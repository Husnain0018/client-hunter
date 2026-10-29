import { afterAll, describe, expect, it } from 'vitest';
import { Database } from '../src/db/database.js';
import { useSqliteAuthState } from '../src/services/baileysAuthState.js';
import { BaileysManager } from '../src/services/baileysManager.js';
import { ClientHandlerService } from '../src/services/clientHandlerService.js';
import { buildApp } from '../src/server.js';
import { issueToken } from '../src/security/auth.js';
import type { Lead } from '../src/types/domain.js';

describe('Baileys WhatsApp Direct Integration Suite', () => {
  const db = new Database(':memory:');
  const service = new ClientHandlerService(db);
  const manager = new BaileysManager(db);

  afterAll(() => {
    db.close();
  });

  const sampleLead: Lead = {
    runId: 'run-wa-test',
    leadId: 'lead-dentist-wa',
    businessName: 'Lahore Smile Studio',
    category: 'Dental Clinic',
    leadType: 'Has Website',
    contactChannel: 'Phone Only',
    website: 'https://lahoresmiles.example',
    email: '',
    phone: '+923007654321',
    whatsappLink: 'https://wa.me/923007654321',
    address: 'Gulberg III, Lahore',
    country: 'Pakistan',
    googleRating: 4.8,
    googleReviews: 50,
    leadScore: 85,
    priority: 'high',
    estimatedDealValue: '$500',
    recommendedServices: ['WhatsApp Automation'],
    weaknesses: ['No automated booking'],
    analysisSummary: 'High-traffic dental clinic missing after-hours WhatsApp lead capture',
    websiteScore: 70,
    websiteStatus: 'Good',
    websiteIssues: [],
    websiteImages: [],
    techStack: [],
    social: {},
    socialActivity: {},
    socialStatus: '',
    competitors: [],
    emailSubject: '',
    emailBodyText: '',
    emailBodyHtml: '',
    whatsappMessage: 'Hi Lahore Smile Studio, we can automate your patient booking on WhatsApp.',
    approvalStatus: 'No Email',
    emailStatus: 'No Email',
    responseStatus: 'No Reply',
    senderName: 'Client Hunter Team',
    searchQuery: 'Dentists in Lahore',
    createdAt: new Date().toISOString(),
    emailSentAt: '',
    followUp1Date: '',
    followUp2Date: '',
    gmailThreadId: '',
  };

  it('1. Persists, serializes, and restores Baileys authentication state via SQLite', async () => {
    expect(db.hasBaileysAuth()).toBe(false);

    const auth1 = useSqliteAuthState(db);
    expect(auth1.state.creds).toBeDefined();
    expect(auth1.state.creds.noiseKey).toBeDefined();
    expect(Buffer.isBuffer(auth1.state.creds.noiseKey.private)).toBe(true);

    // Save creds
    await auth1.saveCreds();
    expect(db.hasBaileysAuth()).toBe(true);

    // Save cryptographic signal keys
    const dummyKey = { key: Buffer.from('baileys-crypto-test-secret-key-1234') };
    await auth1.state.keys.set({
      'pre-key': {
        '101': dummyKey,
      },
    });

    // Simulate server restart by creating new auth state instance from the same DB
    const auth2 = useSqliteAuthState(db);
    expect(auth2.state.creds.noiseKey.private.equals(auth1.state.creds.noiseKey.private)).toBe(true);

    const retrievedKeys = await auth2.state.keys.get('pre-key', ['101']);
    expect(retrievedKeys['101']).toBeDefined();
    expect(Buffer.isBuffer((retrievedKeys['101'] as any).key)).toBe(true);
    expect((retrievedKeys['101'] as any).key.toString()).toBe('baileys-crypto-test-secret-key-1234');

    // Clean session on logout
    auth2.clearAuthState();
    expect(db.hasBaileysAuth()).toBe(false);
  });

  it('2. Maintains singleton connection state and prevents conflicting concurrent connects', async () => {
    const status = manager.getStatus();
    expect(status.state).toBe('not_connected');
    expect(status.qr).toBeNull();
    expect(status.isReady).toBe(false);

    // Connect call returns status and enters initializing state
    const promise1 = manager.connect();
    const promise2 = manager.connect();

    // Idempotent: both calls return promises that resolve safely
    expect(promise1).toBeDefined();
    expect(promise2).toBeDefined();

    await promise1;
    await promise2;

    const currentStatus = manager.getStatus();
    expect(['initializing', 'waiting_for_qr', 'connecting', 'connected', 'connection_error']).toContain(currentStatus.state);

    // Clean up
    await manager.disconnect();
    expect(manager.getStatus().state).toBe('disconnected');
  });

  it('3. Emits live status updates via EventEmitter for SSE streaming', async () => {
    let receivedUpdate: any = null;
    const onStatus = (s: any) => {
      receivedUpdate = s;
    };

    manager.events.on('status', onStatus);
    await manager.disconnect();

    expect(receivedUpdate).not.toBeNull();
    expect(receivedUpdate.state).toBe('disconnected');

    manager.events.off('status', onStatus);
  });

  it('4. Links incoming Baileys messages to registered leads and prevents duplicate processing', async () => {
    db.createRun(sampleLead.runId, {
      userName: 'Client Hunter Team',
      company: 'Growth Agency',
      userEmail: 'team@example.com',
      services: ['WhatsApp Automation'],
      niche: 'Dental Clinic',
      area: 'Lahore',
      country: 'Pakistan',
      maxLeads: 10,
      checkSocial: false,
      emailSummary: false,
    }, new Date().toISOString());

    db.saveLead(sampleLead);
    service.updateStage(sampleLead.leadId, 'conversing');

    // Simulate incoming message through Baileys
    const incomingMsg1 = {
      id: 'baileys_unique_msg_1001',
      from: '923007654321',
      rawJid: '923007654321@s.whatsapp.net',
      text: 'Do you offer a demo of your automated booking system?',
      timestamp: new Date().toISOString(),
    };

    // First arrival
    const res1 = await service.handleIncomingWhatsAppMessage(incomingMsg1);
    expect(res1.handled).toBe(true);
    expect(res1.leadId).toBe(sampleLead.leadId);

    // Verify conversation message record was stored
    const messages = db.getConversationMessages(sampleLead.leadId);
    expect(messages.some((m) => m.text.includes('demo of your automated booking system'))).toBe(true);

    // Duplicate arrival (message replay, network retry)
    const res2 = await service.handleIncomingWhatsAppMessage(incomingMsg1);
    expect(res2.handled).toBe(true);
    expect(res2.reason).toContain('Duplicate');
  });

  it('5. Correctly handles delivery status updates (ACKs)', () => {
    const testProviderId = 'baileys_test_provider_99';
    db.reserveWhatsApp({
      leadId: sampleLead.leadId,
      businessName: sampleLead.businessName,
      number: sampleLead.phone,
      message: 'Test message for ACK verification',
      resend: true,
    });
    db.updateWhatsApp(sampleLead.leadId, { status: 'Sent', providerMessageId: testProviderId });

    // Update to Delivered
    const updated1 = db.updateWhatsAppStatusByProviderId(testProviderId, 'Delivered');
    expect(updated1).toBe(true);
    expect(db.getWhatsApp(sampleLead.leadId)?.status).toBe('Delivered');

    // Update to Read
    const updated2 = db.updateWhatsAppStatusByProviderId(testProviderId, 'Read');
    expect(updated2).toBe(true);
    expect(db.getWhatsApp(sampleLead.leadId)?.status).toBe('Read');
  });

  it('6. Serves authenticated WhatsApp API endpoints correctly', async () => {
    const app = buildApp();
    const token = await issueToken('1h');

    // 1. Unauthenticated request rejected
    const unauthed = await app.inject({
      method: 'GET',
      url: '/api/whatsapp/status',
    });
    expect(unauthed.statusCode).toBe(401);

    // 2. Authenticated status read
    const authedStatus = await app.inject({
      method: 'GET',
      url: '/api/whatsapp/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(authedStatus.statusCode).toBe(200);
    const body = authedStatus.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBeDefined();
    expect(body.status.state).toBeDefined();

    // 3. Disconnect endpoint
    const disconnectRes = await app.inject({
      method: 'POST',
      url: '/api/whatsapp/disconnect',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(disconnectRes.statusCode).toBe(200);
    expect(disconnectRes.json().status.state).toBe('disconnected');

    // 4. Logout endpoint clears credentials
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/whatsapp/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json().status.state).toBe('logged_out');

    await app.close();
  });
});
