import React, { useState, useEffect } from 'react';
import { Sparkles, Download, FileText, Check, Copy, Edit3, Eye, Save, RefreshCw, Printer } from 'lucide-react';
import type { GeneratedResume, CareerProfile } from '../types';
import { client } from '../api/client';

interface ResumeStudioProps {
  profile: CareerProfile | null;
  onProfileUpdated?: () => void;
}

export const ResumeStudio: React.FC<ResumeStudioProps> = ({ profile }) => {
  const [selectedTemplate, setSelectedTemplate] = useState('software_engineering');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resumes, setResumes] = useState<GeneratedResume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load existing resumes on mount
  useEffect(() => {
    loadResumes();
  }, []);

  const loadResumes = async () => {
    try {
      const res = await client.getGeneratedResumes();
      if (res.ok && res.generatedResumes.length > 0) {
        setResumes(res.generatedResumes);
        if (!selectedResumeId) {
          setSelectedResumeId(res.generatedResumes[0].id);
          setEditedText(res.generatedResumes[0].contentText);
          setEditedTitle(res.generatedResumes[0].title);
        }
      }
    } catch (err) {
      console.error('Failed to load generated resumes:', err);
    }
  };

  const currentResume = resumes.find((r) => r.id === selectedResumeId) || resumes[0] || null;

  useEffect(() => {
    if (currentResume) {
      setEditedText(currentResume.contentText);
      setEditedTitle(currentResume.title);
    }
  }, [selectedResumeId]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await client.generateTailoredResume(selectedTemplate, profile || undefined);
      if (res.ok && res.generatedResume) {
        setResumes([res.generatedResume, ...resumes]);
        setSelectedResumeId(res.generatedResume.id);
        setEditedText(res.generatedResume.contentText);
        setEditedTitle(res.generatedResume.title);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to generate resume:', err);
      alert('Error generating resume. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!currentResume) return;
    setIsSaving(true);
    try {
      const res = await client.updateGeneratedResume(currentResume.id, {
        title: editedTitle,
        contentText: editedText,
      });
      if (res.ok && res.generatedResume) {
        const updatedList = resumes.map((r) => (r.id === res.generatedResume.id ? res.generatedResume : r));
        setResumes(updatedList);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to save edited resume:', err);
      alert('Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    if (!editedText) return;
    navigator.clipboard.writeText(editedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);

  const handleDownloadDocx = async () => {
    if (!currentResume) return;
    setIsDownloadingDocx(true);
    try {
      const filename = `${(currentResume.title || 'Resume').replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;
      await client.downloadGeneratedResumeDocx(currentResume.id, filename);
    } catch (err: any) {
      console.error('DOCX download error:', err);
      try {
        const url = client.getGeneratedResumeDocxUrl(currentResume.id);
        window.open(url, '_blank');
      } catch {
        alert('Failed to download Word document: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
      {/* Header and Generator Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="#4f46e5" /> AI Tailored Resume Studio
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Generate international ATS-optimized resumes from your profile data, edit sections live, and download as PDF or DOCX.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', fontWeight: 600 }}
          >
            <option value="software_engineering">Software Engineering (ATS Standard)</option>
            <option value="international">International Mobility & Global Relocation</option>
            <option value="remote_work">Remote Specialist (Asynchronous Delivery)</option>
            <option value="general_professional">General Professional</option>
            <option value="entry_level">Entry Level & Graduate</option>
          </select>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              padding: '9px 18px',
              borderRadius: 8,
              fontSize: '13px',
              fontWeight: 700,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {isGenerating ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
            {isGenerating ? 'Generating Resume…' : 'Generate Tailored Resume'}
          </button>
        </div>
      </div>

      {/* Resume Selector & Controls Bar */}
      {currentResume && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Selected Resume:</span>
            {resumes.length > 1 ? (
              <select
                value={selectedResumeId || currentResume.id}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
              >
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({new Date(r.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            ) : (
              <strong style={{ fontSize: '13px', color: '#0f172a' }}>{currentResume.title}</strong>
            )}

            {saveSuccess && (
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={12} /> Saved to Database
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Toggle Edit Mode */}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              style={{
                background: isEditing ? '#eff6ff' : '#fff',
                color: isEditing ? '#1d4ed8' : '#334155',
                border: isEditing ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isEditing ? <Eye size={13} /> : <Edit3 size={13} />}
              {isEditing ? 'Visual ATS Preview' : 'Edit Resume Text'}
            </button>

            {/* Copy Markdown */}
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: '#fff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy Text'}
            </button>

            {/* Download PDF (Print layout) */}
            <button
              type="button"
              onClick={handlePrintPdf}
              style={{
                background: '#059669',
                color: '#fff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Printer size={13} /> Print / Save PDF
            </button>

            {/* Download DOCX */}
            <button
              type="button"
              onClick={handleDownloadDocx}
              disabled={isDownloadingDocx}
              style={{
                background: isDownloadingDocx ? '#93c5fd' : '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: '12px',
                fontWeight: 700,
                cursor: isDownloadingDocx ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {isDownloadingDocx ? <RefreshCw size={13} className="spin" /> : <Download size={13} />}
              {isDownloadingDocx ? 'Generating .DOCX…' : 'Download Word (.DOCX)'}
            </button>
          </div>
        </div>
      )}

      {/* Editor & Preview Area */}
      {currentResume && (
        <div>
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: 4 }}>Resume Title</label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: 4 }}>Resume Content (Markdown / Text)</label>
                <textarea
                  rows={20}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: '12.5px',
                    padding: '14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    lineHeight: 1.6,
                    background: '#f8fafc',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: 6, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  disabled={isSaving}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 6, fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={14} /> {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="printable-resume-container"
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              }}
              dangerouslySetInnerHTML={{ __html: currentResume.contentHtml }}
            />
          )}
        </div>
      )}

      {!currentResume && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
          <FileText size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#334155', fontWeight: 700 }}>No Tailored Resume Generated Yet</h4>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', maxWidth: 460, marginInline: 'auto' }}>
            Select an ATS template above and click "Generate Tailored Resume" to assemble a professional CV directly from your Candidate Profile.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              padding: '9px 20px',
              borderRadius: 8,
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isGenerating ? 'Generating…' : 'Generate Now'}
          </button>
        </div>
      )}

      {/* Print Stylesheet injection for pristine PDF printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-resume-container, .printable-resume-container * {
            visibility: visible;
          }
          .printable-resume-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
};
