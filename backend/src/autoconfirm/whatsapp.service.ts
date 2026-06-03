import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { toDataURL } from 'qrcode';
import { ShopifyStore } from './entities/shopify-store.entity';
import { OrderLog } from './entities/order-log.entity';

interface WaSession {
  status: 'disconnected' | 'connecting' | 'qr' | 'connected';
  qrDataUrl?: string;
  sock?: any;
  retryCount: number;
  labels?: Array<{ id: string; name: string; color: number }>;
}

const AUDIO_DIR = '/opt/winnerdrop/audios';

interface PendingConfirmation {
  logId: string;
  shopifyOrderId: string;
  shopDomain: string;
  accessToken: string;
  storeId: string;
  expiresAt: number;
  confirmMessage: string;
  cancelMessage: string;
  labelPendingId?: string;
  labelConfirmedId?: string;
  labelCancelledId?: string;
  audioConfirmMode?: string;
  audioCancelMode?: string;
  pollMessage?: any;
}

@Injectable()
export class WhatsappService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private sessions = new Map<string, WaSession>();
  private sessionsDir: string;
  // phone jid → pending confirmation
  private pending = new Map<string, PendingConfirmation>();
  // poll message id → pending confirmation (handles @lid JID mismatches)
  private pendingByPollId = new Map<string, PendingConfirmation>();

  constructor(
    private config: ConfigService,
    @InjectRepository(ShopifyStore)
    private storeRepo: Repository<ShopifyStore>,
    @InjectRepository(OrderLog)
    private logRepo: Repository<OrderLog>,
  ) {
    this.sessionsDir = this.config.get<string>('WA_SESSIONS_DIR', '/opt/winnerdrop/whatsapp-sessions');
    this.restoreActiveSessions();
  }

  private async restoreActiveSessions() {
    try {
      const stores = await this.storeRepo.find({ where: { isActive: true } });
      for (const store of stores) {
        const sessionPath = path.join(this.sessionsDir, store.id);
        if (fs.existsSync(sessionPath) && fs.readdirSync(sessionPath).length > 0) {
          this.logger.log(`[WA] Restaurando sesión: ${store.shopDomain}`);
          await this.initSession(store.id).catch(err =>
            this.logger.warn(`[WA] No se pudo restaurar ${store.id}: ${err.message}`)
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`[WA] Error restaurando sesiones: ${err.message}`);
    }
  }

  async initSession(storeId: string): Promise<void> {
    if (this.sessions.get(storeId)?.status === 'connected') return;

    this.sessions.set(storeId, { status: 'connecting', retryCount: 0 });

    const sessionPath = path.join(this.sessionsDir, storeId);
    fs.mkdirSync(sessionPath, { recursive: true });

    try {
      const baileys = await import('@whiskeysockets/baileys');
      const { state, saveCreds } = await baileys.useMultiFileAuthState(sessionPath);
      const { version } = await baileys.fetchLatestBaileysVersion();

      const sock = baileys.default({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: { level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({ level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) as any }) } as any,
        browser: ['Momentum Bot', 'Chrome', '120.0'],
      });

      const session = this.sessions.get(storeId)!;
      session.sock = sock;

      sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        const s = this.sessions.get(storeId);
        if (!s) return;

        if (qr) {
          s.status = 'qr';
          s.qrDataUrl = await toDataURL(qr, { width: 300 }).catch(() => '');
          this.logger.log(`[WA] QR generado para ${storeId}`);
        }

        if (connection === 'open') {
          s.status = 'connected';
          s.qrDataUrl = undefined;
          s.retryCount = 0;
          this.logger.log(`[WA] Conectado: ${storeId}`);
        }

        if (connection === 'close') {
          const code = (lastDisconnect?.error as any)?.output?.statusCode;
          const loggedOut = code === 401 || code === 440;
          this.logger.warn(`[WA] Desconectado ${storeId} (code: ${code})`);

          if (loggedOut) {
            s.status = 'disconnected';
            s.sock = undefined;
            this.clearSessionFiles(storeId);
          } else if (s.retryCount < 3) {
            s.retryCount++;
            s.status = 'connecting';
            setTimeout(() => this.initSession(storeId), 5000);
          } else {
            s.status = 'disconnected';
            s.sock = undefined;
          }
        }
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('labels.edit', (label: any) => {
        const s = this.sessions.get(storeId);
        if (!s) return;
        if (!s.labels) s.labels = [];
        const idx = s.labels.findIndex(l => l.id === String(label.id));
        const entry = { id: String(label.id), name: label.name, color: label.color };
        if (label.deleted) {
          if (idx >= 0) s.labels.splice(idx, 1);
        } else if (idx >= 0) {
          s.labels[idx] = entry;
        } else {
          s.labels.push(entry);
        }
      });

      sock.ev.on('messages.upsert', async ({ messages }: any) => {
        for (const msg of messages) {
          const jid = msg.key?.remoteJid;
          if (!msg.message || !jid) continue;

          // Poll vote — look up by pollCreationMessageKey.id (vote arrives with @lid, not phone JID)
          const pollVote = msg.message?.pollUpdateMessage;
          if (pollVote) {
            const creationMsgId: string | undefined = pollVote.pollCreationMessageKey?.id;
            const pendingByPoll = creationMsgId ? this.pendingByPollId.get(creationMsgId) : undefined;
            const pendingEntry: PendingConfirmation | undefined = pendingByPoll ?? this.pending.get(jid);

            if (!pendingEntry) { continue; }
            if (Date.now() > pendingEntry.expiresAt) {
              if (creationMsgId) this.pendingByPollId.delete(creationMsgId);
              continue;
            }

            try {
              const b = await import('@whiskeysockets/baileys');
              const pollEncKey: Buffer | Uint8Array | undefined =
                pendingEntry.pollMessage?.message?.pollCreationMessageV3?.encKey ??
                pendingEntry.pollMessage?.message?.messageContextInfo?.messageSecret;
              const pollMsgId: string | undefined = pendingEntry.pollMessage?.key?.id;
              // WhatsApp phone uses LID (not normalized phone JID) for key derivation
              const pollCreatorJid: string = b.jidNormalizedUser((sock.user as any)?.lid || sock.user?.id || '');
              const voterJid: string = b.jidNormalizedUser(jid);

              if (!pollEncKey || !pollMsgId) {
                this.logger.warn('[WA] Faltan datos del poll original');
                continue;
              }

              const decrypted = b.decryptPollVote(pollVote.vote, { pollEncKey, pollCreatorJid, pollMsgId, voterJid });
              const selected: Uint8Array[] = decrypted.selectedOptions ?? [];
              if (selected.length === 0) continue;

              const sha256 = (s: string) => require('crypto').createHash('sha256').update(s, 'utf8').digest();
              const isConfirm = selected.some((h: any) => Buffer.from(h).equals(sha256('✅ Confirmar Pedido')));
              const isCancel = selected.some((h: any) => Buffer.from(h).equals(sha256('❌ Cancelar Pedido')));

              const replyJid = pendingEntry.pollMessage?.key?.remoteJid || jid;
              const phoneJid = pendingEntry.pollMessage?.key?.remoteJid;
              if (isConfirm) {
                this.logger.log(`[WA] Confirmado: ${pendingEntry.shopifyOrderId}`);
                await this.markOrderConfirmed(pendingEntry, sock, replyJid);
                if (creationMsgId) this.pendingByPollId.delete(creationMsgId);
                if (phoneJid) this.pending.delete(phoneJid);
              } else if (isCancel) {
                this.logger.log(`[WA] Cancelado: ${pendingEntry.shopifyOrderId}`);
                await this.cancelShopifyOrder(pendingEntry, sock, replyJid);
                if (creationMsgId) this.pendingByPollId.delete(creationMsgId);
                if (phoneJid) this.pending.delete(phoneJid);
              }
            } catch (err: any) {
              this.logger.warn(`[WA] Error descifrando voto: ${err.message}`);
            }
            continue;
          }

          // Fallback: plain text reply (JID-based lookup)
          const pending = this.pending.get(jid);
          if (!pending || Date.now() > pending.expiresAt) {
            this.pending.delete(jid);
            continue;
          }
          if (msg.key.fromMe) continue;
          const textBody = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase().trim();
          const isConfirm = textBody.includes('confirmar') || textBody === '1' || textBody === 'si' || textBody === 'sí';
          const isCancel = textBody.includes('cancelar') || textBody === '2' || textBody === 'no';

          if (isConfirm) {
            this.logger.log(`[WA] Texto confirmado: ${pending.shopifyOrderId}`);
            await this.markOrderConfirmed(pending, sock, jid);
            this.pending.delete(jid);
          } else if (isCancel) {
            this.logger.log(`[WA] Texto cancelado: ${pending.shopifyOrderId}`);
            await this.cancelShopifyOrder(pending, sock, jid);
            this.pending.delete(jid);
          }
        }
      });

    } catch (err: any) {
      this.logger.error(`[WA] Error init session ${storeId}: ${err.message}`);
      this.sessions.set(storeId, { status: 'disconnected', retryCount: 0 });
    }
  }

  private async sendAudio(sock: any, jid: string, filename: string): Promise<void> {
    try {
      const audioPath = path.join(AUDIO_DIR, filename);
      if (!fs.existsSync(audioPath)) {
        this.logger.warn(`[WA] Audio no encontrado: ${audioPath}`);
        return;
      }
      await sock.sendMessage(jid, {
        audio: { url: audioPath },
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      });
    } catch (err: any) {
      this.logger.warn(`[WA] Error enviando audio: ${err.message}`);
    }
  }

  private async markOrderConfirmed(p: PendingConfirmation, sock: any, jid: string) {
    await this.logRepo.update(p.logId, { confirmationStatus: 'confirmed' });
    await fetch(`https://${p.shopDomain}/admin/api/2025-01/orders/${p.shopifyOrderId}.json`, {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': p.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: { id: p.shopifyOrderId, tags: 'confirmed-whatsapp' } }),
    }).catch(() => null);
    if (p.audioConfirmMode === 'audio') {
      await this.sendAudio(sock, jid, 'confirmacion.ogg');
    } else {
      const txt = p.confirmMessage || '✅ ¡Perfecto! Tu pedido ha sido confirmado. Pronto te llegará. 🚀';
      await sock.sendMessage(jid, { text: txt }).catch(() => null);
    }
    await this.swapChatLabel(p.storeId, jid, p.labelPendingId, p.labelConfirmedId);
  }

  private async cancelShopifyOrder(p: PendingConfirmation, sock: any, jid: string) {
    await this.logRepo.update(p.logId, { confirmationStatus: 'cancelled' });
    const res = await fetch(`https://${p.shopDomain}/admin/api/2025-01/orders/${p.shopifyOrderId}/cancel.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': p.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'customer' }),
    });
    if (p.audioCancelMode === 'audio') {
      await this.sendAudio(sock, jid, 'cancelacion.ogg');
    } else {
      const txt = p.cancelMessage || '❌ Tu pedido ha sido cancelado. Si tienes dudas escríbenos. 😊';
      await sock.sendMessage(jid, { text: txt }).catch(() => null);
    }
    await this.swapChatLabel(p.storeId, jid, p.labelPendingId, p.labelCancelledId);
    if (res.ok) {
      this.logger.log(`[WA] Orden cancelada en Shopify: ${p.shopifyOrderId}`);
    } else {
      this.logger.warn(`[WA] Error cancelando en Shopify: ${res.status}`);
    }
  }

  getStatus(storeId: string): { status: string; qr?: string } {
    const session = this.sessions.get(storeId);
    if (!session) return { status: 'disconnected' };
    return { status: session.status, qr: session.qrDataUrl };
  }

  async sendOrderConfirmation(
    storeId: string,
    phone: string,
    message: string,
    logId: string,
    shopifyOrderId: string,
    shopDomain: string,
    accessToken: string,
    confirmMessage = '',
    cancelMessage = '',
    labelPendingId?: string,
    labelConfirmedId?: string,
    labelCancelledId?: string,
    audioInitialMode = 'text_only',
    audioConfirmMode = 'text',
    audioCancelMode = 'text',
  ): Promise<void> {
    const session = this.sessions.get(storeId);
    if (!session?.sock || session.status !== 'connected') {
      throw new Error('WhatsApp no conectado');
    }

    const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net';

    this.pending.set(jid, {
      logId,
      shopifyOrderId,
      shopDomain,
      accessToken,
      storeId,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      confirmMessage,
      cancelMessage,
      labelPendingId,
      labelConfirmedId,
      labelCancelledId,
      audioConfirmMode,
      audioCancelMode,
    });

    // Send poll; save returned message so votes can be decrypted later
    const sentMsg = await session.sock.sendMessage(jid, {
      poll: {
        name: message,
        values: ['✅ Confirmar Pedido', '❌ Cancelar Pedido'],
        selectableCount: 1,
      },
    });

    const entry = this.pending.get(jid);
    if (entry && sentMsg) {
      entry.pollMessage = sentMsg;
      const pollId = sentMsg.key?.id;
      if (pollId) this.pendingByPollId.set(pollId, entry);
      this.logger.log(`[WA] Poll enviado id=${pollId}`);
    }

    if (audioInitialMode === 'text_and_audio') {
      await this.sendAudio(session.sock, jid, 'audio1.ogg');
    }

    if (labelPendingId) {
      await this.addChatLabel(storeId, jid, labelPendingId);
    }
  }

  getSessionLabels(storeId: string): Array<{ id: string; name: string; color: number }> {
    return this.sessions.get(storeId)?.labels ?? [];
  }

  async addChatLabel(storeId: string, jid: string, labelId: string): Promise<void> {
    const session = this.sessions.get(storeId);
    if (!session?.sock || session.status !== 'connected') return;
    await session.sock.addChatLabel(jid, labelId).catch((e: any) =>
      this.logger.warn(`[WA] addChatLabel failed: ${e.message}`),
    );
  }

  async removeChatLabel(storeId: string, jid: string, labelId: string): Promise<void> {
    const session = this.sessions.get(storeId);
    if (!session?.sock || session.status !== 'connected') return;
    await session.sock.removeChatLabel(jid, labelId).catch((e: any) =>
      this.logger.warn(`[WA] removeChatLabel failed: ${e.message}`),
    );
  }

  async swapChatLabel(storeId: string, jid: string, removeId: string | null | undefined, addId: string | null | undefined): Promise<void> {
    if (removeId) await this.removeChatLabel(storeId, jid, removeId);
    if (addId) await this.addChatLabel(storeId, jid, addId);
  }

  // Legacy plain text send (kept for compatibility)
  async sendMessage(storeId: string, phone: string, message: string): Promise<void> {
    const session = this.sessions.get(storeId);
    if (!session?.sock || session.status !== 'connected') {
      throw new Error('WhatsApp no conectado');
    }
    const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net';
    await session.sock.sendMessage(jid, { text: message });
  }

  async disconnect(storeId: string): Promise<void> {
    const session = this.sessions.get(storeId);
    if (session?.sock) {
      await session.sock.logout().catch(() => null);
    }
    this.sessions.delete(storeId);
    this.clearSessionFiles(storeId);
  }

  private clearSessionFiles(storeId: string) {
    const sessionPath = path.join(this.sessionsDir, storeId);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  }

  onModuleDestroy() {
    for (const [, session] of this.sessions) {
      session.sock?.end?.();
    }
  }
}
