import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { toDataURL } from 'qrcode';
import { ShopifyStore } from './entities/shopify-store.entity';

interface WaSession {
  status: 'disconnected' | 'connecting' | 'qr' | 'connected';
  qrDataUrl?: string;
  sock?: any;
  retryCount: number;
}

@Injectable()
export class WhatsappService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private sessions = new Map<string, WaSession>();
  private sessionsDir: string;

  constructor(
    private config: ConfigService,
    @InjectRepository(ShopifyStore)
    private storeRepo: Repository<ShopifyStore>,
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
    } catch (err: any) {
      this.logger.error(`[WA] Error init session ${storeId}: ${err.message}`);
      this.sessions.set(storeId, { status: 'disconnected', retryCount: 0 });
    }
  }

  getStatus(storeId: string): { status: string; qr?: string } {
    const session = this.sessions.get(storeId);
    if (!session) return { status: 'disconnected' };
    return { status: session.status, qr: session.qrDataUrl };
  }

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
