import { afterAll, describe, expect, it } from 'vitest';
import { Database } from '../src/db/database.js';
import { ClientHandlerService } from '../src/services/clientHandlerService.js';
import { ConversationEngine, isOptOutMessage } from '../src/services/conversationEngine.js';
import { buildApp } from '../src/server.js';
import { issueToken } from '../src/security/auth.js';
import type { Lead } from '../src/types/domain.js';

describe('AI Client Handler & Conversation Lifecycle', () => {
  const db = new Database(':memory:');
  const service = new ClientHandlerService(db);
  const engine = new ConversationEngine(db);

  afterAll(() => {
    db.close();
  });

  const testLead: Lead = {
    runId: 'run-client-1',
    leadId: 'lead-dentist-101',
    businessName: 'Apex Dental & Aesthetics',
    category: 'Dental Clinic',
    leadType: 'Has Website',
    contactChannel: 'Email + Phone',
    website: 'https://apexdental.example',
    email: 'contact@apexdental.example',
    phone: '+923005551234',
    whatsappLink: 'https://wa.me/923005551234',
    address: 'Peoples Colony, Gujranwala',
    country: 'Pakistan',
    googleRating: 4.7,
    googleReviews: 38,
    googleMapsUrl: 'https://maps.google.com/?cid=123',
    locationStatus: 'Verified',
    locationVerified: true,
    leadScore: 82,
    priority: 'high',
    estimatedDealValue: '$500 - $900',
    recommendedServices: ['Website Development', 'WhatsApp Automation'],
    weaknesses: ['Website takes 4.2s to load on mobile', 'No online booking form'],
    analysisSummary: 'Active local dental clinic with high traffic but missing after-hours automated booking.',
    strategy: {
      overview: 'Transform mobile drop-offs into direct WhatsApp bookings.',
      problems: [
        {
          type: 'confirmed',
          category: 'website',
          title: 'Slow mobile responsiveness',
          detail: 'Patients abandon booking attempts.',
        },
      ],
      businessImpact: ['Losing patient inquiries after clinic hours'],
      relevantServices: ['Website Development', 'WhatsApp Automation'],
      solutions: [
        {
          service: 'WhatsApp Automation',
          howItWorks: 'We configure a 24/7 automated WhatsApp bot that answers appointment queries instantly.',
          impact: 'Recovers up to 35% of lost patient bookings.',
          estimatedTimeline: '1-2 weeks',
        },
      ],
      conversationGuidance: {
        icebreaker: "Hi Apex Dental team, I'm reaching out from Unitech Solution.",
        discoveryQuestions: ['How do you currently handle patient inquiries after 8 PM?'],
        objectionHandling: ['We offer a 14-day test period with zero downtime.'],
      },
      nextSteps: ['Schedule a 5-minute setup call.'],
    },
    websiteScore: 48,
    websiteStatus: 'Needs Improvement',
    websiteIssues: ['Slow response', 'Missing mobile CTA'],
    websiteImages: [],
    techStack: ['WordPress'],
    social: {},
    socialActivity: {},
    socialStatus: '',
    competitors: [],
    emailSubject: 'Ideas for Apex Dental',
    emailBodyText: 'Hi team',
    emailBodyHtml: '<p>Hi team</p>',
    whatsappMessage: "Hi Apex Dental & Aesthetics team, I'm reaching out from Unitech Solution. We help dental practices automate patient bookings.",
    approvalStatus: 'Pending Review',
    emailStatus: 'Draft',
    responseStatus: 'No Reply',
    senderName: 'Unitech Solution',
    searchQuery: 'dental clinic in peoples colony',
    createdAt: new Date().toISOString(),
    emailSentAt: '',
    followUp1Date: '',
    followUp2Date: '',
    gmailThreadId: '',
  };

  it('automatically integrates generated leads into Client Handler', () => {
    db.createRun('run-client-1', {
      userName: 'Unitech Solution',
      company: '',
      userEmail: 'ali@example.com',
      userPhone: '+923000000000',
      portfolio: '',
      services: ['Website Development', 'WhatsApp Automation'],
      niche: 'Dental Clinic',
      area: 'Peoples Colony, Gujranwala',
      country: 'Pakistan',
      maxLeads: 5,
      checkSocial: false,
      emailSummary: false,
    }, new Date().toISOString());

    db.saveLead(testLead);

    const clients = service.listClients();
    expect(clients.length).toBeGreaterThan(0);

    const client = service.getClient(testLead.leadId);
    expect(client).toBeDefined();
    expect(client.businessName).toBe('Apex Dental & Aesthetics');
    expect(client.phone).toBe('+923005551234');
    expect(client.stage).toBe('new');
    expect(client.autoPilot).toBe(true);
    expect(client.lead?.recommendedServices).toContain('WhatsApp Automation');
  });

  it('generates a personalized first WhatsApp outreach from research without duplication', async () => {
    // Generate fresh message from lead research
    const firstMsg = await engine.generateFirstMessage(testLead.leadId);
    expect(firstMsg).toBeDefined();
    expect(firstMsg).toContain('Apex Dental & Aesthetics');
    expect(firstMsg).not.toContain('Apex Dental & Aesthetics from Apex Dental & Aesthetics');
    expect(firstMsg).not.toContain('Unitech Solution from Unitech Solution');
    expect(firstMsg.length).toBeGreaterThan(50);
  });

  it('generates personalized WhatsApp outreach with company intro, research findings, impact, and user services', async () => {
    // Create lead with specific research findings
    const dentalLead: Lead = {
      ...testLead,
      leadId: 'dental_clinic_res_1',
      phone: '+923001112233',
      businessName: 'Pearl Smile Dental Care',
      category: 'Dental Clinic',
      leadType: 'Has Website',
      websiteScore: 82,
      websiteStatus: 'Good',
      socialActivity: {
        facebook: { status: 'Inactive', url: 'https://facebook.com/pearlsmile', lastPost: '45 days ago', daysInactive: 45 },
      },
      strategy: {
        overview: 'Pearl Smile Dental Care has a solid local practice with 4.7 stars.',
        problems: [
          {
            type: 'confirmed',
            category: 'social',
            title: 'Stale Social Media Activity',
            detail: 'No posts in 45 days on Facebook.',
            evidence: 'Last post was 45 days ago.',
          },
          {
            type: 'potential',
            category: 'booking',
            title: 'Lack of Online Appointment Booking',
            detail: 'Patients must call during office hours to schedule.',
            evidence: 'No online calendar detected.',
          },
        ],
        businessImpact: [
          'Harder for potential patients to discover services and schedule appointments easily.',
        ],
        relevantServices: ['WhatsApp Automation', 'Website Development'],
        solutions: [],
        conversationGuidance: { icebreaker: '', discoveryQuestions: [], objectionHandling: [] },
        nextSteps: [],
      },
      whatsappMessage: '', // trigger fresh generation
    };

    db.saveLead(dentalLead);

    const message = await engine.generateFirstMessage(dentalLead.leadId);

    // 1. Introduction using company name
    expect(message).toContain("Hi, I'm reaching out from Unitech Solution.");
    expect(message).not.toContain('Unitech Solution from Unitech Solution');

    // 2. Brief summary of research mentioning 2-3 specific problems
    expect(message).toContain('Pearl Smile Dental Care');
    expect(message).toContain('online presence');
    expect(message).toContain('limited recent activity on your social media');
    expect(message).toContain('online appointment-booking');

    // 3. Potential business impact
    expect(message).toContain('These issues may make it harder for potential patients');
    expect(message).toContain('book appointments easily');

    // 4. Relevant services
    expect(message).toContain('improve their online presence and streamline customer communication');

    // 5. Polite soft close
    expect(message).toContain('Would you be interested in discussing them?');
  });

  it('correctly uses personal name introduction when configured as individual sender', async () => {
    db.createRun('run-personal-ali', {
      userName: 'Ali',
      company: '',
      userEmail: 'ali@example.com',
      services: ['Website Development', 'WhatsApp Automation'],
      niche: 'Dental Clinic',
      area: 'Model Town',
      country: 'Pakistan',
      maxLeads: 5,
      checkSocial: false,
      emailSummary: false,
    }, new Date().toISOString());

    const leadAli: Lead = {
      ...testLead,
      leadId: 'lead_personal_ali',
      phone: '+923004445566',
      runId: 'run-personal-ali',
      businessName: 'Dr. Tariq Dental Surgery',
      category: 'Dental Clinic',
      leadType: 'No Website',
      websiteStatus: 'No Website',
      whatsappMessage: '',
      strategy: {
        overview: 'Dr. Tariq Dental Surgery is a dental clinic.',
        problems: [
          {
            type: 'confirmed',
            category: 'website',
            title: 'No Dedicated Website',
            detail: 'Lacks a dedicated business website.',
            evidence: 'No domain found.',
          },
          {
            type: 'potential',
            category: 'booking',
            title: 'No Online Booking',
            detail: 'No online booking interface.',
          },
        ],
        businessImpact: [
          'Harder for patients to find reliable clinic information and book appointments easily.',
        ],
        relevantServices: ['Website Development', 'WhatsApp Automation'],
        solutions: [],
        conversationGuidance: { icebreaker: '', discoveryQuestions: [], objectionHandling: [] },
        nextSteps: [],
      },
    };

    db.saveLead(leadAli);

    const message = await engine.generateFirstMessage(leadAli.leadId);

    // Personal name introduction
    expect(message.startsWith('Hi, my name is Ali.')).toBe(true);
    expect(message).not.toContain('I am Ali from Ali');
    expect(message).toContain('Dr. Tariq Dental Surgery');
    expect(message).toContain('missing dedicated website');
    expect(message).toContain('Would you be interested in discussing them?');
  });

  it('explains researched problems and evidence in detail when client responds inquiring about findings', async () => {
    // Add client question inquiring about the research findings
    db.addConversationMessage({
      id: 'client_inq_1',
      leadId: testLead.leadId,
      sender: 'client',
      text: 'What specific problems did you find during your research?',
      timestamp: new Date().toISOString(),
      status: 'Read',
    });

    const reply = await engine.generateReply(testLead.leadId);
    expect(reply.isOptOut).toBe(false);
    expect(['interested', 'conversing']).toContain(reply.detectedStage);
    expect(reply.replyText.length).toBeGreaterThan(30);

    // Also assert deterministic engine directly produces the structured research problem breakdown
    const detReply = (engine as any).deterministicReply(
      testLead,
      db.getClientConversation(testLead.leadId),
      db.getConversationMessages(testLead.leadId),
      'What specific problems did you find during your research?',
      'Unitech Solution'
    );
    expect(detReply.replyText).toContain('review of Apex Dental & Aesthetics');
    expect(detReply.replyText).toContain('specific areas');
    expect(detReply.detectedStage).toBe('interested');
    expect(detReply.summaryUpdate).toContain('research findings');
  });

  it('detects opt-out keywords accurately and stops communication', async () => {
    expect(isOptOutMessage('Please STOP messaging me')).toBe(true);
    expect(isOptOutMessage('unsubscribe')).toBe(true);
    expect(isOptOutMessage('not interested')).toBe(true);
    expect(isOptOutMessage('how much is it?')).toBe(false);

    const reply = await engine.generateReply(testLead.leadId);
    // Simulate opt-out by adding client opt out message
    db.addConversationMessage({
      id: 'opt_msg_1',
      leadId: testLead.leadId,
      sender: 'client',
      text: 'Please stop contacting our clinic, not interested.',
      timestamp: new Date().toISOString(),
      status: 'Read',
    });

    const optOutReply = await engine.generateReply(testLead.leadId);
    expect(optOutReply.isOptOut).toBe(true);
    expect(optOutReply.detectedStage).toBe('opted_out');
  });

  it('safely handles incoming webhooks, deduplicates messages, and respects auto-pilot', async () => {
    // Reset conversation to active
    service.updateStage(testLead.leadId, 'conversing');

    const webhookPayload = {
      id: 'waha_msg_unique_9988',
      from: '923005551234@c.us',
      fromMe: false,
      body: 'How much does your WhatsApp automation service cost?',
    };

    // First arrival
    const result1 = await service.handleIncomingWebhook(webhookPayload);
    expect(result1.handled).toBe(true);
    expect(result1.leadId).toBe(testLead.leadId);
    expect(result1.autoReplied).toBe(true);
    expect(result1.replyMessage).toContain('$');

    // Duplicate webhook arrival (e.g. WAHA retry)
    const result2 = await service.handleIncomingWebhook(webhookPayload);
    expect(result2.handled).toBe(true);
    expect(result2.reason).toContain('Duplicate');
  }, 15000);

  it('escalates to needs_human when client requests unauthorized discounts', async () => {
    const discountPayload = {
      id: 'waha_msg_discount_101',
      from: '923005551234@c.us',
      fromMe: false,
      body: 'Can you give us a 70% discount or do it for free first?',
    };

    const result = await service.handleIncomingWebhook(discountPayload);
    expect(result.handled).toBe(true);
    expect(result.autoReplied).toBe(false);

    const conv = service.getClient(testLead.leadId);
    expect(conv.stage).toBe('needs_human');
    expect(conv.humanInterventionReason).toContain('discount');
  });

  it('finalizes deal closure and logs terms', async () => {
    const closed = await service.closeDeal(testLead.leadId, {
      leadId: testLead.leadId,
      agreedServices: ['WhatsApp Automation'],
      agreedPrice: '$650',
      agreedTimeline: '10 days',
      agreedDeliverables: 'Automated 24/7 WhatsApp appointment booking system',
      dealNotes: 'Client confirmed via chat, kickoff scheduled for next Monday.',
      notifyUserWhatsApp: false,
    });

    expect(closed.stage).toBe('closed_won');
    expect(closed.agreedPrice).toBe('$650');
    expect(closed.agreedTimeline).toBe('10 days');
    expect(closed.closedAt).toBeDefined();

    const stats = service.getStats();
    expect(stats.closedWon).toBeGreaterThanOrEqual(1);
  });

  it('extracts requirements, builds project plan, and formats deal notification', async () => {
    // Set notification phone in settings
    db.setSetting('deal_notification_phone', '+923009998877');
    expect(db.getSetting('deal_notification_phone')).toBe('+923009998877');

    const freshLeadId = 'lead-dentist-req-plan';
    const freshLead: Lead = {
      ...testLead,
      leadId: freshLeadId,
      businessName: 'Dental Care Center',
      phone: '+923001112244',
      whatsappLink: 'https://wa.me/923001112244',
    };
    db.saveLead(freshLead);
    service.updateStage(freshLeadId, 'conversing');

    // Client shares specific requirements
    const reqResult = await service.handleIncomingWebhook({
      id: 'waha_req_msg_1',
      from: '923001112244@c.us',
      fromMe: false,
      body: 'We definitely need an online appointment booking system and instant WhatsApp auto responder for missed calls.',
    });

    expect(reqResult.handled).toBe(true);
    expect(reqResult.autoReplied).toBe(true);

    const convAfterReq = service.getClient(freshLeadId);
    expect(convAfterReq.identifiedRequirements).toBeDefined();
    expect(convAfterReq.identifiedRequirements?.length).toBeGreaterThan(0);
    expect(convAfterReq.aiHandled).toBe(true);

    // Client accepts and agrees to start
    const agreeResult = await service.handleIncomingWebhook({
      id: 'waha_agree_msg_1',
      from: '923001112244@c.us',
      fromMe: false,
      body: "Sounds good, let's start! Where do I pay?",
    });

    expect(agreeResult.handled).toBe(true);
    expect(agreeResult.autoReplied).toBe(true);

    const convAfterClose = service.getClient(freshLeadId);
    expect(convAfterClose.stage).toBe('closed_won');
    expect(convAfterClose.projectPlan).toBeDefined();
    expect(convAfterClose.projectPlan?.services).toBeDefined();
    expect(convAfterClose.projectPlan?.deliverables).toBeDefined();
    expect(convAfterClose.dealNotificationPhone).toBe('923009998877');
    expect(convAfterClose.dealNotificationText).toContain('DEAL CLOSED - CLIENT HANDLER REPORT');
    expect(convAfterClose.dealNotificationText).toContain('Dental Care Center');

    // Verify stats include all metrics
    const finalStats = service.getStats();
    expect(finalStats.totalClients).toBeGreaterThanOrEqual(2);
    expect(finalStats.closedWon).toBeGreaterThanOrEqual(2);
    expect(finalStats.totalIncomingMessages).toBeGreaterThan(0);
    expect(finalStats.totalOutgoingMessages).toBeGreaterThan(0);
    expect(finalStats.aiHandledCount).toBeGreaterThan(0);
    expect(finalStats.requirementsIdentifiedCount).toBeGreaterThan(0);
    expect(finalStats.projectSummariesCount).toBeGreaterThan(0);
  });

  it('saves, retrieves, and validates notification preferences via API routes', async () => {
    const testDb = new Database(':memory:');
    const app = buildApp(testDb);
    const token = await issueToken('1h');

    // 1. Initial get
    const initialGet = await app.inject({
      method: 'GET',
      url: '/api/client-handler/settings',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(initialGet.statusCode).toBe(200);
    const initData = JSON.parse(initialGet.body);
    expect(initData.ok).toBe(true);
    expect(initData.settings.dealNotificationPhone).toBe('');

    // 2. Reject invalid phone number length
    const invalidPost = await app.inject({
      method: 'POST',
      url: '/api/client-handler/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { dealNotificationPhone: '123' },
    });
    expect(invalidPost.statusCode).toBe(400);
    const invalidData = JSON.parse(invalidPost.body);
    expect(invalidData.ok).toBe(false);
    expect(invalidData.error).toContain('Expected 8-15 digits');

    // 3. Successfully save valid international phone number
    const savePost = await app.inject({
      method: 'POST',
      url: '/api/client-handler/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { dealNotificationPhone: '+92 300 9876543', dealNotificationsEnabled: true },
    });
    expect(savePost.statusCode).toBe(200);
    const saveData = JSON.parse(savePost.body);
    expect(saveData.ok).toBe(true);
    expect(saveData.settings.dealNotificationPhone).toBe('+923009876543');
    expect(saveData.settings.dealNotificationsEnabled).toBe(true);

    // 4. Verify persisted in DB and returned on subsequent GET
    expect(testDb.getSetting('deal_notification_phone')).toBe('+923009876543');
    const subsequentGet = await app.inject({
      method: 'GET',
      url: '/api/client-handler/settings',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(subsequentGet.statusCode).toBe(200);
    const subData = JSON.parse(subsequentGet.body);
    expect(subData.settings.dealNotificationPhone).toBe('+923009876543');
    expect(subData.settings.dealNotificationsEnabled).toBe(true);

    // 5. Test notification with disconnected WhatsApp reports helpful error
    const testNotifRes = await app.inject({
      method: 'POST',
      url: '/api/client-handler/test-notification',
      headers: { authorization: `Bearer ${token}` },
      payload: { phone: '+923009876543' },
    });
    expect(testNotifRes.statusCode).toBe(400);
    const testData = JSON.parse(testNotifRes.body);
    expect(testData.ok).toBe(false);
    expect(testData.error).toContain('WhatsApp is disconnected');

    // 6. Test notification validation when phone is completely invalid
    const testInvalidPhone = await app.inject({
      method: 'POST',
      url: '/api/client-handler/test-notification',
      headers: { authorization: `Bearer ${token}` },
      payload: { phone: 'abc123' },
    });
    expect(testInvalidPhone.statusCode).toBe(400);
    expect(JSON.parse(testInvalidPhone.body).error).toContain('Expected 8-15 digits');

    await app.close();
    testDb.close();
  });
});
