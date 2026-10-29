import { env } from '../config/env.js';
import { safeEqualText } from '../security/auth.js';
import type { WhatsAppStatus } from '../types/domain.js';

export class WahaNotConfiguredError extends Error {
  constructor() {
    super('WAHA is not configured. Use the manual WhatsApp link or configure WAHA on the backend.');
  }
}

async function request(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> | unknown[] }> {
  if (!env.WAHA_BASE_URL || !env.WAHA_API_KEY) throw new WahaNotConfiguredError();
  const response = await fetch(`${env.WAHA_BASE_URL.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': env.WAHA_API_KEY, ...(init.headers || {}) },
    signal: init.signal || AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  let body: Record<string, unknown> | unknown[] = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return { status: response.status, body };
}

export async function resolveWorkingSession(): Promise<string> {
  // 1. Try env.WAHA_SESSION if set
  if (env.WAHA_SESSION) {
    try {
      const res = await request(`/api/sessions/${encodeURIComponent(env.WAHA_SESSION)}`, {
        signal: AbortSignal.timeout(5_000),
      });
      const body = res.body as Record<string, unknown>;
      if (res.status === 200 && body.status === 'WORKING') {
        return env.WAHA_SESSION;
      }
    } catch {
      // Fallback to active session discovery
    }
  }

  // 2. Discover working sessions from WAHA dynamically
  try {
    const listRes = await request('/api/sessions', { signal: AbortSignal.timeout(5_000) });
    if (listRes.status === 200 && Array.isArray(listRes.body)) {
      const sessions = listRes.body as Array<{ name?: string; status?: string }>;
      const working = sessions.find((s) => s.status === 'WORKING');
      if (working?.name) {
        return working.name;
      }
      const first = sessions[0];
      if (first?.name) {
        throw new Error(`WhatsApp session '${first.name}' is ${first.status || 'not ready'}. Please scan the QR code or reconnect the session.`);
      }
    }
  } catch (err) {
    if (err instanceof WahaNotConfiguredError || (err instanceof Error && err.message.includes('WhatsApp session'))) {
      throw err;
    }
  }

  throw new Error(`WhatsApp session is not ready. Please ensure WAHA is running and connected at ${env.WAHA_BASE_URL}.`);
}

export async function sendWhatsApp(number: string, message: string): Promise<{ providerMessageId: string; status: WhatsAppStatus }> {
  const sessionName = await resolveWorkingSession();
  const cleanDigits = number.replace(/\D/g, '');

  let chatId = `${cleanDigits}@c.us`;
  try {
    const checked = await request(`/api/contacts/check-exists?phone=${encodeURIComponent(cleanDigits)}&session=${encodeURIComponent(sessionName)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const checkBody = checked.body as Record<string, unknown>;
    if (checked.status === 200) {
      if (checkBody.numberExists === false) {
        throw new Error(`Number +${cleanDigits} is not registered on WhatsApp.`);
      }
      if (typeof checkBody.chatId === 'string' && checkBody.chatId.includes('@')) {
        chatId = checkBody.chatId;
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('not registered')) {
      throw err;
    }
  }

  const sent = await request('/api/sendText', {
    method: 'POST',
    body: JSON.stringify({ session: sessionName, chatId, text: message }),
    signal: AbortSignal.timeout(45_000),
  });

  const sentBody = sent.body as Record<string, unknown>;
  if (sent.status < 200 || sent.status >= 300) {
    if ([500, 502, 503, 504, 524].includes(sent.status)) {
      throw new Error(`WAHA returned HTTP ${sent.status}; delivery is unconfirmed. Check WhatsApp before retrying.`);
    }
    const errMessage = typeof sentBody.message === 'string' ? sentBody.message : `WAHA rejected the message (HTTP ${sent.status}).`;
    throw new Error(errMessage);
  }

  const candidate = sentBody.id ?? (sentBody._data as Record<string, unknown> | undefined)?.id;
  const full = typeof candidate === 'string' ? candidate : String((candidate as Record<string, unknown> | undefined)?._serialized || '');
  const providerMessageId = full.split('_').filter((part) => /^[A-Za-z0-9]{10,64}$/.test(part)).pop() || (typeof candidate === 'string' && candidate ? candidate : String(Date.now()));

  const ack = typeof sentBody.ack === 'number' ? sentBody.ack : 0;
  return {
    providerMessageId,
    status: ack >= 4 ? 'Played' : ack === 3 ? 'Read' : ack === 2 ? 'Delivered' : ack === 1 ? 'Sent' : 'Pending',
  };
}

export function verifyWebhookSecret(value: string): boolean {
  return Boolean(env.WAHA_WEBHOOK_SECRET) && safeEqualText(value, env.WAHA_WEBHOOK_SECRET);
}

export function parseAck(body: Record<string, unknown>): { providerMessageId: string; status: WhatsAppStatus; error: string } | null {
  if (body.event !== 'message.ack') return null;
  const payload = (body.payload || {}) as Record<string, unknown>;
  if (payload.fromMe === false) return null;
  const rawId = typeof payload.id === 'string' ? payload.id : String((payload.id as Record<string, unknown> | undefined)?._serialized || '');
  const providerMessageId = rawId.split('_').filter((part) => /^[A-Za-z0-9]{10,64}$/.test(part)).pop() || '';
  const names: Record<string, number> = { ERROR: -1, PENDING: 0, SERVER: 1, DEVICE: 2, READ: 3, PLAYED: 4 };
  const ack = typeof payload.ack === 'number' ? payload.ack : names[String(payload.ackName || '').toUpperCase()];
  const statuses: Record<number, WhatsAppStatus> = { [-1]: 'Failed', 0: 'Pending', 1: 'Sent', 2: 'Delivered', 3: 'Read', 4: 'Played' };
  if (!providerMessageId || statuses[ack] === undefined) return null;
  return { providerMessageId, status: statuses[ack], error: ack === -1 ? 'WhatsApp reported a delivery error.' : '' };
}
