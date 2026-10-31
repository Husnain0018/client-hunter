import React, { useState } from 'react';
import { ShieldCheck, Plus, Trash2, Edit2, Check, ExternalLink } from 'lucide-react';
import type { CertificationRecord } from '../types';

interface CertificationsEditorProps {
  certifications: Array<CertificationRecord | string>;
  onChange: (certifications: Array<CertificationRecord | string>) => void;
}

export const CertificationsEditor: React.FC<CertificationsEditorProps> = ({ certifications = [], onChange }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [date, setDate] = useState('');
  const [url, setUrl] = useState('');

  const resetForm = () => {
    setName('');
    setIssuer('');
    setDate('');
    setUrl('');
    setIsAdding(false);
    setEditingIndex(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (idx: number) => {
    const item = certifications[idx];
    if (typeof item === 'string') {
      setName(item);
      setIssuer('');
      setDate('');
      setUrl('');
    } else {
      setName(item.name);
      setIssuer(item.issuer || '');
      setDate(item.date || '');
      setUrl(item.url || '');
    }
    setEditingIndex(idx);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please provide Certification Name.');
      return;
    }

    const record: CertificationRecord = {
      id: `cert_${Date.now()}`,
      name: name.trim(),
      issuer: issuer.trim() || undefined,
      date: date.trim() || undefined,
      url: url.trim() || undefined,
    };

    if (editingIndex !== null) {
      const updated = [...certifications];
      updated[editingIndex] = record;
      onChange(updated);
    } else {
      onChange([...certifications, record]);
    }
    resetForm();
  };

  const handleRemove = (idx: number) => {
    onChange(certifications.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px', marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={18} color="#0891b2" />
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            Certifications & Industry Credentials
          </h4>
          <span style={{ fontSize: '11px', background: '#cffafe', color: '#0e7490', fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
            {certifications.length}
          </span>
        </div>
        {!isAdding && editingIndex === null && (
          <button
            type="button"
            onClick={handleStartAdd}
            style={{
              background: '#0891b2',
              color: '#fff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus size={14} /> Add Certification
          </button>
        )}
      </div>

      {/* Certifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {certifications.map((item, idx) => {
          const certName = typeof item === 'string' ? item : item.name;
          const certIssuer = typeof item === 'string' ? undefined : item.issuer;
          const certDate = typeof item === 'string' ? undefined : item.date;
          const certUrl = typeof item === 'string' ? undefined : item.url;

          return (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '13px', color: '#0f172a' }}>{certName}</strong>
                  {certIssuer && <span style={{ fontSize: '12px', color: '#0891b2', fontWeight: 600 }}>— {certIssuer}</span>}
                  {certDate && <span style={{ fontSize: '11px', color: '#64748b' }}>({certDate})</span>}
                  {certUrl && (
                    <a href={certUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <ExternalLink size={11} /> Verify
                    </a>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => handleStartEdit(idx)}
                  title="Edit certification"
                  style={{ background: '#f1f5f9', border: 'none', padding: '6px', borderRadius: 6, cursor: 'pointer', color: '#475569' }}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  title="Delete certification"
                  style={{ background: '#fee2e2', border: 'none', padding: '6px', borderRadius: 6, cursor: 'pointer', color: '#dc2626' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}

        {certifications.length === 0 && !isAdding && (
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0', fontStyle: 'italic' }}>
            No certifications added yet. Click "+ Add Certification" to list your professional qualifications.
          </p>
        )}
      </div>

      {/* Add / Edit Form */}
      {(isAdding || editingIndex !== null) && (
        <div style={{ background: '#ffffff', border: '1.5px solid #0891b2', borderRadius: 12, padding: '16px', marginTop: 14 }}>
          <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: '#0e7490' }}>
            {editingIndex !== null ? 'Edit Certification' : 'Add New Certification'}
          </h5>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Certification Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AWS Certified Solutions Architect"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Issuing Organization</label>
              <input
                type="text"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="e.g. Amazon Web Services / Google Cloud"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Issue Date / Year</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="e.g. 2023 or Oct 2023"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Credential URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://credly.com/badges/..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={resetForm}
              style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: 6, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{ background: '#0891b2', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Check size={14} /> Save Certification
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
