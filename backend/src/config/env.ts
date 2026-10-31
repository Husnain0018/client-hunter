import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const boolEnv = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  return value.toLowerCase() === 'true';
}, z.boolean().default(false));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default(process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  AUTH_SECRET: z.string().min(16).default('local-development-only-change-me'),
  AUTH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  CLIENT_HUNTER_ACCESS_CODE: z.string().min(3).default('change-me-now'),
  DATABASE_PATH: z.string().default('./data/client-hunter.sqlite'),
  APIFY_API_TOKEN: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: boolEnv,
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default(''),
  BAILEYS_SESSION_DIR: z.string().default('./data/baileys_auth'),
  BAILEYS_LOG_LEVEL: z.string().default('warn'),
  // Deprecated WAHA settings retained as optional for backwards-compatibility
  WAHA_BASE_URL: z.string().optional().default(''),
  WAHA_API_KEY: z.string().optional().default(''),
  WAHA_SESSION: z.string().default('default'),
  WAHA_WEBHOOK_SECRET: z.string().optional().default(''),
  GOOGLE_SHEETS_ACCESS_TOKEN: z.string().optional().default(''),
});

const parsed = schema.parse(process.env);

export const env = {
  ...parsed,
  databasePath: path.resolve(process.cwd(), parsed.DATABASE_PATH),
  isProduction: parsed.NODE_ENV === 'production',
};

if (env.isProduction && env.AUTH_SECRET.length < 32) {
  throw new Error('AUTH_SECRET must contain at least 32 characters in production.');
}

if (env.isProduction && env.CLIENT_HUNTER_ACCESS_CODE === 'change-me-now') {
  throw new Error('CLIENT_HUNTER_ACCESS_CODE must be changed in production.');
}
