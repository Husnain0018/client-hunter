import { afterAll, describe, expect, it } from 'vitest';
import { Database } from '../src/db/database.js';
import { ClientHandlerService } from '../src/services/clientHandlerService.js';
import { ConversationEngine, isOptOutMessage } from '../src/services/conversationEngine.js';
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
    const firstMsg = await engine.generateFirstMessage(testLead.leadId);
    expect(firstMsg).toBeDefined();
    expect(firstMsg).toContain('Apex Dental & Aesthetics');
    expect(firstMsg).not.toContain('Apex Dental & Aesthetics from Apex Dental & Aesthetics');
    expect(firstMsg.length).toBeGreaterThan(25);
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
});
