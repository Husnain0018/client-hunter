import React from 'react';
import {
  X,
  ExternalLink,
  Building2,
  MapPin,
  DollarSign,
  Calendar,
  Clock,
  ShieldCheck,
  Globe,
  Briefcase,
  GraduationCap,
  Award,
  CheckCircle2,
  Mail,
  Send,
  Sparkles,
  Info,
  Gift,
  HelpCircle
} from 'lucide-react';
import type { JobListing } from '../types';

interface JobDetailsModalProps {
  job: JobListing;
  onClose: () => void;
  onApplyViaEmail?: (job: JobListing) => void;
  onPreparePackage?: (job: JobListing) => void;
  onQuickApply?: (job: JobListing) => void;
  onEmailApply?: (job: JobListing) => void;
}

export function formatTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return 'Posting date unavailable';
  const time = new Date(dateStr).getTime();
  if (isNaN(time) || time <= 0) return 'Posting date unavailable';

  const diffMs = Date.now() - time;
  if (diffMs < 0) return 'Just now';

  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins <= 1 ? '1 minute' : `${mins} minutes`} ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours === 1 ? '1 hour' : `${hours} hours`} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days === 1 ? '1 day' : `${days} days`} ago`;

  const months = Math.floor(days / 30);
  return `${months === 1 ? '1 month' : `${months} months`} ago`;
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Unavailable';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Unavailable';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getSourceBadgeStyle(source: string): { bg: string; color: string; border: string } {
  const s = source.toLowerCase();
  if (s.includes('linkedin')) return { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' };
  if (s.includes('indeed')) return { bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' };
  if (s.includes('glassdoor')) return { bg: '#dcfce7', color: '#15803d', border: '#86efac' };
  if (s.includes('remote ok')) return { bg: '#ffedd5', color: '#c2410c', border: '#fdba74' };
  if (s.includes('arbeitnow')) return { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' };
  if (s.includes('jobicy')) return { bg: '#f3e8ff', color: '#7e22ce', border: '#d8b4fe' };
  return { bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' };
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  job,
  onClose,
  onApplyViaEmail,
  onPreparePackage,
  onQuickApply,
  onEmailApply,
}) => {
  const badge = getSourceBadgeStyle(job.source);
  const handleEmail = onApplyViaEmail || onEmailApply;
  const handlePackage = onPreparePackage || onQuickApply;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          maxWidth: 780,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header Strip */}
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(to bottom, #f8fafc, #ffffff)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                  padding: '3px 10px',
                  borderRadius: 999,
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Source: {job.source}
              </span>
              <span
                style={{
                  background: job.isActive ? '#dcfce7' : '#fee2e2',
                  color: job.isActive ? '#15803d' : '#b91c1c',
                  padding: '3px 10px',
                  borderRadius: 999,
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                {job.isActive ? '● Applications Open' : '● Status Unavailable / Closed'}
              </span>
            </div>

            <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
              {job.title}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: '13px', color: '#475569' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, color: '#1e293b' }}>
                <Building2 size={16} color="#6366f1" /> {job.company}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={16} color="#06b6d4" /> {job.location} ({job.country})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Briefcase size={16} color="#3b82f6" /> {job.workplaceType} • {job.employmentType}
              </span>
              {job.salaryRaw && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a', fontWeight: 700 }}>
                  <DollarSign size={16} /> {job.salaryRaw}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 8,
              padding: 6,
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Section 1: Original Job Source & Verified Posting Metadata Card */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '16px 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              fontSize: '12px',
            }}
          >
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Original Job Source</span>
              <strong style={{ color: '#0f172a', fontSize: '13px' }}>{job.source}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Original Posting Date</span>
              <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                {job.postedAt ? `${formatDateTime(job.postedAt)} (${formatTimeAgo(job.postedAt)})` : 'Posting date unavailable'}
              </strong>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Discovered by System</span>
              <strong style={{ color: '#0f172a', fontSize: '13px' }}>{formatDateTime(job.discoveredAt)}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Last Verified</span>
              <strong style={{ color: '#0f172a', fontSize: '13px' }}>{formatDateTime(job.lastVerifiedAt || job.discoveredAt)}</strong>
            </div>
          </div>

          {/* Section 2: Destination Visa Guidance if present */}
          {job.visaGuidance && (
            <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#3730a3', fontWeight: 700, fontSize: '12px' }}>
                <Globe size={15} /> Destination Work Authorization & Visa Guidance
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
                {job.visaGuidance}
              </p>
            </div>
          )}

          {/* Section 3: A. Short Job Description (Requirement 3.A) */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12, padding: '18px 20px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={15} color="#4f46e5" /> Quick Opportunity Overview
            </h4>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#334155', lineHeight: 1.6, fontWeight: 500 }}>
              {job.shortDescription || `${job.company} is seeking a qualified ${job.title} to join their team in ${job.location}. Review the role requirements and full description below.`}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>
              <div>
                <span style={{ color: '#64748b' }}>Department / Team:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{job.department || 'Not specified in listing'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Experience Level:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{job.experienceLevel || 'Mid-level'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Fresh Graduates Eligible:</span>{' '}
                <strong style={{ color: job.freshGraduatesEligible ? '#15803d' : '#475569' }}>
                  {job.freshGraduatesEligible === true
                    ? 'Yes (Fresh graduates welcome)'
                    : job.freshGraduatesEligible === false
                    ? 'No (Experience required)'
                    : 'Not specified in listing'}
                </strong>
              </div>
            </div>
          </div>

          {/* Section 4: Key Technical & Professional Skills */}
          <div>
            <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
              Required Technical & Professional Skills
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {job.skills && job.skills.length > 0 ? (
                job.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                  No specific skill keywords isolated by source. Review full job description below.
                </span>
              )}

              {job.professionalSkills && job.professionalSkills.map((ps, idx) => (
                <span
                  key={`ps-${idx}`}
                  style={{
                    background: '#f5f3ff',
                    color: '#6d28d9',
                    border: '1px solid #ddd6fe',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {ps}
                </span>
              ))}
            </div>
          </div>

          {/* Section 5: Structured Qualifications & Responsibilities */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {/* Responsibilities */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} color="#10b981" /> Key Responsibilities
              </h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '12px', color: '#334155', lineHeight: 1.6 }}>
                {job.responsibilities && job.responsibilities.length > 0 ? (
                  job.responsibilities.map((r, idx) => <li key={idx} style={{ marginBottom: 6 }}>{r}</li>)
                ) : (
                  <li style={{ color: '#94a3b8', fontStyle: 'italic' }}>Detailed responsibilities are described in the full text below.</li>
                )}
              </ul>
            </div>

            {/* Qualifications & Requirements */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Award size={14} color="#6366f1" /> Qualifications & Requirements
              </h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '12px', color: '#334155', lineHeight: 1.6 }}>
                {job.requirements && job.requirements.length > 0 ? (
                  job.requirements.map((req, idx) => <li key={idx} style={{ marginBottom: 6 }}>{req}</li>)
                ) : (
                  <li style={{ color: '#94a3b8', fontStyle: 'italic' }}>Qualifications are detailed in the full description below.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Section 6: Education, Experience & Benefits Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, fontSize: '12px' }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontWeight: 700, marginBottom: 4 }}>
                <GraduationCap size={15} color="#0284c7" /> Education Requirement
              </div>
              <div style={{ color: '#0f172a' }}>{job.educationRequirements || 'Not specified in listing'}</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontWeight: 700, marginBottom: 4 }}>
                <Clock size={15} color="#f59e0b" /> Experience Requirement
              </div>
              <div style={{ color: '#0f172a' }}>{job.experienceRequirements || `${job.experienceLevel || 'Mid-level'} software engineering experience`}</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontWeight: 700, marginBottom: 4 }}>
                <Gift size={15} color="#ec4899" /> Benefits & Perks
              </div>
              <div style={{ color: '#0f172a' }}>
                {job.benefits && job.benefits.length > 0 ? job.benefits.join(' • ') : 'Standard company benefits or not specified in listing'}
              </div>
            </div>
          </div>

          {/* Section 7: B. Complete Job Description (Full Available Text) */}
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
              Full Job Description
            </h4>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                padding: '18px 20px',
                fontSize: '13px',
                color: '#334155',
                lineHeight: 1.7,
                maxHeight: 280,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {job.description}
            </div>
          </div>

          {/* Application Instructions */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', fontSize: '12px', color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Application Instructions:</strong>{' '}
              {job.applicationInstructions || 'Submit your application via the official job listing link or through the verified application portal below.'}
              {job.contactEmail && (
                <div style={{ marginTop: 4 }}>
                  <strong>Verified Contact Email:</strong>{' '}
                  <a href={`mailto:${job.contactEmail}`} style={{ color: '#b45309', fontWeight: 700 }}>{job.contactEmail}</a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div
          style={{
            padding: '18px 28px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
          }}
        >
          <a
            href={job.sourceUrl || job.applyUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '13px',
              color: '#2563eb',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              textDecoration: 'none',
            }}
          >
            Open Original Posting on {job.source} <ExternalLink size={14} />
          </a>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {handleEmail && (
              <button
                type="button"
                onClick={() => handleEmail(job)}
                style={{
                  background: '#0ea5e9',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: 8,
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Mail size={15} /> Apply via Email
              </button>
            )}

            {handlePackage && (
              <button
                type="button"
                onClick={() => handlePackage(job)}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: 8,
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Sparkles size={15} /> Prepare Application Package
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
