import { safeFetch } from '../security/ssrf.js';
import type { SocialProfile, WebsiteAudit, WebsiteStatus } from '../types/domain.js';
import type { MapsPlace } from './mapsScraper.js';

const BAD_EMAIL = /\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$|sentry|wixpress|example\.|domain\.com|yourname|email@email|@2x/i;

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function contacts(html: string): { emails: string[]; phones: string[] } {
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const match of html.matchAll(/mailto:([^"'?\s>]+)/gi)) {
    const value = decodeURIComponent(match[1]).toLowerCase().trim();
    if (value && !BAD_EMAIL.test(value)) emails.add(value);
  }
  for (const match of stripTags(html).matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) {
    if (!BAD_EMAIL.test(match[0])) emails.add(match[0].toLowerCase());
  }
  for (const match of html.matchAll(/href=["']tel:([^"']+)["']/gi)) phones.add(decodeURIComponent(match[1]).trim());
  for (const match of stripTags(html).matchAll(/(?:\+|00|0)\d[\d\s\-().]{8,16}\d/g)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) phones.add(match[0].trim());
  }
  return { emails: [...emails].slice(0, 5), phones: [...phones].slice(0, 6) };
}

function socialLinks(html: string, seed: SocialProfile = {}): SocialProfile {
  const result: SocialProfile = { ...seed };
  for (const match of html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    const url = match[1].replace(/&amp;/g, '&');
    if (!result.facebook && /facebook\.com\/[A-Za-z0-9._-]+/i.test(url) && !/sharer|share\.php|plugins/i.test(url)) result.facebook = url;
    if (!result.instagram && /instagram\.com\/[A-Za-z0-9._-]+/i.test(url) && !/\/(p|reel|explore|accounts)\//i.test(url)) result.instagram = url;
    if (!result.linkedin && /linkedin\.com\/(company|in|school)\//i.test(url)) result.linkedin = url;
    if (!result.twitter && /(?:twitter|x)\.com\/(?!share|intent|home)[A-Za-z0-9_]+/i.test(url)) result.twitter = url;
    if (!result.youtube && /youtube\.com\/(channel|c|user|@)/i.test(url)) result.youtube = url;
    if (!result.tiktok && /tiktok\.com\/@/i.test(url)) result.tiktok = url;
  }
  return result;
}

function techStack(html: string): string[] {
  const checks: Array<[string, RegExp]> = [['WordPress', /wp-content|wp-includes/i], ['Wix', /wixstatic|wix\.com/i], ['Shopify', /cdn\.shopify|shopify/i], ['Squarespace', /squarespace/i], ['Webflow', /webflow/i], ['Elementor', /elementor/i], ['Joomla', /joomla/i], ['Blogger', /blogspot|blogger/i]];
  return checks.filter(([, matcher]) => matcher.test(html)).map(([name]) => name);
}

function absolute(value: string, base: string): string {
  try { return new URL(value, base).toString(); } catch { return ''; }
}

function bodyText(response: Response, maxBytes = 1_200_000): Promise<string> {
  return response.arrayBuffer().then((buffer) => new TextDecoder().decode(buffer.slice(0, maxBytes)));
}

export async function auditWebsite(place: MapsPlace): Promise<WebsiteAudit> {
  if (!place.website) return { hasWebsite: false, reachable: false, score: null, status: 'No Website', issues: [`No dedicated website was found for ${place.title}.`], images: [], techStack: [], emails: [], phones: place.phone ? [place.phone] : [], social: place.social, title: '', metaDescription: '', httpStatus: null };
  try {
    const { response, url } = await safeFetch(place.website, { headers: { 'User-Agent': 'ClientHunter/1.0 (+website-audit)', Accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(15_000) });
    const html = await bodyText(response);
    const blocked = [401, 403, 406, 429, 503].includes(response.status);
    const reachable = response.status >= 200 && response.status < 400 && html.length > 300;
    const base = new URL(url).toString();
    const contactData = contacts(html);
    const social = socialLinks(html, place.social);
    if (!reachable) {
      return { hasWebsite: true, reachable: false, score: blocked ? 50 : 10, status: blocked ? 'Unverified' : 'Not Loading', issues: [blocked ? `Website blocks automated checks (HTTP ${response.status}); verify manually.` : `Website returned HTTP ${response.status} or did not return enough HTML.`], images: [], techStack: [], emails: contactData.emails, phones: [place.phone, ...contactData.phones].filter(Boolean).slice(0, 6), social, title: '', metaDescription: '', httpStatus: response.status };
    }
    const text = stripTags(html);
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
    const metaDescription = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)/i)?.[1] || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1] || '';
    const h1 = (html.match(/<h1[\s>]/gi) || []).length;
    const imageMatches = [...html.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/gi)];
    const images = [...new Set(imageMatches.map((match) => absolute(match[1], base)).filter((value) => /\.(jpe?g|png|webp)(\?|$)/i.test(value) && !/logo|icon|sprite|pixel|avatar|emoji|loader/i.test(value)))].slice(0, 5);
    const imageCount = (html.match(/<img[\s]/gi) || []).length;
    const missingAlt = (html.match(/<img(?![^>]*\balt=["'][^"']+["'])[^>]*>/gi) || []).length;
    const currentYear = new Date().getFullYear();
    const copyright = html.match(/(?:©|&copy;|copyright)[^0-9]{0,30}((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/i);
    const signals = { https: /^https:/i.test(base), viewport: /<meta[^>]+name=["']viewport["']/i.test(html), form: /<form[\s>]/i.test(html), whatsapp: /wa\.me|api\.whatsapp\.com|whatsapp/i.test(html), chat: /tawk\.to|livechat|tidio|crisp\.chat|intercom|drift\.com|zopim|chatbot|botpress|manychat/i.test(html), analytics: /googletagmanager|gtag\(|google-analytics|fbq\(|connect\.facebook\.net/i.test(html), schema: /application\/ld\+json/i.test(html), og: /property=["']og:/i.test(html) };
    const issues: string[] = [];
    let score = 100;
    const deduct = (points: number, issue: string) => { score -= points; issues.push(issue); };
    if (!signals.https) deduct(5, 'Website is not using HTTPS.');
    if (!signals.viewport) deduct(20, 'No responsive viewport tag was found.');
    if (!title) deduct(8, 'Missing page title.');
    if (!metaDescription) deduct(10, 'Missing meta description.');
    if (h1 === 0) deduct(6, 'No H1 heading was found.');
    if (!signals.form) deduct(8, 'No contact or enquiry form was found.');
    if (!signals.whatsapp && !signals.chat) deduct(6, 'No WhatsApp, live chat, or chatbot signal was found.');
    if (!signals.analytics) deduct(6, 'No analytics or ad-tracking signal was found.');
    if (!signals.schema) deduct(4, 'No JSON-LD structured data was found.');
    if (!signals.og) deduct(3, 'No Open Graph tags were found.');
    if (imageCount < 3) deduct(6, 'Very few images were found.');
    if (imageCount >= 4 && missingAlt / imageCount > 0.5) deduct(5, 'Most images are missing alt text.');
    if (copyright && Number(copyright[2] || copyright[1]) < currentYear - 2) deduct(10, `Copyright year appears outdated (${copyright[2] || copyright[1]}).`);
    if (text.length < 1500) deduct(8, 'Homepage has thin text content.');
    if (!contactData.emails.length && !contactData.phones.length && !place.phone) deduct(10, 'No email or phone was found on the homepage.');
    if (!Object.values(social).some(Boolean)) deduct(8, 'No social profile links were found.');
    if ((html.match(/<table[\s>]/gi) || []).length > 10 || /<marquee|<font[\s>]/i.test(html)) deduct(10, 'Legacy table or deprecated HTML patterns were found.');
    score = Math.max(0, Math.min(100, score));
    const status: WebsiteStatus = score >= 75 ? 'Good' : score >= 50 ? 'Needs Improvement' : 'Poor';
    return { hasWebsite: true, reachable: true, score, status, issues, images, techStack: techStack(html), emails: contactData.emails, phones: [place.phone, ...contactData.phones].filter(Boolean).slice(0, 6), social, title, metaDescription, httpStatus: response.status };
  } catch (error) {
    return { hasWebsite: true, reachable: false, score: 10, status: 'Not Loading', issues: [error instanceof Error ? error.message : 'Website could not be audited safely.'], images: [], techStack: [], emails: [], phones: place.phone ? [place.phone] : [], social: place.social, title: '', metaDescription: '', httpStatus: null };
  }
}
