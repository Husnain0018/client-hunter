import dns from 'node:dns/promises';
import net from 'node:net';

function ipv4ToNumber(value: string): number {
  return value.split('.').reduce((out, part) => (out * 256) + Number(part), 0);
}

function isPrivateIpv4(value: string): boolean {
  const n = ipv4ToNumber(value);
  const ranges: Array<[number, number]> = [
    [ipv4ToNumber('0.0.0.0'), ipv4ToNumber('0.255.255.255')],
    [ipv4ToNumber('10.0.0.0'), ipv4ToNumber('10.255.255.255')],
    [ipv4ToNumber('100.64.0.0'), ipv4ToNumber('100.127.255.255')],
    [ipv4ToNumber('127.0.0.0'), ipv4ToNumber('127.255.255.255')],
    [ipv4ToNumber('169.254.0.0'), ipv4ToNumber('169.254.255.255')],
    [ipv4ToNumber('172.16.0.0'), ipv4ToNumber('172.31.255.255')],
    [ipv4ToNumber('192.0.0.0'), ipv4ToNumber('192.0.0.255')],
    [ipv4ToNumber('192.168.0.0'), ipv4ToNumber('192.168.255.255')],
    [ipv4ToNumber('198.18.0.0'), ipv4ToNumber('198.19.255.255')],
    [ipv4ToNumber('224.0.0.0'), ipv4ToNumber('255.255.255.255')],
  ];
  return ranges.some(([start, end]) => n >= start && n <= end);
}

function isPrivateIpv6(value: string): boolean {
  const v = value.toLowerCase();
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}

export function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address);
  return version === 4 ? isPrivateIpv4(address) : version === 6 ? isPrivateIpv6(address) : true;
}

export async function assertSafeUrl(input: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Website URL is invalid.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS websites are supported.');
  if (url.username || url.password) throw new Error('Website credentials are not allowed.');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Non-standard website ports are blocked.');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname === 'metadata.google.internal') {
    throw new Error('Private or local website addresses are blocked.');
  }
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Private, loopback, link-local, or reserved website addresses are blocked.');
  }
  return url;
}

export async function safeFetch(input: string, init: RequestInit = {}, maxRedirects = 3): Promise<{ response: Response; url: string }> {
  let current = input;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const checked = await assertSafeUrl(current);
    const response = await fetch(checked, { ...init, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url: checked.toString() };
    const location = response.headers.get('location');
    if (!location) return { response, url: checked.toString() };
    if (hop === maxRedirects) throw new Error('Too many website redirects.');
    current = new URL(location, checked).toString();
  }
  throw new Error('Website request failed.');
}
