import '@whiskeysockets/baileys';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { Database } from './db/database.js';
import { authRoutes } from './routes/auth.js';
import { apiRoutes } from './routes/api.js';
import { clientHandlerRoutes } from './routes/clientHandler.js';
import { whatsappRoutes } from './routes/whatsappRoutes.js';
import { RunPipeline } from './services/runPipeline.js';
import { BaileysManager } from './services/baileysManager.js';
import { hasSavedSession } from './services/baileysAuthState.js';

export function buildApp(customDatabase?: Database) {
  const app = Fastify({ logger: env.NODE_ENV !== 'test', bodyLimit: 250_000 });
  const database = customDatabase || new Database(env.databasePath);
  const pipeline = new RunPipeline(database);
  app.register(helmet, { global: true, contentSecurityPolicy: false });
  app.register(cors, {
    origin: env.FRONTEND_ORIGIN === '*' ? true : [env.FRONTEND_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Waha-Webhook-Secret'],
  });
  app.register(rateLimit, { max: 600, timeWindow: '1 minute', keyGenerator: (request) => request.ip });
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string, done) => {
    if (!body || body.trim().length === 0) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body));
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });
  app.get('/api/health', async () => ({ ok: true, service: 'client-hunter-backend', time: new Date().toISOString() }));
  app.register(authRoutes);
  app.register(apiRoutes, { database, pipeline });
  app.register(clientHandlerRoutes, { database });
  app.register(whatsappRoutes, { database });
  app.addHook('onClose', async () => {
    try {
      await BaileysManager.getInstance(database).disconnect();
    } catch {
      // ignore
    }
    database.close();
  });
  return app;
}

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled Rejection:', reason);
});

if (process.env.NODE_ENV !== 'test') {
  const database = new Database(env.databasePath);
  const app = buildApp(database);
  app.listen({ host: env.HOST, port: env.PORT }).then(() => {
    app.log.info(`Client Hunter backend listening on http://${env.HOST}:${env.PORT}`);

    // Auto-resume saved WhatsApp session if credentials exist
    if (hasSavedSession()) {
      app.log.info('Found existing WhatsApp session, reconnecting in background...');
      BaileysManager.getInstance(database).connect().catch((err) => {
        app.log.warn({ err }, 'Background WhatsApp reconnection encountered an error');
      });
    }
  }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
