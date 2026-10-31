import { env } from '../config/env.js';
import { cleanEmailHtml } from '../security/sanitize.js';
import type { Competitor, Lead, LocationStatus, OutreachStrategy, ProblemFinding, SearchRequest, WebsiteAudit } from '../types/domain.js';
import type { MapsPlace } from './mapsScraper.js';
import type { SocialActivity } from '../types/domain.js';

interface DetailedPlan {
  score: number;
  priority: 'high' | 'medium' | 'low';
  deal: string;
  services: string[];
  weaknesses: string[];
  summary: string;
  subject: string;
  opening: string;
  websiteFindings: string[];
  socialFindings: string[];
  competitorInsight: string;
  solutions: Array<{ service: string; howItWorks: string; impact: string; estimatedTimeline: string }>;
  closing: string;
  whatsapp: string;
  strategy: OutreachStrategy;
}

function money(value: number): string { return `$${value.toLocaleString('en-US')}`; }
function cap(value: string, max: number): string { return value.length > max ? `${value.slice(0, max - 1).trim()}…` : value; }
function esc(value: unknown): string { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const COMPANY_INDICATORS = /\b(solutions?|tech(nolog(y|ies))?|agency|studios?|enterprises?|ventures?|consult(ing|ants?)?|media|digital|labs?|systems?|services?|creatives?|associates?|partners?|group|holdings?|firm|corporation|corp|inc|llc|ltd|pvt|co|team|network|works|marketing|software|seo|designs?|development|devs?|automations?|ai|bots?|analytics)\b/i;

export interface SenderIdentity {
  type: 'person' | 'company' | 'person_with_company';
  personName: string;
  companyName: string;
  displayName: string;
  whatsappIntro: string;
  directIntro: string;
  emailOpening: string;
  icebreaker: string;
  whatsappGreeting: (businessName: string) => string;
}

export function resolveSenderIdentity(
  inputOrUserName: string | { userName: string; company?: string; senderType?: 'auto' | 'person' | 'company' },
  rawCompany?: string,
  explicitType: 'auto' | 'person' | 'company' = 'auto'
): SenderIdentity {
  let u = '';
  let c = '';
  let selType: 'auto' | 'person' | 'company' = explicitType;

  if (typeof inputOrUserName === 'object' && inputOrUserName !== null) {
    u = (inputOrUserName.userName || '').trim();
    c = (inputOrUserName.company || '').trim();
    selType = inputOrUserName.senderType || 'auto';
  } else {
    u = (inputOrUserName || '').trim();
    c = (rawCompany || '').trim();
    selType = explicitType || 'auto';
  }

  // Deduplicate if identical case-insensitive
  if (u.toLowerCase() === c.toLowerCase()) {
    c = '';
  }

  let type: 'person' | 'company' | 'person_with_company' = 'person';

  if (selType === 'company') {
    type = 'company';
  } else if (selType === 'person') {
    type = c ? 'person_with_company' : 'person';
  } else {
    // Auto-detection based on linguistic corporate markers
    const uIsComp = COMPANY_INDICATORS.test(u);
    const cIsComp = COMPANY_INDICATORS.test(c);

    if (u && !c) {
      type = uIsComp ? 'company' : 'person';
    } else if (u && c) {
      if (uIsComp && !cIsComp) {
        // Swapped: user typed company in name field and person in company field
        const temp = u;
        u = c;
        c = temp;
        type = 'person_with_company';
      } else if (!uIsComp) {
        type = 'person_with_company';
      } else {
        type = 'company';
      }
    } else if (!u && c) {
      type = cIsComp ? 'company' : 'person';
      u = c;
      c = '';
    }
  }

  let whatsappIntro = '';
  let directIntro = '';
  let emailOpening = '';
  let icebreaker = '';
  let displayName = '';

  if (type === 'company' || (selType === 'auto' && !c && COMPANY_INDICATORS.test(u))) {
    const comp = c || u;
    displayName = comp;
    whatsappIntro = `I'm reaching out from ${comp}`;
    directIntro = `Hi, I'm reaching out from ${comp}.`;
    emailOpening = `I'm reaching out from ${comp}`;
    icebreaker = `Hi {title} team, I'm reaching out from ${comp}. I recently reviewed your Google Maps profile in {area}`;
  } else if (type === 'person_with_company' && u && c) {
    displayName = `${u} (${c})`;
    whatsappIntro = `my name is ${u} from ${c}`;
    directIntro = `Hi, my name is ${u} from ${c}.`;
    emailOpening = `my name is ${u} from ${c}`;
    icebreaker = `Hi {title} team, my name is ${u} from ${c}. I recently reviewed your Google Maps profile in {area}`;
  } else {
    // Person only
    displayName = u;
    whatsappIntro = `my name is ${u}`;
    directIntro = u ? `Hi, my name is ${u}.` : `Hi, I'm reaching out to you.`;
    emailOpening = `my name is ${u}`;
    icebreaker = `Hi {title} team, my name is ${u}. I recently reviewed your Google Maps profile in {area}`;
  }

  const greetingFn = (businessName: string) => {
    const target = businessName ? `${businessName} team` : 'there';
    return `Hi ${target}, ${whatsappIntro}.`;
  };

  const resolvedCompany = (type === 'company' ? (c || u) : c);
  const resolvedPerson = (type === 'company' && !c ? '' : u);

  return {
    type,
    personName: resolvedPerson,
    companyName: resolvedCompany,
    displayName,
    whatsappIntro,
    directIntro,
    emailOpening,
    icebreaker,
    whatsappGreeting: greetingFn,
  };
}

export function cleanSenderIntro(message: string, identity: SenderIdentity): string {
  let cleaned = message.trim();
  const comp = (identity.companyName || (identity.type === 'company' ? identity.personName : '')).trim();
  const name = identity.personName.trim();

  if (comp) {
    const escComp = comp.replace(/[.*+?^${}()|[\]\\s]+/g, '\\s*');
    // Pattern: "Hi, I'm from X. I'm X from X" or "I'm X from X"
    const redundantPattern = new RegExp(`(?:Hi,?\\s*)?(?:I'?m|I am)?\\s*from\\s+${escComp}\\.?\\s*(?:I'?m|I am)\\s+${escComp}\\s+from\\s+${escComp}\\.?`, 'gi');
    cleaned = cleaned.replace(redundantPattern, (match, offset, fullStr) => {
      const before = fullStr.slice(0, offset).trim();
      const needsHi = !/(?:hi|hello|hey)\b/i.test(before);
      return (needsHi ? "Hi, I'm reaching out from " : "I'm reaching out from ") + comp + '.';
    });

    // Pattern: "this is X from X" or "I'm X from X"
    const doubleCompPattern = new RegExp(`(?:this is|I'?m|I am)\\s+${escComp}\\s+from\\s+${escComp}`, 'gi');
    cleaned = cleaned.replace(doubleCompPattern, `I'm reaching out from ${comp}`);

    // Pattern: duplicate "Hi, I'm reaching out from X. Hi, I'm reaching out from X"
    const dupDirectPattern = new RegExp(`(Hi,?\\s+I'?m\\s+reaching\\s+out\\s+from\\s+${escComp}\\.?)\\s*(?:Hi,?\\s*)?(?:I'?m\\s+reaching\\s+out\\s+from|this\\s+is)\\s+${escComp}\\.?`, 'gi');
    cleaned = cleaned.replace(dupDirectPattern, `$1`);
  }

  if (name && identity.type === 'person') {
    const escName = name.replace(/[.*+?^${}()|[\]\\s]+/g, '\\s*');
    const doubleNamePattern = new RegExp(`(?:this is|I'?m|I am)\\s+${escName}\\s+from\\s+${escName}`, 'gi');
    cleaned = cleaned.replace(doubleNamePattern, `my name is ${name}`);

    // Pattern: duplicate "Hi, my name is X. Hi, my name is X"
    const dupNamePattern = new RegExp(`(Hi,?\\s+my\\s+name\\s+is\\s+${escName}\\.?)\\s*(?:Hi,?\\s*)?my\\s+name\\s+is\\s+${escName}\\.?`, 'gi');
    cleaned = cleaned.replace(dupNamePattern, `$1`);
  }

  return cleaned;
}

export interface BuildWhatsAppOutreachOptions {
  leadId?: string;
  businessName: string;
  category?: string;
  niche?: string;
  address?: string;
  audit?: Partial<WebsiteAudit>;
  socialActivity?: Record<string, SocialActivity>;
  competitors?: Competitor[];
  problems?: ProblemFinding[];
  weaknesses?: string[];
  identity: SenderIdentity;
  availableServices?: string[];
  strategy?: OutreachStrategy;
}

function buildImpactSentence(selectedCategories: string[], audienceNoun: string, businessNoun: string): string {
  const hasBooking = selectedCategories.includes('booking');
  const hasWebsite = selectedCategories.includes('website');
  const hasResponse = selectedCategories.includes('response');
  const hasSocial = selectedCategories.includes('social');
  const hasReputation = selectedCategories.includes('reputation');

  if (hasBooking && (hasWebsite || hasSocial)) {
    return `These issues may make it harder for potential ${audienceNoun} to find information about your services and book appointments easily.`;
  }
  if (hasResponse || hasBooking) {
    return `These issues may make it harder for potential ${audienceNoun} to reach you promptly, learn about your services, or choose your ${businessNoun} over competitors.`;
  }
  if (hasSocial || hasReputation) {
    return `These issues may reduce your online visibility and make it harder for prospective ${audienceNoun} to discover your services and choose your ${businessNoun} over nearby competitors.`;
  }
  return `These issues may make it harder for potential ${audienceNoun} to reach you, learn about your services, or choose your ${businessNoun} over competitors.`;
}

function buildServicesClause(selectedCategories: string[], availableServices: string[], businessNoun: string): string {
  const capabilities: string[] = [];

  const hasWebsiteProblem = selectedCategories.includes('website');
  const hasResponseOrBooking = selectedCategories.includes('response') || selectedCategories.includes('booking');
  const hasSocialProblem = selectedCategories.includes('social');
  const hasSearchProblem = selectedCategories.includes('reputation') || selectedCategories.includes('information');

  const hasWebDevService = availableServices.some((s) => /web|site|design|develop|landing|wordpress/i.test(s));
  const hasAutomationService = availableServices.some((s) => /whatsapp|bot|chatbot|automation|crm|book/i.test(s));
  const hasSocialService = availableServices.some((s) => /social|ugc|video|content|instagram|facebook/i.test(s));
  const hasSeoService = availableServices.some((s) => /seo|search|rank|google|ads|ppc/i.test(s));

  if ((hasWebsiteProblem || capabilities.length === 0) && hasWebDevService) {
    capabilities.push('improve their online presence');
  }
  if (hasResponseOrBooking && hasAutomationService) {
    capabilities.push('streamline customer communication');
  }
  if (hasSocialProblem && hasSocialService && capabilities.length < 2) {
    capabilities.push('strengthen their social media engagement');
  }
  if (hasSearchProblem && hasSeoService && capabilities.length < 2) {
    capabilities.push('boost their local search visibility');
  }

  if (capabilities.length === 0) {
    if (hasWebDevService) capabilities.push('improve their online presence');
    if (hasAutomationService) capabilities.push('streamline customer communication');
    if (hasSeoService) capabilities.push('boost local search visibility');
  }
  if (capabilities.length === 0) {
    capabilities.push('improve their online presence and streamline customer communication');
  }

  const capabilityText = capabilities.slice(0, 2).join(' and ');
  return `We help businesses ${capabilityText}. I'd be happy to share a few ideas that could help your ${businessNoun} address these challenges.`;
}

export function generatePersonalizedWhatsAppMessage(options: BuildWhatsAppOutreachOptions): string {
  const {
    businessName,
    category,
    niche,
    audit,
    socialActivity = {},
    competitors = [],
    problems: explicitProblems,
    identity,
    availableServices = [],
    strategy,
  } = options;

  // 1. Natural & professional introduction using personal or company name
  const intro = identity.directIntro || (
    identity.type === 'company'
      ? `Hi, I'm reaching out from ${identity.companyName || identity.displayName}.`
      : identity.type === 'person_with_company'
      ? `Hi, my name is ${identity.personName} from ${identity.companyName}.`
      : `Hi, my name is ${identity.personName || 'Ali'}.`
  );

  // Business & audience nouns tailored to business category
  const rawCat = (niche || category || 'business').toLowerCase();
  let businessNoun = 'business';
  let audienceNoun = 'customers';

  if (/dental/i.test(rawCat)) {
    businessNoun = 'dental clinic';
    audienceNoun = 'patients';
  } else if (/clinic|health|medical|physio|doctor|hospital/i.test(rawCat)) {
    businessNoun = 'clinic';
    audienceNoun = 'patients';
  } else if (/restaurant|cafe|bakery|diner|bistro|food/i.test(rawCat)) {
    businessNoun = 'restaurant';
    audienceNoun = 'customers';
  } else if (/salon|spa|barber|beauty|aesthetic/i.test(rawCat)) {
    businessNoun = 'salon';
    audienceNoun = 'clients';
  } else if (/law|legal|attorney/i.test(rawCat)) {
    businessNoun = 'law firm';
    audienceNoun = 'clients';
  } else if (/consult|agency|accountant|financial/i.test(rawCat)) {
    businessNoun = 'firm';
    audienceNoun = 'clients';
  } else if (/gym|fitness|crossfit/i.test(rawCat)) {
    businessNoun = 'fitness center';
    audienceNoun = 'members';
  } else if (category && category.toLowerCase() !== 'business' && category.length < 30) {
    businessNoun = category.toLowerCase();
  }

  // 2. Opener referencing specific business and review of online presence
  const bLower = (businessName || '').toLowerCase();
  let researchOpener = '';
  if (bLower.includes(businessNoun)) {
    researchOpener = `I recently came across ${businessName} and took some time to review your online presence.`;
  } else if (businessName) {
    researchOpener = `I recently came across your ${businessNoun}, ${businessName}, and took some time to review your online presence.`;
  } else {
    researchOpener = `I recently came across your ${businessNoun} and took some time to review your online presence.`;
  }

  // Select 2 or 3 most relevant researched problems
  interface ProblemCandidate {
    id: string;
    category: 'website' | 'response' | 'social' | 'booking' | 'information' | 'reputation';
    phrase: string;
    priority: number;
  }

  const candidates: ProblemCandidate[] = [];

  // Social media review check
  const inactiveSocial = Object.entries(socialActivity).find(([, item]) => item.status === 'Inactive' || item.status === 'Slow');
  if (inactiveSocial || (strategy?.problems && strategy.problems.some((p) => p.category === 'social'))) {
    candidates.push({
      id: 'social',
      category: 'social',
      phrase: 'limited recent activity on your social media',
      priority: 1,
    });
  }

  // Online appointment booking check
  const hasBookingProblem = (strategy?.problems && strategy.problems.some((p) => p.category === 'booking')) ||
    (explicitProblems && explicitProblems.some((p) => p.category === 'booking')) ||
    /dental|clinic|doctor|health|salon|spa|consult/i.test(rawCat);
  if (hasBookingProblem) {
    candidates.push({
      id: 'booking',
      category: 'booking',
      phrase: 'a lack of convenient online appointment-booking options',
      priority: 2,
    });
  }

  // Website presence and health check
  if (audit?.hasWebsite === false || audit?.status === 'No Website') {
    candidates.push({
      id: 'website_missing',
      category: 'website',
      phrase: 'a missing dedicated website that makes it difficult for customers to find reliable business information and build trust',
      priority: 1,
    });
  } else if (audit && ((audit.score ?? 100) < 60 || audit.status === 'Needs Improvement' || audit.status === 'Poor')) {
    candidates.push({
      id: 'website_issues',
      category: 'website',
      phrase: 'technical performance and slow mobile loading on your website',
      priority: 2,
    });
  }

  // Instant chat / after-hours WhatsApp responsiveness
  const hasResponseGap = (strategy?.problems && strategy.problems.some((p) => p.category === 'response')) ||
    (explicitProblems && explicitProblems.some((p) => p.category === 'response')) ||
    (audit?.hasWebsite && !/whatsapp|chat|tidio|tawk/i.test((audit?.issues || []).join(' ') + (audit?.techStack || []).join(' ')));
  if (hasResponseGap) {
    candidates.push({
      id: 'response',
      category: 'response',
      phrase: 'delayed WhatsApp response options that may cause potential customers to contact competitors',
      priority: 3,
    });
  }

  // Competitor review & local visibility gap
  const hasCompetitorGap = (strategy?.problems && strategy.problems.some((p) => p.category === 'reputation')) ||
    (competitors.some((c) => Number(c.reviews) > 20));
  if (hasCompetitorGap) {
    candidates.push({
      id: 'reputation',
      category: 'reputation',
      phrase: 'lower local search visibility compared to nearby competitors who hold a higher review volume',
      priority: 4,
    });
  }

  // Service details transparency
  if (strategy?.problems && strategy.problems.some((p) => p.category === 'information')) {
    candidates.push({
      id: 'information',
      category: 'information',
      phrase: 'missing or incomplete online service and pricing information',
      priority: 5,
    });
  }

  // Sort and select top 2 or 3
  candidates.sort((a, b) => a.priority - b.priority);
  const selected = candidates.slice(0, 3);
  if (selected.length < 2) {
    if (!selected.some((s) => s.id === 'response')) {
      selected.push({
        id: 'response',
        category: 'response',
        phrase: 'delayed response options during off-hours that could lead potential customers to contact competitors',
        priority: 3,
      });
    }
  }

  const phrases = selected.map((s) => s.phrase);
  let problemsJoined = '';
  if (phrases.length === 2) {
    problemsJoined = `${phrases[0]} and ${phrases[1]}`;
  } else if (phrases.length >= 3) {
    problemsJoined = `${phrases[0]}, ${phrases[1]}, and ${phrases[2]}`;
  } else {
    problemsJoined = phrases[0] || 'areas where customer communication can be improved';
  }

  const researchParagraph = `${researchOpener} I noticed a few potential areas for improvement, including ${problemsJoined}.`;

  // 3. Potential Business Impact
  const selectedCategories = selected.map((s) => s.category);
  const impactParagraph = buildImpactSentence(selectedCategories, audienceNoun, businessNoun);

  // 4. Relevant Services based on user's actual services
  const pool = availableServices.length > 0 ? availableServices : ['Website Development', 'WhatsApp Automation', 'SEO'];
  const servicesParagraph = buildServicesClause(selectedCategories, pool, businessNoun);

  // 5. Soft Close
  const closingQuestion = 'Would you be interested in discussing them?';

  const fullMessage = [
    intro,
    researchParagraph,
    impactParagraph,
    servicesParagraph,
    closingQuestion,
  ].join('\n\n');

  return cleanSenderIntro(fullMessage, identity);
}

function serviceDetails(service: string, niche: string): { howItWorks: string; impact: string; timeline: string } {
  const s = service.toLowerCase();
  const n = niche.toLowerCase();

  if (/web|site|landing|design|develop|wordpress|shopify/i.test(s)) {
    return {
      howItWorks: `Build a clean, high-speed, mobile-optimized website highlighting key ${niche} services, credentials, patient testimonials, and instant contact forms.`,
      impact: 'Converts 2x–3x more visitors into booked appointments and establishes immediate medical/professional trust.',
      timeline: '7–10 business days',
    };
  }
  if (/seo|search|google|ranking|map/i.test(s)) {
    return {
      howItWorks: `Optimize Google Maps listing, local citations, schema markup, and target keywords like '${niche} near me' for top 3 local pack rankings.`,
      impact: 'Increases qualified local inquiry calls by 40%–60% within 60–90 days without recurring ad spend.',
      timeline: '2–4 weeks initial setup',
    };
  }
  if (/whatsapp|bot|chatbot|automation|crm/i.test(s)) {
    return {
      howItWorks: 'Deploy a 24/7 automated WhatsApp responder that instantly answers common questions, shares location/pricing, and books consultations automatically.',
      impact: 'Eliminates after-hours inquiry drop-off and secures leads who reach out in evenings or on weekends.',
      timeline: '3–5 business days',
    };
  }
  if (/social|ugc|video|content|instagram|facebook/i.test(s)) {
    return {
      howItWorks: `Create consistent weekly before-and-after reels, educational tips, and doctor spotlight posts demonstrating expertise in ${niche}.`,
      impact: 'Keeps the clinic top-of-mind and builds patient referral momentum across the local community.',
      timeline: 'Ongoing weekly content plan',
    };
  }
  if (/ads|ppc|google ads|meta ads/i.test(s)) {
    return {
      howItWorks: `Launch geo-targeted search and local campaigns targeting patients actively searching for urgent or high-value ${niche} treatments.`,
      impact: 'Generates predictable weekly patient inquiries with measurable cost-per-lead tracking.',
      timeline: '3–5 business days to launch',
    };
  }

  // Fallback for custom user services
  return {
    howItWorks: `Implement customized ${service} tailored specifically to streamline patient acquisition and service delivery for ${niche}.`,
    impact: `Differentiates the business from nearby competitors and increases client retention in ${niche}.`,
    timeline: '5–7 business days',
  };
}

function selectedServices(request: SearchRequest, audit: WebsiteAudit, activities: Record<string, SocialActivity>): string[] {
  const pool = request.services.length ? request.services : ['Website Development', 'SEO', 'WhatsApp Automation'];
  const issueText = audit.issues.join(' ').toLowerCase();
  const out: string[] = [];
  const add = (matches: RegExp) => {
    for (const service of pool) {
      if (matches.test(service) && !out.includes(service) && out.length < 4) {
        out.push(service);
      }
    }
  };

  if (!audit.hasWebsite || (audit.score ?? 0) < 60) add(/web|site|design|develop|landing|wordpress/i);
  if (!audit.hasWebsite || /meta|h1|title|schema|alt|analytics|https/i.test(issueText)) add(/seo|search|google|ranking/i);
  if (/whatsapp|chat|form|email|phone/i.test(issueText) || !audit.hasWebsite) add(/whatsapp|bot|chatbot|automation|crm/i);
  if (Object.values(activities).some((item) => item.status === 'Inactive' || item.status === 'Slow')) add(/social|ugc|video|content|creative/i);
  add(/ads|ppc|marketing/i);

  // Include any custom services user selected
  for (const s of pool) {
    if (!out.includes(s) && out.length < 4) out.push(s);
  }
  return out.slice(0, 4);
}

function buildProblems(place: MapsPlace, audit: WebsiteAudit, activities: Record<string, SocialActivity>, competitors: Competitor[]): ProblemFinding[] {
  const problems: ProblemFinding[] = [];

  // 1. Website & Digital Foundation
  if (!audit.hasWebsite) {
    problems.push({
      type: 'confirmed',
      category: 'website',
      title: 'No Dedicated Website',
      detail: `${place.title} lacks a dedicated web presence, leaving potential clients to rely solely on third-party directories or incomplete map pins.`,
      evidence: 'No active business website found during domain audit.',
    });
  } else if ((audit.score ?? 0) < 60 || audit.status === 'Needs Improvement' || audit.status === 'Poor') {
    problems.push({
      type: 'confirmed',
      category: 'website',
      title: 'Website Performance & Technical Deficits',
      detail: `The website scored ${audit.score ?? 0}/100. Issues detected: ${audit.issues.slice(0, 3).join('; ')}.`,
      evidence: `Performance score: ${audit.score}/100 with ${audit.issues.length} technical warnings.`,
    });
  }

  // 2. Response & Inquiry Channel Friction
  const hasDirectChat = audit.hasWebsite && /whatsapp|tawk|crisp|chat|tidio/i.test(audit.issues.join(' ') + audit.techStack.join(' '));
  if (!hasDirectChat) {
    problems.push({
      type: 'confirmed',
      category: 'response',
      title: 'No Instant Chat / Automated WhatsApp Channel',
      detail: 'No instant WhatsApp widget or chat automation was identified on the public page. Visitors must manually save numbers or dial phone lines during business hours.',
      evidence: 'No WhatsApp click-to-chat script or widget found on site.',
    });
    problems.push({
      type: 'potential',
      category: 'response',
      title: 'After-Hours Inquiry Loss',
      detail: 'When prospective clients search for treatment in evenings or during weekends, delay in receiving a response often causes them to contact the next available clinic.',
      evidence: 'Manual telephone-dependent intake during restricted working hours.',
    });
  }

  // 3. Online Information Transparency
  problems.push({
    type: 'potential',
    category: 'information',
    title: 'Consultation & Pricing Information Friction',
    detail: 'Key decision-making details such as specialist credentials, available procedure packages, and transparent consultation fees are difficult for first-time clients to verify upfront.',
    evidence: 'Absence of detailed service breakdown or procedure guidance.',
  });

  // 4. Booking Friction
  problems.push({
    type: 'potential',
    category: 'booking',
    title: 'Lack of Self-Service Appointment Scheduling',
    detail: 'Clients cannot self-book or reserve consultation slots online without phone tag, leading to friction for busy professionals.',
    evidence: 'No online calendar or real-time appointment booking interface detected.',
  });

  // 5. Social Presence
  const inactiveSocial = Object.entries(activities).find(([, item]) => item.status === 'Inactive' || item.status === 'Slow');
  if (inactiveSocial) {
    problems.push({
      type: 'confirmed',
      category: 'social',
      title: `Stale Social Presence (${inactiveSocial[0]})`,
      detail: `${inactiveSocial[0][0].toUpperCase()}${inactiveSocial[0].slice(1)} has been inactive for ${inactiveSocial[1].daysInactive ?? 'several'} days. This can signal to prospective clients that the practice is less active.`,
      evidence: `Last public post: ${inactiveSocial[1].lastPost || 'Not recent'}.`,
    });
  }

  // 6. Competitor Authority
  const strongCompetitor = competitors.find((c) => Number(c.reviews) > (place.reviews || 0) * 2 && Number(c.reviews) > 20);
  if (strongCompetitor) {
    problems.push({
      type: 'confirmed',
      category: 'reputation',
      title: 'Competitor Review & Local Authority Gap',
      detail: `Nearby competitor ${strongCompetitor.name} holds ${strongCompetitor.reviews} reviews (${strongCompetitor.rating} stars), giving them a major local search ranking advantage over ${place.title} (${place.reviews || 0} reviews).`,
      evidence: `Competitor reviews: ${strongCompetitor.reviews} vs ${place.reviews || 0}.`,
    });
  }

  return problems;
}

function buildDeterministicPlan(
  request: SearchRequest,
  place: MapsPlace,
  audit: WebsiteAudit,
  activities: Record<string, SocialActivity>,
  competitors: Competitor[],
  identity: SenderIdentity
): DetailedPlan {
  const services = selectedServices(request, audit, activities);
  const problems = buildProblems(place, audit, activities, competitors);
  const weaknesses = problems.map((p) => `${p.type === 'confirmed' ? '[Confirmed]' : '[Potential]'} ${p.title}: ${p.detail}`);

  const websiteFindings = problems.filter((p) => p.category === 'website').map((p) => p.detail);
  const socialFindings = problems.filter((p) => p.category === 'social').map((p) => p.detail);

  const score = Math.max(0, Math.min(100, Math.round((100 - (audit.score ?? 0)) * 0.7 + (audit.emails.length ? 15 : 0) + (audit.phones.length ? 10 : 0) + (audit.hasWebsite ? 0 : 10))));
  const low = Math.round((audit.hasWebsite && (audit.score ?? 0) >= 60 ? 300 : 500) * (1 + Math.max(0, services.length - 1) * 0.5) / 50) * 50;
  const high = Math.round(low * 2.2 / 100) * 100;

  const competitorInsight = competitors.length
    ? `Nearby providers like ${competitors.slice(0, 2).map((item) => `${item.name} (${item.rating || '-'}★, ${item.reviews} reviews)`).join(' and ')} are actively capturing local patients searching in ${place.address || request.area}.`
    : `Local competition in ${request.area} is actively vying for top search placement.`;

  const solutions = services.map((service) => {
    const details = serviceDetails(service, request.niche);
    return {
      service,
      howItWorks: details.howItWorks,
      impact: details.impact,
      estimatedTimeline: details.timeline,
    };
  });

  const businessImpact = [
    'Loss of after-hours patient inquiries due to absence of automated response channels.',
    'Reduced Google Maps search ranking compared to competitors with higher review counts.',
    'Lower conversion of high-intent website visitors due to lack of transparent service packaging and self-service booking.',
  ];

  const icebreaker = `${identity.icebreaker.replace('{title}', place.title).replace('{area}', request.area)}, and noticed your solid ${place.rating ? `${place.rating}-star rating` : 'practice reputation'}. I had a quick question regarding how you currently handle after-hours patient inquiries.`;

  const conversationGuidance = {
    icebreaker,
    discoveryQuestions: [
      `When patients contact ${place.title} in the evening or on weekends, what is your typical response time before they book with another provider?`,
      'Do you currently have a way for patients to view procedure information and schedule appointments directly via WhatsApp?',
      'How are you currently tracking leads from local Google Maps searches versus word-of-mouth referrals?',
    ],
    objectionHandling: [
      'If they say "We already have enough patients": Ask if higher-value elective procedures could increase practice revenue without increasing staff hours.',
      'If they say "We only rely on phone calls": Explain that over 65% of local patients now prefer messaging on WhatsApp over phone calls.',
    ],
  };

  const nextSteps = [
    'Review the identified operational and online gaps with practice decision-makers.',
    'Deploy WhatsApp instant responder to capture after-hours patient inquiries immediately.',
    'Optimize Google Business profile and launch an automated patient review campaign.',
    'Implement a streamlined mobile landing page with online appointment booking.',
  ];

  const strategy: OutreachStrategy = {
    overview: `${place.title} is an established ${place.category} located in ${place.address || request.area} with ${place.rating ? `${place.rating}★ across ${place.reviews} Google reviews` : 'an active local listing'}. Key growth opportunities lie in automating patient intake, improving after-hours response, and strengthening search visibility.`,
    problems,
    businessImpact,
    relevantServices: services,
    solutions,
    conversationGuidance,
    nextSteps,
  };

  const subject = cap(audit.hasWebsite && (audit.score ?? 0) < 60 ? `Quick website & patient intake ideas for ${place.title}` : `Patient inquiry & online ideas for ${place.title}`, 90);
  const opening = `${identity.emailOpening}. I was researching ${request.niche} in ${request.area} and noticed ${place.title} has a strong reputation, but also a few practical opportunities to capture more patient inquiries.`;
  const closing = 'Would you be open to a 5-minute call or a quick reply so I can share 2 specific improvements for your practice?';

  // WhatsApp draft: personalized research-backed outreach
  const whatsapp = generatePersonalizedWhatsAppMessage({
    leadId: place.placeId,
    businessName: place.title,
    category: place.category,
    niche: request.niche,
    address: place.address || request.area,
    audit,
    socialActivity: activities,
    competitors,
    problems,
    weaknesses,
    identity,
    availableServices: services,
    strategy,
  });

  return {
    score,
    priority: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    deal: `${money(low)} - ${money(high)}`,
    services,
    weaknesses: weaknesses.slice(0, 6),
    summary: `${place.title} has ${place.rating ? `a ${place.rating}-star Google rating` : 'a Google listing'}${place.reviews ? ` with ${place.reviews} reviews` : ''}. Identified gaps: ${problems.slice(0, 2).map((p) => p.title).join(', ')}. Recommended focus: ${services.join(', ')}.`,
    subject,
    opening,
    websiteFindings,
    socialFindings,
    competitorInsight,
    solutions,
    closing,
    whatsapp,
    strategy,
  };
}

function buildEmail(
  request: SearchRequest,
  place: MapsPlace,
  plan: DetailedPlan,
  audit: WebsiteAudit,
  competitors: Competitor[],
  identity: SenderIdentity
): { html: string; text: string } {
  const signatureItems = identity.type === 'company'
    ? [identity.companyName, request.portfolio || '', request.userPhone || '']
    : identity.type === 'person_with_company'
    ? [identity.personName, identity.companyName, request.portfolio || '', request.userPhone || '']
    : [identity.personName, request.portfolio || '', request.userPhone || ''];
  const signature = signatureItems.filter(Boolean).map(esc).join('<br>');
  const textSignature = signatureItems.filter(Boolean).join('\n');

  const list = (items: string[]) => items.length ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '';
  const comparison = competitors.length
    ? `<h3>How you compare locally in ${esc(request.area)}</h3><p>${esc(plan.competitorInsight)}</p><table style="width:100%;border-collapse:collapse;margin:12px 0;"><thead><tr style="background:#f3f4f6;text-align:left;"><th style="padding:8px;border:1px solid #e5e7eb;">Business</th><th style="padding:8px;border:1px solid #e5e7eb;">Rating</th><th style="padding:8px;border:1px solid #e5e7eb;">Reviews</th><th style="padding:8px;border:1px solid #e5e7eb;">Website</th></tr></thead><tbody><tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>${esc(place.title)} (you)</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${esc(place.rating || '-')}</td><td style="padding:8px;border:1px solid #e5e7eb;">${place.reviews}</td><td style="padding:8px;border:1px solid #e5e7eb;">${audit.hasWebsite ? 'Yes' : 'No'}</td></tr>${competitors.map((item) => `<tr><td style="padding:8px;border:1px solid #e5e7eb;">${esc(item.name)}</td><td style="padding:8px;border:1px solid #e5e7eb;">${esc(item.rating || '-')}</td><td style="padding:8px;border:1px solid #e5e7eb;">${item.reviews}</td><td style="padding:8px;border:1px solid #e5e7eb;">${item.hasWebsite ? 'Yes' : 'No'}</td></tr>`).join('')}</tbody></table>`
    : '';

  const html = cleanEmailHtml(`<div style="font-family:Arial,sans-serif;max-width:640px;color:#1f2937;line-height:1.65"><p>Hello ${esc(place.title)} Team,</p><p>${esc(plan.opening)}</p>${plan.websiteFindings.length ? `<h3>Key findings from our audit</h3>${list(plan.websiteFindings)}` : ''}${plan.socialFindings.length ? `<h3>Social media signals</h3>${list(plan.socialFindings)}` : ''}${comparison}<h3>Recommended solutions</h3><ul>${plan.solutions.map((item) => `<li><strong>${esc(item.service)}</strong> — ${esc(item.howItWorks)} <em>(${esc(item.impact)})</em></li>`).join('')}</ul><p>${esc(plan.closing)}</p><p>Best regards,<br>${signature}</p><p style="font-size:12px;color:#6b7280;margin-top:24px;">If this is not relevant to your practice, reply "unsubscribe" and we will not contact you again.</p></div>`);

  const text = `Hello ${place.title} Team,\n\n${plan.opening}\n\n${plan.websiteFindings.length ? `Audit findings:\n${plan.websiteFindings.map((item) => `- ${item}`).join('\n')}\n\n` : ''}${plan.socialFindings.length ? `Social media signals:\n${plan.socialFindings.map((item) => `- ${item}`).join('\n')}\n\n` : ''}${plan.competitorInsight ? `Local comparison:\n${plan.competitorInsight}\n\n` : ''}Recommended solutions:\n${plan.solutions.map((item) => `- ${item.service}: ${item.howItWorks} (${item.impact})`).join('\n')}\n\n${plan.closing}\n\nBest regards,\n${textSignature}`;

  return { html, text };
}

function parseModelOutput(value: string): Partial<DetailedPlan> | null {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(value.slice(start, end + 1)) as Partial<DetailedPlan>; } catch { return null; }
}

async function modelPlan(
  request: SearchRequest,
  place: MapsPlace,
  audit: WebsiteAudit,
  activities: Record<string, SocialActivity>,
  competitors: Competitor[],
  hasEmail: boolean,
  identity: SenderIdentity
): Promise<Partial<DetailedPlan> | null> {
  if (!env.OPENAI_API_KEY) return null;
  const prompt = {
    business: place,
    websiteAudit: audit,
    socialActivity: activities,
    competitors,
    sender: {
      name: identity.personName,
      company: identity.companyName,
      type: identity.type,
      requiredIntro: identity.whatsappIntro,
      services: request.services,
    },
    hasEmail,
  };

  const response = await fetch(`${env.OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You analyze a local business prospect strictly from supplied facts. Never invent facts. Return JSON with score (0-100), priority (high/medium/low), deal, services (from sender services), weaknesses (array), summary, whatsapp, and if hasEmail is true include subject, opening, closing. Keep tone professional, respectful, and consultative.

CRITICAL WHATSAPP OUTREACH RULES:
- Structure the WhatsApp message into 5 concise, paragraph-separated sections:
  1. Introduction: Begin with "${identity.directIntro}". NEVER repeat the sender name or company.
  2. Research Summary & Problems: Briefly explain that you took some time to review their business/clinic online presence. Mention 2 or 3 of the most relevant problems actually identified in the supplied facts (e.g. delayed WhatsApp responses, missing or poorly developed website, inactive social media, lack of convenient online appointment-booking options).
  3. Potential Business Impact: Briefly explain why these problems matter (e.g., making it harder for potential customers/patients to reach them, learn about services, or choose them over competitors). Never make unsupported claims about revenue or actual losses.
  4. Relevant Solutions: Naturally introduce how your team helps businesses using 1 or 2 relevant services from the sender's actual available services: ${JSON.stringify(request.services)}, and offer to share a few ideas.
  5. Soft Closing: "Would you be interested in discussing them?"
- Avoid generic marketing hype or long walls of text.`,
        },
        { role: 'user', content: JSON.stringify(prompt) },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) return null;
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return parseModelOutput(body.choices?.[0]?.message?.content || '');
}

export async function analyzeLead(
  request: SearchRequest,
  place: MapsPlace,
  audit: WebsiteAudit,
  activities: Record<string, SocialActivity>,
  competitors: Competitor[],
  runId: string
): Promise<Lead> {
  // Email verification: strictly use verified emails, never invent or fabricate
  const verifiedEmail = audit.emails.find((item) => {
    try {
      return new URL(place.website).hostname.replace(/^www\./, '').endsWith(item.split('@')[1]);
    } catch {
      return false;
    }
  }) || audit.emails[0] || '';

  const phone = audit.phones[0] || place.phone || '';
  const digits = phone.replace(/\D/g, '');
  const dial = { pakistan: '92', india: '91', usa: '1', 'united states': '1', canada: '1', uk: '44', 'united kingdom': '44' }[request.country.toLowerCase() as 'pakistan'] || '';
  const normalizedPhone = digits ? (phone.trim().startsWith('+') ? digits : digits.startsWith('00') ? digits.slice(2) : digits.startsWith('0') && dial ? `${dial}${digits.slice(1)}` : digits) : '';

  const identity = resolveSenderIdentity(request.userName, request.company, request.senderType);
  const fallback = buildDeterministicPlan(request, place, audit, activities, competitors, identity);
  let plan = fallback;

  // Only call AI if API key is present, saving token cost
  if (env.OPENAI_API_KEY) {
    try {
      const ai = await modelPlan(request, place, audit, activities, competitors, Boolean(verifiedEmail), identity);
      if (ai) {
        const services = (ai.services || []).filter((s) => request.services.includes(s)).slice(0, 4);
        plan = {
          ...fallback,
          ...ai,
          services: services.length ? services : fallback.services,
          priority: ai.priority && ['high', 'medium', 'low'].includes(ai.priority) ? ai.priority : fallback.priority,
          score: Number.isFinite(Number(ai.score)) ? Math.max(0, Math.min(100, Math.round(Number(ai.score)))) : fallback.score,
          weaknesses: Array.isArray(ai.weaknesses) ? ai.weaknesses.map(String).slice(0, 6) : fallback.weaknesses,
        };
      }
    } catch {
      // Fallback is resilient
    }
  }

  // Ensure WhatsApp message is clean and devoid of duplicate introductions
  if (plan.whatsapp) {
    plan.whatsapp = cleanSenderIntro(plan.whatsapp, identity);
  }

  // If no email address, NEVER generate email drafts (avoids spam and token waste)
  const emailDraft = verifiedEmail ? buildEmail(request, place, plan, audit, competitors, identity) : { html: '', text: '' };
  const emailSubject = verifiedEmail ? plan.subject : '';
  const emailStatus = verifiedEmail ? ('Draft' as const) : ('No Email' as const);
  const approvalStatus = verifiedEmail ? ('Pending Review' as const) : ('No Email' as const);

  const contactChannel = verifiedEmail && phone
    ? 'Email + Phone'
    : verifiedEmail
    ? 'Email Only'
    : phone
    ? 'Phone/WhatsApp Only'
    : audit.hasWebsite
    ? 'Website Form Only'
    : 'Social Only';

  const socialStatus = Object.entries(activities)
    .map(([name, item]) => `${name}: ${item.status}${item.daysInactive === null ? '' : ` (${item.daysInactive}d)`}`)
    .join(' | ') || 'No social media found';

  const createdAt = new Date().toISOString();

  return {
    runId,
    leadId: place.placeId,
    businessName: place.title,
    category: place.category,
    leadType: audit.hasWebsite ? 'Has Website' : 'No Website',
    contactChannel,
    website: place.website,
    email: verifiedEmail,
    phone,
    whatsappLink: normalizedPhone ? `https://wa.me/${normalizedPhone}` : '',
    address: place.address,
    country: request.country,
    googleRating: place.rating,
    googleReviews: place.reviews,
    googleMapsUrl: place.mapsUrl,
    locationStatus: place.locationStatus || ('Verified' as LocationStatus),
    locationVerified: place.locationVerified ?? true,
    leadScore: plan.score,
    priority: plan.priority,
    estimatedDealValue: plan.deal,
    recommendedServices: plan.services,
    weaknesses: plan.weaknesses,
    analysisSummary: plan.summary + (!env.OPENAI_API_KEY ? ' [Deterministic draft]' : ''),
    strategy: plan.strategy,
    websiteScore: audit.score,
    websiteStatus: audit.status,
    websiteIssues: audit.issues,
    websiteImages: audit.images,
    techStack: audit.techStack,
    social: audit.social,
    socialActivity: activities,
    socialStatus,
    competitors,
    emailSubject,
    emailBodyText: emailDraft.text,
    emailBodyHtml: emailDraft.html,
    whatsappMessage: phone ? plan.whatsapp : '',
    approvalStatus,
    emailStatus,
    responseStatus: 'No Reply',
    senderName: identity.displayName,
    searchQuery: `${request.niche} in ${request.area}, ${request.country}`,
    createdAt,
    emailSentAt: '',
    followUp1Date: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    followUp2Date: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    gmailThreadId: '',
    whatsappStatus: 'Not sent',
  };
}
