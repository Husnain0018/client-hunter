import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const key = new TextEncoder().encode(env.AUTH_SECRET);
const salt = createHash('sha256').update(`client-hunter:${env.AUTH_SECRET}`).digest();
const expected = scryptSync(env.CLIENT_HUNTER_ACCESS_CODE, salt, 32);

export function verifyAccessCode(value: string): boolean {
  const actual = scryptSync(value, salt, 32);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function issueToken(expiresIn: string = env.AUTH_TOKEN_EXPIRES_IN): Promise<string> {
  return new SignJWT({ scope: 'client-hunter' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject('client')
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    await reply.code(401).send({ ok: false, error: 'Authentication required.' });
    return;
  }
  try {
    const result = await jwtVerify(token, key, { algorithms: ['HS256'], subject: 'client' });
    if (result.payload.scope !== 'client-hunter') throw new Error('Invalid scope');
  } catch {
    await reply.code(401).send({ ok: false, error: 'Session expired or invalid.' });
  }
}

export function createWebhookToken(): string {
  return randomBytes(32).toString('hex');
}

export function safeEqualText(actual: string, expectedValue: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expectedValue);
  return a.length === b.length && timingSafeEqual(a, b);
}
