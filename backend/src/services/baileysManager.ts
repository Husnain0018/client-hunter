import {
  DisconnectReason,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  makeWASocket,
  proto,
  type ConnectionState,
  type WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import EventEmitter from 'node:events';
import pino from 'pino';
import type { Database } from '../db/database.js';
import type {
  BaileysAccountInfo,
  BaileysConnectionState,
  BaileysStatusInfo,
  WhatsAppStatus,
} from '../types/domain.js';
import { hasSavedSession, initPersistentAuthState } from './baileysAuthState.js';

const pinoLogger = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'warn' });

export type IncomingMessageHandler = (msg: {
  id: string;
  from: string;
  rawJid: string;
  text: string;
  timestamp: string;
}) => Promise<void>;

const MAX_RECONNECT_ATTEMPTS = 6;

export class BaileysManager {
  private static instance: BaileysManager | null = null;

  private state: BaileysConnectionState = 'not_connected';
  private qr: string | null = null;
  private account: BaileysAccountInfo | null = null;
  private error: string | null = null;
  private reconnectAttempts = 0;
  private lastConnectedAt: string | null = null;

  private sock: WASocket | null = null;
  private connectingPromise: Promise<BaileysStatusInfo> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private intentionalDisconnect = false;

  private clearAuthFn: (() => void) | null = null;
  private messageHandler: IncomingMessageHandler | null = null;

  readonly events = new EventEmitter();

  constructor(private readonly db: Database) {
    this.events.setMaxListeners(100);
    if (hasSavedSession()) {
      this.state = 'disconnected';
    }
  }

  static getInstance(db: Database): BaileysManager {
    if (!BaileysManager.instance) {
      BaileysManager.instance = new BaileysManager(db);
    }
    return BaileysManager.instance;
  }

  setMessageHandler(handler: IncomingMessageHandler): void {
    this.messageHandler = handler;
  }

  getStatus(): BaileysStatusInfo {
    return {
      state: this.state,
      qr: this.qr,
      account: this.account,
      error: this.error,
      reconnectAttempts: this.reconnectAttempts,
      lastConnectedAt: this.lastConnectedAt,
      isReady: this.state === 'connected' && Boolean(this.sock),
    };
  }

  private emitStatus(): void {
    this.events.emit('status', this.getStatus());
  }

  async connect(): Promise<BaileysStatusInfo> {
    if (this.state === 'connected' && this.sock) {
      return this.getStatus();
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.intentionalDisconnect = false;
    this.error = null;
    this.state = hasSavedSession() ? 'connecting' : 'initializing';
    this.emitStatus();

    this.connectingPromise = (async () => {
      try {
        const { state, saveCreds, clearAuthState } = await initPersistentAuthState();
        this.clearAuthFn = clearAuthState;

        // Clean up any stale socket
        if (this.sock) {
          try {
            this.sock.end(undefined);
          } catch {
            // ignore
          }
          this.sock = null;
        }

        const sock = makeWASocket({
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pinoLogger),
          },
          logger: pinoLogger,
          printQRInTerminal: false,
          syncFullHistory: false,
          markOnlineOnConnect: false,
          connectTimeoutMs: 60_000,
          defaultQueryTimeoutMs: 60_000,
          keepAliveIntervalMs: 25_000,
        });

        this.sock = sock;

        sock.ev.on('creds.update', async () => {
          try {
            await saveCreds();
          } catch (err) {
            pinoLogger.error({ err }, 'Failed to persist Baileys credentials');
          }
        });

        sock.ev.on('connection.update', (update) => {
          this.handleConnectionUpdate(update);
        });

        sock.ev.on('messages.upsert', (upsert) => {
          void this.handleMessagesUpsert(upsert);
        });

        sock.ev.on('messages.update', (updates) => {
          void this.handleMessagesUpdate(updates);
        });

        return this.getStatus();
      } catch (err) {
        pinoLogger.error({ err }, 'Error during Baileys socket initialization');
        this.state = 'connection_error';
        this.error = err instanceof Error ? err.message : 'Could not initialize WhatsApp connection.';
        this.emitStatus();
        throw err;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  private handleConnectionUpdate(update: Partial<ConnectionState>): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.qr = qr;
      this.state = 'waiting_for_qr';
      this.error = null;
      this.emitStatus();
    }

    if (connection === 'connecting') {
      if (this.state !== 'waiting_for_qr') {
        this.state = this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting';
        this.emitStatus();
      }
    } else if (connection === 'open') {
      this.state = 'connected';
      this.qr = null;
      this.error = null;
      this.reconnectAttempts = 0;
      this.lastConnectedAt = new Date().toISOString();

      const user = this.sock?.user;
      if (user) {
        const rawPhone = jidNormalizedUser(user.id).replace(/\D/g, '');
        this.account = {
          id: user.id,
          name: user.name || (user as any).notify || 'WhatsApp Account',
          phone: rawPhone ? `+${rawPhone}` : undefined,
        };
      }
      this.emitStatus();
    } else if (connection === 'close') {
      this.handleConnectionClose(lastDisconnect);
    }
  }

  private handleConnectionClose(lastDisconnect: { error?: Error | Boom; date?: Date } | undefined): void {
    const boomError = lastDisconnect?.error as Boom | undefined;
    const statusCode = boomError?.output?.statusCode;

    pinoLogger.warn({ statusCode, message: lastDisconnect?.error?.message }, 'Baileys connection closed');

    if (this.intentionalDisconnect) {
      this.state = 'disconnected';
      this.qr = null;
      this.emitStatus();
      return;
    }

    const isLoggedOut = statusCode === DisconnectReason.loggedOut;
    const isReplaced = statusCode === DisconnectReason.connectionReplaced;
    const isRestartRequired = statusCode === DisconnectReason.restartRequired;

    if (isLoggedOut) {
      this.state = 'logged_out';
      this.qr = null;
      this.account = null;
      this.error = 'WhatsApp session was logged out. Scan a new QR code to reconnect.';
      if (this.clearAuthFn) {
        this.clearAuthFn();
      }
      this.emitStatus();
      return;
    }

    if (isReplaced) {
      this.state = 'disconnected';
      this.qr = null;
      this.error = 'WhatsApp session was connected on another device/browser.';
      this.emitStatus();
      return;
    }

    if (isRestartRequired) {
      pinoLogger.info('Baileys requested immediate restart, reconnecting now...');
      void this.connect();
      return;
    }

    // Transient disconnect: schedule reconnection with exponential backoff
    this.scheduleReconnect(lastDisconnect?.error?.message);
  }

  private scheduleReconnect(errorMessage?: string): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.state = 'connection_error';
      this.error = errorMessage || 'Automatic reconnection attempts exhausted. Please reconnect manually.';
      this.emitStatus();
      return;
    }

    const delayMs = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;
    this.state = 'reconnecting';
    this.error = `Connection lost. Reconnecting in ${Math.round(delayMs / 1000)}s (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`;
    this.emitStatus();

    this.reconnectTimer = setTimeout(() => {
      void this.connect();
    }, delayMs);
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {
        // ignore
      }
      this.sock = null;
    }

    this.state = 'disconnected';
    this.qr = null;
    this.error = null;
    this.emitStatus();
  }

  async logout(): Promise<void> {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.sock) {
      try {
        await this.sock.logout();
      } catch {
        try {
          this.sock.end(undefined);
        } catch {
          // ignore
        }
      }
      this.sock = null;
    }

    if (this.clearAuthFn) {
      this.clearAuthFn();
    }

    this.state = 'logged_out';
    this.qr = null;
    this.account = null;
    this.error = null;
    this.reconnectAttempts = 0;
    this.emitStatus();
  }

  async restart(): Promise<BaileysStatusInfo> {
    await this.disconnect();
    this.reconnectAttempts = 0;
    return this.connect();
  }

  async sendTextMessage(
    number: string,
    text: string
  ): Promise<{ providerMessageId: string; status: WhatsAppStatus }> {
    if (this.state !== 'connected' || !this.sock) {
      throw new Error('WhatsApp is not connected. Open the WhatsApp page and scan the QR code to connect.');
    }

    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('Message text cannot be empty.');
    }

    const cleanDigits = number.replace(/\D/g, '');
    if (cleanDigits.length < 8 || cleanDigits.length > 15) {
      throw new Error(`Invalid WhatsApp number +${cleanDigits}. Expected 8-15 digits with country code.`);
    }

    // Verify WhatsApp registration
    let targetJid = `${cleanDigits}@s.whatsapp.net`;
    try {
      const results = await this.sock.onWhatsApp(cleanDigits);
      if (Array.isArray(results) && results.length > 0) {
        const found = results[0];
        if (found && !found.exists) {
          throw new Error(`Number +${cleanDigits} is not registered on WhatsApp.`);
        }
        if (found?.jid) {
          targetJid = found.jid;
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('not registered')) {
        throw err;
      }
      // Transient verification issue; fallback to default JID
    }

    const sent = await this.sock.sendMessage(targetJid, { text: cleanText });
    const providerMessageId = sent?.key?.id || `baileys_${Date.now()}`;

    return {
      providerMessageId,
      status: 'Sent',
    };
  }

  private async handleMessagesUpsert(upsert: {
    messages: proto.IWebMessageInfo[];
    type: string;
  }): Promise<void> {
    for (const msg of upsert.messages) {
      if (!msg.key || !msg.message || msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid || '';
      // Filter out broadcast and group messages
      if (remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@g.us')) continue;

      const messageId = msg.key.id || '';
      if (!messageId) continue;

      // Idempotent processing check
      if (this.db.isWebhookProcessed(messageId)) continue;
      this.db.markWebhookProcessed(messageId);

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';

      if (!text.trim()) continue;

      const senderDigits = remoteJid.split('@')[0].replace(/\D/g, '');
      const timestamp = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      if (this.messageHandler) {
        try {
          await this.messageHandler({
            id: messageId,
            from: senderDigits,
            rawJid: remoteJid,
            text: text.trim(),
            timestamp,
          });
        } catch (err) {
          pinoLogger.error({ err, messageId }, 'Failed in incoming WhatsApp message handler');
        }
      }
    }
  }

  private async handleMessagesUpdate(
    updates: Array<{ key: proto.IMessageKey; update: { status?: proto.WebMessageInfo.Status | null } }>
  ): Promise<void> {
    for (const item of updates) {
      const id = item.key.id;
      if (!id || item.update.status === undefined || item.update.status === null) continue;

      const statusMap: Record<number, WhatsAppStatus> = {
        [proto.WebMessageInfo.Status.ERROR]: 'Failed',
        [proto.WebMessageInfo.Status.PENDING]: 'Pending',
        [proto.WebMessageInfo.Status.SERVER_ACK]: 'Sent',
        [proto.WebMessageInfo.Status.DELIVERY_ACK]: 'Delivered',
        [proto.WebMessageInfo.Status.READ]: 'Read',
        [proto.WebMessageInfo.Status.PLAYED]: 'Played',
      };

      const mapped = statusMap[item.update.status];
      if (mapped) {
        this.db.updateWhatsAppStatusByProviderId(id, mapped);
      }
    }
  }
}
