import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import * as crypto from 'crypto';
import { MetaConnection } from './entities/meta-connection.entity';
import { MetaCampaign } from './entities/meta-campaign.entity';
import { User } from '../users/user.entity';

const GRAPH = 'https://graph.facebook.com/v19.0';

const SYSTEM_PROMPT = `Eres un experto en Meta Ads con 10 años de experiencia en ecommerce latinoamericano.
Analizas el creativo (imagen/video) y los datos del producto para generar una campaña profesional.
SIEMPRE usas la jerga y expressions del país especificado.
SIEMPRE devuelves JSON válido sin markdown ni explicaciones adicionales.
Para testeo: ABO, presupuesto dividido equitativamente entre conjuntos.
Intereses: específicos y relevantes, evita intereses genéricos.
Copy: directo, persuasivo, con urgencia. Máximo 125 caracteres para texto principal.
Título: máximo 40 caracteres. CTA: acción concreta.`;

@Injectable()
export class MetaAdsService {
  private readonly logger = new Logger(MetaAdsService.name);
  private anthropic: Anthropic;

  constructor(
    private config: ConfigService,
    @InjectRepository(MetaConnection)
    private connectionRepo: Repository<MetaConnection>,
    @InjectRepository(MetaCampaign)
    private campaignRepo: Repository<MetaCampaign>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {
    this.anthropic = new Anthropic({ apiKey: this.config.get('CLAUDE_API_KEY') });
  }

  // ─── OAuth ───────────────────────────────────────────────────────────────

  getAuthUrl(userId: string): string {
    const appId = this.config.get('META_APP_ID');
    const redirectUri = this.config.get('META_REDIRECT_URI');
    const scopes = 'ads_management,ads_read,business_management,pages_read_engagement,email';
    const state = Buffer.from(userId).toString('base64');
    return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;
  }

  async handleCallback(code: string, state: string): Promise<string> {
    const userId = Buffer.from(state, 'base64').toString('utf8');
    const appId = this.config.get('META_APP_ID');
    const appSecret = this.config.get('META_APP_SECRET');
    const redirectUri = this.config.get('META_REDIRECT_URI');

    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    ).then(r => r.json()) as any;

    if (tokenRes.error) throw new BadRequestException(tokenRes.error.message);

    const llRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenRes.access_token}`
    ).then(r => r.json()) as any;

    const longToken = llRes.access_token ?? tokenRes.access_token;
    const expiresIn = llRes.expires_in ?? 5184000;

    const meRes = await fetch(`${GRAPH}/me?fields=id,name&access_token=${longToken}`).then(r => r.json()) as any;

    let conn = await this.connectionRepo.findOne({ where: { userId } });
    if (!conn) conn = this.connectionRepo.create({ userId });
    conn.fbUserId = meRes.id;
    conn.accessToken = longToken;
    conn.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    conn.isActive = true;
    await this.connectionRepo.save(conn);

    return userId;
  }

  // ─── Ad accounts ─────────────────────────────────────────────────────────

  async getAdAccounts(userId: string): Promise<any[]> {
    const conn = await this.getConnection(userId);
    const res = await fetch(
      `${GRAPH}/me/adaccounts?fields=id,name,account_status,currency&access_token=${conn.accessToken}`
    ).then(r => r.json()) as any;
    if (res.error) throw new BadRequestException(res.error.message);
    return res.data ?? [];
  }

  async selectAdAccount(userId: string, adAccountId: string, adAccountName: string): Promise<void> {
    const conn = await this.getConnection(userId);
    conn.adAccountId = adAccountId;
    conn.adAccountName = adAccountName;
    await this.connectionRepo.save(conn);
  }

  async getPages(userId: string): Promise<any[]> {
    const conn = await this.getConnection(userId);
    const res = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,access_token&access_token=${conn.accessToken}`
    ).then(r => r.json()) as any;
    if (res.error) throw new BadRequestException(res.error.message);
    return res.data ?? [];
  }

  async selectPage(userId: string, pageId: string, pageName: string): Promise<void> {
    const conn = await this.getConnection(userId);
    conn.pageId = pageId;
    conn.pageName = pageName;
    await this.connectionRepo.save(conn);
  }

  // ─── Status ──────────────────────────────────────────────────────────────

  async getStatus(userId: string): Promise<{ connected: boolean; adAccountId?: string; adAccountName?: string; pageId?: string; pageName?: string; credits: number }> {
    const conn = await this.connectionRepo.findOne({ where: { userId, isActive: true } });
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const credits = (user as any)?.metaCredits ?? 0;
    if (!conn) return { connected: false, credits };
    return {
      connected: true,
      adAccountId: conn.adAccountId ?? undefined,
      adAccountName: conn.adAccountName ?? undefined,
      pageId: conn.pageId ?? undefined,
      pageName: conn.pageName ?? undefined,
      credits,
    };
  }

  async disconnect(userId: string): Promise<void> {
    const conn = await this.connectionRepo.findOne({ where: { userId } });
    if (!conn) throw new NotFoundException('No hay conexión activa');
    conn.isActive = false;
    conn.accessToken = '';
    await this.connectionRepo.save(conn);
  }

  // ─── Campaign creation ────────────────────────────────────────────────────

  async createCampaign(
    userId: string,
    dto: {
      campaignType: string;
      productName: string;
      landingPage: string;
      country: string;
      excludeCities: string[];
      dailyBudget: number;
      startTime: string;
    },
    files: Express.Multer.File[],
  ): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const credits = (user as any).metaCredits ?? 0;
    if (credits < 1) throw new ForbiddenException('Sin créditos. Recarga para continuar.');

    const conn = await this.getConnection(userId);
    if (!conn.adAccountId) throw new BadRequestException('Selecciona una cuenta publicitaria primero');
    if (!conn.pageId) throw new BadRequestException('Selecciona una página de Facebook primero');

    if (!files || files.length === 0) throw new BadRequestException('Sube al menos un anuncio');

    // Generate campaign structure with Claude
    const aiResult = await this.generateWithClaude(files, dto);

    // Create campaign on Meta
    const metaResult = await this.createOnMeta(conn, dto, aiResult, files);

    // Deduct credit
    await this.userRepo.update(userId, { metaCredits: credits - 1 } as any);

    // Save to DB
    const campaign = this.campaignRepo.create({
      userId,
      metaConnectionId: conn.id,
      fbCampaignId: metaResult.campaignId,
      fbAdSetId: metaResult.adSetId,
      name: aiResult.campaignName,
      objective: dto.campaignType,
      status: 'PAUSED',
      dailyBudget: dto.dailyBudget,
      country: dto.country,
      aiData: JSON.stringify(aiResult),
    });
    await this.campaignRepo.save(campaign);

    return { success: true, campaign: metaResult, aiData: aiResult };
  }

  // ─── Claude ──────────────────────────────────────────────────────────────

  private async generateWithClaude(files: Express.Multer.File[], dto: any): Promise<any> {
    const imageContents: any[] = [];

    for (const file of files.slice(0, 5)) {
      if (file.mimetype.startsWith('image/')) {
        imageContents.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.mimetype as any,
            data: file.buffer.toString('base64'),
          },
        });
      } else if (file.mimetype.startsWith('video/')) {
        // For video, skip image analysis - use product info only
        this.logger.log('[MetaAds] Video detected, using product info for copy generation');
      }
    }

    const countryNames: Record<string, string> = {
      RD: 'República Dominicana', GT: 'Guatemala', EC: 'Ecuador',
      CR: 'Costa Rica', CO: 'Colombia', MX: 'México', US: 'Estados Unidos',
      ES: 'España', PE: 'Perú', CL: 'Chile', AR: 'Argentina',
    };
    const countryName = countryNames[dto.country] || dto.country;

    const userPrompt = `País objetivo: ${countryName}
Producto: ${dto.productName}
Landing page: ${dto.landingPage}
Tipo de campaña: ${dto.campaignType}
Presupuesto diario: $${dto.dailyBudget} USD
${dto.excludeCities?.length ? `Ciudades excluidas: ${dto.excludeCities.join(', ')}` : ''}
Número de anuncios: ${files.length}

Genera la estructura completa de campaña. Devuelve SOLO este JSON:
{
  "campaignName": "nombre de la campaña",
  "adSetName": "nombre del conjunto",
  "targeting": {
    "age_min": 18,
    "age_max": 55,
    "genders": [1, 2],
    "interests": [{"id": "6003139266461", "name": "Shopping"}, ...],
    "geo_locations": {
      "countries": ["${dto.country === 'RD' ? 'DO' : dto.country === 'GT' ? 'GT' : dto.country === 'EC' ? 'EC' : dto.country === 'CR' ? 'CR' : dto.country === 'CO' ? 'CO' : dto.country}"]
      ${dto.excludeCities?.length ? `,"excluded_geo_locations": {"cities": [${dto.excludeCities.map((c: string) => `{"key": "${c}"}`).join(',')}]}` : ''}
    }
  },
  "ads": [
    {
      "name": "Anuncio 1",
      "primaryText": "copy principal aquí (max 125 chars)",
      "headline": "titular aquí (max 40 chars)",
      "description": "descripción corta",
      "callToAction": "SHOP_NOW"
    }
  ]
}
Genera ${files.length} objeto(s) en el array "ads", uno por cada creativo.
Usa jerga natural de ${countryName}. Los intereses deben ser IDs reales de Meta.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }] as any,
      messages: [{
        role: 'user',
        content: [
          ...imageContents,
          { type: 'text', text: userPrompt },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      throw new BadRequestException('Error generando estructura con IA. Intenta de nuevo.');
    }
  }

  // ─── Meta API ─────────────────────────────────────────────────────────────

  private async createOnMeta(conn: MetaConnection, dto: any, aiData: any, files: Express.Multer.File[]): Promise<any> {
    const token = conn.accessToken;
    const adAccountId = conn.adAccountId;
    const pageId = conn.pageId;

    const objectiveMap: Record<string, string> = {
      VENTAS: 'OUTCOME_SALES',
      TRAFICO: 'OUTCOME_TRAFFIC',
      LEADS: 'OUTCOME_LEADS',
      MENSAJES: 'OUTCOME_ENGAGEMENT',
      RECONOCIMIENTO: 'OUTCOME_AWARENESS',
    };
    const objective = objectiveMap[dto.campaignType] ?? 'OUTCOME_SALES';

    // 1. Create campaign
    const campaignRes = await this.metaPost(`/${adAccountId}/campaigns`, {
      name: aiData.campaignName ?? `${dto.productName} - ${dto.country}`,
      objective,
      status: 'PAUSED',
      special_ad_categories: [],
    }, token);
    if (campaignRes.error) throw new BadRequestException(`Meta: ${campaignRes.error.message}`);
    const campaignId = campaignRes.id;

    // 2. Create ad set
    const startTime = dto.startTime === 'now'
      ? Math.floor(Date.now() / 1000)
      : Math.floor(new Date(dto.startTime).getTime() / 1000);

    const adSetRes = await this.metaPost(`/${adAccountId}/adsets`, {
      name: aiData.adSetName ?? `Conjunto - ${dto.productName}`,
      campaign_id: campaignId,
      daily_budget: Math.round(dto.dailyBudget * 100),
      billing_event: 'IMPRESSIONS',
      optimization_goal: objective === 'OUTCOME_SALES' ? 'OFFSITE_CONVERSIONS' : 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: aiData.targeting,
      start_time: startTime,
      status: 'PAUSED',
    }, token);
    if (adSetRes.error) throw new BadRequestException(`Meta ad set: ${adSetRes.error.message}`);
    const adSetId = adSetRes.id;

    // 3. Create ads (one per creative)
    const adIds: string[] = [];
    const ads = aiData.ads ?? [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const adCopy = ads[i] ?? ads[0] ?? {};

      let creativeId: string;

      if (file.mimetype.startsWith('image/')) {
        // Upload image
        const imgRes = await this.metaPost(`/${adAccountId}/adimages`, {
          bytes: file.buffer.toString('base64'),
        }, token);
        if (imgRes.error) { this.logger.warn(`Image upload error: ${imgRes.error.message}`); continue; }
        const imgHash = Object.values(imgRes.images as Record<string, any>)[0]?.hash;

        // Create creative
        const creativeRes = await this.metaPost(`/${adAccountId}/adcreatives`, {
          name: adCopy.name ?? `Creativo ${i + 1}`,
          object_story_spec: {
            page_id: pageId,
            link_data: {
              image_hash: imgHash,
              link: dto.landingPage,
              message: adCopy.primaryText ?? '',
              name: adCopy.headline ?? dto.productName,
              description: adCopy.description ?? '',
              call_to_action: { type: adCopy.callToAction ?? 'SHOP_NOW', value: { link: dto.landingPage } },
            },
          },
        }, token);
        if (creativeRes.error) { this.logger.warn(`Creative error: ${creativeRes.error.message}`); continue; }
        creativeId = creativeRes.id;
      } else {
        // Video upload
        const vidRes = await this.metaPost(`/${adAccountId}/advideos`, {
          source: file.buffer.toString('base64'),
          title: dto.productName,
        }, token);
        if (vidRes.error) { this.logger.warn(`Video upload error: ${vidRes.error.message}`); continue; }

        const creativeRes = await this.metaPost(`/${adAccountId}/adcreatives`, {
          name: adCopy.name ?? `Creativo video ${i + 1}`,
          object_story_spec: {
            page_id: pageId,
            video_data: {
              video_id: vidRes.id,
              message: adCopy.primaryText ?? '',
              title: adCopy.headline ?? dto.productName,
              call_to_action: { type: adCopy.callToAction ?? 'SHOP_NOW', value: { link: dto.landingPage } },
            },
          },
        }, token);
        if (creativeRes.error) { this.logger.warn(`Creative video error: ${creativeRes.error.message}`); continue; }
        creativeId = creativeRes.id;
      }

      // Create ad
      const adRes = await this.metaPost(`/${adAccountId}/ads`, {
        name: adCopy.name ?? `Anuncio ${i + 1}`,
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status: 'PAUSED',
      }, token);
      if (!adRes.error) adIds.push(adRes.id);
    }

    return { campaignId, adSetId, adIds };
  }

  private async metaPost(path: string, body: any, token: string): Promise<any> {
    const res = await fetch(`${GRAPH}${path}?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // ─── Campaigns list ───────────────────────────────────────────────────────

  async getCampaigns(userId: string): Promise<MetaCampaign[]> {
    return this.campaignRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getConnection(userId: string): Promise<MetaConnection> {
    const conn = await this.connectionRepo.findOne({ where: { userId, isActive: true } });
    if (!conn) throw new NotFoundException('Conecta tu cuenta de Facebook primero');
    return conn;
  }
}
