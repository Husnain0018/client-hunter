import type { CareerProfile, JobListing, WorkplaceType } from '../types/domain.js';

export interface MatchResult {
  score: number; // 0 - 100
  matchReasons: string[];
  missingSkills: string[];
  salaryFit?: 'below' | 'within' | 'above' | 'unspecified';
  visaGuidance?: string;
  marketTips?: string[];
}

export class JobMatchingEngine {
  /**
   * Evaluates compatibility between candidate profile and a job listing.
   */
  public evaluate(profile: CareerProfile | null, job: JobListing): MatchResult {
    let score = 0;
    const matchReasons: string[] = [];
    const missingSkills: string[] = [];
    const marketTips: string[] = [];

    const jobText = `${job.title} ${job.description} ${(job.requirements || []).join(' ')}`.toLowerCase();
    const candidateSkillsLower = (profile?.skills || []).map(s => s.toLowerCase().trim());

    // 1. SKILLS MATCH (Up to 45 points)
    const matchedSkills: string[] = [];
    for (const skill of candidateSkillsLower) {
      if (!skill) continue;
      if (jobText.includes(skill)) {
        matchedSkills.push(skill);
      }
    }

    // Identify missing skills from job requirements
    for (const req of (job.requirements || [])) {
      const words = req.toLowerCase().split(/[\s,/]+/);
      for (const w of words) {
        if (w.length > 2 && !['and', 'with', 'the', 'for', 'experience', 'knowledge', 'years', 'using'].includes(w)) {
          if (!candidateSkillsLower.some(cs => cs.includes(w) || w.includes(cs))) {
            if (!missingSkills.includes(w) && missingSkills.length < 5) {
              missingSkills.push(w);
            }
          }
        }
      }
    }

    if (candidateSkillsLower.length > 0) {
      const matchRatio = Math.min(1, matchedSkills.length / Math.max(2, Math.min(6, candidateSkillsLower.length)));
      const skillScore = Math.round(matchRatio * 45);
      score += skillScore;
      if (matchedSkills.length > 0) {
        matchReasons.push(`Skills match: ${matchedSkills.slice(0, 4).join(', ')}`);
      }
    } else {
      score += 20; // Default baseline
    }

    // 2. TITLE / ROLE FIT (Up to 25 points)
    const targetRoles = (profile?.targetRoles || []).map(r => r.toLowerCase().trim()).filter(Boolean);
    const jobTitleLower = job.title.toLowerCase();

    let titleMatched = false;
    for (const role of targetRoles) {
      const tokens = role.split(/\s+/).filter(t => t.length > 2);
      const matchedTokens = tokens.filter(t => jobTitleLower.includes(t));
      if (matchedTokens.length >= 1) {
        titleMatched = true;
        const roleScore = Math.min(25, Math.round((matchedTokens.length / tokens.length) * 25));
        score += roleScore;
        matchReasons.push(`Title aligns with target role: "${job.title}" matches "${role}"`);
        break;
      }
    }

    if (!titleMatched && targetRoles.length > 0) {
      if (/(developer|engineer|designer|manager|architect|analyst)/i.test(jobTitleLower)) {
        score += 10;
      }
    } else if (targetRoles.length === 0) {
      score += 15;
    }

    // 3. WORKPLACE TYPE FIT (Up to 15 points)
    const remotePref = profile?.remotePreference;
    if (!remotePref || remotePref === job.workplaceType) {
      score += 15;
      matchReasons.push(`Workplace format matches preference: ${job.workplaceType}`);
    } else if (job.workplaceType === 'Remote' && remotePref === 'Hybrid') {
      score += 10;
      matchReasons.push('Remote flexibility offers excellent hybrid/telecommute compatibility');
    } else {
      score += 5;
    }

    // 4. LOCATION & COUNTRY FIT (Up to 15 points)
    const preferredLocations = (profile?.preferredLocations || []).map(c => c.toLowerCase());
    const jobCountry = (job.country || '').toLowerCase();

    if (job.workplaceType === 'Remote' || job.location.toLowerCase().includes('remote') || job.location.toLowerCase().includes('worldwide')) {
      score += 15;
      matchReasons.push('Worldwide/remote eligibility');
    } else if (preferredLocations.length === 0 || preferredLocations.some(l => l.includes(jobCountry) || jobCountry.includes(l)) || preferredLocations.includes('worldwide')) {
      score += 15;
      matchReasons.push(`Located in your preferred country: ${job.country}`);
    } else {
      score += 5;
    }

    // 5. SALARY FIT EVALUATION
    let salaryFit: 'below' | 'within' | 'above' | 'unspecified' = 'unspecified';
    const minSalaryNum = profile?.minSalary ? parseInt(profile.minSalary.replace(/[^0-9]/g, ''), 10) : 0;
    if (minSalaryNum > 0 && (job.salaryMin || job.salaryMax)) {
      if (job.salaryMax && job.salaryMax < minSalaryNum) {
        salaryFit = 'below';
      } else if (job.salaryMin && job.salaryMin >= minSalaryNum) {
        salaryFit = 'above';
      } else {
        salaryFit = 'within';
      }
    }

    // 6. INTERNATIONAL DESTINATION GUIDANCE & VISA NORMS
    const norm = this.getMarketGuidance(profile?.location || 'Pakistan', job.country, job.workplaceType);
    if (norm) {
      marketTips.push(...norm.tips);
    }

    return {
      score: Math.min(100, Math.max(10, score)),
      matchReasons,
      missingSkills: missingSkills.slice(0, 4),
      salaryFit,
      visaGuidance: norm?.visaAdvice,
      marketTips: marketTips.length > 0 ? marketTips : undefined,
    };
  }

  /**
   * Provides market customs and visa norms for cross-border applicants.
   */
  public getMarketGuidance(
    candidateLocation: string = 'Pakistan',
    destinationCountry: string = 'Worldwide',
    workplaceType: WorkplaceType = 'Remote'
  ): { visaAdvice: string; tips: string[] } | null {
    const dest = destinationCountry.toLowerCase();

    if (workplaceType === 'Remote') {
      return {
        visaAdvice: 'Remote position: No local visa required. Typically contracted via B2B or Employer of Record (EOR like Deel, Remote.com).',
        tips: [
          'Highlight asynchronous communication skills and timezone overlap (UTC / EST / CET).',
          'Ensure payment receiving methods (Wise, Payoneer, international wire) are prepared.',
          'Emphasize self-management, GitHub/portfolio links, and remote teamwork track record.'
        ]
      };
    }

    if (dest.includes('united states') || dest === 'us' || dest === 'usa') {
      return {
        visaAdvice: 'US employers require H-1B, O-1, or TN sponsorship. Most companies indicate in job specs if they sponsor international visas.',
        tips: [
          'US resume standard: 1 page (max 2 for 7+ yrs), no photo, no birthdate, no marital status.',
          'Format accomplishments with the Google X-Y-Z formula: "Accomplished [X] as measured by [Y], by doing [Z]".',
          'Reference your work authorization status clearly in the application cover letter.'
        ]
      };
    }

    if (dest.includes('united kingdom') || dest === 'uk') {
      return {
        visaAdvice: 'UK positions require a Skilled Worker Visa. The employer must hold an active Home Office Sponsor Licence.',
        tips: [
          'UK CV standard: 2 pages, reverse-chronological, no photo or personal demographics.',
          'Specify your UK right-to-work status or willingness to relocate under points-based immigration.',
          'List British/International degree equivalence (UK NARIC / ENIC) if applicable.'
        ]
      };
    }

    if (dest.includes('united arab emirates') || dest === 'uae' || dest.includes('dubai')) {
      return {
        visaAdvice: 'UAE employers handle residence visa and labor card sponsorship directly upon signing an employment offer.',
        tips: [
          'UAE employers appreciate current residency status (Visit Visa, Employment Visa with NOC, or Golden Visa).',
          'Include attested educational certificates and clear driving license status if relevant.',
          'A professional headshot is standard on Gulf Region CVs.'
        ]
      };
    }

    if (dest.includes('germany') || dest.includes('europe') || dest.includes('eu')) {
      return {
        visaAdvice: 'Qualified professionals can obtain the EU Blue Card or Germany Opportunity Card (Chancenkarte).',
        tips: [
          'European standard CV: 1-2 pages, clear categorization of technical tools and spoken language proficiency (CEFR A1-C2).',
          'Highlight English fluency (B2/C1) and any German language proficiency.',
          'State willingness to relocate and your standard notice period (usually 1-3 months in Europe).'
        ]
      };
    }

    if (dest.includes('canada')) {
      return {
        visaAdvice: 'Canada offers Global Skills Strategy (fast-track 2-week work permits) and Express Entry / PNP pathways.',
        tips: [
          'Canadian format resume: No photo, no date of birth, emphasis on quantifiable business impact.',
          'Mention if you have an active Express Entry profile or provincial nomination eligibility.'
        ]
      };
    }

    if (dest.includes('pakistan') || dest.includes('india')) {
      return {
        visaAdvice: 'Local employment: standard National ID (CNIC/Aadhaar) and local tax registration.',
        tips: [
          'Mention your current location, notice period, and willingness to work on-site or hybrid in major tech hubs.',
          'Include direct WhatsApp contact and LinkedIn profile URL.'
        ]
      };
    }

    return {
      visaAdvice: 'Review company career page for international sponsorship policies.',
      tips: [
        'Use an international ATS-friendly CV without local idioms.',
        'Emphasize measurable technical accomplishments and system architecture achievements.'
      ]
    };
  }
}

export const jobMatchingEngine = new JobMatchingEngine();
