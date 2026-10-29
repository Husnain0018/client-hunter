import { randomUUID } from 'node:crypto';
import { Database } from '../db/database.js';
import type { Lead, SearchRequest } from '../types/domain.js';
import { searchMaps, normalizeAndDedupe, type MapsPlace } from './mapsScraper.js';
import { auditWebsite } from './websiteAuditor.js';
import { inspectSocials } from './socialScraper.js';
import { analyzeLead } from './aiAnalyzer.js';
import { appendLeads } from './googleSheetsSync.js';

export class RunPipeline {
  constructor(private readonly database: Database) {}

  start(request: SearchRequest, sheet?: { sheetId: string; tab: string }): string {
    const runId = randomUUID().replace(/-/g, '').slice(0, 32);
    this.database.createRun(runId, request, new Date().toISOString());
    void this.process(runId, request, sheet);
    return runId;
  }

  private event(runId: string, event: Parameters<Database['appendEvent']>[1]): void { this.database.appendEvent(runId, event); }

  private async process(runId: string, request: SearchRequest, sheet?: { sheetId: string; tab: string }): Promise<void> {
    this.database.updateRun(runId, 'running', 'Search started.', 0);
    this.event(runId, { type: 'stage', stage: 'start', level: 'info', message: `Search started for ${request.niche} in ${request.area}, ${request.country}.` });
    try {
      const maps = await searchMaps(request);
      if (maps.warning) this.event(runId, { type: 'stage', stage: 'maps', level: 'warn', message: maps.warning });
      const existing = this.existingKeys();
      const normalized = normalizeAndDedupe(maps.places, request, existing);
      const places = normalized.places.filter((place) => {
        const domain = (() => { try { return new URL(place.website).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } })();
        const phoneKey = place.phone.replace(/\D/g, '').slice(-9);
        return !this.database.findDuplicate(place.placeId, domain, phoneKey);
      });
      for (const place of places) this.event(runId, { type: 'lead', stage: 'maps', level: 'info', message: `${place.title} found on Google Maps.`, payload: { leadId: place.placeId, businessName: place.title, address: place.address, phone: place.phone, website: place.website, rating: place.rating, reviews: place.reviews } });
      this.event(runId, { type: 'stage', stage: 'maps', level: 'info', message: `${places.length} new businesses passed government, duplicate, and contact filters.` });
      if (!places.length) {
        const message = normalized.duplicates > 0
          ? 'You have already fetched the available leads for this area and business category. No new leads were found.'
          : `No new leads found. ${normalized.skipped} non-target listing(s) were skipped.`;
        this.database.updateRun(runId, 'done', message, 0, new Date().toISOString());
        this.event(runId, { type: 'done', stage: 'done', level: 'info', message });
        return;
      }
      const audits = await this.mapWithConcurrency(places, 4, async (place) => {
        const audit = await auditWebsite(place);
        this.event(runId, { type: 'lead', stage: 'websites', level: audit.status === 'Not Loading' ? 'warn' : 'info', message: `${place.title}: ${audit.status}.`, payload: { leadId: place.placeId, businessName: place.title, websiteStatus: audit.status, websiteScore: audit.score, websiteIssues: audit.issues, email: audit.emails[0] || '', phone: audit.phones[0] || place.phone } });
        return { place, audit };
      });
      this.event(runId, { type: 'stage', stage: 'websites', level: 'info', message: 'Website and contact audits completed.' });
      const socialRows = await this.mapWithConcurrency(audits, 3, async ({ place, audit }) => {
        const result = await inspectSocials(audit.social, request.checkSocial);
        this.event(runId, { type: 'lead', stage: 'social', level: 'info', message: `${place.title}: social review completed.`, payload: { leadId: place.placeId, businessName: place.title, socialStatus: result.summary } });
        return { place, audit, social: result };
      });
      this.event(runId, { type: 'stage', stage: 'social', level: 'info', message: request.checkSocial ? 'Social activity checks completed.' : 'Social profile discovery completed; activity check was disabled.' });
      const leads: Lead[] = [];
      for (const row of socialRows) {
        const lead = await analyzeLead(request, row.place, row.audit, row.social.activity, normalized.competitors.get(row.place.placeId) || [], runId);
        this.database.saveLead(lead);
        leads.push(lead);
        this.event(runId, { type: 'lead', stage: 'final', level: 'info', message: `${lead.businessName}: score ${lead.leadScore}/100, ${lead.priority} priority.`, payload: lead });
      }
      this.event(runId, { type: 'stage', stage: 'final', level: 'info', message: 'Personalized email and WhatsApp drafts were generated.' });
      if (sheet) {
        try {
          await appendLeads(sheet.sheetId, sheet.tab, leads);
          this.event(runId, { type: 'stage', stage: 'final', level: 'info', message: 'Leads were synced to the connected Google Sheet.' });
        } catch (error) {
          this.event(runId, { type: 'stage', stage: 'final', level: 'warn', message: error instanceof Error ? error.message : 'Google Sheet sync failed.' });
        }
      }
      const message = normalized.duplicates > 0
        ? `${leads.length} new lead(s) found. ${normalized.duplicates} previously discovered duplicate(s) skipped.`
        : `${leads.length} new leads found.`;
      this.database.updateRun(runId, 'done', message, leads.length, new Date().toISOString());
      this.event(runId, { type: 'done', stage: 'done', level: 'info', message, payload: { total: leads.length } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The lead search failed unexpectedly.';
      this.database.updateRun(runId, 'error', message, 0, new Date().toISOString());
      this.event(runId, { type: 'error', stage: 'done', level: 'error', message });
    }
  }

  private existingKeys(): { ids: Set<string>; domains: Set<string>; phones: Set<string>; names?: Set<string> } {
    return this.database.getAllExistingLeadIdentifiers();
  }

  private async mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
    const result: R[] = [];
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        result[index] = await worker(items[index]);
      }
    });
    await Promise.all(runners);
    return result;
  }
}
