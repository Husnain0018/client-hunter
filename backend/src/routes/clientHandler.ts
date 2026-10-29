import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../security/auth.js';
import type { Database } from '../db/database.js';
import { ClientHandlerService } from '../services/clientHandlerService.js';
import { verifyWebhookSecret } from '../services/wahaService.js';
import type { ClientStage } from '../types/domain.js';

const clientStageEnum = z.enum([
  'new',
  'contacted',
  'awaiting_reply',
  'conversing',
  'follow_up_scheduled',
  'interested',
  'proposal_pending',
  'negotiating',
  'closed_won',
  'lost',
  'opted_out',
  'needs_human',
]);

const messageSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

const closeDealSchema = z.object({
  agreedServices: z.array(z.string().trim().min(1)).min(1),
  agreedPrice: z.string().trim().min(1).max(100),
  agreedTimeline: z.string().trim().min(1).max(100),
  agreedDeliverables: z.string().trim().min(1).max(1000),
  dealNotes: z.string().max(2000).optional().default(''),
  notifyUserWhatsApp: z.boolean().default(false),
  userPhoneNumber: z.string().max(40).optional(),
});

export async function clientHandlerRoutes(app: FastifyInstance, options: { database: Database }): Promise<void> {
  const service = new ClientHandlerService(options.database);

  // 1. Webhook for incoming WhatsApp client messages
  app.post('/api/webhooks/waha/message', async (request, reply) => {
    const secret = String(request.headers['x-waha-webhook-secret'] || '');
    if (!verifyWebhookSecret(secret)) {
      return reply.code(401).send({ ok: false, error: 'Invalid webhook secret.' });
    }

    const body = (request.body || {}) as Record<string, unknown>;
    const payload = (body.payload || body) as Record<string, unknown>;

    try {
      const res = await service.handleIncomingWebhook(payload);
      return { ok: true, ...res };
    } catch (err) {
      request.log.error(err, 'Failed to process incoming WhatsApp webhook');
      return reply.code(500).send({ ok: false, error: err instanceof Error ? err.message : 'Webhook error' });
    }
  });

  // Protected Client Handler Endpoints
  app.register(async (authedApp) => {
    authedApp.addHook('preHandler', authenticate);

    // List all clients with pipeline stage & stats
    authedApp.get('/api/clients', async (request) => {
      const query = request.query as { stage?: string; q?: string };
      const clients = service.listClients(query.stage, query.q);
      const stats = service.getStats();
      return { ok: true, clients, stats };
    });

    // Single client record
    authedApp.get('/api/clients/:leadId', async (request, reply) => {
      const { leadId } = request.params as { leadId: string };
      try {
        const client = service.getClient(leadId);
        return { ok: true, client };
      } catch {
        return reply.code(404).send({ ok: false, error: 'Client conversation not found.' });
      }
    });

    // Send WhatsApp message to client
    authedApp.post('/api/clients/:leadId/message', async (request, reply) => {
      const { leadId } = request.params as { leadId: string };
      const parsed = messageSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Valid text is required.' });

      try {
        const sent = await service.sendMessage(leadId, parsed.data.text, 'user');
        const client = service.getClient(leadId);
        return { ok: true, message: sent, client };
      } catch (err) {
        return reply.code(500).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to send message.' });
      }
    });

    // Generate & optionally send first message
    authedApp.post('/api/clients/:leadId/first-message', async (request, reply) => {
      const { leadId } = request.params as { leadId: string };
      const autoSend = Boolean((request.body as any)?.autoSend);
      try {
        const result = await service.sendFirstMessage(leadId, autoSend);
        const client = service.getClient(leadId);
        return { ok: true, ...result, client };
      } catch (err) {
        return reply.code(500).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to generate first message.' });
      }
    });

    // Generate AI response draft
    authedApp.post('/api/clients/:leadId/generate-reply', async (request, reply) => {
      const { leadId } = request.params as { leadId: string };
      const guidance = (request.body as any)?.guidance as string | undefined;
      try {
        const draft = await service.generateReplyDraft(leadId, guidance);
        return { ok: true, draft };
      } catch (err) {
        return reply.code(500).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to generate reply.' });
      }
    });

    // Toggle auto-pilot
    authedApp.post('/api/clients/:leadId/autopilot', async (request, reply) => {
      const { leadId } = request.params as { leadId: string };
      const enabled = Boolean((request.body as any)?.enabled);
      try {
        const client = service.toggleAutoPilot(leadId, enabled);
        return { ok: true, client };
      } catch (err) {
        return reply.code(500).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to update autopilot.' });
      }
    });

    // Update stage or notes
    authedApp.post('/api/clients/:leadId/stage', async (request, reply) => {
      const { leadId } = request.params as { leadId: string };
      const parsed = z.object({
        stage: clientStageEnum,
        dealNotes: z.string().max(2000).optional(),
      }).safeParse(request.body);

      if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Valid stage is required.' });

      try {
        const client = service.updateStage(leadId, parsed.data.stage as ClientStage, parsed.data.dealNotes);
        return { ok: true, client };
      } catch (err) {
        return reply.code(500).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to update stage.' });
      }
    });

    // Close deal & trigger notifications
    authedApp.post('/api/clients/:leadId/close-deal', async (request, reply) => {
      const { leadId } = request.params as { leadId: string };
      const parsed = closeDealSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid deal terms.' });

      try {
        const client = await service.closeDeal(leadId, {
          leadId,
          ...parsed.data,
        });
        return { ok: true, client };
      } catch (err) {
        return reply.code(500).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to close deal.' });
      }
    });
  });
}
