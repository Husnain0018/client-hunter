import { randomUUID } from 'node:crypto';
import type { Database } from '../db/database.js';
import type {
  ClientConversation,
  ClientHandlerStats,
  ClientStage,
  ConversationMessage,
  DealClosingInfo,
  Lead,
  WhatsAppStatus,
} from '../types/domain.js';
import { ConversationEngine, isOptOutMessage } from './conversationEngine.js';
import { sendWhatsApp, WahaNotConfiguredError } from './wahaService.js';

export class ClientHandlerService {
  readonly engine: ConversationEngine;

  constructor(private readonly db: Database) {
    this.engine = new ConversationEngine(db);
  }

  /**
   * Retrieves all client conversations with search and filter
   */
  listClients(stage?: string, search?: string): ClientConversation[] {
    return this.db.listClientConversations(stage, search);
  }

  /**
   * Retrieves single client with conversation history
   */
  getClient(leadId: string): ClientConversation {
    const conv = this.db.getClientConversation(leadId);
    if (!conv) throw new Error(`Client conversation for lead ${leadId} not found.`);
    return conv;
  }

  /**
   * Sends an outbound message to a client (user manual or AI approved)
   */
  async sendMessage(
    leadId: string,
    text: string,
    sender: 'assistant' | 'user' = 'user',
    metadata?: Record<string, unknown>
  ): Promise<ConversationMessage> {
    const lead = this.db.getLead(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found.`);
    if (!lead.phone) throw new Error(`Lead ${lead.businessName} has no phone number on file.`);

    const conv = this.db.getClientConversation(leadId);
    if (conv?.optedOut) {
      throw new Error(`Cannot send message: ${lead.businessName} has opted out of communication.`);
    }

    const cleanText = text.trim();
    if (!cleanText) throw new Error('Message text cannot be empty.');

    const msgId = `msg_${Date.now()}_${randomUUID().slice(0, 8)}`;
    let providerMessageId = '';
    let status: WhatsAppStatus = 'Sent';

    try {
      const sent = await sendWhatsApp(lead.phone, cleanText);
      providerMessageId = sent.providerMessageId;
      status = sent.status;
    } catch (err) {
      if (err instanceof WahaNotConfiguredError) {
        // Local deterministic simulation fallback
        providerMessageId = `sim_${Date.now()}`;
        status = 'Sent';
      } else {
        throw err;
      }
    }

    const message: ConversationMessage = {
      id: msgId,
      leadId,
      sender,
      text: cleanText,
      timestamp: new Date().toISOString(),
      status,
      providerMessageId,
      metadata,
    };

    this.db.addConversationMessage(message);

    // Update conversation record stage to awaiting_reply
    const nextStage: ClientStage = conv?.stage === 'new' ? 'contacted' : 'awaiting_reply';
    this.db.upsertClientConversation(leadId, {
      stage: nextStage,
      lastMessageAt: message.timestamp,
    });

    return message;
  }

  /**
   * Generates and optionally sends the first outreach message
   */
  async sendFirstMessage(leadId: string, autoSend = false): Promise<{ messageText: string; sentMessage?: ConversationMessage }> {
    const text = await this.engine.generateFirstMessage(leadId);
    if (autoSend) {
      const sent = await this.sendMessage(leadId, text, 'assistant', { type: 'first_outreach' });
      return { messageText: text, sentMessage: sent };
    }
    return { messageText: text };
  }

  /**
   * Generates an AI reply draft without automatically dispatching it
   */
  async generateReplyDraft(leadId: string, userGuidance?: string) {
    return this.engine.generateReply(leadId, userGuidance);
  }

  /**
   * Toggles auto-pilot mode for a specific client
   */
  toggleAutoPilot(leadId: string, enabled: boolean): ClientConversation {
    return this.db.upsertClientConversation(leadId, { autoPilot: enabled });
  }

  /**
   * Updates stage or notes for a client
   */
  updateStage(leadId: string, stage: ClientStage, dealNotes?: string): ClientConversation {
    return this.db.upsertClientConversation(leadId, {
      stage,
      ...(dealNotes !== undefined ? { dealNotes } : {}),
      ...(stage !== 'needs_human' ? { humanInterventionReason: '' } : {}),
    });
  }

  /**
   * Handles incoming WhatsApp webhook events (WAHA) with deduplication & auto-pilot
   */
  async handleIncomingWebhook(payload: Record<string, unknown>): Promise<{
    handled: boolean;
    reason?: string;
    leadId?: string;
    autoReplied?: boolean;
    replyMessage?: string;
  }> {
    const rawId = typeof payload.id === 'string' ? payload.id : String((payload.id as any)?._serialized || (payload._data as any)?.id || '');
    const messageId = rawId || (payload.messageId as string) || '';

    // Step 1: Webhook deduplication
    if (messageId) {
      if (this.db.isWebhookProcessed(messageId)) {
        return { handled: true, reason: 'Duplicate webhook message ignored.' };
      }
      this.db.markWebhookProcessed(messageId);
    }

    // Step 2: Extract message details
    const fromMe = payload.fromMe === true || (payload._data as any)?.fromMe === true;
    if (fromMe) {
      return { handled: true, reason: 'Outbound message from self ignored.' };
    }

    const fromRaw = typeof payload.from === 'string' ? payload.from : String((payload._data as any)?.from || '');
    const text = typeof payload.body === 'string' ? payload.body.trim() : '';

    if (!fromRaw || !text) {
      return { handled: false, reason: 'Missing sender phone or message body.' };
    }

    // Step 3: Match phone to lead
    const lead = this.db.findLeadByPhone(fromRaw);
    if (!lead) {
      return { handled: true, reason: `No registered lead matches sender ${fromRaw}.` };
    }

    const leadId = lead.leadId;
    const incomingMsg: ConversationMessage = {
      id: `in_${Date.now()}_${randomUUID().slice(0, 8)}`,
      leadId,
      sender: 'client',
      text,
      timestamp: new Date().toISOString(),
      status: 'Read',
      providerMessageId: messageId,
    };

    this.db.addConversationMessage(incomingMsg);

    // Step 4: Check Opt-Out
    if (isOptOutMessage(text)) {
      this.db.upsertClientConversation(leadId, {
        stage: 'opted_out',
        optedOut: true,
        summary: 'Client opted out of communications.',
        lastMessageAt: incomingMsg.timestamp,
      });
      return { handled: true, leadId, reason: 'Client opted out.' };
    }

    // Step 5: Check Auto-Pilot
    const conv = this.db.getClientConversation(leadId);
    if (!conv?.autoPilot) {
      // Auto-pilot disabled: mark stage as conversing / awaiting response and let human answer
      this.db.upsertClientConversation(leadId, {
        stage: 'conversing',
        lastMessageAt: incomingMsg.timestamp,
      });
      return { handled: true, leadId, autoReplied: false, reason: 'Auto-pilot disabled; conversation updated for human reply.' };
    }

    // Step 6: Generate AI Reply
    const aiResult = await this.engine.generateReply(leadId);

    // If human intervention is required, pause and escalate
    if (aiResult.needsHumanIntervention) {
      this.db.upsertClientConversation(leadId, {
        stage: 'needs_human',
        humanInterventionReason: aiResult.humanInterventionReason || 'AI flagged request requiring human authorization.',
        summary: aiResult.summaryUpdate || conv.summary,
        lastMessageAt: incomingMsg.timestamp,
      });
      return { handled: true, leadId, autoReplied: false, reason: 'Flagged for human intervention.' };
    }

    // If deal closure agreed via AI
    if (aiResult.dealAgreed && aiResult.suggestedTerms) {
      await this.sendMessage(leadId, aiResult.replyText, 'assistant', { type: 'deal_closing' });
      this.db.upsertClientConversation(leadId, {
        stage: 'closed_won',
        agreedServices: aiResult.suggestedTerms.services || lead.recommendedServices,
        agreedPrice: aiResult.suggestedTerms.price || lead.estimatedDealValue || '',
        agreedTimeline: aiResult.suggestedTerms.timeline || '1-2 weeks',
        agreedDeliverables: aiResult.suggestedTerms.deliverables || '',
        closedAt: new Date().toISOString(),
        summary: aiResult.summaryUpdate || 'Deal agreed and closed via automated conversation.',
      });
      return { handled: true, leadId, autoReplied: true, replyMessage: aiResult.replyText };
    }

    // Normal automatic response
    const sent = await this.sendMessage(leadId, aiResult.replyText, 'assistant', {
      stageDetected: aiResult.detectedStage,
    });

    this.db.upsertClientConversation(leadId, {
      stage: aiResult.detectedStage,
      summary: aiResult.summaryUpdate || conv.summary,
      lastMessageAt: sent.timestamp,
    });

    return {
      handled: true,
      leadId,
      autoReplied: true,
      replyMessage: aiResult.replyText,
    };
  }

  /**
   * Finalizes deal, logs agreed deliverables, and triggers notification
   */
  async closeDeal(leadId: string, dealInfo: DealClosingInfo): Promise<ClientConversation> {
    const lead = this.db.getLead(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found.`);

    const conv = this.db.getClientConversation(leadId);
    if (!conv) throw new Error(`Conversation ${leadId} not found.`);

    const now = new Date().toISOString();
    const updated = this.db.upsertClientConversation(leadId, {
      stage: 'closed_won',
      agreedServices: dealInfo.agreedServices || lead.recommendedServices,
      agreedPrice: dealInfo.agreedPrice || lead.estimatedDealValue || '',
      agreedTimeline: dealInfo.agreedTimeline || '2 weeks',
      agreedDeliverables: dealInfo.agreedDeliverables || 'Full service implementation',
      dealNotes: dealInfo.dealNotes || conv.dealNotes || '',
      closedAt: conv.closedAt || now,
    });

    // Send Deal-Closed Notification if requested and not yet notified
    if (dealInfo.notifyUserWhatsApp && dealInfo.userPhoneNumber && !updated.closingNotifiedAt) {
      try {
        const notifText = `🎉 Deal successfully closed! You have acquired a new client: ${lead.businessName}. Services: ${updated.agreedServices.join(', ')}. Deliverables: ${updated.agreedDeliverables}. Timeline: ${updated.agreedTimeline}. Price: ${updated.agreedPrice}. Please review the client requirements and begin next steps.`;
        await sendWhatsApp(dealInfo.userPhoneNumber, notifText);
        this.db.upsertClientConversation(leadId, {
          closingNotifiedAt: now,
        });
      } catch (err) {
        console.warn('[ClientHandlerService] Failed to deliver deal closure WhatsApp notification:', err);
      }
    }

    return this.db.getClientConversation(leadId)!;
  }

  /**
   * Aggregates stats for dashboard
   */
  getStats(): ClientHandlerStats {
    return this.db.getClientHandlerStats();
  }
}
