import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { cleanEmailHtml } from '../security/sanitize.js';

export class EmailNotConfiguredError extends Error {
  constructor() { super('SMTP is not configured. Use the Gmail or mail-client link, or configure SMTP on the backend.'); }
}

export async function sendEmail(input: { to: string; subject: string; html: string; text: string; replyTo?: string }): Promise<{ messageId: string }> {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) throw new EmailNotConfiguredError();
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  const result = await transport.sendMail({ from: env.SMTP_FROM, to: input.to, replyTo: input.replyTo || undefined, subject: input.subject, text: input.text, html: cleanEmailHtml(input.html) });
  return { messageId: result.messageId };
}
