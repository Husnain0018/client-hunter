import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Bot,
  Copy,
  Check,
  Send,
  Loader2,
  AlertCircle,
  HelpCircle,
  Clock,
  Briefcase
} from 'lucide-react';
import { api } from '../api/client';
import type { JobApplication } from '../types';

interface AiEmailAssistantModalProps {
  application: JobApplication;
  onClose: () => void;
  onResponseLogged?: (updatedApp: JobApplication) => void;
}

export const AiEmailAssistantModal: React.FC<AiEmailAssistantModalProps> = ({
  application,
  onClose,
  onResponseLogged,
}) => {
  const [employerMessage, setEmployerMessage] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{
    category: string;
    categoryLabel: string;
    sentiment: string;
    keyPoints: string[];
    suggestedReply: string;
    actionItems: string[];
  } | null>(null);

  const [editableReply, setEditableReply] = useState('');
  const [copied, setCopied] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!employerMessage.trim()) {
      setError('Please enter or paste the employer email message to analyze.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    try {
      const res = await api.getAiEmailReply(application.id, employerMessage.trim());
      if (res.ok && res.analysis) {
        setAnalysis(res.analysis);
        setEditableReply(res.analysis.suggestedReply);
      }
    } catch (err: any) {
      setError(err.message || 'Could not analyze employer message.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editableReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveResponse = async () => {
    setSavingLog(true);
    try {
      const res = await api.logEmployerResponse(application.id, {
        fromEmail: application.recipientEmail || 'employer@company.com',
        subject: `Response regarding ${application.job?.title || 'position'}`,
        body: employerMessage.trim(),
        category: analysis?.category,
        userReply: editableReply.trim(),
      });
      if (res.ok) {
        setLogSuccess(true);
        if (onResponseLogged) {
          onResponseLogged(res.application);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save communication record.');
    } finally {
      setSavingLog(false);
    }
  };

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
        if (e.target === e.currentTarget && !analyzing) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(to bottom, #f8fafc, #ffffff)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={20} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                AI Employer Email Response Assistant
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {application.job?.company} — {application.job?.title}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#64748b', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: '13px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Incoming Employer Email Message *
            </label>
            <textarea
              rows={4}
              value={employerMessage}
              onChange={(e) => setEmployerMessage(e.target.value)}
              placeholder="Paste the message received from the employer here (e.g. 'We reviewed your resume and would love to invite you for a 30-min call this week...')"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px', lineHeight: 1.5, fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || !employerMessage.trim()}
              style={{
                background: employerMessage.trim() ? '#4f46e5' : '#94a3b8',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: '13px',
                fontWeight: 700,
                cursor: employerMessage.trim() && !analyzing ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {analyzing ? (
                <>
                  <Loader2 size={16} className="spin" /> Analyzing Message & Generating Reply…
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Analyze & Suggest Professional Reply
                </>
              )}
            </button>
          </div>

          {/* Analysis & Suggested Reply */}
          {analysis && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Category & Sentiment Tag */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: analysis.category === 'interview_invite' ? '#dcfce7' : analysis.category === 'rejection' ? '#fee2e2' : '#e0e7ff',
                    color: analysis.category === 'interview_invite' ? '#15803d' : analysis.category === 'rejection' ? '#b91c1c' : '#3730a3',
                    padding: '4px 12px',
                    borderRadius: 999,
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  Detected: {analysis.categoryLabel}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Sentiment: <strong>{analysis.sentiment.toUpperCase()}</strong>
                </span>
              </div>

              {/* Key points identified */}
              {analysis.keyPoints.length > 0 && (
                <div style={{ fontSize: '12px', color: '#334155' }}>
                  <strong>Key Observations:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
                    {analysis.keyPoints.map((kp, idx) => (
                      <li key={idx}>{kp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action items */}
              {analysis.actionItems.length > 0 && (
                <div style={{ fontSize: '12px', color: '#1d4ed8', background: '#eff6ff', padding: '8px 12px', borderRadius: 8 }}>
                  <strong>Recommended Next Step:</strong> {analysis.actionItems.join(' • ')}
                </div>
              )}

              {/* Suggested Reply Box */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                    Suggested Professional Reply (Editable)
                  </label>
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      background: copied ? '#10b981' : '#f1f5f9',
                      color: copied ? '#fff' : '#475569',
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied!' : 'Copy Reply'}
                  </button>
                </div>

                <textarea
                  rows={9}
                  value={editableReply}
                  onChange={(e) => setEditableReply(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px', lineHeight: 1.6, fontFamily: 'inherit' }}
                />
              </div>

              {/* Save & Log Record */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', color: logSuccess ? '#16a34a' : '#64748b' }}>
                  {logSuccess ? '✓ Communication logged to application timeline!' : 'Review and approve this reply before sending.'}
                </span>

                <button
                  type="button"
                  onClick={handleSaveResponse}
                  disabled={savingLog || logSuccess}
                  style={{
                    background: logSuccess ? '#16a34a' : '#0284c7',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: savingLog || logSuccess ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {savingLog ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                  {logSuccess ? 'Saved to Tracker' : 'Log Communication & Update Status'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
