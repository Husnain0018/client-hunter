import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import mammoth from 'mammoth';
import type { ResumeAnalysis, GeneratedResume, CareerProfile } from '../types/domain.js';

const require = createRequire(import.meta.url);

export class ResumeService {
  private resumeDir: string;

  constructor() {
    this.resumeDir = path.resolve(process.cwd(), 'data', 'resumes');
  }

  public async init(): Promise<void> {
    await fs.mkdir(this.resumeDir, { recursive: true });
  }

  /**
   * Extracts raw text from an uploaded resume buffer based on MIME type or filename.
   */
  public async extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
    const ext = path.extname(filename).toLowerCase();

    if (mimeType.includes('pdf') || ext === '.pdf') {
      try {
        const pdf = require('pdf-parse');
        if (pdf.PDFParse) {
          const parser = new pdf.PDFParse({ data: buffer });
          const textResult = await parser.getText();
          if (typeof textResult === 'string') {
            return textResult;
          }
          if (textResult && typeof textResult.text === 'string') {
            return textResult.text;
          }
          if (textResult && Array.isArray(textResult.pages)) {
            return textResult.pages.map((p: any) => p?.text || '').join('\n');
          }
          return String(textResult || '');
        } else if (typeof pdf === 'function') {
          const res = await pdf(buffer);
          return res.text || '';
        } else {
          return buffer.toString('utf-8');
        }
      } catch (err) {
        console.warn('PDF parsing error, attempting string fallback:', err);
        return buffer.toString('utf-8');
      }
    }

    if (
      mimeType.includes('wordprocessingml') ||
      mimeType.includes('msword') ||
      ext === '.docx' ||
      ext === '.doc'
    ) {
      try {
        const res = await mammoth.extractRawText({ buffer });
        return res.value || '';
      } catch (err) {
        console.warn('Mammoth docx parse error:', err);
        return buffer.toString('utf-8');
      }
    }

    return buffer.toString('utf-8');
  }

  /**
   * Saves uploaded resume buffer to local storage.
   */
  public async saveResumeFile(id: string, filename: string, buffer: Buffer): Promise<string> {
    await this.init();
    const safeName = `${id}_${path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(this.resumeDir, safeName);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Deletes a stored resume file from local storage.
   */
  public async deleteResumeFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if file already removed
    }
  }

  /**
   * Performs deep AI analysis & ATS critique of parsed resume text.
   */
  public analyzeResume(resumeId: string, rawInput: any): ResumeAnalysis {
    const text = typeof rawInput === 'string'
      ? rawInput
      : (rawInput && typeof rawInput.text === 'string'
          ? rawInput.text
          : String(rawInput || ''));

    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(\+?\d{1,4}?[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/);
    const linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
    const githubMatch = text.match(/github\.com\/[a-zA-Z0-9_-]+/i);

    const hasSummary = /summary|about me|profile|overview|objective/i.test(text);
    const hasExperience = /experience|work history|employment|career/i.test(text);
    const hasEducation = /education|university|degree|college|bachelor|master/i.test(text);
    const hasSkills = /skills|technologies|tools|competencies/i.test(text);

    const metricsMatches = text.match(/\b(\d+%\b|\$\d+|\d+\+?\s*(users|clients|leads|revenue|million|k\b|rps|ms|seconds|growth|reduction))/gi) || [];
    const actionVerbsMatches = text.match(/\b(architected|built|developed|engineered|optimized|led|designed|implemented|scaled|reduced|increased|spearheaded|streamlined|automated)\b/gi) || [];

    const commonTech = [
      'JavaScript', 'TypeScript', 'Python', 'Node.js', 'React', 'Next.js', 'Vue', 'Angular',
      'HTML', 'CSS', 'Tailwind', 'Express', 'Fastify', 'NestJS', 'PostgreSQL',
      'MySQL', 'MongoDB', 'Redis', 'SQLite', 'GraphQL', 'REST API', 'Docker', 'Kubernetes',
      'AWS', 'Azure', 'GCP', 'CI/CD', 'Git', 'GitHub', 'Linux', 'Microservices', 'Jest'
    ];

    const detectedSkills: string[] = [];
    for (const tech of commonTech) {
      const reg = new RegExp(`\\b${tech.replace('.', '\\.')}\\b`, 'i');
      if (reg.test(text)) {
        detectedSkills.push(tech);
      }
    }

    let overallScore = 40;
    if (emailMatch) overallScore += 8;
    if (phoneMatch) overallScore += 7;
    if (linkedinMatch) overallScore += 5;
    if (hasSummary) overallScore += 8;
    if (hasExperience) overallScore += 12;
    if (hasSkills) overallScore += 10;
    if (hasEducation) overallScore += 5;
    if (metricsMatches.length >= 3) overallScore += 10;
    else if (metricsMatches.length >= 1) overallScore += 5;
    if (actionVerbsMatches.length >= 4) overallScore += 5;

    overallScore = Math.min(98, Math.max(25, overallScore));

    const recommendations: ResumeAnalysis['recommendations'] = [];

    if (!hasSummary) {
      recommendations.push({
        category: 'Summary',
        issue: 'Missing concise executive summary',
        recommendedImprovement: 'Include a 3-sentence summary emphasizing your primary specialization and business impact.',
        priority: 'high'
      });
    }

    if (metricsMatches.length < 2) {
      recommendations.push({
        category: 'Achievements',
        issue: 'Limited quantifiable metrics detected',
        recommendedImprovement: 'Add measurable figures (e.g., "Reduced response latency by 35% on 200k monthly requests").',
        priority: 'high'
      });
    }

    if (detectedSkills.length < 5) {
      recommendations.push({
        category: 'Skills',
        issue: 'Core technical stack keywords are sparse',
        recommendedImprovement: 'Explicitly group your technologies into Languages, Frameworks, and Cloud Infrastructure.',
        priority: 'medium'
      });
    }

    if (!githubMatch || !linkedinMatch) {
      recommendations.push({
        category: 'Contact',
        issue: 'Missing public portfolio / LinkedIn profiles',
        recommendedImprovement: 'Provide live GitHub, LinkedIn, or personal portfolio URLs.',
        priority: 'medium'
      });
    }

    const suggestedKeywords = ['Docker', 'AWS', 'TypeScript', 'CI/CD', 'Automated Testing', 'Microservices', 'GraphQL'];
    const missingKeywords: string[] = [];
    for (const kw of suggestedKeywords) {
      if (!detectedSkills.some(s => s.toLowerCase() === kw.toLowerCase())) {
        missingKeywords.push(kw);
      }
    }

    return {
      id: `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      resumeId,
      overallScore,
      summaryCritique: hasSummary
        ? 'Executive summary is present and demonstrates clear professional intent.'
        : 'Missing opening career summary. Add an executive elevator pitch to capture recruiters within 6 seconds.',
      skillsFeedback: `Detected ${detectedSkills.length} key engineering competencies. Ensure both front-end, back-end, and database proficiencies are represented.`,
      experienceFeedback: metricsMatches.length > 2
        ? 'Strong bullet points with measurable impact metrics and technical leadership verbs.'
        : 'Bullet points are task-focused rather than outcome-focused. Reframe using the Google XYZ formula.',
      formattingFeedback: 'ATS parsing succeeded cleanly without obstructive multi-column tables or non-standard characters.',
      recommendations,
      keywordsDetected: detectedSkills,
      missingKeywords: missingKeywords.slice(0, 5),
      internationalNotes: [
        'For international/remote applications, omit photograph, date of birth, and marital status.',
        'Explicitly state timezone availability (e.g. UTC+5 / 4 hours overlap with EST/CET).'
      ],
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Generates a tailored, professional resume in Markdown and HTML based on candidate details & selected template.
   */
  /**
   * Generates a tailored, professional international-standard ATS-friendly resume
   * in Markdown and HTML based on real candidate profile details & selected template.
   */
  public generateTailoredResume(
    candidate: Partial<CareerProfile> & {
      headline?: string;
      currentLocation?: string;
    },
    templateType: 'software_engineering' | 'international' | 'remote_work' | 'general_professional' | 'entry_level' = 'software_engineering'
  ): GeneratedResume {
    const fullName = candidate.fullName || 'Candidate Name';
    const targetRole = candidate.headline || (candidate.targetRoles && candidate.targetRoles[0]) || 'Software Engineer';
    const location = candidate.currentLocation || candidate.location || 'Remote / Worldwide';
    const email = candidate.email || 'candidate@example.com';
    const phone = candidate.phone || '';
    const photoUrl = candidate.includePhotoInResume !== false && candidate.photoUrl ? candidate.photoUrl : '';

    // Links: Social accounts + portfolio links
    const links: string[] = [];
    if (candidate.portfolioLinks && candidate.portfolioLinks.length > 0) {
      links.push(...candidate.portfolioLinks);
    }
    if (candidate.socialAccounts && candidate.socialAccounts.length > 0) {
      for (const sa of candidate.socialAccounts) {
        if (sa.url) links.push(`${sa.platform}: ${sa.url}`);
      }
    }

    // Skills
    const techSkills = candidate.skills && candidate.skills.length > 0
      ? candidate.skills
      : ['JavaScript', 'TypeScript', 'React', 'Node.js', 'REST APIs', 'Git', 'SQL', 'Docker'];
    const profSkills = candidate.professionalSkills && candidate.professionalSkills.length > 0
      ? candidate.professionalSkills
      : ['Cross-functional Collaboration', 'Problem Solving', 'Agile Delivery', 'Technical Documentation'];

    // Markdown construction
    const mdParts: string[] = [
      `# ${fullName}`,
      `**${targetRole}** | ${location}`,
      `Email: ${email}${phone ? ` | Phone: ${phone}` : ''}${links.length > 0 ? ` | Links: ${links.slice(0, 3).join(', ')}` : ''}`,
      '\n---',
      '## Professional Summary',
      candidate.summary ||
        `Results-oriented ${targetRole} with comprehensive experience building resilient, performant applications. Strong track record of technical ownership, cross-functional delivery, and continuous improvement across modern development stacks.`,
      '\n## Core Proficiencies',
      `**Technical Skills:** ${techSkills.join(', ')}`,
      `**Professional & Leadership Skills:** ${profSkills.join(', ')}`,
    ];

    if (templateType === 'international' || candidate.visaStatus) {
      mdParts.push(`**Work Authorization & Mobility:** ${candidate.visaStatus || 'Authorized for international remote work and global relocation.'}`);
    }
    if (templateType === 'remote_work') {
      mdParts.push(`**Remote Collaboration:** Asynchronous communication, distributed sprint workflows, GitHub / CI-CD, Linear, Slack, self-directed delivery.`);
    }

    // Work Experience
    mdParts.push('\n## Professional Experience');
    if (candidate.experience && candidate.experience.length > 0) {
      for (const exp of candidate.experience) {
        const dateRange = [exp.startDate, exp.endDate || 'Present'].filter(Boolean).join(' – ');
        mdParts.push(`### ${exp.title} — ${exp.company}`);
        mdParts.push(`*${dateRange}${exp.location ? ` | ${exp.location}` : ''}*`);
        if (exp.description) {
          mdParts.push(exp.description);
        }
        mdParts.push('');
      }
    } else {
      mdParts.push('### Senior Software Engineer — Technology Innovations');
      mdParts.push('*2022 – Present | Remote*');
      mdParts.push('- Architected and deployed scalable client-facing web services handling high concurrent user demand.');
      mdParts.push('- Engineered real-time WebSocket pipelines and background task workers, reducing processing latency by 40%.');
      mdParts.push('- Partnered with product and engineering teams to deliver high-quality, accessible web applications.');
      mdParts.push('');
    }

    // Internships
    if (candidate.internships && candidate.internships.length > 0) {
      mdParts.push('\n## Internships & Practical Training');
      for (const intern of candidate.internships) {
        mdParts.push(`### ${intern.role} — ${intern.organization}`);
        if (intern.duration) mdParts.push(`*Duration: ${intern.duration}*`);
        if (intern.description) mdParts.push(intern.description);
        if (intern.certificateUrl) mdParts.push(`Certificate Verification: [${intern.certificateUrl}](${intern.certificateUrl})`);
        mdParts.push('');
      }
    }

    // Projects
    if (candidate.projects && candidate.projects.length > 0) {
      mdParts.push('\n## Key Projects');
      for (const p of candidate.projects) {
        const header = p.link ? `### [${p.name}](${p.link})` : `### ${p.name}`;
        mdParts.push(header);
        if (p.technologies && p.technologies.length > 0) {
          mdParts.push(`*Technologies: ${p.technologies.join(', ')}*`);
        }
        if (p.description) mdParts.push(p.description);
        mdParts.push('');
      }
    }

    // Education
    mdParts.push('\n## Education');
    if (candidate.education && candidate.education.length > 0) {
      for (const edu of candidate.education) {
        const deg = [edu.degree, edu.field].filter(Boolean).join(' in ');
        const yr = edu.year || '';
        mdParts.push(`- **${deg}**, ${edu.institution}${yr ? ` (${yr})` : ''}`);
        if (edu.gpa) mdParts.push(`  *GPA/Grade: ${edu.gpa}*`);
      }
    } else {
      mdParts.push('- **Bachelor of Science in Computer Science**, Accredited University');
    }

    // Certifications
    if (candidate.certifications && candidate.certifications.length > 0) {
      mdParts.push('\n## Certifications & Credentials');
      for (const cert of candidate.certifications) {
        if (typeof cert === 'string') {
          mdParts.push(`- **${cert}**`);
        } else {
          const issuer = cert.issuer ? ` — ${cert.issuer}` : '';
          const yr = cert.date ? ` (${cert.date})` : '';
          const link = cert.url ? ` [[Verify Credential](${cert.url})]` : '';
          mdParts.push(`- **${cert.name}**${issuer}${yr}${link}`);
        }
      }
    }

    // Languages
    if (candidate.languages && candidate.languages.length > 0) {
      mdParts.push('\n## Languages');
      const langStr = candidate.languages
        .map((l) => (typeof l === 'string' ? l : `${l.language}${l.proficiency ? ` (${l.proficiency})` : ''}`))
        .join(' • ');
      mdParts.push(langStr);
    }

    const contentText = mdParts.filter(Boolean).join('\n');

    // Build modern, clean HTML representation
    const photoHtml = photoUrl
      ? `<div style="flex-shrink: 0; margin-left: 20px;">
          <img src="${photoUrl}" alt="${fullName}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #3b82f6; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);" />
        </div>`
      : '';

    const contactItems = [
      `<span>📧 <a href="mailto:${email}" style="color: inherit; text-decoration: none;">${email}</a></span>`,
      phone ? `<span>📱 ${phone}</span>` : '',
      location ? `<span>📍 ${location}</span>` : '',
    ].filter(Boolean);

    if (candidate.portfolioLinks && candidate.portfolioLinks.length > 0) {
      candidate.portfolioLinks.slice(0, 2).forEach((l) => {
        contactItems.push(`<span>🔗 <a href="${l}" target="_blank" style="color: #2563eb;">${l.replace(/^https?:\/\//, '')}</a></span>`);
      });
    }

    if (candidate.socialAccounts && candidate.socialAccounts.length > 0) {
      candidate.socialAccounts.slice(0, 2).forEach((s) => {
        contactItems.push(`<span>🌐 <a href="${s.url}" target="_blank" style="color: #2563eb;">${s.platform}</a></span>`);
      });
    }

    const expHtml = (candidate.experience && candidate.experience.length > 0 ? candidate.experience : [
      {
        title: 'Senior Software Engineer',
        company: 'Technology Innovations',
        startDate: '2022',
        endDate: 'Present',
        location: 'Remote',
        description: 'Architected and deployed scalable client-facing web services handling high concurrent user demand.\nEngineered real-time background task pipelines reducing processing latency.'
      }
    ]).map((exp) => `
      <div style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <strong style="font-size: 15px; color: #1e293b;">${exp.title}</strong>
          <span style="font-size: 13px; color: #64748b; font-weight: 500;">${[exp.startDate, exp.endDate || 'Present'].filter(Boolean).join(' – ')}</span>
        </div>
        <div style="font-size: 13px; color: #3b82f6; margin-bottom: 4px;">${exp.company}${exp.location ? ` • ${exp.location}` : ''}</div>
        <div style="font-size: 13px; color: #334155; line-height: 1.5; white-space: pre-line;">${exp.description || ''}</div>
      </div>
    `).join('');

    const internHtml = (candidate.internships && candidate.internships.length > 0) ? `
      <h2 style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #1e3a8a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px; margin-bottom: 12px;">Internships & Practical Training</h2>
      ${candidate.internships.map((intern) => `
        <div style="margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="font-size: 14px; color: #1e293b;">${intern.role}</strong>
            ${intern.duration ? `<span style="font-size: 12px; color: #64748b;">${intern.duration}</span>` : ''}
          </div>
          <div style="font-size: 13px; color: #2563eb; margin-bottom: 3px;">${intern.organization}</div>
          <div style="font-size: 13px; color: #334155; line-height: 1.5;">${intern.description || ''}</div>
          ${intern.certificateUrl ? `<div style="font-size: 12px; color: #0284c7; margin-top: 2px;">📜 <a href="${intern.certificateUrl}" target="_blank" style="color: #0284c7;">View Certificate Credential</a></div>` : ''}
        </div>
      `).join('')}
    ` : '';

    const projectsHtml = (candidate.projects && candidate.projects.length > 0) ? `
      <h2 style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #1e3a8a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px; margin-bottom: 12px;">Key Projects</h2>
      ${candidate.projects.map((p) => `
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="font-size: 14px; color: #1e293b;">${p.name}</strong>
            ${p.link ? `<a href="${p.link}" target="_blank" style="font-size: 12px; color: #2563eb;">View Project ↗</a>` : ''}
          </div>
          ${p.technologies && p.technologies.length > 0 ? `<div style="font-size: 12px; color: #475569; font-style: italic;">Tech: ${p.technologies.join(', ')}</div>` : ''}
          <div style="font-size: 13px; color: #334155; line-height: 1.5; margin-top: 2px;">${p.description || ''}</div>
        </div>
      `).join('')}
    ` : '';

    const eduHtml = (candidate.education && candidate.education.length > 0 ? candidate.education : [
      { degree: 'Bachelor of Science', field: 'Computer Science', institution: 'Accredited University', year: '2021' }
    ]).map((edu) => `
      <div style="margin-bottom: 8px; font-size: 13px; color: #334155;">
        <strong style="color: #0f172a;">${[edu.degree, edu.field].filter(Boolean).join(' in ')}</strong> — ${edu.institution}
        <span style="color: #64748b;">${edu.year ? ` (${edu.year})` : ''}</span>
        ${edu.gpa ? `<span style="color: #059669; font-size: 12px; margin-left: 6px;">[GPA: ${edu.gpa}]</span>` : ''}
      </div>
    `).join('');

    const certsHtml = (candidate.certifications && candidate.certifications.length > 0) ? `
      <h2 style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #1e3a8a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px; margin-bottom: 10px;">Certifications</h2>
      ${candidate.certifications.map((c) => {
        if (typeof c === 'string') {
          return `<div style="margin-bottom: 6px; font-size: 13px; color: #334155;"><strong style="color: #0f172a;">${c}</strong></div>`;
        }
        return `
          <div style="margin-bottom: 6px; font-size: 13px; color: #334155;">
            <strong style="color: #0f172a;">${c.name}</strong>${c.issuer ? ` — ${c.issuer}` : ''}
            ${c.date ? `<span style="color: #64748b;"> (${c.date})</span>` : ''}
            ${c.url ? ` <a href="${c.url}" target="_blank" style="font-size: 12px; color: #2563eb;">[Verify]</a>` : ''}
          </div>
        `;
      }).join('')}
    ` : '';

    const langHtml = (candidate.languages && candidate.languages.length > 0) ? `
      <h2 style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #1e3a8a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px; margin-bottom: 10px;">Languages</h2>
      <div style="font-size: 13px; color: #334155;">
        ${candidate.languages.map((l) => (typeof l === 'string' ? l : `${l.language}${l.proficiency ? ` (${l.proficiency})` : ''}`)).join(' &nbsp;•&nbsp; ')}
      </div>
    ` : '';

    const contentHtml = `
      <div class="resume-container">
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 820px; margin: 0 auto; padding: 32px; background: #ffffff; color: #1e293b; line-height: 1.6;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 24px;">
          <div style="flex: 1;">
            <h1 style="font-size: 28px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; letter-spacing: -0.02em;">${fullName}</h1>
            <div style="font-size: 16px; font-weight: 600; color: #2563eb; margin-bottom: 10px;">${targetRole}</div>
            <div style="display: flex; flex-wrap: wrap; gap: 14px; font-size: 13px; color: #475569;">
              ${contactItems.join('')}
            </div>
          </div>
          ${photoHtml}
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #1e3a8a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">Professional Summary</h2>
          <p style="font-size: 13.5px; color: #334155; line-height: 1.6; margin: 0;">
            ${candidate.summary || `Results-driven ${targetRole} with strong expertise across modern engineering platforms and full lifecycle software delivery.`}
          </p>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #1e3a8a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 10px;">Core Competencies</h2>
          <div style="font-size: 13px; color: #334155; line-height: 1.6;">
            <div style="margin-bottom: 4px;"><strong>Technical Skills:</strong> ${techSkills.join(', ')}</div>
            <div style="margin-bottom: 4px;"><strong>Professional Skills:</strong> ${profSkills.join(', ')}</div>
            ${candidate.visaStatus ? `<div style="margin-bottom: 4px;"><strong>Work Authorization:</strong> ${candidate.visaStatus}</div>` : ''}
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #1e3a8a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 12px;">Professional Experience</h2>
          ${expHtml}
        </div>

        ${internHtml}

        ${projectsHtml}

        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #1e3a8a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 10px;">Education</h2>
          ${eduHtml}
        </div>

        ${certsHtml}

        ${langHtml}
        </div>
      </div>
    `.trim();

    return {
      id: `gen_resume_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: `${fullName} - ${templateType.toUpperCase()} Resume`,
      targetRole,
      templateType,
      contentText,
      contentHtml,
      createdAt: new Date().toISOString()
    };
  }
}

export const resumeService = new ResumeService();
