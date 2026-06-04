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

const SYSTEM_PROMPT = `Eres un Media Buyer experto en Meta Ads con dominio total de lo que funciona en 2024-2026 para ecommerce latinoamericano. Piensas como performance marketer con foco en ROAS y ventas reales.

CONOCIMIENTO ACTUALIZADO META 2024-2026:
- ASC+ (Advantage+ Shopping) es la estructura que más vende actualmente. Meta optimiza con su IA todo: audiencias, creativos, placements. SIEMPRE recomendarla para ventas.
- Broad targeting (sin intereses) funciona mejor que intereses en el 80% de casos. Meta's AI ya sabe a quién mostrarle.
- ABO para testeo (control total por conjunto). CBO para escalar (Meta distribuye el budget donde convierte).
- Campaña de 1 conjunto con creative testing (3-5 anuncios diferentes) es el setup de testeo más rentable actualmente.
- Estructura ganadora testeo: 1 campaña ABO → 1 conjunto broad + 1 conjunto retargeting si hay pixel con data.
- Estructura escalar: ASC+ con presupuesto diario, dejar correr 7 días mínimo antes de evaluar.
- Copy que vende en LATAM: urgencia real ("Solo hoy", "Últimas unidades"), prueba social ("Miles de clientes"), transformación ("De X a Y en Z días").
- Video > imagen siempre. UGC-style (natural, sin producción) supera video producido en conversiones.
- Para bajo presupuesto (<$15/día): 1 campaña, 1 conjunto broad, 3 anuncios diferentes. No dispersar.
- Para medio presupuesto ($15-50/día): CBO con 2-3 conjuntos + retargeting separado.
- Para alto presupuesto ($50+/día): ASC+ principal + retargeting por separado.
- Evaluación: no cortes antes de 72 horas y $20+ gastados. Deja que salga del learning phase (50 conversiones/semana).
- Intereses cuando usar: nichos muy específicos (fitness extremo, hobbies técnicos). Para productos masivos: BROAD.
- Placements: Advantage+ placements siempre. Reels está convirtiendo muy bien en 2024.
- CTA más efectivos para ventas: SHOP_NOW, LEARN_MORE (para productos que necesitan explicación), SIGN_UP para leads.

REGLAS DE COPY LATAM:
- Usar expresiones locales del país (no traducción literal del español neutro).
- RD: "Bróder", "Brutal", "To' lo día", precios en pesos dominicanos referenciados.
- CO: "Parce", "Bacano", "Chevere".
- MX: "Güey", "Está cañón", "No manches".
- Urgencia sin ser spam: escasez real, beneficio concreto, transformación clara.
- Prueba social cuando aplique: números específicos ("más de 2,000 pedidos").

FORMATO DE RESPUESTA: SOLO JSON válido, sin markdown, sin explicaciones.`;


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
    const scopes = 'ads_management,ads_read,business_management,pages_read_engagement';
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
      campaignMode?: string;
      budgetType?: string;
      angleMode?: string;
      customAngle?: string;
      adSetsCount?: string;
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

    const adSets = parseInt(dto.adSetsCount ?? '1');
    const isABO = dto.budgetType === 'ABO';
    const perSetBudget = isABO ? Math.floor(dto.dailyBudget / adSets) : dto.dailyBudget;
    const isASC = dto.budgetType === 'ASC+';

    const userPrompt = `BRIEF DE CAMPAÑA:
País objetivo: ${countryName}
Producto: ${dto.productName}
Landing page: ${dto.landingPage}
Objetivo: ${dto.campaignType}
Presupuesto diario: $${dto.dailyBudget} USD
Estructura elegida: ${dto.budgetType ?? 'ABO'}${isABO ? ` → $${perSetBudget}/día por conjunto` : isASC ? ' → Advantage+ Shopping, Meta optimiza todo automáticamente' : ''}
Modo: ${dto.campaignMode === 'testeo' ? 'TESTEO — encontrar qué convierte' : 'ESCALAR — maximizar ROAS con lo que funciona'}
Audiencia: ${dto.angleMode === 'broad' ? 'BROAD — sin intereses, algoritmo de Meta optimiza solo' : 'CON INTERESES — audiencia específica por nicho'}
${dto.angleMode === 'custom' && dto.customAngle ? `Ángulo del copy (definido por cliente): ${dto.customAngle}` : 'Ángulo del copy: elige el ángulo más persuasivo y efectivo para vender este producto en ' + countryName}
${dto.excludeCities?.length ? `Ciudades excluidas: ${dto.excludeCities.join(', ')}` : ''}
Número de anuncios a crear: ${files.length}

INSTRUCCIONES ESPECÍFICAS:
- Si es BROAD: targeting sin intereses específicos (array vacío o solo 1-2 muy relevantes).
- Si es ASC+: genera estructura para Advantage+ Shopping Campaign.
- Copy debe usar jerga natural de ${countryName}, no español neutro.
- Genera exactamente ${files.length} objeto(s) en el array "ads".
- Cada anuncio debe tener un ángulo diferente si son múltiples creativos.
- Ángulos que venden: urgencia, transformación, prueba social, miedo a perder, exclusividad.

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
      is_adset_budget_sharing_enabled: false,
    }, token);
    if (campaignRes.error) {
      this.logger.error(`[Meta] Campaign error: ${JSON.stringify(campaignRes.error)}`);
      throw new BadRequestException(`Meta: ${campaignRes.error.message}`);
    }
    const campaignId = campaignRes.id;

    // 2. Create ad set
    const startTime = dto.startTime === 'now'
      ? Math.floor(Date.now() / 1000)
      : Math.floor(new Date(dto.startTime).getTime() / 1000);

    const countryCodeMap: Record<string, string> = {
      RD: 'DO', GT: 'GT', EC: 'EC', CR: 'CR', CO: 'CO',
      MX: 'MX', US: 'US', ES: 'ES', PE: 'PE', CL: 'CL', AR: 'AR',
    };
    const isoCountry = countryCodeMap[dto.country] ?? dto.country;

    // Build safe targeting — resolve real interest IDs from Meta API
    const safeTargeting: any = {
      age_min: aiData.targeting?.age_min ?? 18,
      age_max: aiData.targeting?.age_max ?? 55,
      genders: aiData.targeting?.genders ?? [1, 2],
      geo_locations: { countries: [isoCountry] },
    };
    if (dto.excludeCities?.length) {
      safeTargeting.geo_locations.excluded_geo_locations = {
        cities: dto.excludeCities.map((c: string) => ({ key: c })),
      };
    }

    // If interests requested, resolve real IDs from Meta search API
    const interestNames: string[] = (aiData.targeting?.interests ?? []).map((i: any) => i.name ?? i).filter(Boolean);
    if (interestNames.length > 0 && dto.angleMode !== 'broad') {
      const resolvedInterests: { id: string; name: string }[] = [];
      for (const name of interestNames.slice(0, 5)) {
        try {
          const res = await fetch(
            `${GRAPH}/search?type=adinterest&q=${encodeURIComponent(name)}&limit=1&access_token=${token}`
          ).then(r => r.json()) as any;
          if (res.data?.[0]?.id) resolvedInterests.push({ id: res.data[0].id, name: res.data[0].name });
        } catch { /* skip failed interest */ }
      }
      if (resolvedInterests.length > 0) {
        safeTargeting.interests = resolvedInterests;
      }
    }

    // Map objective → correct optimization goal
    const goalMap: Record<string, string> = {
      OUTCOME_SALES:       'OFFSITE_CONVERSIONS',
      OUTCOME_TRAFFIC:     'LANDING_PAGE_VIEWS',
      OUTCOME_LEADS:       'LEAD_GENERATION',
      OUTCOME_ENGAGEMENT:  'CONVERSATIONS',
      OUTCOME_AWARENESS:   'REACH',
    };
    let optimizationGoal = goalMap[objective] ?? 'LINK_CLICKS';

    // OFFSITE_CONVERSIONS and LEAD_GENERATION require a pixel — fetch first available
    let promotedObject: any = undefined;
    if (optimizationGoal === 'OFFSITE_CONVERSIONS' || optimizationGoal === 'LEAD_GENERATION') {
      try {
        const pixRes = await fetch(
          `${GRAPH}/${adAccountId}/adspixels?fields=id,name&limit=1&access_token=${token}`
        ).then(r => r.json()) as any;
        const pixel = pixRes.data?.[0];
        if (pixel?.id) {
          const eventType = optimizationGoal === 'LEAD_GENERATION' ? 'LEAD' : 'PURCHASE';
          promotedObject = { pixel_id: pixel.id, custom_event_type: eventType };
        } else {
          // No pixel — fall back to traffic-style to avoid Meta API error
          optimizationGoal = optimizationGoal === 'LEAD_GENERATION' ? 'LINK_CLICKS' : 'LANDING_PAGE_VIEWS';
          this.logger.warn('[Meta] No pixel found — falling back to ' + optimizationGoal);
        }
      } catch {
        optimizationGoal = 'LANDING_PAGE_VIEWS';
      }
    }

    const adSetBody: any = {
      name: aiData.adSetName ?? `Conjunto - ${dto.productName}`,
      campaign_id: campaignId,
      daily_budget: Math.round(dto.dailyBudget * 100),
      billing_event: 'IMPRESSIONS',
      optimization_goal: optimizationGoal,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: safeTargeting,
      start_time: startTime,
      status: 'PAUSED',
    };
    if (promotedObject) adSetBody.promoted_object = promotedObject;

    const adSetRes = await this.metaPost(`/${adAccountId}/adsets`, adSetBody, token);
    if (adSetRes.error) {
      this.logger.error(`[Meta] AdSet error: ${JSON.stringify(adSetRes.error)}`);
      throw new BadRequestException(`Meta ad set: ${adSetRes.error.message}`);
    }
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

  // ─── Metrics analysis ────────────────────────────────────────────────────

  async analyzeMetrics(userId: string, fbCampaignId: string, campaignId: string): Promise<{ metrics: any; analysis: string }> {
    const conn = await this.getConnection(userId);
    const dbCampaign = await this.campaignRepo.findOne({ where: { id: campaignId, userId } });

    // Check campaign age
    const ageHours = dbCampaign ? (Date.now() - new Date(dbCampaign.createdAt).getTime()) / 3600000 : 999;
    if (ageHours < 36) {
      return {
        metrics: null,
        analysis: `⏳ Tu campaña tiene menos de 48 horas activa.\n\nNecesitas esperar al menos 1-2 días completos para tener datos significativos. Meta necesita tiempo para salir del learning phase y optimizar las entregas.\n\n**¿Qué puedes hacer ahora?**\n• No toques nada — cada cambio reinicia el aprendizaje\n• Revisa que el pixel esté disparando correctamente\n• Vuelve en ${Math.ceil(48 - ageHours)} horas para un análisis real`,
      };
    }

    // Fetch metrics from Meta
    if (!fbCampaignId) return { metrics: null, analysis: 'Esta campaña no tiene ID de Meta registrado.' };

    const fields = 'spend,impressions,reach,clicks,ctr,cpc,purchase_roas,conversions,frequency,actions,cost_per_action_type';
    const res = await fetch(
      `${GRAPH}/${fbCampaignId}/insights?fields=${fields}&date_preset=last_7d&access_token=${conn.accessToken}`
    ).then(r => r.json()) as any;

    const m = res.data?.[0] ?? {};
    const metrics = {
      spend: m.spend ?? '0',
      roas: m.purchase_roas?.[0]?.value ?? null,
      ctr: m.ctr ?? null,
      cpc: m.cpc ?? null,
      reach: m.reach ?? null,
      impressions: m.impressions ?? null,
      frequency: m.frequency ?? null,
      conversions: m.conversions?.[0]?.value ?? null,
    };

    // Claude analyzes
    const analysisPrompt = `Eres un media buyer experto en Meta Ads. Analiza estas métricas de los últimos 7 días y da recomendaciones ESPECÍFICAS y ACCIONABLES.

Campaña: ${dbCampaign?.name ?? fbCampaignId}
Objetivo: ${dbCampaign?.objective ?? 'desconocido'}
Presupuesto diario: $${dbCampaign?.dailyBudget ?? '?'}/día
País: ${dbCampaign?.country ?? '?'}
Días activa: ~${Math.floor(ageHours / 24)} días

MÉTRICAS:
- Gasto total: $${metrics.spend}
- ROAS: ${metrics.roas ? `${parseFloat(metrics.roas).toFixed(2)}x` : 'Sin datos (sin pixel o sin ventas)'}
- CTR: ${metrics.ctr ? `${parseFloat(metrics.ctr).toFixed(2)}%` : 'N/A'}
- CPC: ${metrics.cpc ? `$${parseFloat(metrics.cpc).toFixed(2)}` : 'N/A'}
- Alcance: ${metrics.reach ?? 'N/A'}
- Frecuencia: ${metrics.frequency ?? 'N/A'}
- Conversiones: ${metrics.conversions ?? '0'}

Responde en español, directo, sin rodeos. Usa emojis para organizar.
Formato:
📊 DIAGNÓSTICO: (qué está pasando con esta campaña)
✅ LO QUE FUNCIONA: (si hay algo positivo)
⚠️ PROBLEMAS DETECTADOS: (qué está mal y por qué)
🎯 ACCIONES INMEDIATAS: (máximo 3 acciones concretas ordenadas por impacto)
⏭️ PRÓXIMO PASO: (qué hacer HOY)`;

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }] as any,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const analysis = response.content[0].type === 'text' ? response.content[0].text : 'Sin análisis disponible.';
    return { metrics, analysis };
  }

  // ─── Scale options ────────────────────────────────────────────────────────

  async getScaleOptions(userId: string, fbCampaignId: string, fbAdSetId: string): Promise<{ options: any[] }> {
    const conn = await this.getConnection(userId);
    const dbCampaign = await this.campaignRepo.findOne({ where: { fbCampaignId, userId } });

    // Get current metrics to personalize recommendations
    let currentBudget = dbCampaign?.dailyBudget ?? 10;
    let roas = 0;
    if (fbAdSetId) {
      const adsetRes = await fetch(`${GRAPH}/${fbAdSetId}?fields=daily_budget&access_token=${conn.accessToken}`).then(r => r.json()) as any;
      if (adsetRes.daily_budget) currentBudget = parseInt(adsetRes.daily_budget) / 100;
    }
    if (fbCampaignId) {
      const metricsRes = await fetch(`${GRAPH}/${fbCampaignId}/insights?fields=purchase_roas,spend&date_preset=last_7d&access_token=${conn.accessToken}`).then(r => r.json()) as any;
      roas = parseFloat(metricsRes.data?.[0]?.purchase_roas?.[0]?.value ?? 0);
    }

    const newBudget20 = Math.round(currentBudget * 1.2 * 100) / 100;
    const newBudget30 = Math.round(currentBudget * 1.3 * 100) / 100;

    const options = [
      {
        type: 'budget_20',
        label: '📈 Escalar presupuesto +20%',
        description: `Aumentar de $${currentBudget}/día a $${newBudget20}/día. La regla de oro: máximo 20-30% cada 3 días. Más que eso reinicia el learning phase.`,
        benefit: 'Escala suave sin reiniciar aprendizaje',
        risk: 'Esperar 72h antes del próximo aumento',
        recommended: roas >= 2,
        params: { newBudget: newBudget20 },
      },
      {
        type: 'budget_30',
        label: '🚀 Escalar presupuesto +30%',
        description: `Aumentar de $${currentBudget}/día a $${newBudget30}/día. Más agresivo. Solo si el ROAS lleva 3+ días estable por encima de 2.5x.`,
        benefit: 'Crecimiento más rápido si ROAS es sólido',
        risk: 'Mayor riesgo de inestabilidad si ROAS no es estable',
        recommended: roas >= 2.5,
        params: { newBudget: newBudget30 },
      },
      {
        type: 'duplicate_adset',
        label: '🔄 Duplicar conjunto ganador',
        description: 'Duplicar el conjunto actual con presupuesto fresco. Cada copia inicia un nuevo learning phase de forma independiente. Permite escalar horizontalmente sin tocar el original.',
        benefit: 'No tocas el conjunto que ya funciona',
        risk: 'Puede haber superposición de audiencias',
        recommended: roas >= 1.5 && currentBudget >= 15,
        params: {},
      },
      {
        type: 'asc_plus',
        label: '🤖 Migrar a ASC+ (Advantage+ Shopping)',
        description: 'Crear nueva campaña ASC+ con el mismo presupuesto. La IA de Meta toma control total: audiencias, placements y creativos. Es la estructura que más convierte en ecommerce en 2024.',
        benefit: 'El algoritmo de Meta optimiza todo automáticamente',
        risk: 'Perdes control granular del targeting',
        recommended: currentBudget >= 30,
        params: {},
      },
      {
        type: 'broad_targeting',
        label: '🌐 Ampliar a audiencia broad',
        description: 'Quitar restricciones de intereses y abrir a audiencia amplia. En 2024, el algoritmo de Meta supera a los intereses manuales en la mayoría de productos masivos.',
        benefit: 'Mayor volumen, más datos para el algoritmo',
        risk: 'Necesita ~$5 de gasto para calibrar',
        recommended: false,
        params: {},
      },
    ].sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));

    return { options };
  }

  // ─── Scale execute ────────────────────────────────────────────────────────

  async executeScale(userId: string, fbCampaignId: string, fbAdSetId: string, scaleType: string, params: any): Promise<{ success: boolean; details: string }> {
    const conn = await this.getConnection(userId);
    const token = conn.accessToken;

    switch (scaleType) {
      case 'budget_20':
      case 'budget_30': {
        const newBudgetCents = Math.round(params.newBudget * 100);
        const res = await fetch(`${GRAPH}/${fbAdSetId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ daily_budget: newBudgetCents, access_token: token }),
        }).then(r => r.json()) as any;
        if (res.error) throw new BadRequestException(res.error.message);
        return { success: true, details: `Presupuesto actualizado a $${params.newBudget}/día.\n\nNo hagas otro cambio en las próximas 72 horas. Deja que Meta re-aprenda con el nuevo budget.` };
      }

      case 'duplicate_adset': {
        const res = await fetch(`${GRAPH}/${fbAdSetId}/copies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: fbCampaignId, access_token: token }),
        }).then(r => r.json()) as any;
        if (res.error) throw new BadRequestException(res.error.message);
        return { success: true, details: `Conjunto duplicado correctamente (ID: ${res.ad_object_ids?.[0]?.copied_id ?? 'nuevo'}).\n\nEl original sigue activo. El duplicado empieza su propio learning phase.\n\nDeja ambos correr por 3-5 días antes de comparar resultados.` };
      }

      case 'asc_plus': {
        const dbCampaign = await this.campaignRepo.findOne({ where: { fbCampaignId, userId } });
        const budget = dbCampaign?.dailyBudget ?? 10;
        const res = await this.metaPost(`/${conn.adAccountId}/campaigns`, {
          name: `ASC+ ${dbCampaign?.name ?? 'Campaña'} - Escalado`,
          objective: 'OUTCOME_SALES',
          status: 'PAUSED',
          special_ad_categories: [],
          smart_promotion_type: 'GUIDED_CREATION',
        }, token);
        if (res.error) throw new BadRequestException(res.error.message);
        return { success: true, details: `Campaña ASC+ creada (ID: ${res.id}) en estado PAUSADA.\n\nPróximos pasos:\n1. Ve a Meta Ads Manager\n2. Agrega tus creativos a la nueva campaña ASC+\n3. Actívala y monitorea vs. la campaña original\n4. En 7 días compara ROAS y decide cuál escalar.` };
      }

      case 'broad_targeting': {
        const res = await fetch(`${GRAPH}/${fbAdSetId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targeting: { age_min: 18, age_max: 65, genders: [1, 2], geo_locations: { countries: ['DO'] } }, access_token: token }),
        }).then(r => r.json()) as any;
        if (res.error) throw new BadRequestException(res.error.message);
        return { success: true, details: `Targeting ampliado a audiencia broad.\n\nEl conjunto ahora mostrará a todas las personas de 18-65 años. El algoritmo de Meta decidirá a quién mostrar basándose en el comportamiento del pixel.\n\nEspera 3-5 días para evaluar el impacto.` };
      }

      default:
        throw new BadRequestException('Tipo de escalado no reconocido');
    }
  }

  async getCampaignMetrics(userId: string): Promise<any[]> {
    const conn = await this.connectionRepo.findOne({ where: { userId, isActive: true } });
    if (!conn?.adAccountId) return [];
    const fields = 'campaign_name,spend,impressions,reach,clicks,ctr,cpc,purchase_roas,conversions';
    const res = await fetch(
      `${GRAPH}/${conn.adAccountId}/insights?fields=${fields}&date_preset=last_7d&level=campaign&access_token=${conn.accessToken}`
    ).then(r => r.json()) as any;
    if (res.error) return [];
    return res.data ?? [];
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getConnection(userId: string): Promise<MetaConnection> {
    const conn = await this.connectionRepo.findOne({ where: { userId, isActive: true } });
    if (!conn) throw new NotFoundException('Conecta tu cuenta de Facebook primero');
    return conn;
  }
}
