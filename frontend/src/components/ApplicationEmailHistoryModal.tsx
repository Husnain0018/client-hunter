import React, { useState } from 'react';
import {
  X,
  Mail,
  Send,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Paperclip,
  ExternalLink
} from 'lucide-react';
import type { JobApplicationEmailRecord } from '../types';
import { formatDateTime } from './JobDetailsModal';

interface ApplicationEmailHistoryModalProps {
  emails: JobApplicationEmailRecord[];
  onClose: () => void;
}

export const ApplicationEmailHistoryModal: React.FC<ApplicationEmailHistoryModalProps> = ({
  emails,
  onClose,
}) => {
  const [selectedEmail, setSelectedEmail] = useState<JobApplicationEmailRecord | null>(emails[0] || null);

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
          maxWidth: 880,
          width: '100%',
          maxHeight: '85vh',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
            <div style={{ background: '#0284c7', color: '#fff', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={18} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                Application Email Dispatch History
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Review all formal job application emails sent through the platform ({emails.length} total)
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

        {/* 2-Pane Content */}
        <div style={{ display: 'grid', gridTemplateColumns: emails.length > 0 ? '320px 1fr' : '1fr', flex: 1, minHeight: 400, overflow: 'hidden' }}>
          {/* Left: Email List */}
          <div style={{ borderRight: '1px solid #e2e8f0', background: '#f8fafc', overflowY: 'auto', padding: '12px' }}>
            {emails.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No application emails recorded yet.
              </div>
            ) : (
              emails.map((item) => {
                const isSelected = selectedEmail?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedEmail(item)}
                    style={{
                      background: isSelected ? '#ffffff' : 'transparent',
                      border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                      boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                      borderRadius: 10,
                      padding: '12px',
                      marginBottom: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{item.companyName}</strong>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: item.deliveryStatus === 'failed' ? '#fee2e2' : '#dcfce7',
                          color: item.deliveryStatus === 'failed' ? '#b91c1c' : '#15803d',
                        }}
                      >
                        {item.deliveryStatus === 'failed' ? 'Failed' : 'Sent'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#475569', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.jobTitle}
                    </div>

                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      To: {item.recipientEmail}
                    </div>

                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: 4 }}>
                      {formatDateTime(item.sentAt)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Email Detail View */}
          <div style={{ padding: '24px', overflowY: 'auto', background: '#fff' }}>
            {selectedEmail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    {selectedEmail.subject}
                  </h3>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    Applying for: <strong>{selectedEmail.jobTitle}</strong> at <strong>{selectedEmail.companyName}</strong>
                  </div>
                </div>

                {/* Metadata Card */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Recipient:</span>{' '}
                    <strong style={{ color: '#0f172a' }}>{selectedEmail.recipientEmail}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Sender:</span>{' '}
                    <strong style={{ color: '#0f172a' }}>{selectedEmail.senderEmail}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Sent Date:</span>{' '}
                    <strong style={{ color: '#0f172a' }}>{formatDateTime(selectedEmail.sentAt)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Delivery Status:</span>{' '}
                    <strong style={{ color: selectedEmail.deliveryStatus === 'failed' ? '#dc2626' : '#16a34a' }}>
                      ● {selectedEmail.deliveryStatus.toUpperCase()}
                    </strong>
                  </div>
                </div>

                {/* Attachment note */}
                {selectedEmail.resumeName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#0369a1', background: '#e0f2fe', padding: '8px 12px', borderRadius: 8 }}>
                    <Paperclip size={14} /> Attached Resume: <strong>{selectedEmail.resumeName}</strong>
                  </div>
                )}

                {/* Message Body */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                    Dispatched Message Content
                  </label>
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '16px 18px',
                      fontSize: '13px',
                      lineHeight: 1.7,
                      color: '#1e293b',
                      whiteSpace: 'pre-wrap',
                      maxHeight: 320,
                      overflowY: 'auto',
                    }}
                  >
                    {selectedEmail.body}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Select an email from the left to view the complete dispatched message and delivery details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
