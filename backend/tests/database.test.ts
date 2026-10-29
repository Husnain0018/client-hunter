import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { Database } from '../src/db/database.js';

const files: string[] = [];
afterEach(() => { for (const file of files.splice(0)) { try { fs.rmSync(file, { force: true }); fs.rmSync(`${file}-wal`, { force: true }); fs.rmSync(`${file}-shm`, { force: true }); } catch { /* cleanup best effort */ } } });

describe('SQLite persistence', () => {
  it('keeps run events and prevents WhatsApp duplicate sends', () => {
    const file = path.join(os.tmpdir(), `client-hunter-${randomUUID()}.sqlite`); files.push(file);
    const db = new Database(file);
    db.createRun('run-1', { userName: 'Test', company: 'Test', userEmail: 'test@example.com', userPhone: '', portfolio: '', services: ['SEO'], niche: 'dentists', area: 'Lahore', country: 'Pakistan', maxLeads: 1, checkSocial: false, emailSummary: false }, new Date().toISOString());
    const seq = db.appendEvent('run-1', { type: 'stage', stage: 'start', level: 'info', message: 'started' });
    expect(db.events('run-1', 0)[0]?.seq).toBe(seq);
    const first = db.reserveWhatsApp({ leadId: 'lead-1', businessName: 'Clinic', number: '923001234567', message: 'Hi', resend: false });
    expect(first.ok).toBe(true);
    const second = db.reserveWhatsApp({ leadId: 'lead-1', businessName: 'Clinic', number: '923001234567', message: 'Hi again', resend: false });
    expect(second.ok).toBe(false);
    const resend = db.reserveWhatsApp({ leadId: 'lead-1', businessName: 'Clinic', number: '923001234567', message: 'Hi again', resend: true });
    expect(resend.ok).toBe(true);
    db.close();
  });
});
