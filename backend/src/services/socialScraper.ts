import { env } from '../config/env.js';
import type { SocialActivity, SocialProfile } from '../types/domain.js';

function toDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const date = typeof value === 'number' ? new Date(value < 1e12 ? value * 1000 : value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanSocialUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return value.split('?')[0].split('#')[0].replace(/\/$/, '');
  }
}

async function runActor(actor: string, input: unknown): Promise<unknown[]> {
  if (!env.APIFY_API_TOKEN) return [];
  try {
    const response = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.APIFY_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return [];
    const data = await response.json() as unknown;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function activity(url: string, dates: Date[], checked: boolean): SocialActivity {
  if (!checked) return { status: 'Not checked', url, lastPost: '', daysInactive: null };
  if (!dates.length) return { status: 'No public posts found', url, lastPost: '', daysInactive: null };
  const last = new Date(Math.max(...dates.map((date) => date.getTime())));
  const daysInactive = Math.max(0, Math.floor((Date.now() - last.getTime()) / 86_400_000));
  return { status: daysInactive <= 30 ? 'Active' : daysInactive <= 90 ? 'Slow' : 'Inactive', url, lastPost: last.toISOString().slice(0, 10), daysInactive };
}

export async function inspectSocials(social: SocialProfile, enabled: boolean): Promise<{ activity: Record<string, SocialActivity>; summary: string }> {
  const empty: Record<string, SocialActivity> = {};
  if (social.facebook) empty.facebook = activity(social.facebook, [], false);
  if (social.instagram) empty.instagram = activity(social.instagram, [], false);
  if (social.linkedin) empty.linkedin = activity(social.linkedin, [], false);
  if (social.twitter) empty.twitter = activity(social.twitter, [], false);
  if (social.youtube) empty.youtube = activity(social.youtube, [], false);
  if (social.tiktok) empty.tiktok = activity(social.tiktok, [], false);
  if (!enabled) return { activity: empty, summary: Object.keys(empty).length ? 'Social profiles found; activity check disabled.' : 'No social media found.' };
  const dates: Record<string, Date[]> = { facebook: [], instagram: [] };
  if (social.facebook) {
    try {
      const cleanFb = cleanSocialUrl(social.facebook);
      const rows = await runActor('apify~facebook-posts-scraper', { startUrls: [{ url: cleanFb }], resultsLimit: 3 });
      for (const row of rows) { const r = row as Record<string, unknown>; const date = toDate(r.time ?? r.timestamp ?? r.date ?? r.postedAt ?? r.createdTime); if (date) dates.facebook.push(date); }
    } catch {
      // Individual Facebook failure ignored
    }
  }
  if (social.instagram) {
    try {
      const cleanIg = cleanSocialUrl(social.instagram);
      const rows = await runActor('apify~instagram-scraper', { directUrls: [cleanIg], resultsType: 'posts', resultsLimit: 3, addParentData: false });
      for (const row of rows) { const r = row as Record<string, unknown>; const date = toDate(r.timestamp ?? r.takenAtTimestamp ?? r.publishedTime ?? r.date); if (date) dates.instagram.push(date); }
    } catch {
      // Individual Instagram failure ignored
    }
  }
  const result: Record<string, SocialActivity> = {};
  if (social.facebook) result.facebook = activity(social.facebook, dates.facebook, true);
  if (social.instagram) result.instagram = activity(social.instagram, dates.instagram, true);
  for (const platform of ['linkedin', 'twitter', 'youtube', 'tiktok'] as const) if (social[platform]) result[platform] = { status: 'No public posts found', url: social[platform]!, lastPost: '', daysInactive: null };
  const summary = Object.entries(result).map(([platform, item]) => `${platform}: ${item.status}${item.daysInactive === null ? '' : ` (${item.daysInactive} days inactive)`}`).join(' | ') || 'No social media found.';
  return { activity: result, summary };
}
