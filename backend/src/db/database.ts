import fs from 'node:fs';
import path from 'node:path';
import DatabaseDriver from 'better-sqlite3';
import type {
  ClientConversation,
  ClientHandlerStats,
  ClientStage,
  ConversationMessage,
  CustomService,
  Lead,
  LeadStats,
  RunEvent,
  RunRecord,
  SearchRequest,
  WhatsAppRecord,
  WhatsAppStatus,
} from '../types/domain.js';

type StoredRun = {
  run_id: string;
  status: RunRecord['status'];
  request_json: string;
  message: string;
  total: number;
  created_at: string;
  completed_at: string | null;
};

export class Database {
  readonly db: DatabaseDriver.Database;
  private readonly statements = new Map<string, DatabaseDriver.Statement>();

  constructor(filename: string) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseDriver(filename);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        request_json TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        total INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS leads (
        row_id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
        lead_id TEXT NOT NULL,
        domain TEXT NOT NULL DEFAULT '',
        phone_key TEXT NOT NULL DEFAULT '',
        data_json TEXT NOT NULL,
        UNIQUE(run_id, lead_id)
      );
      CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);
      CREATE INDEX IF NOT EXISTS idx_leads_domain ON leads(domain);
      CREATE INDEX IF NOT EXISTS idx_leads_phone_key ON leads(phone_key);
      CREATE TABLE IF NOT EXISTS run_events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        stage TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        payload_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_run_seq ON run_events(run_id, seq);
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        lead_id TEXT PRIMARY KEY,
        business_name TEXT NOT NULL,
        number TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        provider_message_id TEXT NOT NULL DEFAULT '',
        saved_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        error TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS email_sends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id TEXT NOT NULL,
        to_address TEXT NOT NULL,
        subject TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        provider_id TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS custom_services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS client_conversations (
        lead_id TEXT PRIMARY KEY,
        stage TEXT NOT NULL DEFAULT 'new',
        auto_pilot INTEGER NOT NULL DEFAULT 1,
        agreed_services_json TEXT NOT NULL DEFAULT '[]',
        agreed_price TEXT NOT NULL DEFAULT '',
        agreed_timeline TEXT NOT NULL DEFAULT '',
        agreed_deliverables TEXT NOT NULL DEFAULT '',
        deal_notes TEXT NOT NULL DEFAULT '',
        closed_at TEXT,
        closing_notified_at TEXT,
        human_intervention_reason TEXT NOT NULL DEFAULT '',
        next_follow_up_at TEXT,
        follow_up_count INTEGER NOT NULL DEFAULT 0,
        opted_out INTEGER NOT NULL DEFAULT 0,
        summary TEXT NOT NULL DEFAULT '',
        last_message_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_client_conv_stage ON client_conversations(stage);
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Sent',
        provider_message_id TEXT NOT NULL DEFAULT '',
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conv_msgs_lead ON conversation_messages(lead_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_conv_msgs_prov ON conversation_messages(provider_message_id);
      CREATE TABLE IF NOT EXISTS processed_webhooks (
        message_id TEXT PRIMARY KEY,
        processed_at TEXT NOT NULL
      );
    `);
  }

  private stmt(sql: string): DatabaseDriver.Statement {
    let s = this.statements.get(sql);
    if (!s) {
      s = this.db.prepare(sql);
      this.statements.set(sql, s);
    }
    return s;
  }

  close(): void {
    this.statements.clear();
    this.db.close();
  }

  createRun(runId: string, request: SearchRequest, createdAt: string): void {
    this.stmt('INSERT INTO runs (run_id, status, request_json, created_at) VALUES (?, ?, ?, ?)')
      .run(runId, 'queued', JSON.stringify(request), createdAt);
  }

  getRun(runId: string): RunRecord | null {
    const row = this.stmt('SELECT * FROM runs WHERE run_id = ?').get(runId) as StoredRun | undefined;
    if (!row) return null;
    return { runId: row.run_id, status: row.status, request: JSON.parse(row.request_json) as SearchRequest, message: row.message, total: row.total, createdAt: row.created_at, completedAt: row.completed_at };
  }

  listRuns(limit = 50): RunRecord[] {
    return (this.stmt('SELECT * FROM runs ORDER BY created_at DESC LIMIT ?').all(limit) as StoredRun[]).map((row) => ({ runId: row.run_id, status: row.status, request: JSON.parse(row.request_json) as SearchRequest, message: row.message, total: row.total, createdAt: row.created_at, completedAt: row.completed_at }));
  }

  deleteRun(runId: string): boolean {
    const transaction = this.db.transaction(() => {
      this.stmt('DELETE FROM run_events WHERE run_id = ?').run(runId);
      this.stmt('DELETE FROM leads WHERE run_id = ?').run(runId);
      const res = this.stmt('DELETE FROM runs WHERE run_id = ?').run(runId);
      return res.changes > 0;
    });
    return transaction();
  }

  updateRun(runId: string, status: RunRecord['status'], message: string, total: number, completedAt: string | null = null): void {
    this.stmt('UPDATE runs SET status = ?, message = ?, total = ?, completed_at = ? WHERE run_id = ?').run(status, message, total, completedAt, runId);
  }

  appendEvent(runId: string, event: Omit<RunEvent, 'seq' | 'runId' | 'createdAt'>): number {
    const now = new Date().toISOString();
    const result = this.stmt('INSERT INTO run_events (run_id, type, stage, level, message, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(runId, event.type, event.stage, event.level, event.message, event.payload === undefined ? null : JSON.stringify(event.payload), now);
    return Number(result.lastInsertRowid);
  }

  events(runId: string, after = 0, limit = 500): RunEvent[] {
    const rows = this.stmt('SELECT * FROM run_events WHERE run_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?').all(runId, after, limit) as Array<{ seq: number; run_id: string; type: RunEvent['type']; stage: RunEvent['stage']; level: RunEvent['level']; message: string; payload_json: string | null; created_at: string }>;
    return rows.map((row) => ({ seq: row.seq, runId: row.run_id, type: row.type, stage: row.stage, level: row.level, message: row.message, payload: row.payload_json ? JSON.parse(row.payload_json) : undefined, createdAt: row.created_at }));
  }

  saveLead(lead: Lead): void {
    const domain = (() => { try { return new URL(lead.website).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } })();
    const phoneKey = lead.phone.replace(/\D/g, '').slice(-9);
    this.stmt(`INSERT INTO leads (run_id, lead_id, domain, phone_key, data_json) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(run_id, lead_id) DO UPDATE SET data_json = excluded.data_json, domain = excluded.domain, phone_key = excluded.phone_key`)
      .run(lead.runId, lead.leadId, domain, phoneKey, JSON.stringify(lead));
  }

  findDuplicate(leadId: string, domain: string, phoneKey: string): boolean {
    const row = this.stmt(`SELECT row_id FROM leads WHERE lead_id = ? OR (? <> '' AND domain = ?) OR (? <> '' AND phone_key = ?) LIMIT 1`).get(leadId, domain, domain, phoneKey, phoneKey);
    return Boolean(row);
  }

  getAllExistingLeadIdentifiers(): { ids: Set<string>; domains: Set<string>; phones: Set<string>; names: Set<string> } {
    const rows = this.stmt('SELECT lead_id, domain, phone_key, data_json FROM leads').all() as Array<{ lead_id: string; domain: string; phone_key: string; data_json: string }>;
    const ids = new Set<string>();
    const domains = new Set<string>();
    const phones = new Set<string>();
    const names = new Set<string>();
    for (const row of rows) {
      if (row.lead_id) ids.add(row.lead_id);
      if (row.domain) domains.add(row.domain);
      if (row.phone_key) phones.add(row.phone_key);
      try {
        const lead = JSON.parse(row.data_json) as { businessName?: string };
        if (lead.businessName) {
          const norm = lead.businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (norm) names.add(norm);
        }
      } catch {}
    }
    return { ids, domains, phones, names };
  }

  getStats(): LeadStats {
    const runCount = (this.stmt('SELECT COUNT(*) as c FROM runs').get() as { c: number })?.c || 0;
    const rows = this.stmt('SELECT data_json FROM leads').all() as Array<{ data_json: string }>;
    const uniqueMap = new Map<string, Lead>();
    for (const row of rows) {
      try {
        const lead = JSON.parse(row.data_json) as Lead;
        const key = lead.leadId || lead.phone || lead.website || lead.businessName;
        if (key && !uniqueMap.has(key)) {
          uniqueMap.set(key, lead);
        }
      } catch {}
    }
    const uniqueLeads = Array.from(uniqueMap.values());
    let verified = 0;
    let withEmail = 0;
    let withPhone = 0;
    let noWebsite = 0;

    for (const lead of uniqueLeads) {
      if (lead.locationVerified !== false) verified++;
      if (lead.email) withEmail++;
      if (lead.phone) withPhone++;
      if (lead.leadType === 'No Website' || !lead.website) noWebsite++;
    }

    return {
      totalUniqueLeads: uniqueLeads.length,
      totalRuns: runCount,
      verifiedLeads: verified,
      leadsWithEmail: withEmail,
      leadsWithPhone: withPhone,
      noWebsiteLeads: noWebsite,
    };
  }

  deleteLead(leadId: string): boolean {
    const result = this.stmt('DELETE FROM leads WHERE lead_id = ?').run(leadId);
    return result.changes > 0;
  }

  listCustomServices(): CustomService[] {
    const rows = this.stmt('SELECT id, name, description, created_at FROM custom_services ORDER BY created_at ASC').all() as Array<{ id: string; name: string; description: string; created_at: string }>;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
    }));
  }

  createCustomService(name: string, description = ''): CustomService {
    const cleanName = name.trim();
    const id = `srv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = new Date().toISOString();
    this.stmt('INSERT INTO custom_services (id, name, description, created_at) VALUES (?, ?, ?, ?)').run(id, cleanName, description.trim(), createdAt);
    return { id, name: cleanName, description: description.trim(), createdAt };
  }

  deleteCustomService(id: string): boolean {
    const result = this.stmt('DELETE FROM custom_services WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getLead(leadId: string): Lead | null {
    const row = this.stmt('SELECT data_json FROM leads WHERE lead_id = ? ORDER BY row_id DESC LIMIT 1').get(leadId) as { data_json: string } | undefined;
    return row ? JSON.parse(row.data_json) as Lead : null;
  }

  getRunLeads(runId: string): Lead[] {
    return (this.stmt('SELECT data_json FROM leads WHERE run_id = ? ORDER BY row_id ASC').all(runId) as Array<{ data_json: string }>).map((row) => JSON.parse(row.data_json) as Lead);
  }

  updateLead(leadId: string, patch: Partial<Lead>): Lead | null {
    const lead = this.getLead(leadId);
    if (!lead) return null;
    const updated = { ...lead, ...patch };
    this.stmt('UPDATE leads SET data_json = ? WHERE lead_id = ?').run(JSON.stringify(updated), leadId);
    return updated;
  }

  getWhatsApp(leadId: string): WhatsAppRecord | null {
    const row = this.stmt('SELECT * FROM whatsapp_messages WHERE lead_id = ?').get(leadId) as { lead_id: string; business_name: string; number: string; status: WhatsAppStatus; message: string; provider_message_id: string; saved_at: string; updated_at: string; error: string } | undefined;
    return row ? { leadId: row.lead_id, businessName: row.business_name, number: row.number, status: row.status, message: row.message, providerMessageId: row.provider_message_id, savedAt: row.saved_at, updatedAt: row.updated_at, error: row.error } : null;
  }

  reserveWhatsApp(input: { leadId: string; businessName: string; number: string; message: string; resend: boolean }): { ok: true; record: WhatsAppRecord } | { ok: false; reason: string; record: WhatsAppRecord } {
    const now = new Date().toISOString();
    const transaction = this.db.transaction(() => {
      const existing = this.getWhatsApp(input.leadId);
      if (existing && existing.businessName.toLowerCase() !== input.businessName.toLowerCase() && existing.number !== input.number) {
        return { ok: false as const, reason: 'Lead ID conflict: it is already associated with another business and number.', record: existing };
      }
      if (existing && !input.resend) {
        const ageMs = Date.now() - Date.parse(existing.updatedAt);
        if (existing.status === 'Sending' && ageMs < 180_000) return { ok: false as const, reason: 'A WhatsApp send for this lead is already in progress.', record: existing };
        if (['Pending', 'Sent', 'Delivered', 'Read', 'Played', 'Unconfirmed'].includes(existing.status)) return { ok: false as const, reason: `A previous WhatsApp message is ${existing.status}. Check the chat before resending.`, record: existing };
      }
      this.stmt(`INSERT INTO whatsapp_messages (lead_id, business_name, number, status, message, saved_at, updated_at, error)
        VALUES (?, ?, ?, 'Sending', ?, ?, ?, '')
        ON CONFLICT(lead_id) DO UPDATE SET business_name = excluded.business_name, number = excluded.number, status = 'Sending', message = excluded.message, updated_at = excluded.updated_at, error = ''`)
        .run(input.leadId, input.businessName, input.number, input.message.slice(0, 1500), existing?.savedAt || now, now);
      return { ok: true as const, record: this.getWhatsApp(input.leadId)! };
    });
    return transaction();
  }

  updateWhatsApp(leadId: string, patch: Partial<Pick<WhatsAppRecord, 'status' | 'providerMessageId' | 'error'>>): WhatsAppRecord | null {
    const now = new Date().toISOString();
    this.stmt('UPDATE whatsapp_messages SET status = COALESCE(?, status), provider_message_id = COALESCE(?, provider_message_id), error = COALESCE(?, error), updated_at = ? WHERE lead_id = ?')
      .run(patch.status ?? null, patch.providerMessageId ?? null, patch.error ?? null, now, leadId);
    return this.getWhatsApp(leadId);
  }

  findWhatsAppByProviderId(providerMessageId: string): WhatsAppRecord | null {
    const row = this.stmt('SELECT lead_id FROM whatsapp_messages WHERE provider_message_id = ?').get(providerMessageId) as { lead_id: string } | undefined;
    return row ? this.getWhatsApp(row.lead_id) : null;
  }

  recordEmail(leadId: string, to: string, subject: string, providerId: string): void {
    this.stmt('INSERT INTO email_sends (lead_id, to_address, subject, sent_at, provider_id) VALUES (?, ?, ?, ?, ?)').run(leadId, to, subject, new Date().toISOString(), providerId);
  }

  findLeadByPhone(rawPhone: string): Lead | null {
    const digits = rawPhone.replace(/\D/g, '');
    if (!digits) return null;
    const key9 = digits.slice(-9);
    const key7 = digits.slice(-7);

    let row = this.stmt('SELECT data_json FROM leads WHERE phone_key = ? ORDER BY row_id DESC LIMIT 1').get(key9) as { data_json: string } | undefined;
    if (!row && key7) {
      row = this.stmt(`SELECT data_json FROM leads WHERE phone_key LIKE ? ORDER BY row_id DESC LIMIT 1`).get(`%${key7}`) as { data_json: string } | undefined;
    }
    if (!row) {
      // Fallback search across all leads for matching trailing digits
      const allRows = this.stmt('SELECT data_json FROM leads ORDER BY row_id DESC').all() as Array<{ data_json: string }>;
      for (const r of allRows) {
        try {
          const l = JSON.parse(r.data_json) as Lead;
          const leadDigits = (l.phone || '').replace(/\D/g, '');
          if (leadDigits && (leadDigits.endsWith(key7) || digits.endsWith(leadDigits.slice(-7)))) {
            return l;
          }
        } catch {}
      }
    }
    return row ? JSON.parse(row.data_json) as Lead : null;
  }

  isWebhookProcessed(messageId: string): boolean {
    if (!messageId) return false;
    const row = this.stmt('SELECT message_id FROM processed_webhooks WHERE message_id = ?').get(messageId);
    return Boolean(row);
  }

  markWebhookProcessed(messageId: string): void {
    if (!messageId) return;
    const now = new Date().toISOString();
    this.stmt('INSERT OR IGNORE INTO processed_webhooks (message_id, processed_at) VALUES (?, ?)').run(messageId, now);
  }

  getConversationMessages(leadId: string, limit = 200): ConversationMessage[] {
    const rows = this.stmt(
      'SELECT id, lead_id, sender, text, status, provider_message_id, metadata_json, created_at FROM conversation_messages WHERE lead_id = ? ORDER BY created_at ASC LIMIT ?'
    ).all(leadId, limit) as Array<{
      id: string;
      lead_id: string;
      sender: 'client' | 'assistant' | 'user';
      text: string;
      status: WhatsAppStatus;
      provider_message_id: string;
      metadata_json: string | null;
      created_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      leadId: r.lead_id,
      sender: r.sender,
      text: r.text,
      status: r.status,
      providerMessageId: r.provider_message_id,
      metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
      timestamp: r.created_at,
    }));
  }

  addConversationMessage(msg: ConversationMessage): void {
    const now = msg.timestamp || new Date().toISOString();
    const metaJson = msg.metadata ? JSON.stringify(msg.metadata) : null;
    this.stmt(
      `INSERT INTO conversation_messages (id, lead_id, sender, text, status, provider_message_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      msg.id,
      msg.leadId,
      msg.sender,
      msg.text,
      msg.status || 'Sent',
      msg.providerMessageId || '',
      metaJson,
      now
    );

    // Update conversation last_message_at and stage if needed
    this.upsertClientConversation(msg.leadId, {
      lastMessageAt: now,
      ...(msg.sender === 'assistant' || msg.sender === 'user'
        ? { stage: 'awaiting_reply' as ClientStage }
        : { stage: 'conversing' as ClientStage }),
    });
  }

  updateConversationMessageStatus(providerMessageId: string, status: WhatsAppStatus): boolean {
    if (!providerMessageId) return false;
    const res = this.stmt('UPDATE conversation_messages SET status = ? WHERE provider_message_id = ?').run(status, providerMessageId);
    return res.changes > 0;
  }

  getClientConversation(leadId: string): ClientConversation | null {
    const lead = this.getLead(leadId);
    if (!lead) return null;

    const row = this.stmt('SELECT * FROM client_conversations WHERE lead_id = ?').get(leadId) as any;
    const messages = this.getConversationMessages(leadId);

    if (!row) {
      // Auto-initialize from lead record
      const wa = this.getWhatsApp(leadId);
      const initialStage: ClientStage = wa ? 'contacted' : 'new';
      const now = new Date().toISOString();
      const newConv: ClientConversation = {
        leadId,
        businessName: lead.businessName,
        phone: lead.phone,
        stage: initialStage,
        autoPilot: true,
        agreedServices: [],
        agreedPrice: '',
        agreedTimeline: '',
        agreedDeliverables: '',
        dealNotes: '',
        closedAt: null,
        closingNotifiedAt: null,
        humanInterventionReason: '',
        nextFollowUpAt: null,
        followUpCount: 0,
        optedOut: false,
        summary: lead.analysisSummary || '',
        lastMessageAt: wa?.updatedAt || lead.createdAt || now,
        createdAt: lead.createdAt || now,
        updatedAt: now,
        lead,
        messages,
      };
      this.upsertClientConversation(leadId, newConv);
      return newConv;
    }

    return {
      leadId: row.lead_id,
      businessName: lead.businessName,
      phone: lead.phone,
      stage: row.stage as ClientStage,
      autoPilot: Boolean(row.auto_pilot),
      agreedServices: JSON.parse(row.agreed_services_json || '[]'),
      agreedPrice: row.agreed_price || '',
      agreedTimeline: row.agreed_timeline || '',
      agreedDeliverables: row.agreed_deliverables || '',
      dealNotes: row.deal_notes || '',
      closedAt: row.closed_at || null,
      closingNotifiedAt: row.closing_notified_at || null,
      humanInterventionReason: row.human_intervention_reason || '',
      nextFollowUpAt: row.next_follow_up_at || null,
      followUpCount: Number(row.follow_up_count) || 0,
      optedOut: Boolean(row.opted_out),
      summary: row.summary || lead.analysisSummary || '',
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lead,
      messages,
    };
  }

  upsertClientConversation(leadId: string, patch: Partial<ClientConversation>): ClientConversation {
    const existing = this.stmt('SELECT * FROM client_conversations WHERE lead_id = ?').get(leadId) as any;
    const now = new Date().toISOString();
    const lead = this.getLead(leadId);

    if (!existing) {
      const wa = this.getWhatsApp(leadId);
      const stage = patch.stage || (wa ? 'contacted' : 'new');
      const autoPilot = patch.autoPilot !== undefined ? (patch.autoPilot ? 1 : 0) : 1;
      const agreedServices = JSON.stringify(patch.agreedServices || []);
      const price = patch.agreedPrice || '';
      const timeline = patch.agreedTimeline || '';
      const deliverables = patch.agreedDeliverables || '';
      const notes = patch.dealNotes || '';
      const closedAt = patch.closedAt || null;
      const closingNotifiedAt = patch.closingNotifiedAt || null;
      const humanReason = patch.humanInterventionReason || '';
      const nextFollowUp = patch.nextFollowUpAt || null;
      const followUpCount = patch.followUpCount || 0;
      const optedOut = patch.optedOut ? 1 : 0;
      const summary = patch.summary || lead?.analysisSummary || '';
      const lastMsgAt = patch.lastMessageAt || wa?.updatedAt || lead?.createdAt || now;

      this.stmt(`
        INSERT INTO client_conversations (
          lead_id, stage, auto_pilot, agreed_services_json, agreed_price, agreed_timeline,
          agreed_deliverables, deal_notes, closed_at, closing_notified_at, human_intervention_reason,
          next_follow_up_at, follow_up_count, opted_out, summary, last_message_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        leadId, stage, autoPilot, agreedServices, price, timeline,
        deliverables, notes, closedAt, closingNotifiedAt, humanReason,
        nextFollowUp, followUpCount, optedOut, summary, lastMsgAt, lead?.createdAt || now, now
      );
    } else {
      const stage = patch.stage ?? existing.stage;
      const autoPilot = patch.autoPilot !== undefined ? (patch.autoPilot ? 1 : 0) : existing.auto_pilot;
      const agreedServices = patch.agreedServices !== undefined ? JSON.stringify(patch.agreedServices) : existing.agreed_services_json;
      const price = patch.agreedPrice ?? existing.agreed_price;
      const timeline = patch.agreedTimeline ?? existing.agreed_timeline;
      const deliverables = patch.agreedDeliverables ?? existing.agreed_deliverables;
      const notes = patch.dealNotes ?? existing.deal_notes;
      const closedAt = patch.closedAt !== undefined ? patch.closedAt : existing.closed_at;
      const closingNotifiedAt = patch.closingNotifiedAt !== undefined ? patch.closingNotifiedAt : existing.closing_notified_at;
      const humanReason = patch.humanInterventionReason ?? existing.human_intervention_reason;
      const nextFollowUp = patch.nextFollowUpAt !== undefined ? patch.nextFollowUpAt : existing.next_follow_up_at;
      const followUpCount = patch.followUpCount ?? existing.follow_up_count;
      const optedOut = patch.optedOut !== undefined ? (patch.optedOut ? 1 : 0) : existing.opted_out;
      const summary = patch.summary ?? existing.summary;
      const lastMsgAt = patch.lastMessageAt ?? existing.last_message_at;

      this.stmt(`
        UPDATE client_conversations SET
          stage = ?, auto_pilot = ?, agreed_services_json = ?, agreed_price = ?,
          agreed_timeline = ?, agreed_deliverables = ?, deal_notes = ?, closed_at = ?,
          closing_notified_at = ?, human_intervention_reason = ?, next_follow_up_at = ?,
          follow_up_count = ?, opted_out = ?, summary = ?, last_message_at = ?, updated_at = ?
        WHERE lead_id = ?
      `).run(
        stage, autoPilot, agreedServices, price, timeline,
        deliverables, notes, closedAt, closingNotifiedAt, humanReason,
        nextFollowUp, followUpCount, optedOut, summary, lastMsgAt, now, leadId
      );
    }

    return this.getClientConversation(leadId)!;
  }

  listClientConversations(filterStage?: string, search?: string): ClientConversation[] {
    const leadRows = this.stmt('SELECT data_json FROM leads ORDER BY row_id DESC').all() as Array<{ data_json: string }>;
    const convRows = this.stmt('SELECT * FROM client_conversations').all() as any[];
    const convMap = new Map<string, any>();
    for (const c of convRows) {
      convMap.set(c.lead_id, c);
    }

    const uniqueLeads = new Map<string, Lead>();
    for (const r of leadRows) {
      try {
        const l = JSON.parse(r.data_json) as Lead;
        if (l.leadId && !uniqueLeads.has(l.leadId)) {
          uniqueLeads.set(l.leadId, l);
        }
      } catch {}
    }

    const result: ClientConversation[] = [];
    const q = search ? search.trim().toLowerCase() : '';

    for (const [leadId, lead] of uniqueLeads.entries()) {
      if (q) {
        const matchesName = lead.businessName?.toLowerCase().includes(q);
        const matchesCategory = lead.category?.toLowerCase().includes(q);
        const matchesCity = lead.address?.toLowerCase().includes(q);
        const matchesPhone = lead.phone?.toLowerCase().includes(q);
        if (!matchesName && !matchesCategory && !matchesCity && !matchesPhone) continue;
      }

      const c = convMap.get(leadId);
      const wa = this.getWhatsApp(leadId);
      const stage: ClientStage = c ? (c.stage as ClientStage) : (wa ? 'contacted' : 'new');

      if (filterStage && filterStage !== 'all' && stage !== filterStage) {
        continue;
      }

      const conv: ClientConversation = {
        leadId,
        businessName: lead.businessName,
        phone: lead.phone,
        stage,
        autoPilot: c ? Boolean(c.auto_pilot) : true,
        agreedServices: c ? JSON.parse(c.agreed_services_json || '[]') : [],
        agreedPrice: c ? c.agreed_price : '',
        agreedTimeline: c ? c.agreed_timeline : '',
        agreedDeliverables: c ? c.agreed_deliverables : '',
        dealNotes: c ? c.deal_notes : '',
        closedAt: c ? c.closed_at : null,
        closingNotifiedAt: c ? c.closing_notified_at : null,
        humanInterventionReason: c ? c.human_intervention_reason : '',
        nextFollowUpAt: c ? c.next_follow_up_at : null,
        followUpCount: c ? Number(c.follow_up_count) : 0,
        optedOut: c ? Boolean(c.opted_out) : false,
        summary: c ? c.summary : (lead.analysisSummary || ''),
        lastMessageAt: c ? c.last_message_at : (wa?.updatedAt || lead.createdAt || new Date().toISOString()),
        createdAt: c ? c.created_at : lead.createdAt,
        updatedAt: c ? c.updated_at : lead.createdAt,
        lead,
      };
      result.push(conv);
    }

    // Sort by most recent interaction first
    return result.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }

  getClientHandlerStats(): ClientHandlerStats {
    const clients = this.listClientConversations();
    let newLeads = 0;
    let awaitingReply = 0;
    let activeConversations = 0;
    let negotiating = 0;
    let closedWon = 0;
    let needsHuman = 0;
    let optedOut = 0;

    for (const c of clients) {
      if (c.stage === 'new') newLeads++;
      else if (c.stage === 'contacted' || c.stage === 'awaiting_reply') awaitingReply++;
      else if (c.stage === 'conversing' || c.stage === 'interested') activeConversations++;
      else if (c.stage === 'proposal_pending' || c.stage === 'negotiating') negotiating++;
      else if (c.stage === 'closed_won') closedWon++;
      else if (c.stage === 'needs_human') needsHuman++;
      else if (c.stage === 'opted_out' || c.stage === 'lost') optedOut++;
    }

    return {
      totalClients: clients.length,
      newLeads,
      awaitingReply,
      activeConversations,
      negotiating,
      closedWon,
      needsHuman,
      optedOut,
    };
  }
}
