import { afterAll, describe, expect, it } from 'vitest';
import { Database } from '../src/db/database.js';
import { resolveSenderIdentity, cleanSenderIntro } from '../src/services/aiAnalyzer.js';
import type { Lead } from '../src/types/domain.js';

describe('features and database enhancements', () => {
  const db = new Database(':memory:');
  afterAll(() => {
    db.close();
  });

  it('manages custom services correctly', () => {
    expect(db.listCustomServices()).toHaveLength(0);

    const s1 = db.createCustomService('Dental Implant Funnel', 'High-converting patient booking system');
    expect(s1.id).toBeDefined();
    expect(s1.name).toBe('Dental Implant Funnel');

    const list = db.listCustomServices();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Dental Implant Funnel');

    const deleted = db.deleteCustomService(s1.id);
    expect(deleted).toBe(true);
    expect(db.listCustomServices()).toHaveLength(0);
  });

  it('calculates stats and handles lead deletion', () => {
    db.createRun('run-1', {
      userName: 'Ali',
      company: 'Hunter',
      userEmail: 'ali@example.com',
      services: ['SEO'],
      niche: 'Dental Clinics',
      area: 'Peoples Colony, Gujranwala',
      country: 'Pakistan',
      maxLeads: 10,
      checkSocial: false,
      emailSummary: false,
    }, new Date().toISOString());

    const lead1: Lead = {
      runId: 'run-1',
      leadId: 'lead-test-1',
      businessName: 'Rahat Dental Clinic',
      category: 'Dental Clinic',
      leadType: 'Has Website',
      contactChannel: 'Email + Phone',
      website: 'https://rahatdental.pk',
      email: 'info@rahatdental.pk',
      phone: '+923001234567',
      whatsappLink: 'https://wa.me/923001234567',
      address: 'Peoples Colony, Gujranwala',
      country: 'Pakistan',
      googleRating: 4.8,
      googleReviews: 45,
      googleMapsUrl: '',
      locationStatus: 'Verified',
      locationVerified: true,
      leadScore: 85,
      priority: 'high',
      estimatedDealValue: '$500 - $1000',
      recommendedServices: ['SEO', 'WhatsApp Automation'],
      weaknesses: ['Slow website response'],
      analysisSummary: 'Solid clinic with automation opportunities.',
      websiteScore: 45,
      websiteStatus: 'Needs Improvement',
      websiteIssues: [],
      websiteImages: [],
      techStack: [],
      social: {},
      socialActivity: {},
      socialStatus: '',
      competitors: [],
      emailSubject: 'Ideas for Rahat Dental',
      emailBodyText: 'Hello',
      emailBodyHtml: '<p>Hello</p>',
      whatsappMessage: 'Hi Rahat Dental',
      approvalStatus: 'Pending Review',
      emailStatus: 'Draft',
      responseStatus: 'No Reply',
      senderName: 'Hunter',
      searchQuery: '',
      createdAt: new Date().toISOString(),
      emailSentAt: '',
      followUp1Date: '',
      followUp2Date: '',
      gmailThreadId: '',
    };

    db.saveLead(lead1);

    const statsBefore = db.getStats();
    expect(statsBefore.totalRuns).toBe(1);
    expect(statsBefore.totalUniqueLeads).toBe(1);
    expect(statsBefore.verifiedLeads).toBe(1);
    expect(statsBefore.leadsWithEmail).toBe(1);
    expect(statsBefore.leadsWithPhone).toBe(1);

    // Identifiers check
    const idents = db.getAllExistingLeadIdentifiers();
    expect(idents.ids.has('lead-test-1')).toBe(true);
    expect(idents.domains.has('rahatdental.pk')).toBe(true);
    expect(idents.phones.has('001234567')).toBe(true);

    // Delete lead
    const delResult = db.deleteLead('lead-test-1');
    expect(delResult).toBe(true);

    const statsAfter = db.getStats();
    expect(statsAfter.totalUniqueLeads).toBe(0);

    // Delete run
    const delRunResult = db.deleteRun('run-1');
    expect(delRunResult).toBe(true);
    expect(db.getRun('run-1')).toBeNull();
  });

  describe('resolveSenderIdentity and cleanSenderIntro', () => {
    it('accurately identifies company names and prevents redundant introductions', () => {
      const identity = resolveSenderIdentity({
        userName: 'Unitech Solution',
        company: '',
        userEmail: 'ali@example.com',
        services: ['SEO'],
        niche: 'Dental',
        area: 'Gujranwala',
        country: 'Pakistan',
        maxLeads: 10,
        checkSocial: false,
        emailSummary: false,
      });

      expect(identity.type).toBe('company');
      expect(identity.companyName).toBe('Unitech Solution');
      expect(identity.whatsappIntro).toBe("I'm reaching out from Unitech Solution");
      expect(identity.whatsappGreeting('Rahat Dental')).toBe("Hi Rahat Dental team, I'm reaching out from Unitech Solution.");
      expect(identity.emailOpening).toBe("I'm reaching out from Unitech Solution");
    });

    it('accurately identifies personal names', () => {
      const identity = resolveSenderIdentity({
        userName: 'Ali',
        company: '',
        userEmail: 'ali@example.com',
        services: ['SEO'],
        niche: 'Dental',
        area: 'Gujranwala',
        country: 'Pakistan',
        maxLeads: 10,
        checkSocial: false,
        emailSummary: false,
      });

      expect(identity.type).toBe('person');
      expect(identity.personName).toBe('Ali');
      expect(identity.whatsappIntro).toBe('my name is Ali');
      expect(identity.whatsappGreeting('Rahat Dental')).toBe('Hi Rahat Dental team, my name is Ali.');
      expect(identity.emailOpening).toBe('my name is Ali');
    });

    it('combines personal name and company name cleanly without duplicates', () => {
      const identity = resolveSenderIdentity({
        userName: 'Ali Husnain',
        company: 'Unitech Solution',
        userEmail: 'ali@example.com',
        services: ['SEO'],
        niche: 'Dental',
        area: 'Gujranwala',
        country: 'Pakistan',
        maxLeads: 10,
        checkSocial: false,
        emailSummary: false,
      });

      expect(identity.type).toBe('person_with_company');
      expect(identity.personName).toBe('Ali Husnain');
      expect(identity.companyName).toBe('Unitech Solution');
      expect(identity.whatsappIntro).toBe('my name is Ali Husnain from Unitech Solution');
      expect(identity.whatsappGreeting('Rahat Dental')).toBe('Hi Rahat Dental team, my name is Ali Husnain from Unitech Solution.');
    });

    it('handles duplicate name and company input without repeating', () => {
      const identity = resolveSenderIdentity({
        userName: 'Unitech Solution',
        company: 'Unitech Solution',
        userEmail: 'ali@example.com',
        services: ['SEO'],
        niche: 'Dental',
        area: 'Gujranwala',
        country: 'Pakistan',
        maxLeads: 10,
        checkSocial: false,
        emailSummary: false,
      });

      expect(identity.type).toBe('company');
      expect(identity.companyName).toBe('Unitech Solution');
      expect(identity.whatsappIntro).toBe("I'm reaching out from Unitech Solution");
      expect(identity.whatsappGreeting('Rahat Dental')).not.toContain('Unitech Solution from Unitech Solution');
    });

    it('respects user-specified senderType override', () => {
      const personExplicit = resolveSenderIdentity({
        userName: 'Tech Solutions Hub',
        company: '',
        senderType: 'person',
        userEmail: 'ali@example.com',
        services: ['SEO'],
        niche: 'Dental',
        area: 'Gujranwala',
        country: 'Pakistan',
        maxLeads: 10,
        checkSocial: false,
        emailSummary: false,
      });
      expect(personExplicit.type).toBe('person');
      expect(personExplicit.whatsappIntro).toBe('my name is Tech Solutions Hub');

      const companyExplicit = resolveSenderIdentity({
        userName: 'Ali',
        company: '',
        senderType: 'company',
        userEmail: 'ali@example.com',
        services: ['SEO'],
        niche: 'Dental',
        area: 'Gujranwala',
        country: 'Pakistan',
        maxLeads: 10,
        checkSocial: false,
        emailSummary: false,
      });
      expect(companyExplicit.type).toBe('company');
      expect(companyExplicit.whatsappIntro).toBe("I'm reaching out from Ali");
    });

    it('cleans redundant patterns with cleanSenderIntro', () => {
      const redundant1 = "Hi Rahat Dental team, I'm from Unitech Solution. I'm Unitech Solution from Unitech Solution. I noticed your clinic does not have a website.";
      const cleaned1 = cleanSenderIntro(redundant1, {
        type: 'company',
        companyName: 'Unitech Solution',
        personName: 'Unitech Solution',
        displayName: 'Unitech Solution',
        whatsappIntro: "I'm reaching out from Unitech Solution",
        emailOpening: "I'm reaching out from Unitech Solution",
        icebreaker: 'from Unitech Solution',
        whatsappGreeting: () => "Hi Rahat Dental team, I'm reaching out from Unitech Solution."
      });

      expect(cleaned1).toBe("Hi Rahat Dental team, I'm reaching out from Unitech Solution. I noticed your clinic does not have a website.");
      expect(cleaned1).not.toContain('Unitech Solution from Unitech Solution');
      expect(cleaned1).not.toContain("I'm from Unitech Solution. I'm");
    });
  });
});
