import sanitizeHtml from 'sanitize-html';

export function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

export function cleanEmailHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: ['a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'i', 'li', 'ol', 'p', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      '*': ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
  });
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function validEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
