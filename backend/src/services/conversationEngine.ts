import { env } from '../config/env.js';
import type { Database } from '../db/database.js';
import type { ClientConversation, ClientStage, ConversationMessage, CustomService, Lead } from '../types/domain.js';
import { resolveSenderIdentity } from './aiAnalyzer.js';

export interface AIResponseResult {
  replyText: string;
  detectedStage: ClientStage;
  needsHumanIntervention: boolean;
  humanInterventionReason?: string;
  isOptOut: boolean;
  dealAgreed: boolean;
  suggestedTerms?: {
    services?: string[];
    price?: string;
    timeline?: string;
    deliverables?: string;
  };
  summaryUpdate?: string;
}

const OPT_OUT_PATTERNS = [
  /\b(stop|unsubscribe|opt[\s-]?out|leave\s+me\s+alone|don'?t\s+(?:message|text|call)\s+(?:me|again)|not\s+interested|remove\s+(?:my\s+number|me))\b/i,
];

export function isOptOutMessage(text: string): boolean {
  return OPT_OUT_PATTERNS.some((p) => p.test(text.trim()));
}

export class ConversationEngine {
  constructor(private readonly db: Database) {}

  /**
   * Generates a tailored first WhatsApp outreach message for a lead
   */
  async generateFirstMessage(leadId: string): Promise<string> {
    const lead = this.db.getLead(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found.`);

    if (lead.whatsappMessage && lead.whatsappMessage.trim().length > 20) {
      return lead.whatsappMessage.trim();
    }

    const run = lead.runId ? this.db.getRun(lead.runId) : null;
    const userName = run?.request.userName || lead.senderName || 'Consultant';
    const company = run?.request.company || '';
    const senderType = run?.request.senderType || 'auto';
    const identity = resolveSenderIdentity(userName, company, senderType);

    const greeting = identity.whatsappGreeting(lead.businessName);
    const services = lead.recommendedServices.length ? lead.recommendedServices.slice(0, 2).join(' and ') : 'digital presence';
    const location = lead.address ? ` in ${lead.address.split(',')[0].trim()}` : '';

    return `${greeting} I noticed your business on Google Maps${location}. We help local ${lead.category || 'businesses'} capture more client bookings with ${services}. Would you be open to a quick 3-minute chat on how this works?`;
  }

  /**
   * Generates the next response to an incoming client message or user trigger
   */
  async generateReply(leadId: string, userGuidance?: string): Promise<AIResponseResult> {
    const lead = this.db.getLead(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found.`);

    const conv = this.db.getClientConversation(leadId);
    const messages = this.db.getConversationMessages(leadId);
    const customServices = this.db.listCustomServices();
    const run = lead.runId ? this.db.getRun(lead.runId) : null;

    const userName = run?.request.userName || lead.senderName || 'Our Team';
    const company = run?.request.company || '';
    const senderType = run?.request.senderType || 'auto';
    const identity = resolveSenderIdentity(userName, company, senderType);

    const lastClientMessage = [...messages].reverse().find((m) => m.sender === 'client');
    const clientText = lastClientMessage?.text || '';

    // Step 1: Immediate opt-out check
    if (clientText && isOptOutMessage(clientText)) {
      return {
        replyText: `Thank you for letting us know. We have marked your number to not be contacted again. Have a great day!`,
        detectedStage: 'opted_out',
        needsHumanIntervention: false,
        isOptOut: true,
        dealAgreed: false,
        summaryUpdate: 'Client opted out of communications.',
      };
    }

    // Step 2: Try AI-powered response if OPENAI_API_KEY configured
    if (env.OPENAI_API_KEY) {
      try {
        const aiResult = await this.modelConversationReply(
          lead,
          conv,
          messages,
          customServices,
          identity.displayName,
          userGuidance
        );
        if (aiResult) return aiResult;
      } catch (err) {
        console.warn('[ConversationEngine] AI model failed, falling back to deterministic engine:', err);
      }
    }

    // Step 3: Reliable Deterministic Fallback Engine
    return this.deterministicReply(lead, conv, messages, clientText, identity.displayName, userGuidance);
  }

  /**
   * Generates a respectful, non-spammy follow-up message
   */
  async generateFollowUp(leadId: string): Promise<string> {
    const lead = this.db.getLead(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found.`);

    const conv = this.db.getClientConversation(leadId);
    const count = (conv?.followUpCount || 0) + 1;
    const service = lead.recommendedServices[0] || 'patient appointment booking';

    if (count === 1) {
      return `Hi ${lead.businessName} team, just following up on our previous note. We recently helped a nearby practice automate their ${service} inquiries so they stopped missing weekend leads. Would you like to see a brief 60-second preview?`;
    }

    if (count === 2) {
      return `Hi ${lead.businessName} team, checking in one last time! I know how busy running ${lead.businessName} gets. If you're currently satisfied with your setup, no problem at all. Just wanted to make sure you had the option available whenever you're ready!`;
    }

    return `Hi ${lead.businessName} team, hope all is well! Feel free to reach out anytime if you ever need help with ${service}.`;
  }

  private async modelConversationReply(
    lead: Lead,
    conv: ClientConversation | null,
    messages: ConversationMessage[],
    customServices: CustomService[],
    displayName: string,
    userGuidance?: string
  ): Promise<AIResponseResult | null> {
    const conversationTranscript = messages
      .slice(-10)
      .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
      .join('\n');

    const availableServices = [
      'Website Development',
      'SEO',
      'Social Media Management',
      'AI Chatbot',
      'WhatsApp Automation',
      'CRM Automation',
      'Google Ads',
      'UGC Video Ads',
      'Branding & Design',
      ...customServices.map((s) => s.name),
    ];

    const systemPrompt = `You are a professional, polite, and persuasive Client Acquisition Specialist representing "${displayName}".
Your objective is to guide prospective local businesses from initial contact through understanding their needs, explaining solutions, addressing questions/objections, and closing deals.

CRITICAL RULES & GUARDRAILS:
1. ONLY offer services from the authorized services list: ${JSON.stringify(availableServices)}.
2. Base solutions strictly on the lead's verified public facts:
   - Business: ${lead.businessName} (${lead.category}) in ${lead.address}
   - Website Status: ${lead.websiteStatus} (Score: ${lead.websiteScore ?? 'None'})
   - Verified Weaknesses: ${JSON.stringify(lead.weaknesses)}
   - Recommended Services: ${JSON.stringify(lead.recommendedServices)}
   - Estimated Deal Value: ${lead.estimatedDealValue}
3. Never make unsupported claims about problems that were not verified. If the lead has no website, politely mention that a mobile-friendly site would help them capture Google Maps searchers.
4. If the client asks for discounts, unapproved custom work, or guarantees outside standard scope:
   Set "needsHumanIntervention": true, and explain why in "humanInterventionReason".
5. If the client asks to opt-out, stop, or not be contacted:
   Set "isOptOut": true, "detectedStage": "opted_out".
6. Only set "dealAgreed": true and "detectedStage": "closed_won" if the client has EXPLICITLY confirmed an agreement (e.g. "Let's proceed", "Send the contract/invoice", "Agreed on terms"). DO NOT mark closed_won if they are just expressing initial interest.
7. Tone: Professional, warm, concise (WhatsApp messages should usually be 2-4 sentences max, never huge walls of text).

Output ONLY valid JSON with keys:
{
  "replyText": string,
  "detectedStage": "contacted" | "awaiting_reply" | "conversing" | "interested" | "negotiating" | "needs_human" | "closed_won" | "opted_out",
  "needsHumanIntervention": boolean,
  "humanInterventionReason": string,
  "isOptOut": boolean,
  "dealAgreed": boolean,
  "suggestedTerms": {
    "services": string[],
    "price": string,
    "timeline": string,
    "deliverables": string
  },
  "summaryUpdate": string
}`;

    const userMessage = `Current Stage: ${conv?.stage || 'new'}
User's internal guidance: ${userGuidance || 'None'}

Conversation Transcript:
${conversationTranscript || 'No previous messages.'}

Generate the best response and stage analysis.`;

    const res = await fetch(`${env.OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: 0.25,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return null;
    const data = await res.json() as any;
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as AIResponseResult;
    return parsed;
  }

  private deterministicReply(
    lead: Lead,
    conv: ClientConversation | null,
    messages: ConversationMessage[],
    clientText: string,
    displayName: string,
    userGuidance?: string
  ): AIResponseResult {
    const textLower = clientText.toLowerCase();
    const service = lead.recommendedServices[0] || 'digital growth';
    const dealValue = lead.estimatedDealValue || '$400 - $800';

    // 1. Opt-out detection
    if (isOptOutMessage(clientText)) {
      return {
        replyText: 'Understood. We will not contact you again. Thank you for your time!',
        detectedStage: 'opted_out',
        needsHumanIntervention: false,
        isOptOut: true,
        dealAgreed: false,
        summaryUpdate: 'Client requested opt out.',
      };
    }

    // 2. High discount or custom demand requiring human review
    if (/(discount|half\s+price|free|guarantee|refund|cheap|special\s+deal)/i.test(textLower)) {
      return {
        replyText: `We want to make sure the pricing matches your exact clinic needs without cutting corners. Let me check with our lead strategist to see what custom package we can offer you!`,
        detectedStage: 'needs_human',
        needsHumanIntervention: true,
        humanInterventionReason: `Client inquired about custom discounts or special pricing: "${clientText.slice(0, 100)}"`,
        isOptOut: false,
        dealAgreed: false,
        summaryUpdate: 'Client requested discount; flagged for human intervention.',
      };
    }

    // 3. Explicit deal acceptance / closing criteria
    if (/(let'?s\s+do\s+it|deal|agree|sounds\s+good,?\s+let'?s\s+start|send\s+(?:the\s+)?(?:invoice|contract|agreement)|where\s+do\s+i\s+pay|ready\s+to\s+proceed)/i.test(textLower)) {
      return {
        replyText: `Fantastic! We are thrilled to partner with ${lead.businessName}. We will prepare your kickoff onboarding for ${service} (${dealValue}, 1-2 weeks delivery). Could you confirm the best email to send over the project brief?`,
        detectedStage: 'closed_won',
        needsHumanIntervention: false,
        isOptOut: false,
        dealAgreed: true,
        suggestedTerms: {
          services: lead.recommendedServices.slice(0, 2),
          price: dealValue,
          timeline: '1-2 weeks',
          deliverables: `Setup and deployment of ${service} with dedicated support.`,
        },
        summaryUpdate: 'Client agreed to proceed. Deal successfully closed!',
      };
    }

    // 4. Pricing / Cost Question
    if (/(cost|price|how\s+much|rates|charges|fee|budget)/i.test(textLower)) {
      return {
        replyText: `Our typical investment for ${service} ranges around ${dealValue}, depending on the exact scope and integrations required. We include full setup, testing, and 30 days of direct support. Would you like a fast 5-minute walk-through to see what fits ${lead.businessName} best?`,
        detectedStage: 'negotiating',
        needsHumanIntervention: false,
        isOptOut: false,
        dealAgreed: false,
        suggestedTerms: {
          services: [service],
          price: dealValue,
          timeline: '1-2 weeks',
          deliverables: `Full setup of ${service} for ${lead.businessName}`,
        },
        summaryUpdate: 'Client requested pricing details.',
      };
    }

    // 5. How it works / What services Question
    if (/(how\s+does\s+it\s+work|what\s+services|details|explain|portfolio|examples)/i.test(textLower)) {
      const solution = lead.strategy?.solutions?.[0]?.howItWorks ||
        `We set up a responsive online channel for ${lead.businessName} that captures inquiries from Google Maps and routes them directly to your team.`;
      return {
        replyText: `${solution} Everything is handled turn-key so your daily staff operations are uninterrupted. Would you be open to a quick call tomorrow to look at a live example?`,
        detectedStage: 'conversing',
        needsHumanIntervention: false,
        isOptOut: false,
        dealAgreed: false,
        summaryUpdate: 'Explained solution mechanics and benefits.',
      };
    }

    // 6. Objection: Already have someone or not right now
    if (/(already\s+have|not\s+now|busy|later|don'?t\s+need)/i.test(textLower)) {
      return {
        replyText: `Totally understand! Many clinic owners we work with already had basic listings, but were losing inquiries because after-hours messages went unanswered. We can keep this on file—feel free to message us whenever you would like to explore it!`,
        detectedStage: 'interested',
        needsHumanIntervention: false,
        isOptOut: false,
        dealAgreed: false,
        summaryUpdate: 'Handled timing/agency objection gracefully.',
      };
    }

    // 7. General positive inquiry or prompt
    return {
      replyText: `Thanks for the response! For ${lead.businessName}, focusing on ${service} is the quickest way to turn Google Maps visitors into confirmed bookings. What is your current priority this month?`,
      detectedStage: 'conversing',
      needsHumanIntervention: false,
      isOptOut: false,
      dealAgreed: false,
      summaryUpdate: 'Engaged client in discovery conversation.',
    };
  }
}
