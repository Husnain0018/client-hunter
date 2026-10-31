import type { JobListing } from '../types/domain.js';

export interface AlternativeDiscoveredEmail {
  email: string;
  source: string;
  sourceUrl: string;
  emailType: 'recruitment' | 'hr' | 'company_contact' | 'general';
}

export interface DiscoveredEmailResult {
  found: boolean;
  email: string;
  source: string;
  sourceUrl?: string;
  companyName?: string;
  companyWebsite?: string;
  verificationStatus: 'verified' | 'publicly_listed' | 'unverified' | 'not_found';
  verificationLabel?: string;
  emailType?: 'recruitment' | 'hr' | 'company_contact' | 'general';
  portalUrl?: string;
  originalListingUrl?: string;
  sourcesChecked: string[];
  alternativeEmails?: AlternativeDiscoveredEmail[];
  notes?: string;
}

interface CandidateEmailHit {
  email: string;
  source: string;
  sourceUrl: string;
  emailType: 'recruitment' | 'hr' | 'company_contact' | 'general';
  verificationStatus: 'verified' | 'publicly_listed' | 'unverified';
  verificationLabel: string;
  score: number;
}

const RECRUITMENT_PREFIXES = [
  'careers',
  'career',
  'jobs',
  'job',
  'hiring',
  'recruiting',
  'recruitment',
  'talent',
  'apply',
  'applications',
  'application',
  'join',
  'joinus',
  'work',
  'opportunities',
  'vacancy',
  'vacancies',
  'karriere',
  'bewerbung',
  'bewerbungen',
  'stellen',
  'talents',
];

const HR_PREFIXES = [
  'hr',
  'humanresources',
  'human-resources',
  'people',
  'peopleops',
  'personal',
  'personalabteilung',
  'staffing',
];

const COMPANY_CONTACT_PREFIXES = [
  'contact',
  'kontakt',
  'info',
  'hello',
  'hallo',
  'mail',
  'office',
  'team',
  'inquiries',
  'enquiry',
  'enquiries',
  'welcome',
  'service',
];

const BLOCKED_EMAIL_PREFIXES = [
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'privacy',
  'datenschutz',
  'dpo',
  'security',
  'abuse',
  'billing',
  'invoice',
  'invoices',
  'legal',
  'press',
  'pr',
  'media',
  'unsubscribe',
  'mailer-daemon',
  'postmaster',
  'webmaster',
  'support',
  'helpdesk',
];

const JOB_PORTAL_DOMAINS = [
  'arbeitnow.com',
  'remoteok.com',
  'remoteok.io',
  'remotive.com',
  'remotive.io',
  'jobicy.com',
  'weworkremotely.com',
  'himalayas.app',
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'monster.com',
  'stepstone.de',
  'xing.com',
  'wellfound.com',
  'angel.co',
  'greenhouse.io',
  'lever.co',
  'workable.com',
  'ashbyhq.com',
  'bamboohr.com',
  'smartrecruiters.com',
  'myworkdayjobs.com',
  'personio.de',
  'personio.com',
  'join.com',
  'softgarden.io',
  'recruitee.com',
];

const IGNORED_EMAIL_DOMAINS = [
  'example.com',
  'example.org',
  'example.net',
  'domain.com',
  'yourdomain.com',
  'company.com',
  'email.com',
  'test.com',
  'sample.com',
  'w3.org',
  'schema.org',
  'sentry.io',
  'sentry.wixpress.com',
  'wixpress.com',
  'cloudflare.com',
  'googleapis.com',
  'googleusercontent.com',
  'gravatar.com',
  'wordpress.org',
  'wp.com',
];

const NON_COMPANY_LINK_DOMAINS = [
  ...JOB_PORTAL_DOMAINS,
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'tiktok.com',
  'github.com',
  'gitlab.com',
  'google.com',
  'apple.com',
  'microsoft.com',
  'cloudflare.com',
  'cookiebot.com',
  'onetrust.com',
  'whatsapp.com',
  't.me',
  'lnkd.in',
];

export class JobEmailDiscoveryService {
  private cache = new Map<string, { timestamp: number; result: DiscoveredEmailResult }>();
  private domainCache = new Map<string, { timestamp: number; website: string | null }>();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Multi-step recruitment email discovery workflow:
   * Step 1: Inspect original job listing fields (mailto, contactEmail, description, requirements).
   * Step 2: Inspect the job posting webpage (JSON-LD JobPosting, page mailto links, external company links).
   * Step 3: Resolve and inspect the company's official website (/careers, /jobs, /contact, /impressum, /about).
   * Step 4: Validate, classify, deduplicate, and prioritize discovered email addresses.
   */
  public async discoverRecipientEmail(
    job: JobListing,
    options?: { bypassCache?: boolean },
  ): Promise<DiscoveredEmailResult> {
    const cacheKey = `${job.id}::${job.company}::${job.applyUrl || ''}::${job.contactEmail || ''}`;
    if (!options?.bypassCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.result;
      }
    }

    const sourcesChecked: string[] = [];
    const hits = new Map<string, CandidateEmailHit>();
    const originalListingUrl = job.sourceUrl || job.applyUrl || '';
    let companyWebsite: string | undefined;

    const addHit = (hit: CandidateEmailHit) => {
      const normalized = hit.email.trim().toLowerCase();
      if (!this.isValidCandidateEmail(normalized)) return;
      const existing = hits.get(normalized);
      if (!existing || hit.score > existing.score) {
        hits.set(normalized, { ...hit, email: normalized });
      }
    };

    // =========================================================================
    // STEP 1: Check the Original Job Listing Data
    // =========================================================================
    sourcesChecked.push(`Original Job Listing (${job.source || 'Direct Listing'})`);

    // 1A. Direct mailto: link in applyUrl
    if (job.applyUrl && job.applyUrl.toLowerCase().startsWith('mailto:')) {
      const decoded = this.decodeObfuscatedEmails(job.applyUrl);
      const emailMatch = decoded.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (emailMatch?.[1] && this.isValidCandidateEmail(emailMatch[1])) {
        const email = emailMatch[1].toLowerCase();
        addHit({
          email,
          source: 'Original Job Listing (Direct mailto: Link)',
          sourceUrl: originalListingUrl,
          emailType: this.classifyEmailType(email),
          verificationStatus: 'verified',
          verificationLabel: 'Verified in Original Job Listing',
          score: 100,
        });
      }
    }

    // 1B. Stored contactEmail on the job listing
    if (job.contactEmail && this.isValidCandidateEmail(job.contactEmail)) {
      const email = job.contactEmail.trim().toLowerCase();
      if (!this.isJobPortalEmail(email, job.company)) {
        const emailType = this.classifyEmailType(email);
        addHit({
          email,
          source:
            emailType === 'recruitment' || emailType === 'hr'
              ? 'Original Job Listing (Recruitment Contact)'
              : 'Original Job Listing (Published Contact)',
          sourceUrl: originalListingUrl,
          emailType,
          verificationStatus: 'verified',
          verificationLabel: 'Publicly Listed in Job Posting • Format Validated',
          score: emailType === 'recruitment' || emailType === 'hr' ? 98 : 85,
        });
      }
    }

    // 1C. Scan job description, requirements, and responsibilities
    const combinedText = [
      job.description || '',
      ...(job.requirements || []),
      ...(job.responsibilities || []),
    ].join('\n');

    if (combinedText.trim()) {
      const decodedText = this.decodeObfuscatedEmails(combinedText);

      // Explicit application instruction pattern
      const explicitActionRegex =
        /(?:send|email|forward|submit|apply|reach out|write|schicken|senden|bewerben|bewerbung)[^.\n]{0,60}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
      let actionMatch: RegExpExecArray | null;
      while ((actionMatch = explicitActionRegex.exec(decodedText)) !== null) {
        const email = actionMatch[1].toLowerCase();
        if (this.isValidCandidateEmail(email) && !this.isJobPortalEmail(email, job.company)) {
          addHit({
            email,
            source: 'Original Job Listing (Application Instructions)',
            sourceUrl: originalListingUrl,
            emailType: 'recruitment',
            verificationStatus: 'verified',
            verificationLabel: 'Verified in Job Application Instructions',
            score: 99,
          });
        }
      }

      // General email scan in job text
      const textEmails = this.extractEmailsFromText(decodedText);
      for (const email of textEmails) {
        if (this.isJobPortalEmail(email, job.company)) continue;
        const emailType = this.classifyEmailType(email);
        const score =
          emailType === 'recruitment'
            ? 95
            : emailType === 'hr'
            ? 92
            : emailType === 'company_contact'
            ? 80
            : 72;
        addHit({
          email,
          source:
            emailType === 'recruitment' || emailType === 'hr'
              ? 'Original Job Listing Description'
              : 'Original Job Listing (Company Contact)',
          sourceUrl: originalListingUrl,
          emailType,
          verificationStatus: emailType === 'recruitment' || emailType === 'hr' ? 'verified' : 'publicly_listed',
          verificationLabel: 'Extracted from Job Listing • Format Validated',
          score,
        });
      }

      // Extract any company website mentioned directly in description text
      const websiteFromText = this.extractCompanyWebsiteFromText(decodedText, job.company);
      if (websiteFromText) {
        companyWebsite = websiteFromText;
      }
    }

    // If we already found a high-confidence verified recruitment email in the original listing, return immediately
    const bestFromStep1 = this.selectBestHit(hits);
    if (bestFromStep1 && bestFromStep1.score >= 95) {
      const result = this.buildSuccessResult(job, bestFromStep1, hits, sourcesChecked, companyWebsite);
      this.cache.set(cacheKey, { timestamp: Date.now(), result });
      return result;
    }

    // =========================================================================
    // STEP 2: Investigate the Job Posting Website (Portal / Apply URL)
    // =========================================================================
    const urlsToInspect = Array.from(
      new Set([job.applyUrl, job.sourceUrl].filter((u): u is string => Boolean(u && u.startsWith('http')))),
    );

    for (const targetUrl of urlsToInspect) {
      if (!this.isSafePublicUrl(targetUrl)) continue;
      if (this.isWalledGardenAggregator(targetUrl)) continue;

      const host = this.getHostname(targetUrl);
      const isDirectCompany = !this.isJobPortalUrl(targetUrl);
      if (isDirectCompany && !companyWebsite) {
        companyWebsite = this.getOrigin(targetUrl);
      }

      sourcesChecked.push(
        isDirectCompany ? `Company Job Page (${host})` : `Job Portal Listing (${host})`,
      );

      const html = await this.fetchPageHtml(targetUrl, 3500);
      if (!html) continue;

      // 2A. Check JSON-LD JobPosting schema for hiringOrganization url & applicationContact email
      const jsonLdInfo = this.extractFromJsonLd(html);
      if (jsonLdInfo.companyWebsite && !companyWebsite) {
        companyWebsite = jsonLdInfo.companyWebsite;
      }
      for (const email of jsonLdInfo.emails) {
        if (!this.isJobPortalEmail(email, job.company)) {
          const emailType = this.classifyEmailType(email);
          addHit({
            email,
            source: isDirectCompany ? 'Official Company Job Page' : `Job Portal Structured Data (${host})`,
            sourceUrl: targetUrl,
            emailType,
            verificationStatus: 'verified',
            verificationLabel: 'Verified in Job Posting Schema',
            score: 94,
          });
        }
      }

      // 2B. Extract emails from the job posting page HTML (excluding job portal's own domain emails)
      const pageEmails = this.extractEmailsFromHtml(html);
      for (const email of pageEmails) {
        if (this.isJobPortalEmail(email, job.company)) continue;
        // If this is a job portal page, also ensure the email isn't belonging to the portal's host
        if (!isDirectCompany && email.endsWith(`@${host}`)) continue;

        const emailType = this.classifyEmailType(email);
        const score =
          emailType === 'recruitment'
            ? 92
            : emailType === 'hr'
            ? 90
            : emailType === 'company_contact'
            ? 78
            : 68;
        addHit({
          email,
          source: isDirectCompany
            ? 'Official Company Careers Page'
            : `Job Posting Page (${host})`,
          sourceUrl: targetUrl,
          emailType,
          verificationStatus: emailType === 'recruitment' || emailType === 'hr' ? 'verified' : 'publicly_listed',
          verificationLabel: 'Publicly Listed / Format Validated',
          score,
        });
      }

      // 2C. If on a job portal, look for external links pointing to the employer's website
      if (!isDirectCompany && !companyWebsite) {
        const extractedSite = this.extractExternalCompanyWebsiteFromPortalHtml(html, targetUrl, job.company);
        if (extractedSite) {
          companyWebsite = extractedSite;
        }
      }
    }

    const bestFromStep2 = this.selectBestHit(hits);
    if (bestFromStep2 && bestFromStep2.score >= 90) {
      const result = this.buildSuccessResult(job, bestFromStep2, hits, sourcesChecked, companyWebsite);
      this.cache.set(cacheKey, { timestamp: Date.now(), result });
      return result;
    }

    // =========================================================================
    // STEP 3: Identify & Investigate the Company's Official Website
    // =========================================================================
    if (!companyWebsite) {
      companyWebsite = (await this.resolveOfficialCompanyWebsite(job)) || undefined;
    }

    if (companyWebsite && this.isSafePublicUrl(companyWebsite)) {
      const origin = this.getOrigin(companyWebsite);
      const companyHost = this.getHostname(origin);
      sourcesChecked.push(`Official Company Website (${origin})`);

      // 3A. Fetch the company homepage first to extract emails & discover internal careers/contact/imprint links
      const homeHtml = await this.fetchPageHtml(origin, 3200);
      const internalPages = new Map<string, string>(); // url -> label

      if (homeHtml) {
        this.collectEmailsFromCompanyPage(
          homeHtml,
          origin,
          'Official Company Homepage',
          companyHost,
          job.company,
          addHit,
        );

        // Extract internal links for Careers, HR, Contact, About, Impressum/Imprint
        const discoveredLinks = this.extractRelevantInternalLinks(homeHtml, origin);
        for (const item of discoveredLinks) {
          internalPages.set(item.url, item.label);
        }
      }

      // Add standard fallback paths if not already queued
      const standardPaths: Array<{ path: string; label: string }> = [
        { path: '/careers', label: 'Official Careers Page' },
        { path: '/karriere', label: 'Official Careers Page' },
        { path: '/jobs', label: 'Official Jobs Page' },
        { path: '/contact', label: 'Official Contact Page' },
        { path: '/contact-us', label: 'Official Contact Page' },
        { path: '/kontakt', label: 'Official Contact Page' },
        { path: '/impressum', label: 'Official Legal / Imprint Page' },
        { path: '/imprint', label: 'Official Legal / Imprint Page' },
        { path: '/about', label: 'Official About Page' },
      ];

      for (const sp of standardPaths) {
        if (internalPages.size >= 7) break;
        const fullUrl = `${origin}${sp.path}`;
        if (!internalPages.has(fullUrl)) {
          internalPages.set(fullUrl, sp.label);
        }
      }

      // Fetch candidate internal pages in parallel
      const entriesToFetch = Array.from(internalPages.entries()).slice(0, 7);
      await Promise.all(
        entriesToFetch.map(async ([pageUrl, pageLabel]) => {
          if (!this.isSafePublicUrl(pageUrl)) return;
          const html = await this.fetchPageHtml(pageUrl, 3000);
          if (!html) return;
          sourcesChecked.push(`${pageLabel} (${pageUrl})`);
          this.collectEmailsFromCompanyPage(html, pageUrl, pageLabel, companyHost, job.company, addHit);
        }),
      );
    }

    // =========================================================================
    // STEP 4, 5 & 6: Select Best Email or Return Structured Not Found
    // =========================================================================
    const bestHit = this.selectBestHit(hits);
    if (bestHit) {
      const result = this.buildSuccessResult(job, bestHit, hits, sourcesChecked, companyWebsite);
      this.cache.set(cacheKey, { timestamp: Date.now(), result });
      return result;
    }

    const notFoundResult: DiscoveredEmailResult = {
      found: false,
      email: '',
      source: 'Recruitment Email Not Found',
      companyName: job.company,
      companyWebsite,
      verificationStatus: 'not_found',
      verificationLabel: 'No Public Email Published',
      portalUrl: job.applyUrl || job.sourceUrl || companyWebsite || '',
      originalListingUrl,
      sourcesChecked,
      notes:
        'No reliable recruitment or company contact email was publicly listed across the checked sources. You can apply directly through the official portal or enter a known recipient address manually.',
    };

    this.cache.set(cacheKey, { timestamp: Date.now(), result: notFoundResult });
    return notFoundResult;
  }

  private collectEmailsFromCompanyPage(
    html: string,
    pageUrl: string,
    pageLabel: string,
    companyHost: string,
    companyName: string,
    addHit: (hit: CandidateEmailHit) => void,
  ): void {
    const emails = this.extractEmailsFromHtml(html);
    const isCareersPage = /career|karriere|job|stellen|recruit|talent/i.test(pageUrl + ' ' + pageLabel);

    for (const email of emails) {
      if (this.isJobPortalEmail(email, companyName)) continue;

      const emailDomain = email.split('@')[1]?.toLowerCase() || '';
      const matchesCompanyDomain =
        emailDomain === companyHost ||
        companyHost.endsWith(`.${emailDomain}`) ||
        emailDomain.endsWith(`.${companyHost}`) ||
        this.emailMatchesCompanyTokens(emailDomain, companyName);

      const emailType = this.classifyEmailType(email);

      let score = 60;
      if (emailType === 'recruitment') {
        score = isCareersPage ? 93 : 90;
      } else if (emailType === 'hr') {
        score = isCareersPage ? 91 : 88;
      } else if (emailType === 'company_contact') {
        score = isCareersPage ? 82 : 76;
      } else {
        score = isCareersPage ? 70 : 64;
      }

      if (matchesCompanyDomain) {
        score += 3;
      }

      addHit({
        email,
        source: pageLabel,
        sourceUrl: pageUrl,
        emailType,
        verificationStatus:
          emailType === 'recruitment' || emailType === 'hr' ? 'verified' : 'publicly_listed',
        verificationLabel:
          emailType === 'recruitment' || emailType === 'hr'
            ? `Verified Recruitment Inbox (${pageLabel})`
            : `Publicly Listed on ${pageLabel} • Format Validated`,
        score,
      });
    }
  }

  private buildSuccessResult(
    job: JobListing,
    bestHit: CandidateEmailHit,
    allHits: Map<string, CandidateEmailHit>,
    sourcesChecked: string[],
    companyWebsite?: string,
  ): DiscoveredEmailResult {
    const alternatives: AlternativeDiscoveredEmail[] = Array.from(allHits.values())
      .filter((h) => h.email !== bestHit.email)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((h) => ({
        email: h.email,
        source: h.source,
        sourceUrl: h.sourceUrl,
        emailType: h.emailType,
      }));

    return {
      found: true,
      email: bestHit.email,
      source: bestHit.source,
      sourceUrl: bestHit.sourceUrl,
      companyName: job.company,
      companyWebsite: companyWebsite || this.inferWebsiteFromEmail(bestHit.email),
      verificationStatus: bestHit.verificationStatus,
      verificationLabel: bestHit.verificationLabel,
      emailType: bestHit.emailType,
      portalUrl: job.applyUrl || job.sourceUrl || companyWebsite || '',
      originalListingUrl: job.sourceUrl || job.applyUrl || '',
      sourcesChecked,
      alternativeEmails: alternatives,
      notes:
        bestHit.emailType === 'recruitment' || bestHit.emailType === 'hr'
          ? `Dedicated recruitment/HR address discovered via ${bestHit.source}.`
          : `Official company contact address published on ${bestHit.source}.`,
    };
  }

  private selectBestHit(hits: Map<string, CandidateEmailHit>): CandidateEmailHit | null {
    if (hits.size === 0) return null;
    return Array.from(hits.values()).sort((a, b) => b.score - a.score)[0] || null;
  }

  /**
   * Resolves the official company website using:
   * 1. Clearbit Company Autocomplete API (verified against company name tokens).
   * 2. Brand alias detection inside the job description (e.g., "Wir sind <brand>" / "We are <brand>").
   */
  private async resolveOfficialCompanyWebsite(job: JobListing): Promise<string | null> {
    const rawCompany = (job.company || '').trim();
    if (!rawCompany || rawCompany.toLowerCase() === 'unknown company') return null;

    const cached = this.domainCache.get(rawCompany.toLowerCase());
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.website;
    }

    const candidatesToQuery: string[] = [];
    const cleaned = this.cleanCompanyName(rawCompany);
    if (cleaned) candidatesToQuery.push(cleaned);

    // Check if the job description introduces a brand alias (e.g. "Wir sind vly" or "At <Brand>, we")
    const brandAlias = this.extractBrandAliasFromDescription(job.description || '', cleaned);
    if (brandAlias && !candidatesToQuery.includes(brandAlias)) {
      candidatesToQuery.push(brandAlias);
    }

    for (const queryName of candidatesToQuery) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(queryName)}`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timer);
        if (!res.ok) continue;

        const suggestions = (await res.json()) as Array<{ name?: string; domain?: string }>;
        if (!Array.isArray(suggestions) || suggestions.length === 0) continue;

        const queryTokens = this.tokenizeName(queryName);
        for (const item of suggestions) {
          const domain = (item.domain || '').toLowerCase().trim();
          const itemName = (item.name || '').toLowerCase().trim();
          if (!domain || this.isJobPortalUrl(`https://${domain}`)) continue;

          // Verify strong token match between queried company name and returned suggestion
          const domainBase = domain.split('.')[0].replace(/[^a-z0-9]/g, '');
          const nameBase = itemName.replace(/[^a-z0-9]/g, '');
          const primaryToken = queryTokens[0] || '';

          if (
            primaryToken.length >= 3 &&
            (domainBase.includes(primaryToken) ||
              primaryToken.includes(domainBase) ||
              nameBase.includes(primaryToken))
          ) {
            const website = `https://${domain}`;
            this.domainCache.set(rawCompany.toLowerCase(), { timestamp: Date.now(), website });
            return website;
          }
        }
      } catch {
        // Ignore network/timeout errors
      }
    }

    this.domainCache.set(rawCompany.toLowerCase(), { timestamp: Date.now(), website: null });
    return null;
  }

  private cleanCompanyName(name: string): string {
    return name
      .replace(/[®™©]/g, '')
      .replace(
        /\b(GmbH\s*&\s*Co\.?\s*KG|GmbH|AG|e\.K\.|UG|SE|KG|OHG|Inc\.?|LLC|Ltd\.?|Limited|Corp\.?|Corporation|Co\.?|PLC|B\.V\.|N\.V\.|S\.A\.|S\.A\.S\.|S\.r\.l\.|Pvt\.?\s*Ltd\.?|Group|Holding|Holdings)\b/gi,
        '',
      )
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenizeName(name: string): string[] {
    return this.cleanCompanyName(name)
      .toLowerCase()
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ß/g, 'ss')
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2);
  }

  private extractBrandAliasFromDescription(description: string, cleanedCompany: string): string | null {
    if (!description) return null;
    const match = description.match(
      /(?:Wir sind|We are|Welcome to|Willkommen bei)\s+([A-ZÄÖÜa-zäöü0-9-]{3,20})(?:\s*[–—,-]|\s+ein|\s+an?\b)/,
    );
    if (match?.[1]) {
      const alias = match[1].trim();
      if (alias.toLowerCase() !== cleanedCompany.toLowerCase()) {
        return alias;
      }
    }
    return null;
  }

  private extractCompanyWebsiteFromText(text: string, companyName: string): string | null {
    const urlMatches = text.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s"'<>)]*)?/gi) || [];
    for (const rawUrl of urlMatches) {
      const cleaned = rawUrl.replace(/[.,;:!?)]+$/, '');
      if (!this.isSafePublicUrl(cleaned)) continue;
      const host = this.getHostname(cleaned);
      if (NON_COMPANY_LINK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) continue;
      if (this.emailMatchesCompanyTokens(host, companyName)) {
        return this.getOrigin(cleaned);
      }
    }
    return null;
  }

  private extractExternalCompanyWebsiteFromPortalHtml(
    html: string,
    portalUrl: string,
    companyName: string,
  ): string | null {
    const portalHost = this.getHostname(portalUrl);
    const linkRegex = /<a\b[^>]*href=["'](https?:\/\/[^"'\s>]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1].trim();
      const anchorText = match[2].replace(/<[^>]+>/g, ' ').trim().toLowerCase();
      if (!this.isSafePublicUrl(href)) continue;

      const host = this.getHostname(href);
      if (!host || host === portalHost || host.endsWith(`.${portalHost}`)) continue;
      if (NON_COMPANY_LINK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) continue;

      if (
        this.emailMatchesCompanyTokens(host, companyName) ||
        /website|company|webseite|homepage|career|karriere/i.test(anchorText)
      ) {
        return this.getOrigin(href);
      }
    }
    return null;
  }

  private extractRelevantInternalLinks(
    html: string,
    origin: string,
  ): Array<{ url: string; label: string }> {
    const originHost = this.getHostname(origin);
    const results: Array<{ url: string; label: string; priority: number }> = [];
    const seen = new Set<string>();

    const linkRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const rawHref = match[1].trim();
      const anchorText = match[2].replace(/<[^>]+>/g, ' ').trim();
      if (!rawHref || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:')) {
        continue;
      }

      let resolved: string;
      try {
        resolved = new URL(rawHref, origin).toString().split('#')[0].replace(/\/$/, '');
      } catch {
        continue;
      }

      if (seen.has(resolved)) continue;
      const host = this.getHostname(resolved);
      if (host !== originHost && !host.endsWith(`.${originHost}`)) continue;

      const combined = `${resolved.toLowerCase()} ${anchorText.toLowerCase()}`;
      if (/\b(career|careers|karriere|jobs|stellen|stellenangebote|recruiting|work-with-us|join-us)\b/i.test(combined)) {
        seen.add(resolved);
        results.push({ url: resolved, label: 'Official Careers Page', priority: 1 });
      } else if (/\b(contact|contact-us|kontakt|get-in-touch)\b/i.test(combined)) {
        seen.add(resolved);
        results.push({ url: resolved, label: 'Official Contact Page', priority: 2 });
      } else if (/\b(impressum|imprint|legal-notice)\b/i.test(combined)) {
        seen.add(resolved);
        results.push({ url: resolved, label: 'Official Legal / Imprint Page', priority: 3 });
      } else if (/\b(about|about-us|ueber-uns|uber-uns|team|company)\b/i.test(combined)) {
        seen.add(resolved);
        results.push({ url: resolved, label: 'Official About Page', priority: 4 });
      }
    }

    return results.sort((a, b) => a.priority - b.priority).slice(0, 6);
  }

  private extractFromJsonLd(html: string): { emails: string[]; companyWebsite?: string } {
    const emails: string[] = [];
    let companyWebsite: string | undefined;

    const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = scriptRegex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        const items = Array.isArray(parsed) ? parsed : parsed?.['@graph'] ? parsed['@graph'] : [parsed];
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const contactEmail =
            item.applicationContact?.email ||
            item.hiringOrganization?.email ||
            item.email;
          if (typeof contactEmail === 'string' && this.isValidCandidateEmail(contactEmail)) {
            emails.push(contactEmail.toLowerCase().trim());
          }
          const orgUrl = item.hiringOrganization?.sameAs || item.hiringOrganization?.url;
          if (
            typeof orgUrl === 'string' &&
            orgUrl.startsWith('http') &&
            !this.isJobPortalUrl(orgUrl) &&
            this.isSafePublicUrl(orgUrl)
          ) {
            companyWebsite = this.getOrigin(orgUrl);
          }
        }
      } catch {
        // Ignore malformed JSON-LD
      }
    }

    return { emails, companyWebsite };
  }

  private decodeObfuscatedEmails(input: string): string {
    return (input || '')
      .replace(/&#64;|&#x40;|%40/gi, '@')
      .replace(/&#46;|&#x2e;/gi, '.')
      .replace(/\s*(?:\[at\]|\(at\)|\{at\})\s*/gi, '@')
      .replace(/\s*(?:\[dot\]|\(dot\)|\{dot\})\s*/gi, '.');
  }

  private extractEmailsFromHtml(html: string): string[] {
    const decoded = this.decodeObfuscatedEmails(html);
    const results = new Set<string>();

    // 1. Explicit mailto: links first
    const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
    let m: RegExpExecArray | null;
    while ((m = mailtoRegex.exec(decoded)) !== null) {
      const clean = m[1].toLowerCase().trim();
      if (this.isValidCandidateEmail(clean)) {
        results.add(clean);
      }
    }

    // 2. Visible text emails
    const stripped = decoded
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
    for (const email of this.extractEmailsFromText(stripped)) {
      results.add(email);
    }

    return Array.from(results);
  }

  private extractEmailsFromText(text: string): string[] {
    const results = new Set<string>();
    const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const raw of matches) {
      const clean = raw.toLowerCase().replace(/[.,;:!?)]+$/, '').trim();
      if (this.isValidCandidateEmail(clean)) {
        results.add(clean);
      }
    }
    return Array.from(results);
  }

  public isValidCandidateEmail(email: string): boolean {
    if (!email || email.length > 120) return false;
    const clean = email.trim().toLowerCase();
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,12}$/.test(clean)) return false;

    const [localPart, domain] = clean.split('@');
    if (!localPart || !domain || localPart.length < 2) return false;

    // Exclude image/asset filenames and version strings (e.g. icon@2x.png)
    if (/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot|map|pdf)$/i.test(clean)) {
      return false;
    }

    if (IGNORED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      return false;
    }

    if (BLOCKED_EMAIL_PREFIXES.some((prefix) => localPart === prefix || localPart.startsWith(`${prefix}.`) || localPart.startsWith(`${prefix}_`))) {
      return false;
    }

    return true;
  }

  public classifyEmailType(email: string): 'recruitment' | 'hr' | 'company_contact' | 'general' {
    const localPart = (email.split('@')[0] || '').toLowerCase();
    const tokens = localPart.split(/[._+-]+/);

    if (
      RECRUITMENT_PREFIXES.some(
        (p) => localPart === p || tokens.includes(p) || localPart.startsWith(p),
      )
    ) {
      return 'recruitment';
    }

    if (HR_PREFIXES.some((p) => localPart === p || tokens.includes(p) || localPart === 'hr')) {
      return 'hr';
    }

    if (COMPANY_CONTACT_PREFIXES.some((p) => localPart === p || tokens.includes(p))) {
      return 'company_contact';
    }

    return 'general';
  }

  private isJobPortalEmail(email: string, companyName: string): boolean {
    const domain = (email.split('@')[1] || '').toLowerCase();
    if (!domain) return true;
    const companyLower = (companyName || '').toLowerCase();

    for (const portalDomain of JOB_PORTAL_DOMAINS) {
      if (domain === portalDomain || domain.endsWith(`.${portalDomain}`)) {
        const portalBrand = portalDomain.split('.')[0];
        if (!companyLower.includes(portalBrand)) {
          return true;
        }
      }
    }
    return false;
  }

  private isJobPortalUrl(url: string): boolean {
    const host = this.getHostname(url);
    if (!host) return false;
    return JOB_PORTAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  }

  private isWalledGardenAggregator(url: string): boolean {
    const host = this.getHostname(url);
    return ['linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com'].some(
      (d) => host === d || host.endsWith(`.${d}`),
    );
  }

  private emailMatchesCompanyTokens(domainOrHost: string, companyName: string): boolean {
    const tokens = this.tokenizeName(companyName);
    const cleanHost = domainOrHost.toLowerCase().replace(/[^a-z0-9]/g, '');
    return tokens.some((t) => t.length >= 3 && cleanHost.includes(t));
  }

  private inferWebsiteFromEmail(email: string): string | undefined {
    const domain = (email.split('@')[1] || '').toLowerCase();
    if (!domain) return undefined;
    const publicMailProviders = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com', 'gmx.de', 'web.de'];
    if (publicMailProviders.includes(domain)) return undefined;
    return `https://${domain}`;
  }

  private getHostname(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  private getOrigin(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.hostname}`;
    } catch {
      return '';
    }
  }

  /**
   * SSRF Protection: Ensures only public HTTP/HTTPS URLs are fetched, blocking loopback,
   * private RFC1918 networks, link-local metadata endpoints, and internal hostnames.
   */
  public isSafePublicUrl(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      if (
        !host ||
        host === 'localhost' ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        host.endsWith('.localhost') ||
        host === '0.0.0.0' ||
        host === '::1' ||
        host === '[::1]'
      ) {
        return false;
      }

      // Check IPv4 private/loopback/link-local ranges
      const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (ipv4Match) {
        const [, a, b] = ipv4Match.map(Number);
        if (
          a === 127 ||
          a === 10 ||
          a === 0 ||
          (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && b === 168) ||
          (a === 169 && b === 254)
        ) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  private async fetchPageHtml(url: string, timeoutMs = 3500): Promise<string | null> {
    if (!this.isSafePublicUrl(url)) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
        },
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType && !contentType.includes('html') && !contentType.includes('xml') && !contentType.includes('text')) {
        return null;
      }
      const text = await res.text();
      return text.slice(0, 512_000);
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }
}

export const jobEmailDiscoveryService = new JobEmailDiscoveryService();
