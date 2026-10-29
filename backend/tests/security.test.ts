import { describe, expect, it } from 'vitest';
import { jwtVerify } from 'jose';
import { isPrivateAddress } from '../src/security/ssrf.js';
import { cleanEmailHtml, normalizePhone } from '../src/security/sanitize.js';
import { issueToken, verifyAccessCode } from '../src/security/auth.js';
import { env } from '../src/config/env.js';

describe('security boundaries', () => {
  it('blocks private and loopback addresses', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('10.1.2.3')).toBe(true);
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
  });

  it('removes active markup from email HTML', () => {
    const result = cleanEmailHtml('<p>Hello</p><script>alert(1)</script><a href="javascript:alert(2)">bad</a>');
    expect(result).toContain('<p>Hello</p>');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('javascript:');
  });

  it('normalizes phone input without trusting formatting', () => {
    expect(normalizePhone('+92 (300) 123-4567')).toBe('923001234567');
  });

  it('verifies the configured access code and rejects a wrong code', () => {
    expect(verifyAccessCode(process.env.CLIENT_HUNTER_ACCESS_CODE || 'change-me-now')).toBe(true);
    expect(verifyAccessCode('definitely-not-the-code')).toBe(false);
  });

  it('issues a valid signed token that can be verified and has client-hunter scope', async () => {
    const token = await issueToken();
    const key = new TextEncoder().encode(env.AUTH_SECRET);
    const result = await jwtVerify(token, key, { algorithms: ['HS256'], subject: 'client' });
    expect(result.payload.scope).toBe('client-hunter');
    expect(result.payload.sub).toBe('client');
  });
});
