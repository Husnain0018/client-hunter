import JSZip from 'jszip';
import type { CareerProfile } from '../types/domain.js';

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface RelationshipEntry {
  id: string;
  type: string;
  target: string;
  targetMode?: string;
}

export class DocxBuilder {
  /**
   * Generates a fully compliant, beautiful Microsoft Word .docx file for a resume
   * complete with candidate photograph (if enabled), clickable hyperlinks, and ATS-optimized styling.
   */
  public static async buildResumeDocx(profile: CareerProfile, title?: string): Promise<Buffer> {
    const zip = new JSZip();
    const relationships: RelationshipEntry[] = [
      { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', target: 'styles.xml' },
    ];

    let hasPhoto = false;
    if (profile.includePhotoInResume && profile.photoUrl && profile.photoUrl.startsWith('data:image/')) {
      try {
        const base64Data = profile.photoUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
        const photoBuffer = Buffer.from(base64Data, 'base64');
        if (photoBuffer.length > 0) {
          zip.file('word/media/photo.jpg', photoBuffer);
          relationships.push({
            id: 'rIdPhoto',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
            target: 'media/photo.jpg',
          });
          hasPhoto = true;
        }
      } catch {
        // ignore photo encoding error
      }
    }

    let nextRelId = 10;
    const createHyperlinkRun = (text: string, url: string): string => {
      if (!url) return `<w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r>`;
      const rId = `rIdLink${nextRelId++}`;
      relationships.push({
        id: rId,
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
        target: url,
        targetMode: 'External',
      });
      return `
        <w:hyperlink r:id="${rId}">
          <w:r>
            <w:rPr><w:sz w:val="22"/><w:color w:val="2563EB"/><w:u w:val="single"/></w:rPr>
            <w:t>${escapeXml(text)}</w:t>
          </w:r>
        </w:hyperlink>
      `;
    };

    // 1. [Content_Types].xml
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
    );

    // 2. _rels/.rels
    zip.file(
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );

    // 3. word/styles.xml
    zip.file(
      'word/styles.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:color w:val="1E293B"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="34"/>
      <w:color w:val="0F172A"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr>
      <w:spacing w:before="240" w:after="80"/>
      <w:pBdr>
        <w:bottom w:val="single" w:sz="8" w:space="4" w:color="2563EB"/>
      </w:pBdr>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
      <w:color w:val="1E3A8A"/>
    </w:rPr>
  </w:style>
</w:styles>`
    );

    const pElements: string[] = [];

    // Photo drawing element if present (1.1 inches = 1005840 EMUs)
    if (hasPhoto) {
      pElements.push(`
        <w:p>
          <w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="120"/></w:pPr>
          <w:r>
            <w:drawing>
              <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
                <wp:extent cx="1005840" cy="1005840"/>
                <wp:effectExtent l="0" t="0" r="0" b="0"/>
                <wp:docPr id="1" name="Candidate Photograph"/>
                <wp:cNvGraphicFramePr>
                  <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
                </wp:cNvGraphicFramePr>
                <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                  <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                      <pic:nvPicPr>
                        <pic:cNvPr id="0" name="photo.jpg"/>
                        <pic:cNvPicPr/>
                      </pic:nvPicPr>
                      <pic:blipFill>
                        <a:blip r:embed="rIdPhoto" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                        <a:stretch><a:fillRect/></a:stretch>
                      </pic:blipFill>
                      <pic:spPr>
                        <a:xfrm><a:off x="0" y="0"/><a:ext cx="1005840" cy="1005840"/></a:xfrm>
                        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                      </pic:spPr>
                    </pic:pic>
                  </a:graphicData>
                </a:graphic>
              </wp:inline>
            </w:drawing>
          </w:r>
        </w:p>
      `);
    }

    const addHeading1 = (text: string) => {
      pElements.push(`
        <w:p>
          <w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr>
          <w:r><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="0F172A"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r>
        </w:p>
      `);
    };

    const addHeading2 = (text: string) => {
      pElements.push(`
        <w:p>
          <w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="240" w:after="80"/></w:pPr>
          <w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1E3A8A"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r>
        </w:p>
      `);
    };

    const addParagraph = (text: string, isItalic = false, isBold = false) => {
      pElements.push(`
        <w:p>
          <w:pPr><w:spacing w:after="80"/></w:pPr>
          <w:r>
            <w:rPr>${isBold ? '<w:b/>' : ''}${isItalic ? '<w:i/>' : ''}<w:sz w:val="22"/><w:color w:val="334155"/></w:rPr>
            <w:t xml:space="preserve">${escapeXml(text)}</w:t>
          </w:r>
        </w:p>
      `);
    };

    const addSubtitle = (parts: string[]) => {
      const line = parts.filter(Boolean).join('  |  ');
      pElements.push(`
        <w:p>
          <w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>
          <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r>
        </w:p>
      `);
    };

    const addBullet = (boldPrefix: string, text: string, linkUrl?: string) => {
      pElements.push(`
        <w:p>
          <w:pPr>
            <w:ind w:left="360" w:hanging="240"/>
            <w:spacing w:after="60"/>
          </w:pPr>
          <w:r><w:t>• </w:t></w:r>
          ${boldPrefix ? `<w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">${escapeXml(boldPrefix)}: </w:t></w:r>` : ''}
          ${linkUrl ? createHyperlinkRun(text, linkUrl) : `<w:r><w:rPr><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`}
        </w:p>
      `);
    };

    // --- Compose Content ---
    addHeading1(profile.fullName || 'Candidate Name');

    const contactParts: string[] = [];
    if (profile.targetRoles && profile.targetRoles.length > 0) contactParts.push(profile.targetRoles[0]);
    if (profile.location) contactParts.push(profile.location);
    if (profile.email) contactParts.push(profile.email);
    if (profile.phone) contactParts.push(profile.phone);
    addSubtitle(contactParts);

    // Clickable Social & Professional Profiles
    if (profile.socialAccounts && profile.socialAccounts.length > 0) {
      const linksRuns = profile.socialAccounts.map((a) => `${createHyperlinkRun(a.platform, a.url)}`).join(` <w:r><w:t xml:space="preserve"> | </w:t></w:r> `);
      pElements.push(`
        <w:p>
          <w:pPr><w:jc w:val="center"/><w:spacing w:after="140"/></w:pPr>
          ${linksRuns}
        </w:p>
      `);
    }

    // Professional Summary
    if (profile.summary) {
      addHeading2('PROFESSIONAL SUMMARY');
      addParagraph(profile.summary);
    }

    // Technical & Professional Skills
    const techSkills = profile.skills || [];
    const profSkills = profile.professionalSkills || [];
    if (techSkills.length > 0 || profSkills.length > 0) {
      addHeading2('CORE SKILLS & METHODOLOGIES');
      if (techSkills.length > 0) {
        addBullet('Technical Stack', techSkills.join(', '));
      }
      if (profSkills.length > 0) {
        addBullet('Professional Competencies', profSkills.join(', '));
      }
    }

    // Work Experience
    if (profile.experience && profile.experience.length > 0) {
      addHeading2('WORK EXPERIENCE');
      for (const exp of profile.experience) {
        pElements.push(`
          <w:p>
            <w:pPr><w:spacing w:before="120" w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>${escapeXml(exp.title)}</w:t></w:r>
            <w:r><w:rPr><w:sz w:val="22"/><w:color w:val="2563EB"/></w:rPr><w:t xml:space="preserve"> — ${escapeXml(exp.company)}</w:t></w:r>
            ${exp.location ? `<w:r><w:rPr><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve"> (${escapeXml(exp.location)})</w:t></w:r>` : ''}
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>${escapeXml(exp.startDate)} – ${exp.current ? 'Present' : escapeXml(exp.endDate || '')}</w:t></w:r>
          </w:p>
        `);
        if (exp.description) {
          addParagraph(exp.description);
        }
        if (exp.responsibilities && exp.responsibilities.length > 0) {
          for (const resp of exp.responsibilities) {
            addBullet('', resp);
          }
        }
        if (exp.achievements && exp.achievements.length > 0) {
          for (const ach of exp.achievements) {
            addBullet('Key Achievement', ach);
          }
        }
      }
    }

    // Internships & Practical Training
    if (profile.internships && profile.internships.length > 0) {
      addHeading2('INTERNSHIPS & PRACTICAL EXPERIENCE');
      for (const intern of profile.internships) {
        pElements.push(`
          <w:p>
            <w:pPr><w:spacing w:before="120" w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>${escapeXml(intern.role)}</w:t></w:r>
            <w:r><w:rPr><w:sz w:val="22"/><w:color w:val="2563EB"/></w:rPr><w:t xml:space="preserve"> — ${escapeXml(intern.organization)}</w:t></w:r>
            ${intern.duration ? `<w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve"> (${escapeXml(intern.duration)})</w:t></w:r>` : ''}
          </w:p>
        `);
        if (intern.description) {
          addParagraph(intern.description);
        }
        if (intern.certificateUrl) {
          addBullet('Certificate Verification', intern.certificateUrl, intern.certificateUrl);
        }
      }
    }

    // Key Projects
    if (profile.projects && profile.projects.length > 0) {
      addHeading2('KEY ENGINEERING PROJECTS');
      for (const proj of profile.projects) {
        const linkRuns: string[] = [];
        if (proj.link) linkRuns.push(createHyperlinkRun('[Live Demo]', proj.link));
        if (proj.repoUrl) linkRuns.push(createHyperlinkRun('[Source Code]', proj.repoUrl));

        pElements.push(`
          <w:p>
            <w:pPr><w:spacing w:before="100" w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>${escapeXml(proj.name)}</w:t></w:r>
            ${linkRuns.length > 0 ? ` <w:r><w:t xml:space="preserve"> </w:t></w:r>${linkRuns.join(' ')}` : ''}
          </w:p>
        `);
        if (proj.description) {
          addParagraph(proj.description);
        }
        if (proj.technologies && proj.technologies.length > 0) {
          addBullet('Technologies', proj.technologies.join(', '));
        }
      }
    }

    // Education
    if (profile.education && profile.education.length > 0) {
      addHeading2('EDUCATION');
      for (const edu of profile.education) {
        pElements.push(`
          <w:p>
            <w:pPr><w:spacing w:before="100" w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>${escapeXml(edu.degree)}${edu.field ? ` in ${escapeXml(edu.field)}` : ''}</w:t></w:r>
            <w:r><w:rPr><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr><w:t xml:space="preserve"> — ${escapeXml(edu.institution)}</w:t></w:r>
            ${edu.year ? `<w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve"> (${escapeXml(edu.year)})</w:t></w:r>` : ''}
          </w:p>
        `);
        if (edu.gpa) {
          addBullet('GPA / Honors', edu.gpa);
        }
      }
    }

    // Certifications
    if (profile.certifications && profile.certifications.length > 0) {
      addHeading2('CERTIFICATIONS & CREDENTIALS');
      for (const cert of profile.certifications) {
        if (typeof cert === 'string') {
          addBullet('', cert);
        } else {
          const detail = [cert.issuer, cert.date].filter(Boolean).join(' • ');
          addBullet(cert.name, detail || cert.url || '', cert.url);
        }
      }
    }

    // Languages
    if (profile.languages && profile.languages.length > 0) {
      addHeading2('LANGUAGES');
      const langItems = profile.languages.map((l) => (typeof l === 'string' ? l : `${l.language} (${l.proficiency})`));
      addParagraph(langItems.join('  •  '));
    }

    // Compile Relationships
    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relationships.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${escapeXml(r.target)}"${r.targetMode ? ` TargetMode="${r.targetMode}"` : ''}/>`).join('\n  ')}
</Relationships>`;
    zip.file('word/_rels/document.xml.rels', relsXml);

    // Document Body Wrapper with standard 1-inch margins
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${pElements.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    zip.file('word/document.xml', documentXml);

    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  /**
   * Generates a Word .docx file directly from parsed or edited Markdown resume text,
   * converting Markdown headings, lists, bold text, and hyperlinks into standard Word formatting.
   */
  public static async buildFromMarkdown(title: string, markdown: string, profile?: CareerProfile): Promise<Buffer> {
    // If a candidate profile is available, generate full structured DOCX
    if (profile && profile.fullName) {
      return this.buildResumeDocx(profile, title);
    }

    const zip = new JSZip();
    const relationships: RelationshipEntry[] = [
      { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', target: 'styles.xml' },
    ];

    let nextRelId = 10;
    const createHyperlinkRun = (text: string, url: string): string => {
      const rId = `rIdLink${nextRelId++}`;
      relationships.push({
        id: rId,
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
        target: url,
        targetMode: 'External',
      });
      return `<w:hyperlink r:id="${rId}"><w:r><w:rPr><w:sz w:val="22"/><w:color w:val="2563EB"/><w:u w:val="single"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:hyperlink>`;
    };

    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
    );

    zip.file(
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );

    zip.file(
      'word/styles.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:color w:val="1E293B"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`
    );

    const pElements: string[] = [];
    const lines = markdown.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('# ')) {
        const text = line.substring(2).trim();
        pElements.push(`
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="80"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="0F172A"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r>
          </w:p>
        `);
      } else if (line.startsWith('## ')) {
        const text = line.substring(3).trim();
        pElements.push(`
          <w:p>
            <w:pPr>
              <w:spacing w:before="240" w:after="80"/>
              <w:pBdr>
                <w:bottom w:val="single" w:sz="8" w:space="2" w:color="2563EB"/>
              </w:pBdr>
            </w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1E3A8A"/></w:rPr><w:t>${escapeXml(text.toUpperCase())}</w:t></w:r>
          </w:p>
        `);
      } else if (line.startsWith('### ')) {
        const text = line.substring(4).trim();
        pElements.push(`
          <w:p>
            <w:pPr><w:spacing w:before="120" w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r>
          </w:p>
        `);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.substring(2).trim();
        pElements.push(`
          <w:p>
            <w:pPr>
              <w:ind w:left="360" w:hanging="240"/>
              <w:spacing w:after="60"/>
            </w:pPr>
            <w:r><w:t>• </w:t></w:r>
            <w:r><w:rPr><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>
          </w:p>
        `);
      } else if (line === '---') {
        pElements.push(`
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="E2E8F0"/></w:pBdr>
            </w:pPr>
          </w:p>
        `);
      } else {
        pElements.push(`
          <w:p>
            <w:pPr><w:spacing w:after="80"/></w:pPr>
            <w:r><w:rPr><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>
          </w:p>
        `);
      }
    }

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relationships.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${escapeXml(r.target)}"${r.targetMode ? ` TargetMode="${r.targetMode}"` : ''}/>`).join('\n  ')}
</Relationships>`;
    zip.file('word/_rels/document.xml.rels', relsXml);

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${pElements.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    zip.file('word/document.xml', documentXml);

    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }
}
