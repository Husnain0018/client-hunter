import type { CareerProfile, JobListing } from '../types/domain.js';

export interface GeneratedApplicationEmail {
  subject: string;
  html: string;
  text: string;
  matchedSkills?: string[];
  recipientGreeting?: string;
}

function escapeHtml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cleanMarkdownAndWhitespace(raw: string): string {
  return (raw || '')
    .replace(/^#+\s*(?:Professional\s+Summary|Summary|About\s+Me|Profile)\s*\n+/gim, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitIntoBullets(text?: string, explicitBullets?: string[]): string[] {
  const results: string[] = [];
  if (Array.isArray(explicitBullets) && explicitBullets.length > 0) {
    for (const b of explicitBullets) {
      const cleaned = cleanMarkdownAndWhitespace(b).replace(/^[-•*]\s*/, '').trim();
      if (cleaned) results.push(cleaned);
    }
  }
  if (results.length > 0) return results.slice(0, 5);

  if (!text) return [];
  const cleanedText = cleanMarkdownAndWhitespace(text);

  // If separated by newlines, treat each line/paragraph as a bullet
  const lines = cleanedText
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return lines.slice(0, 5);
  }

  // Otherwise split a long single paragraph into concise sentence bullets
  const sentences = cleanedText
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  if (sentences.length > 1) {
    return sentences.slice(0, 4);
  }

  return cleanedText ? [cleanedText] : [];
}

function normalizeSkillKey(skill: string): string {
  return skill
    .toLowerCase()
    .replace(/\.js\b/g, '')
    .replace(/\bes6\+?\b/g, '')
    .replace(/\bwebsite\b/g, 'web')
    .replace(/[^a-z0-9+#]/g, '')
    .trim();
}

function deduplicateSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of skills) {
    const clean = (raw || '').trim();
    if (!clean) continue;
    const key = normalizeSkillKey(clean);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

export class ApplicationEmailGenerator {
  /**
   * Generates a personalized, international-standard HTML job application email
   * and synchronized plain-text version using verified candidate profile data.
   */
  public generateEmail(profile: CareerProfile | null, job: JobListing): GeneratedApplicationEmail {
    const candidateName = profile?.fullName?.trim() || 'Candidate';
    const candidateEmail = profile?.email?.trim() || '';
    const candidatePhone = profile?.phone?.trim() || '';
    const candidateLocation = profile?.location?.trim() || '';

    // Determine the best role headline matching the target job
    const candidateHeadline = this.selectBestRoleHeadline(profile, job);

    // 1. Subject Line
    const subject = `Application for ${job.title} – ${candidateName}`;

    // 2. Greeting (detect contact person name if mentioned in job listing)
    const contactPerson = this.extractContactPerson(job.description || '');
    const greetingLine = contactPerson
      ? `Dear ${contactPerson},`
      : `Dear Hiring Team at ${job.company},`;

    // 3. Match candidate skills against job requirements
    const rawTechSkills = deduplicateSkills(profile?.skills || []);
    const rawProfSkills = deduplicateSkills(profile?.professionalSkills || []);
    const { matchedSkills, categorizedSkills } = this.categorizeAndRankSkills(
      rawTechSkills,
      rawProfSkills,
      job,
    );

    // 4. Application Introduction (Section 2)
    const matchedHighlight =
      matchedSkills.length >= 2
        ? `with hands-on proficiency in ${matchedSkills.slice(0, 5).join(', ')}`
        : rawTechSkills.length >= 2
        ? `with strong technical foundations in ${rawTechSkills.slice(0, 4).join(', ')}`
        : `with a strong background in software delivery and problem-solving`;

    const introParagraph = `I am writing to formally apply for the ${job.title} position at ${job.company}. Having reviewed the role requirements, I am confident that my background as a ${candidateHeadline} ${matchedHighlight} aligns well with your team's objectives.`;

    // 5. Concise Professional Summary (Section 3 — Max 2 concise paragraphs, no markdown clutter)
    const summaryParagraphs = this.buildConciseSummaryParagraphs(profile, job, candidateHeadline);

    // 6. Education (Section 4)
    const educationList = (profile?.education || []).map((edu) => {
      const degreeTitle = `${edu.degree}${edu.field ? ` in ${edu.field}` : ''}`.trim();
      const rawYear = (edu.year || '').trim();
      const yearDisplay = rawYear.replace(/^continue\s*\((.*)\)$/i, 'In Progress ($1)');
      const rawGpa = (edu.gpa || '').trim();
      const gpaDisplay = rawGpa
        ? /^gpa/i.test(rawGpa)
          ? rawGpa
          : /gpa$/i.test(rawGpa)
          ? `GPA: ${rawGpa.replace(/\s*gpa$/i, '')}`
          : `GPA: ${rawGpa}`
        : '';
      return {
        degreeTitle,
        institution: edu.institution || '',
        yearDisplay,
        gpaDisplay,
      };
    });

    // 7. Work Experience & Internships (Sections 6 & 7)
    const experiences = (profile?.experience || []).map((exp) => ({
      title: (exp.title || '').replace(/\s+/g, ' ').trim(),
      company: (exp.company || '').trim(),
      location: (exp.location || '').trim(),
      period: `${exp.startDate || ''}${exp.startDate ? ' – ' : ''}${exp.current ? 'Present' : exp.endDate || ''}`.trim(),
      bullets: splitIntoBullets(exp.description, exp.responsibilities),
    }));

    const internships = (profile?.internships || []).map((intern) => ({
      role: (intern.role || '').replace(/\s+/g, ' ').trim(),
      organization: (intern.organization || '').trim(),
      duration: (intern.duration || '').replace(/\s*-\s*/g, ' – ').trim(),
      bullets: splitIntoBullets(intern.description),
      certificateUrl: (intern.certificateUrl || '').trim(),
    }));

    // Avoid repeating identical text if an internship is listed in both Work Experience and Internships
    const hasDistinctWorkExperience = experiences.some(
      (exp) =>
        !internships.some(
          (i) =>
            i.organization.toLowerCase() === exp.company.toLowerCase() &&
            exp.title.toLowerCase().includes('intern'),
        ),
    );

    // 8. Projects (Section 8)
    const projects = (profile?.projects || []).map((proj) => {
      const inferredTech =
        proj.technologies && proj.technologies.length > 0
          ? proj.technologies
          : this.inferProjectTechnologies(proj.name, proj.description, rawTechSkills);
      return {
        name: (proj.name || '').trim(),
        description: cleanMarkdownAndWhitespace(proj.description || ''),
        technologies: inferredTech,
        link: (proj.link || '').trim(),
        repoUrl: (proj.repoUrl || '').trim(),
      };
    });

    // 9. Certifications & Training (Section 9)
    const certifications = (profile?.certifications || []).map((c) => {
      if (typeof c === 'string') {
        return { name: c, issuer: '', date: '', url: '' };
      }
      return {
        name: (c.name || '').trim(),
        issuer: (c.issuer || '').trim(),
        date: (c.date || '').trim(),
        url: (c.url || '').trim(),
      };
    });

    // 10. Professional Links (Section 10 — filter out bare domain roots like https://github.com/)
    const professionalLinks = this.collectValidProfessionalLinks(profile);

    // 11. Closing Statement
    const closingParagraph1 = `I have attached my resume for your review, which provides further detail on my qualifications and project work. I would welcome the opportunity to discuss how my skills and experience can support ${job.company}'s upcoming initiatives.`;
    const closingParagraph2 = `Thank you for your time and consideration. I look forward to hearing from you.`;

    // =========================================================================
    // BUILD CLEAN PLAIN-TEXT VERSION (Synchronized with HTML)
    // =========================================================================
    const textLines: string[] = [
      greetingLine,
      '',
      introParagraph,
      '',
      'PROFESSIONAL SUMMARY',
      ...summaryParagraphs.map((p) => p),
      '',
    ];

    if (educationList.length > 0) {
      textLines.push('EDUCATION');
      for (const edu of educationList) {
        const meta = [edu.institution, edu.yearDisplay, edu.gpaDisplay].filter(Boolean).join(' | ');
        textLines.push(`• ${edu.degreeTitle}${meta ? ` — ${meta}` : ''}`);
      }
      textLines.push('');
    }

    if (categorizedSkills.length > 0) {
      textLines.push('TECHNICAL & PROFESSIONAL SKILLS');
      for (const cat of categorizedSkills) {
        textLines.push(`• ${cat.category}: ${cat.items.join(', ')}`);
      }
      textLines.push('');
    }

    if (experiences.length > 0 && (hasDistinctWorkExperience || internships.length === 0)) {
      textLines.push('WORK EXPERIENCE');
      for (const exp of experiences) {
        textLines.push(
          `${exp.title} | ${exp.company}${exp.location ? ` (${exp.location})` : ''}${exp.period ? ` — ${exp.period}` : ''}`,
        );
        for (const b of exp.bullets.slice(0, 4)) {
          textLines.push(`  • ${b}`);
        }
      }
      textLines.push('');
    }

    if (internships.length > 0) {
      textLines.push('INTERNSHIP EXPERIENCE');
      for (const intern of internships) {
        textLines.push(
          `${intern.role} | ${intern.organization}${intern.duration ? ` — ${intern.duration}` : ''}`,
        );
        for (const b of intern.bullets.slice(0, 4)) {
          textLines.push(`  • ${b}`);
        }
        if (intern.certificateUrl) {
          textLines.push(`  • Verification Certificate: ${intern.certificateUrl}`);
        }
      }
      textLines.push('');
    }

    if (projects.length > 0) {
      textLines.push('SELECTED PROJECTS');
      for (const proj of projects) {
        textLines.push(`• ${proj.name}: ${proj.description}`);
        if (proj.technologies.length > 0) {
          textLines.push(`  Technologies: ${proj.technologies.join(', ')}`);
        }
        if (proj.link) textLines.push(`  Live Link: ${proj.link}`);
        if (proj.repoUrl) textLines.push(`  Repository: ${proj.repoUrl}`);
      }
      textLines.push('');
    }

    if (certifications.length > 0) {
      textLines.push('CERTIFICATIONS & TRAINING');
      for (const cert of certifications) {
        const meta = [cert.issuer, cert.date].filter(Boolean).join(' | ');
        textLines.push(
          `• ${cert.name}${meta ? ` — ${meta}` : ''}${cert.url ? ` (${cert.url})` : ''}`,
        );
      }
      textLines.push('');
    }

    if (professionalLinks.length > 0) {
      textLines.push('PROFESSIONAL PROFILES & LINKS');
      for (const link of professionalLinks) {
        textLines.push(`• ${link.label}: ${link.url}`);
      }
      textLines.push('');
    }

    textLines.push(closingParagraph1);
    textLines.push('');
    textLines.push(closingParagraph2);
    textLines.push('');
    textLines.push('Sincerely,');
    textLines.push(candidateName);
    textLines.push(candidateHeadline);
    if (candidateEmail) textLines.push(`Email: ${candidateEmail}`);
    if (candidatePhone) textLines.push(`Phone: ${candidatePhone}`);
    if (candidateLocation) textLines.push(`Location: ${candidateLocation}`);

    const plainText = textLines.join('\n');

    // =========================================================================
    // BUILD EXECUTIVE HTML EMAIL (Email-Client Compatible Inline CSS)
    // =========================================================================
    const sectionHeaderStyle =
      'margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #1e3a8a;';

    // Section 1 & 2: Greeting + Application Introduction
    const greetingAndIntroHtml = `
      <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.65; color: #0f172a; font-weight: 600;">
        ${escapeHtml(greetingLine)}
      </p>
      <p style="margin: 0 0 20px; font-size: 14.5px; line-height: 1.7; color: #334155;">
        ${escapeHtml(introParagraph)}
      </p>
    `;

    // Section 3: Professional Summary
    const summaryHtml = `
      <div style="margin-bottom: 24px; background-color: #f8fafc; border-left: 4px solid #1e40af; border-radius: 0 8px 8px 0; padding: 14px 18px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #1e40af; margin-bottom: 6px;">
          Professional Summary
        </div>
        ${summaryParagraphs
          .map(
            (p, idx) => `
          <p style="margin: ${idx === summaryParagraphs.length - 1 ? '0' : '0 0 10px'}; font-size: 14px; line-height: 1.65; color: #334155;">
            ${escapeHtml(p)}
          </p>`,
          )
          .join('')}
      </div>
    `;

    // Section 4: Education
    const educationHtml =
      educationList.length > 0
        ? `
      <div style="margin-bottom: 24px;">
        <h2 style="${sectionHeaderStyle}">Education</h2>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          ${educationList
            .map(
              (edu) => `
            <tr>
              <td style="padding: 8px 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                  ${escapeHtml(edu.degreeTitle)}
                </div>
                <div style="font-size: 13px; color: #475569;">
                  <strong>${escapeHtml(edu.institution)}</strong>
                  ${edu.yearDisplay ? ` &bull; <span style="color: #64748b;">${escapeHtml(edu.yearDisplay)}</span>` : ''}
                  ${edu.gpaDisplay ? ` &bull; <span style="color: #1e40af; font-weight: 600;">${escapeHtml(edu.gpaDisplay)}</span>` : ''}
                </div>
              </td>
            </tr>`,
            )
            .join('<tr><td style="height: 8px;"></td></tr>')}
        </table>
      </div>
    `
        : '';

    // Section 5: Technical & Professional Skills (Organized Table Rows)
    const skillsHtml =
      categorizedSkills.length > 0
        ? `
      <div style="margin-bottom: 24px;">
        <h2 style="${sectionHeaderStyle}">Technical &amp; Professional Skills</h2>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          ${categorizedSkills
            .map(
              (cat, idx) => `
            <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
              <td width="32%" valign="top" style="padding: 9px 12px; font-size: 13px; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0;">
                ${escapeHtml(cat.category)}
              </td>
              <td width="68%" valign="top" style="padding: 9px 12px; font-size: 13px; line-height: 1.55; color: #334155;">
                ${cat.items
                  .map((skill) => {
                    const isMatched = matchedSkills.some(
                      (m) => normalizeSkillKey(m) === normalizeSkillKey(skill),
                    );
                    return isMatched
                      ? `<strong style="color: #1e40af; background-color: #eff6ff; padding: 1px 6px; border-radius: 4px;">${escapeHtml(skill)}</strong>`
                      : escapeHtml(skill);
                  })
                  .join(', ')}
              </td>
            </tr>`,
            )
            .join('')}
        </table>
      </div>
    `
        : '';

    // Section 6: Work Experience
    const experienceHtml =
      experiences.length > 0 && (hasDistinctWorkExperience || internships.length === 0)
        ? `
      <div style="margin-bottom: 24px;">
        <h2 style="${sectionHeaderStyle}">Work Experience</h2>
        ${experiences
          .map(
            (exp) => `
          <div style="margin-bottom: 14px; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 6px; background-color: #ffffff;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="left" style="font-size: 14px; font-weight: 700; color: #0f172a;">
                  ${escapeHtml(exp.title)}
                </td>
                <td align="right" style="font-size: 12.5px; color: #64748b; font-weight: 600;">
                  ${escapeHtml(exp.period)}
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top: 2px; padding-bottom: 8px; font-size: 13px; font-weight: 600; color: #1e40af;">
                  ${escapeHtml(exp.company)}${exp.location ? ` <span style="color: #64748b; font-weight: 400;">&bull; ${escapeHtml(exp.location)}</span>` : ''}
                </td>
              </tr>
            </table>
            ${
              exp.bullets.length > 0
                ? `<ul style="margin: 0; padding-left: 18px; font-size: 13.5px; line-height: 1.6; color: #334155;">
                ${exp.bullets
                  .slice(0, 4)
                  .map((b) => `<li style="margin-bottom: 4px;">${escapeHtml(b)}</li>`)
                  .join('')}
              </ul>`
                : ''
            }
          </div>`,
          )
          .join('')}
      </div>
    `
        : '';

    // Section 7: Internship Experience
    const internshipHtml =
      internships.length > 0
        ? `
      <div style="margin-bottom: 24px;">
        <h2 style="${sectionHeaderStyle}">Internship Experience</h2>
        ${internships
          .map(
            (intern) => `
          <div style="margin-bottom: 14px; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 6px; background-color: #ffffff;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="left" style="font-size: 14px; font-weight: 700; color: #0f172a;">
                  ${escapeHtml(intern.role)}
                </td>
                <td align="right" style="font-size: 12.5px; color: #64748b; font-weight: 600;">
                  ${escapeHtml(intern.duration)}
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top: 2px; padding-bottom: 8px; font-size: 13px; font-weight: 600; color: #1e40af;">
                  ${escapeHtml(intern.organization)}
                </td>
              </tr>
            </table>
            ${
              intern.bullets.length > 0
                ? `<ul style="margin: 0; padding-left: 18px; font-size: 13.5px; line-height: 1.6; color: #334155;">
                ${intern.bullets
                  .slice(0, 4)
                  .map((b) => `<li style="margin-bottom: 4px;">${escapeHtml(b)}</li>`)
                  .join('')}
              </ul>`
                : ''
            }
            ${
              intern.certificateUrl
                ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0; font-size: 12.5px;">
                <strong style="color: #0f172a;">Credential Verification:</strong>
                <a href="${escapeHtml(intern.certificateUrl)}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600; margin-left: 6px;">
                  View Internship Certificate (${escapeHtml(intern.certificateUrl)})
                </a>
              </div>`
                : ''
            }
          </div>`,
          )
          .join('')}
      </div>
    `
        : '';

    // Section 8: Projects
    const projectsHtml =
      projects.length > 0
        ? `
      <div style="margin-bottom: 24px;">
        <h2 style="${sectionHeaderStyle}">Selected Projects</h2>
        ${projects
          .map(
            (proj) => `
          <div style="margin-bottom: 12px; padding: 11px 14px; border: 1px solid #e2e8f0; border-radius: 6px; background-color: #f8fafc;">
            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
              ${escapeHtml(proj.name)}
              ${
                proj.link
                  ? `<a href="${escapeHtml(proj.link)}" target="_blank" rel="noopener noreferrer" style="font-size: 12px; color: #2563eb; text-decoration: underline; margin-left: 8px; font-weight: 600;">[Live Project]</a>`
                  : ''
              }
              ${
                proj.repoUrl
                  ? `<a href="${escapeHtml(proj.repoUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 12px; color: #475569; text-decoration: underline; margin-left: 8px; font-weight: 600;">[Source Code]</a>`
                  : ''
              }
            </div>
            ${
              proj.description
                ? `<p style="margin: 0 0 6px; font-size: 13.5px; line-height: 1.55; color: #334155;">${escapeHtml(proj.description)}</p>`
                : ''
            }
            ${
              proj.technologies.length > 0
                ? `<div style="font-size: 12px; color: #475569;">
                <strong style="color: #0f172a;">Technologies:</strong> ${escapeHtml(proj.technologies.join(', '))}
              </div>`
                : ''
            }
          </div>`,
          )
          .join('')}
      </div>
    `
        : '';

    // Section 9: Certifications and Training
    const certsHtml =
      certifications.length > 0
        ? `
      <div style="margin-bottom: 24px;">
        <h2 style="${sectionHeaderStyle}">Certifications &amp; Training</h2>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          ${certifications
            .map(
              (c) => `
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background-color: #ffffff; font-size: 13.5px; color: #334155;">
                <strong style="color: #0f172a;">${escapeHtml(c.name)}</strong>
                ${c.issuer ? ` &mdash; <span style="color: #1e40af; font-weight: 600;">${escapeHtml(c.issuer)}</span>` : ''}
                ${c.date ? ` <span style="color: #64748b; font-size: 12.5px;">(${escapeHtml(c.date)})</span>` : ''}
                ${
                  c.url
                    ? `<div style="margin-top: 4px; font-size: 12px;">
                    <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">
                      Verify Certification (${escapeHtml(c.url)})
                    </a>
                  </div>`
                    : ''
                }
              </td>
            </tr>`,
            )
            .join('<tr><td style="height: 8px;"></td></tr>')}
        </table>
      </div>
    `
        : '';

    // Section 10: Professional Links
    const linksHtml =
      professionalLinks.length > 0
        ? `
      <div style="margin-bottom: 24px;">
        <h2 style="${sectionHeaderStyle}">Professional Profiles &amp; Links</h2>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px;">
          ${professionalLinks
            .map(
              (l) => `
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #0f172a; width: 130px; font-weight: 700;">
                ${escapeHtml(l.label)}:
              </td>
              <td style="padding: 4px 0; font-size: 13px;">
                <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">
                  ${escapeHtml(l.url)}
                </a>
              </td>
            </tr>`,
            )
            .join('')}
        </table>
      </div>
    `
        : '';

    // Section 11: Professional Closing & Signature
    const closingHtml = `
      <p style="margin: 0 0 12px; font-size: 14.5px; line-height: 1.7; color: #334155;">
        ${escapeHtml(closingParagraph1)}
      </p>
      <p style="margin: 0 0 20px; font-size: 14.5px; line-height: 1.7; color: #334155;">
        ${escapeHtml(closingParagraph2)}
      </p>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 2px solid #e2e8f0; padding-top: 16px;">
        <tr>
          <td style="padding-top: 14px;">
            <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">Sincerely,</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
              ${escapeHtml(candidateName)}
            </div>
            <div style="font-size: 13.5px; font-weight: 600; color: #1e40af; margin-bottom: 8px;">
              ${escapeHtml(candidateHeadline)}
            </div>
            <div style="font-size: 13px; color: #475569; line-height: 1.6;">
              ${
                candidateEmail
                  ? `<div><strong>Email:</strong> <a href="mailto:${escapeHtml(candidateEmail)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(candidateEmail)}</a></div>`
                  : ''
              }
              ${candidatePhone ? `<div><strong>Phone:</strong> ${escapeHtml(candidatePhone)}</div>` : ''}
              ${candidateLocation ? `<div><strong>Location:</strong> ${escapeHtml(candidateLocation)}</div>` : ''}
            </div>
          </td>
        </tr>
      </table>
    `;

    const html = this.wrapInEmailLayout({
      subject,
      jobTitle: job.title,
      companyName: job.company,
      candidateName,
      candidateHeadline,
      candidateLocation,
      innerHtml: `
        ${greetingAndIntroHtml}
        ${summaryHtml}
        ${educationHtml}
        ${skillsHtml}
        ${experienceHtml}
        ${internshipHtml}
        ${projectsHtml}
        ${certsHtml}
        ${linksHtml}
        ${closingHtml}
      `,
    });

    return {
      subject,
      html,
      text: plainText,
      matchedSkills,
      recipientGreeting: greetingLine,
    };
  }

  /**
   * Renders an edited plain-text application message into the same clean, executive HTML email layout
   * so that user edits made before sending retain full professional HTML formatting.
   */
  public renderHtmlFromEditedText(
    editedText: string,
    subject: string,
    profile: CareerProfile | null,
    job: JobListing,
  ): string {
    const candidateName = profile?.fullName?.trim() || 'Candidate';
    const candidateHeadline = this.selectBestRoleHeadline(profile, job);
    const candidateLocation = profile?.location?.trim() || '';

    const knownHeadings = new Set([
      'PROFESSIONAL SUMMARY',
      'EDUCATION',
      'TECHNICAL & PROFESSIONAL SKILLS',
      'TECHNICAL SKILLS',
      'WORK EXPERIENCE',
      'INTERNSHIP EXPERIENCE',
      'SELECTED PROJECTS',
      'PROJECTS',
      'CERTIFICATIONS & TRAINING',
      'CERTIFICATIONS',
      'PROFESSIONAL PROFILES & LINKS',
      'PROFESSIONAL LINKS',
    ]);

    const lines = (editedText || '').replace(/\r\n/g, '\n').split('\n');
    const htmlBlocks: string[] = [];
    let bulletBuffer: string[] = [];

    const flushBullets = () => {
      if (bulletBuffer.length === 0) return;
      htmlBlocks.push(
        `<ul style="margin: 0 0 16px; padding-left: 20px; font-size: 13.5px; line-height: 1.65; color: #334155;">` +
          bulletBuffer.map((b) => `<li style="margin-bottom: 4px;">${this.linkifyEscapedText(escapeHtml(b))}</li>`).join('') +
          `</ul>`,
      );
      bulletBuffer = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || /^-{3,}$/.test(line)) {
        flushBullets();
        continue;
      }

      const upper = line.replace(/:$/, '').toUpperCase();
      if (knownHeadings.has(upper)) {
        flushBullets();
        htmlBlocks.push(
          `<h2 style="margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #1e3a8a;">${escapeHtml(upper)}</h2>`,
        );
        continue;
      }

      if (/^[•*-]\s+/.test(line)) {
        bulletBuffer.push(line.replace(/^[•*-]\s+/, '').trim());
        continue;
      }

      flushBullets();
      htmlBlocks.push(
        `<p style="margin: 0 0 12px; font-size: 14px; line-height: 1.65; color: #334155;">${this.linkifyEscapedText(escapeHtml(line))}</p>`,
      );
    }
    flushBullets();

    return this.wrapInEmailLayout({
      subject,
      jobTitle: job.title,
      companyName: job.company,
      candidateName,
      candidateHeadline,
      candidateLocation,
      innerHtml: htmlBlocks.join('\n'),
    });
  }

  private linkifyEscapedText(escaped: string): string {
    return escaped.replace(
      /(https?:\/\/[^\s)&lt;&gt;&quot;]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">$1</a>',
    );
  }

  private wrapInEmailLayout(params: {
    subject: string;
    jobTitle: string;
    companyName: string;
    candidateName: string;
    candidateHeadline: string;
    candidateLocation: string;
    innerHtml: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(params.subject)}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 680px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
          <!-- Executive Header -->
          <tr>
            <td style="padding: 22px 28px; background-color: #0f172a; border-bottom: 3px solid #2563eb; color: #ffffff;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #93c5fd; font-weight: 700; margin-bottom: 4px;">
                Formal Job Application &bull; ${escapeHtml(params.companyName)}
              </div>
              <h1 style="margin: 0 0 6px; font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.3;">
                ${escapeHtml(params.jobTitle)}
              </h1>
              <div style="font-size: 13.5px; color: #e2e8f0;">
                <strong>${escapeHtml(params.candidateName)}</strong> &bull; ${escapeHtml(params.candidateHeadline)}${params.candidateLocation ? ` &bull; ${escapeHtml(params.candidateLocation)}` : ''}
              </div>
            </td>
          </tr>
          <!-- Main Application Content -->
          <tr>
            <td style="padding: 28px;">
              ${params.innerHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px 28px; text-align: center; font-size: 12px; color: #64748b;">
              Application for <strong>${escapeHtml(params.jobTitle)}</strong> at <strong>${escapeHtml(params.companyName)}</strong> &bull; Resume Attached
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private selectBestRoleHeadline(profile: CareerProfile | null, job: JobListing): string {
    const roles = profile?.targetRoles || [];
    if (roles.length === 0) return 'Software Engineer';

    const jobText = `${job.title} ${job.description || ''}`.toLowerCase();
    for (const role of roles) {
      const cleanRole = role.replace(/\([^)]*\)/g, '').trim().toLowerCase();
      const words = cleanRole.split(/\s+/).filter((w) => w.length >= 3 && w !== 'developer' && w !== 'engineer');
      if (words.some((w) => jobText.includes(w))) {
        return role;
      }
    }
    return roles[0];
  }

  private extractContactPerson(description: string): string | null {
    if (!description) return null;
    const match = description.match(
      /(?:Contact\s+Person|Ansprechpartner(?:in)?|Hiring\s+Manager|Recruiter)\s*:\s*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,2})/,
    );
    return match?.[1]?.trim() || null;
  }

  private buildConciseSummaryParagraphs(
    profile: CareerProfile | null,
    job: JobListing,
    headline: string,
  ): string[] {
    const rawSummary = cleanMarkdownAndWhitespace(profile?.summary || '');
    if (!rawSummary) {
      return [
        `Results-oriented ${headline} experienced in designing, building, and maintaining scalable web applications, backend APIs, and automated workflows. Committed to clean architecture, reliable delivery, and collaborative engineering.`,
      ];
    }

    const paragraphs = rawSummary
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 20);

    if (paragraphs.length <= 2) {
      return paragraphs;
    }

    // Select the opening qualification paragraph + the paragraph most relevant to the job
    const first = paragraphs[0];
    const jobContext = `${job.title} ${job.description || ''} ${(job.skills || []).join(' ')}`.toLowerCase();
    let bestSecond = paragraphs[1];
    let bestScore = -1;

    for (let i = 1; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      // Skip generic "Currently seeking..." closing paragraph if a stronger technical paragraph exists
      if (/^currently seeking/i.test(p) && paragraphs.length > 2) continue;
      const words = p.toLowerCase().split(/[^a-z0-9+#.]+/);
      const score = words.filter((w) => w.length >= 3 && jobContext.includes(w)).length;
      if (score > bestScore) {
        bestScore = score;
        bestSecond = p;
      }
    }

    return [first, bestSecond];
  }

  private categorizeAndRankSkills(
    techSkills: string[],
    profSkills: string[],
    job: JobListing,
  ): {
    matchedSkills: string[];
    categorizedSkills: Array<{ category: string; items: string[] }>;
  } {
    const jobText = [
      job.title,
      job.description || '',
      ...(job.skills || []),
      ...(job.requirements || []),
    ]
      .join(' ')
      .toLowerCase();

    const allTech = deduplicateSkills(techSkills);
    const matchedSkills = allTech.filter((s) => {
      const token = s.toLowerCase().replace(/\.js\b/g, '').trim();
      return token.length >= 2 && jobText.includes(token);
    });

    // Sort skills so job-matched skills come first within each category
    const sortByRelevance = (list: string[]) =>
      [...list].sort((a, b) => {
        const aMatch = matchedSkills.includes(a) ? 1 : 0;
        const bMatch = matchedSkills.includes(b) ? 1 : 0;
        return bMatch - aMatch;
      });

    const frontend: string[] = [];
    const backend: string[] = [];
    const dataAndDevops: string[] = [];
    const aiAndAutomation: string[] = [];

    for (const skill of sortByRelevance(allTech)) {
      const lower = skill.toLowerCase();
      if (
        /\b(ai|llm|gemini|prompt|rag|n8n|chatbot|voice|agent|whatsapp\s+automation|workflow\s+automation)\b/.test(
          lower,
        )
      ) {
        aiAndAutomation.push(skill);
      } else if (
        /\b(react|html|css|bootstrap|tailwind|ui|frontend|responsive|wordpress|next\.?js|vue|angular)\b/.test(
          lower,
        )
      ) {
        frontend.push(skill);
      } else if (
        /\b(sql|mysql|postgresql|sqlite|mongodb|database|docker|linux|ubuntu|git|github|vercel|cloudinary|postman|vs\s*code|visual\s*studio)\b/.test(
          lower,
        )
      ) {
        dataAndDevops.push(skill);
      } else {
        backend.push(skill);
      }
    }

    const categories: Array<{ category: string; items: string[] }> = [];
    if (backend.length > 0) {
      categories.push({ category: 'Languages & Backend APIs', items: backend.slice(0, 10) });
    }
    if (frontend.length > 0) {
      categories.push({ category: 'Frontend & Web Development', items: frontend.slice(0, 10) });
    }
    if (dataAndDevops.length > 0) {
      categories.push({ category: 'Databases, DevOps & Tooling', items: dataAndDevops.slice(0, 10) });
    }
    if (aiAndAutomation.length > 0) {
      categories.push({ category: 'AI & Workflow Automation', items: aiAndAutomation.slice(0, 8) });
    }

    const cleanProf = deduplicateSkills(
      profSkills.filter(
        (ps) => !allTech.some((ts) => normalizeSkillKey(ts) === normalizeSkillKey(ps)),
      ),
    );
    if (cleanProf.length > 0) {
      categories.push({ category: 'Professional Competencies', items: cleanProf.slice(0, 8) });
    }

    return { matchedSkills, categorizedSkills: categories };
  }

  private inferProjectTechnologies(
    name: string,
    description: string,
    candidateSkills: string[],
  ): string[] {
    const text = `${name} ${description}`.toLowerCase();
    const matched = candidateSkills.filter((s) => {
      const token = s.toLowerCase().replace(/\.js\b/g, '').trim();
      return token.length >= 3 && text.includes(token);
    });
    if (matched.length > 0) return matched.slice(0, 6);
    if (text.includes('full-stack') || text.includes('prospecting')) {
      return ['TypeScript', 'React', 'Node.js', 'SQLite', 'REST APIs'];
    }
    if (text.includes('backend') || text.includes('rest api')) {
      return ['Node.js', 'TypeScript', 'REST APIs', 'RBAC', 'SQL'];
    }
    if (text.includes('voice') || text.includes('gemini')) {
      return ['JavaScript', 'Gemini Live API', 'Web Audio Streaming'];
    }
    return [];
  }

  private collectValidProfessionalLinks(
    profile: CareerProfile | null,
  ): Array<{ label: string; url: string }> {
    const out: Array<{ label: string; url: string }> = [];
    const seenUrls = new Set<string>();

    const rawSocial = profile?.socialAccounts;
    const socialList: Array<{ platform: string; url: string }> = Array.isArray(rawSocial)
      ? rawSocial
      : rawSocial && typeof rawSocial === 'object'
      ? Object.entries(rawSocial as Record<string, string>).map(([k, v]) => ({
          platform: k.charAt(0).toUpperCase() + k.slice(1),
          url: String(v || ''),
        }))
      : [];

    for (const acc of socialList) {
      const url = (acc.url || '').trim();
      if (!url || !url.startsWith('http')) continue;
      if (this.isBareRootSocialDomain(url)) continue;
      const norm = url.toLowerCase().replace(/\/$/, '');
      if (seenUrls.has(norm)) continue;
      seenUrls.add(norm);
      out.push({ label: acc.platform || 'Profile', url });
    }

    for (const rawUrl of profile?.portfolioLinks || []) {
      const url = (rawUrl || '').trim();
      if (!url || !url.startsWith('http')) continue;
      if (this.isBareRootSocialDomain(url)) continue;
      const norm = url.toLowerCase().replace(/\/$/, '');
      if (seenUrls.has(norm)) continue;
      seenUrls.add(norm);
      out.push({ label: 'Portfolio / Website', url });
    }

    return out;
  }

  private isBareRootSocialDomain(url: string): boolean {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.replace(/\/+/g, '');
      const socialHosts = ['github.com', 'linkedin.com', 'gitlab.com', 'twitter.com', 'x.com'];
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      return socialHosts.includes(host) && path.length === 0;
    } catch {
      return false;
    }
  }
}

export const applicationEmailGenerator = new ApplicationEmailGenerator();
