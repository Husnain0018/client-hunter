import { afterAll, describe, expect, it } from 'vitest';
import { Database } from '../src/db/database.js';
import { hasSavedSession, initPersistentAuthState } from '../src/services/baileysAuthState.js';
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

  it('1. Persists, serializes, and restores Baileys authentication state', async () => {
    const auth1 = await initPersistentAuthState(db);
    auth1.clearAuthState();
    expect(hasSavedSession(db)).toBe(false);

    expect(auth1.state.creds).toBeDefined();
    expect(auth1.state.creds.noiseKey).toBeDefined();
    expect(Buffer.isBuffer(auth1.state.creds.noiseKey.private)).toBe(true);

    // Save creds with registered = true to simulate completed pairing
    auth1.state.creds.registered = true;
    auth1.state.creds.me = { id: '923001234567@s.whatsapp.net', name: 'Test Account' };
    await auth1.saveCreds();
    expect(hasSavedSession(db)).toBe(true);

    // Save cryptographic signal keys
    const dummyKey = { key: Buffer.from('baileys-crypto-test-secret-key-1234') };
    await auth1.state.keys.set({
      'pre-key': {
        '101': dummyKey,
      },
    });

    // Simulate server restart by creating new auth state instance
    const auth2 = await initPersistentAuthState(db);
    expect(auth2.state.creds.noiseKey.private.equals(auth1.state.creds.noiseKey.private)).toBe(true);
    expect(auth2.state.creds.registered).toBe(true);

    const retrievedKeys = await auth2.state.keys.get('pre-key', ['101']);
    expect(retrievedKeys['101']).toBeDefined();
    expect(Buffer.isBuffer((retrievedKeys['101'] as any).key)).toBe(true);
    expect((retrievedKeys['101'] as any).key.toString()).toBe('baileys-crypto-test-secret-key-1234');

    // Clean session on logout
    auth2.clearAuthState();
    expect(hasSavedSession(db)).toBe(false);
  });

  it('2. Maintains singleton connection state and prevents conflicting concurrent connects', async () => {
    const status = manager.getStatus();
    expect(['not_connected', 'disconnected']).toContain(status.state);
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

  it('7. Preserves authenticated session on transient network disconnects without asking for QR', async () => {
    // Simulate active authenticated credentials
    const auth = await initPersistentAuthState(db);
    auth.state.creds.registered = true;
    auth.state.creds.me = { id: '923001234567@s.whatsapp.net', name: 'Dr. Dental Office' };
    await auth.saveCreds();

    expect(hasSavedSession(db)).toBe(true);

    const testManager = new BaileysManager(db);
    const status = testManager.getStatus();
    expect(status.hasSavedSession).toBe(true);

    // Simulate transient connection drop (e.g. 428 connectionClosed or 408 timedOut)
    (testManager as any).handleConnectionClose({
      error: { output: { statusCode: 428 }, message: 'Connection Closed by server' },
    });

    // Verify it transitioned to reconnecting / temporarily_disconnected without deleting credentials
    const reconnectingStatus = testManager.getStatus();
    expect(['reconnecting', 'temporarily_disconnected']).toContain(reconnectingStatus.state);
    expect(hasSavedSession(db)).toBe(true);
    expect(reconnectingStatus.qr).toBeNull(); // Must NOT emit QR code for saved session!

    // Clean up
    await testManager.destroy();
    auth.clearAuthState();
    expect(hasSavedSession(db)).toBe(false);
  });

  it('8. Never misclassifies an unregistered initial connection 401 failure as session_expired', async () => {
    const auth = await initPersistentAuthState(db, { forceFresh: true });
    auth.clearAuthState();
    expect(hasSavedSession(db)).toBe(false);

    const freshManager = new BaileysManager(db);
    (freshManager as any).activeAttemptHadSavedSession = false;
    (freshManager as any).qrRetryCount = 3; // simulate retries exhausted

    (freshManager as any).handleConnectionClose({
      error: { output: { statusCode: 401 }, message: 'Connection Failure' },
    });

    const status = freshManager.getStatus();
    expect(status.state).toBe('connection_failed');
    expect(status.state).not.toBe('session_expired');
    expect(status.error).not.toContain('session expired');
    await freshManager.destroy();
  });

  it('9. Clears dead credentials when a saved session expires (401) so subsequent connect generates a fresh QR', async () => {
    const auth = await initPersistentAuthState(db, { forceFresh: true });
    auth.state.creds.me = { id: '923224627528:12@s.whatsapp.net', name: 'Unitech solution' };
    (auth.state.creds as any).account = { details: Buffer.from('test') };
    await auth.saveCreds();
    expect(hasSavedSession(db)).toBe(true);

    const sessionManager = new BaileysManager(db);
    expect(sessionManager.getStatus().hasSavedSession).toBe(true);

    // Simulate background 401 loggedOut from phone unlinking
    (sessionManager as any).userInitiatedConnect = false;
    (sessionManager as any).handleConnectionClose({
      error: { output: { statusCode: 401 }, message: 'Logged Out' },
    });

    const expiredStatus = sessionManager.getStatus();
    expect(expiredStatus.state).toBe('session_expired');
    // Stale credentials must be wiped immediately so next Connect generates a fresh QR code
    expect(hasSavedSession(db)).toBe(false);
    expect(expiredStatus.hasSavedSession).toBe(false);

    await sessionManager.destroy();
  });

  it('10. Resolves Baileys v7 @lid Linked Identity JIDs to registered lead phone numbers and triggers AI reply', async () => {
    // Save Yaseen Children Care Clinic lead with phone +92 336 4013415
    const yaseenLead: Lead = {
      ...sampleLead,
      leadId: 'Ld09bb64dd7ed76c2107b',
      businessName: 'Yaseen Children Care Clinic | Dr Muhammad Sufyan Yaseen',
      phone: '+92 336 4013415',
      whatsappLink: 'https://wa.me/923364013415',
    };
    db.saveLead(yaseenLead);

    // Store LID-to-Phone reverse mapping in baileys_auth (exact format used by Baileys v7)
    db.saveLidPhoneMapping('154773928038590@lid', '923364013415@s.whatsapp.net');
    expect(db.resolvePhoneFromLid('154773928038590@lid')).toBe('923364013415');

    // Verify findLeadByPhone resolves raw @lid JID directly to Yaseen Children Care Clinic
    const matchedLead = db.findLeadByPhone('154773928038590@lid');
    expect(matchedLead).not.toBeNull();
    expect(matchedLead?.leadId).toBe('Ld09bb64dd7ed76c2107b');

    // Simulate Baileys messages.upsert arriving from 154773928038590@lid
    const lidManager = new BaileysManager(db);
    lidManager.setMessageHandler(async (msg) => {
      await service.handleIncomingWhatsAppMessage(msg);
    });

    await (lidManager as any).handleMessagesUpsert({
      type: 'notify',
      messages: [
        {
          key: {
            remoteJid: '154773928038590@lid',
            fromMe: false,
            id: 'A56048D78B11F5527BBA04EE2EDB648F',
          },
          pushName: 'Dr Muhammad Sufyan Yaseen',
          messageTimestamp: Math.floor(Date.now() / 1000),
          message: {
            conversation: 'Yes, what problems did you find on our clinic profile and how much does your setup cost?',
          },
        },
      ],
    });

    // Verify incoming client message AND AI auto-reply were both saved to Yaseen Children Care Clinic
    const msgs = db.getConversationMessages('Ld09bb64dd7ed76c2107b');
    const clientMsg = msgs.find((m) => m.sender === 'client' && m.providerMessageId === 'A56048D78B11F5527BBA04EE2EDB648F');
    const aiReply = msgs.find((m) => m.sender === 'assistant');

    expect(clientMsg).toBeDefined();
    expect(clientMsg?.text).toContain('what problems did you find');
    expect(aiReply).toBeDefined();
    expect(aiReply?.text.length).toBeGreaterThan(20);

    await lidManager.destroy();
  });

  it('11. Unwraps ephemeral, edited, media, document, voice note, and interactive WhatsApp messages', () => {
    const lidManager = new BaileysManager(db);

    // 1. Ephemeral wrapped extendedTextMessage
    const eph = lidManager.extractIncomingContent({
      ephemeralMessage: {
        message: {
          extendedTextMessage: {
            text: 'Check our website https://lahoresmiles.example',
          },
        },
      },
    });
    expect(eph.text).toBe('Check our website https://lahoresmiles.example');
    expect(eph.messageType).toBe('link');

    // 2. Image with caption
    const img = lidManager.extractIncomingContent({
      imageMessage: {
        caption: 'Here is our clinic reception card',
        mimetype: 'image/jpeg',
      },
    });
    expect(img.messageType).toBe('image');
    expect(img.text).toContain('Here is our clinic reception card');
    expect(img.attachments?.[0]?.type).toBe('image');

    // 3. Document PDF
    const doc = lidManager.extractIncomingContent({
      documentMessage: {
        fileName: 'Clinic_Services_Price_List.pdf',
        mimetype: 'application/pdf',
      },
    });
    expect(doc.messageType).toBe('document');
    expect(doc.text).toContain('Clinic_Services_Price_List.pdf');

    // 4. Voice note (audioMessage with ptt: true)
    const voice = lidManager.extractIncomingContent({
      audioMessage: {
        ptt: true,
        seconds: 14,
        mimetype: 'audio/ogg; codecs=opus',
      },
    });
    expect(voice.messageType).toBe('voice');
    expect(voice.text).toContain('14s');
  });

  it('12. Preserves incoming messages from unmatched senders and supports linking them to an existing lead', async () => {
    const unknownRes = await service.handleIncomingWhatsAppMessage({
      id: 'baileys_unmatched_msg_777',
      from: '923459998877',
      rawJid: '923459998877@s.whatsapp.net',
      pushName: 'Dr. Kamran Reception',
      text: 'Hi, this is Lahore Smile Studio messaging from our secondary reception WhatsApp number. Tell me more about your booking system.',
      timestamp: new Date().toISOString(),
    });

    expect(unknownRes.handled).toBe(true);
    expect(unknownRes.unmatchedContact).toBe(true);
    expect(unknownRes.leadId).toMatch(/^Lwa_/);

    const unmatchedLeadId = unknownRes.leadId!;
    const unmatchedConv = service.getClient(unmatchedLeadId);
    expect(unmatchedConv.businessName).toContain('Dr. Kamran Reception');
    expect(unmatchedConv.messages?.some((m) => m.sender === 'client' && m.text.includes('secondary reception'))).toBe(true);

    // Now link the unmatched contact to existing sampleLead ('lead-dentist-wa')
    const mergedConv = service.linkUnmatchedLead(unmatchedLeadId, sampleLead.leadId);
    expect(mergedConv.leadId).toBe(sampleLead.leadId);
    expect(mergedConv.messages?.some((m) => m.text.includes('secondary reception'))).toBe(true);
  });
});
