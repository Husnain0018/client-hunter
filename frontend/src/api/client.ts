import type {
  BaileysStatusInfo,
  ClientConversation,
  ClientHandlerStats,
  ClientStage,
  ConversationMessage,
  CustomService,
  DealClosingInfo,
  Lead,
  LeadStats,
  Run,
  RunEvent,
  SearchForm,
} from '../types';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const TOKEN_KEY = 'client-hunter-token';
const REMEMBERED_KEY = 'client-hunter-access-code';

type AuthListener = (token: string | null, reason?: string) => void;
const authListeners = new Set<AuthListener>();

export function onAuthChange(listener: AuthListener): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

function notifyAuth(token: string | null, reason?: string): void {
  for (const listener of authListeners) {
    try {
      listener(token, reason);
    } catch (err) {
      console.error('Auth listener error:', err);
    }
  }
}

let isReauthenticating: Promise<boolean> | null = null;

async function attemptSilentReauth(): Promise<boolean> {
  const rememberedCode = localStorage.getItem(REMEMBERED_KEY);
  if (!rememberedCode) return false;

  if (isReauthenticating) {
    return isReauthenticating;
  }

  isReauthenticating = (async () => {
    try {
      const response = await fetch(`${API}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: rememberedCode }),
      });
      const data = await response.json();
      if (response.ok && data?.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        notifyAuth(data.token);
        return true;
      }
    } catch {
      // Network or connection issue
    }
    return false;
  })().finally(() => {
    isReauthenticating = null;
  });

  return isReauthenticating;
}

async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...init, headers });
  } catch (netErr) {
    if (!isRetry && (!init.method || init.method === 'GET')) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return request<T>(path, init, true);
    }
    throw netErr;
  }

  const text = await response.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: `Server returned HTTP ${response.status}.` }; }

  if (!response.ok) {
    const errorMsg = (body as { error?: string }).error || `Request failed (HTTP ${response.status}).`;

    // Handle 401 Unauthorized / Expired / Invalid session
    if (response.status === 401 && !path.startsWith('/api/auth/session') && !isRetry) {
      const reauthSuccess = await attemptSilentReauth();
      if (reauthSuccess) {
        return request<T>(path, init, true);
      }

      // Re-authentication failed or unavailable: wipe stale session
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REMEMBERED_KEY);
      notifyAuth(null, errorMsg);
    }

    throw new Error(errorMsg);
  }
  return body as T;
}

export const api = {
  get token(): string | null { return localStorage.getItem(TOKEN_KEY); },
  get hasRememberedCode(): boolean { return Boolean(localStorage.getItem(REMEMBERED_KEY)); },
  onAuthChange,
  async login(accessCode: string, remember = true): Promise<void> {
    const result = await request<{ token: string }>('/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ accessCode }),
    });
    localStorage.setItem(TOKEN_KEY, result.token);
    if (remember) {
      localStorage.setItem(REMEMBERED_KEY, accessCode);
    } else {
      localStorage.removeItem(REMEMBERED_KEY);
    }
    notifyAuth(result.token);
  },
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBERED_KEY);
    notifyAuth(null);
  },
  async refreshSession(): Promise<boolean> {
    if (!localStorage.getItem(TOKEN_KEY)) return false;
    try {
      const result = await request<{ ok: boolean; token: string }>('/api/auth/refresh', {
        method: 'POST',
      });
      if (result.token) {
        localStorage.setItem(TOKEN_KEY, result.token);
        notifyAuth(result.token);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  },
  startRun(form: SearchForm, sheet?: { sheetId: string; tab: string }): Promise<{ runId: string }> { return request('/api/runs', { method: 'POST', body: JSON.stringify({ ...form, sheetId: sheet?.sheetId, sheetTab: sheet?.tab }) }); },
  getRun(runId: string): Promise<{ run: Run; leads: Lead[] }> { return request(`/api/runs/${encodeURIComponent(runId)}`); },
  getEvents(runId: string, after: number): Promise<{ events: RunEvent[]; run: Run }> { return request(`/api/runs/${encodeURIComponent(runId)}/events?after=${after}`); },
  listRuns(): Promise<{ runs: Run[] }> { return request('/api/runs'); },
  async deleteRun(runId: string): Promise<{ ok: boolean; runId: string; stats: LeadStats }> {
    try {
      return await request(`/api/runs/${encodeURIComponent(runId)}`, { method: 'DELETE' });
    } catch {
      return await request(`/api/runs/${encodeURIComponent(runId)}/delete`, { method: 'POST', body: '{}' });
    }
  },
  getStats(): Promise<{ ok: boolean; stats: LeadStats }> { return request('/api/leads/stats'); },
  async deleteLead(leadId: string): Promise<{ ok: boolean; leadId: string; stats: LeadStats }> {
    try {
      return await request(`/api/leads/${encodeURIComponent(leadId)}`, { method: 'DELETE' });
    } catch {
      return await request(`/api/leads/${encodeURIComponent(leadId)}/delete`, { method: 'POST', body: '{}' });
    }
  },
  getServices(): Promise<{ ok: boolean; predefined: string[]; custom: CustomService[] }> { return request('/api/services'); },
  addCustomService(name: string, description?: string): Promise<{ ok: boolean; service: CustomService }> { return request('/api/services', { method: 'POST', body: JSON.stringify({ name, description }) }); },
  async deleteCustomService(id: string): Promise<{ ok: boolean; id: string }> {
    try {
      return await request(`/api/services/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      return await request(`/api/services/${encodeURIComponent(id)}/delete`, { method: 'POST', body: '{}' });
    }
  },
  connectSheet(sheetUrl: string): Promise<{ sheet: { sheetId: string; tab: string; title: string; url: string; headers: string } }> { return request('/api/integrations/sheets/connect', { method: 'POST', body: JSON.stringify({ sheetUrl }) }); },
  sendEmail(leadId: string, body: { to: string; subject: string; html: string; text: string; replyTo?: string }): Promise<{ sentAt: string }> { return request(`/api/leads/${encodeURIComponent(leadId)}/email`, { method: 'POST', body: JSON.stringify(body) }); },
  sendWhatsApp(leadId: string, body: { businessName: string; number: string; message: string; resend: boolean }): Promise<{ record: { status: string; providerMessageId?: string } }> { return request(`/api/leads/${encodeURIComponent(leadId)}/whatsapp`, { method: 'POST', body: JSON.stringify(body) }); },

  // Client Handler Methods
  listClients(stage?: string, q?: string): Promise<{ ok: boolean; clients: ClientConversation[]; stats: ClientHandlerStats }> {
    const params = new URLSearchParams();
    if (stage && stage !== 'all') params.set('stage', stage);
    if (q) params.set('q', q);
    const qs = params.toString();
    return request(`/api/clients${qs ? `?${qs}` : ''}`);
  },
  getClient(leadId: string): Promise<{ ok: boolean; client: ClientConversation }> {
    return request(`/api/clients/${encodeURIComponent(leadId)}`);
  },
  sendClientMessage(leadId: string, text: string): Promise<{ ok: boolean; message: ConversationMessage; client: ClientConversation }> {
    return request(`/api/clients/${encodeURIComponent(leadId)}/message`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },
  sendFirstMessage(leadId: string, autoSend = false): Promise<{ ok: boolean; messageText: string; sentMessage?: ConversationMessage; client: ClientConversation }> {
    return request(`/api/clients/${encodeURIComponent(leadId)}/first-message`, {
      method: 'POST',
      body: JSON.stringify({ autoSend }),
    });
  },
  generateClientReply(leadId: string, guidance?: string): Promise<{ ok: boolean; draft: any }> {
    return request(`/api/clients/${encodeURIComponent(leadId)}/generate-reply`, {
      method: 'POST',
      body: JSON.stringify({ guidance }),
    });
  },
  toggleAutopilot(leadId: string, enabled: boolean): Promise<{ ok: boolean; client: ClientConversation }> {
    return request(`/api/clients/${encodeURIComponent(leadId)}/autopilot`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  },
  updateClientStage(leadId: string, stage: ClientStage, dealNotes?: string): Promise<{ ok: boolean; client: ClientConversation }> {
    return request(`/api/clients/${encodeURIComponent(leadId)}/stage`, {
      method: 'POST',
      body: JSON.stringify({ stage, dealNotes }),
    });
  },
  closeDeal(leadId: string, dealInfo: DealClosingInfo): Promise<{ ok: boolean; client: ClientConversation }> {
    return request(`/api/clients/${encodeURIComponent(leadId)}/close-deal`, {
      method: 'POST',
      body: JSON.stringify(dealInfo),
    });
  },

  // Direct Baileys WhatsApp Connection Methods
  getWhatsAppStatus(): Promise<{ ok: boolean; status: BaileysStatusInfo }> {
    return request('/api/whatsapp/status');
  },
  connectWhatsApp(): Promise<{ ok: boolean; status: BaileysStatusInfo }> {
    return request('/api/whatsapp/connect', { method: 'POST', body: '{}' });
  },
  disconnectWhatsApp(): Promise<{ ok: boolean; status: BaileysStatusInfo }> {
    return request('/api/whatsapp/disconnect', { method: 'POST', body: '{}' });
  },
  logoutWhatsApp(): Promise<{ ok: boolean; status: BaileysStatusInfo }> {
    return request('/api/whatsapp/logout', { method: 'POST', body: '{}' });
  },
  restartWhatsApp(): Promise<{ ok: boolean; status: BaileysStatusInfo }> {
    return request('/api/whatsapp/restart', { method: 'POST', body: '{}' });
  },
  subscribeWhatsAppEvents(onUpdate: (status: BaileysStatusInfo) => void): () => void {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    const sseUrl = `${API}/api/whatsapp/events?token=${encodeURIComponent(token)}`;
    let eventSource: EventSource | null = null;
    let pollInterval: any = null;
    let isClosed = false;

    const startPolling = () => {
      if (pollInterval || isClosed) return;
      pollInterval = setInterval(async () => {
        try {
          const res = await request<{ ok: boolean; status: BaileysStatusInfo }>('/api/whatsapp/status');
          if (res?.status) onUpdate(res.status);
        } catch {
          // ignore transient poll failure
        }
      }, 3000);
    };

    try {
      eventSource = new EventSource(sseUrl);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as BaileysStatusInfo;
          onUpdate(data);
        } catch {
          // ignore
        }
      };
      eventSource.onerror = () => {
        // Switch to polling if SSE has an issue
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      isClosed = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  },
};
