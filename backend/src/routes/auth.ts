import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env.js';
import { authenticate, issueToken, verifyAccessCode } from '../security/auth.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/session', async (request, reply) => {
    const parsed = z.object({ accessCode: z.string().min(1).max(200) }).safeParse(request.body);
    if (!parsed.success || !verifyAccessCode(parsed.data.accessCode)) return reply.code(401).send({ ok: false, error: 'Invalid access code.' });
    return { ok: true, token: await issueToken(), expiresIn: env.AUTH_TOKEN_EXPIRES_IN };
  });

  app.get('/api/auth/session', { preHandler: authenticate }, async () => {
    return { ok: true, authenticated: true };
  });

  app.post('/api/auth/refresh', { preHandler: authenticate }, async () => {
    return { ok: true, token: await issueToken(), expiresIn: env.AUTH_TOKEN_EXPIRES_IN };
  });
}
