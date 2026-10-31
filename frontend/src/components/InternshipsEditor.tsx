import React, { useState } from 'react';
import { Award, Plus, Trash2, Edit2, Check, ExternalLink } from 'lucide-react';
import type { InternshipRecord } from '../types';

interface InternshipsEditorProps {
  internships: InternshipRecord[];
  onChange: (internships: InternshipRecord[]) => void;
}

export const InternshipsEditor: React.FC<InternshipsEditorProps> = ({ internships = [], onChange }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state
  const [role, setRole] = useState('');
  const [organization, setOrganization] = useState('');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');

  const resetForm = () => {
    setRole('');
    setOrganization('');
    setDuration('');
    setDescription('');
    setCertificateUrl('');
    setIsAdding(false);
    setEditingIndex(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (idx: number) => {
    const item = internships[idx];
    setRole(item.role);
    setOrganization(item.organization);
    setDuration(item.duration);
    setDescription(item.description);
    setCertificateUrl(item.certificateUrl || '');
    setEditingIndex(idx);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!role.trim() || !organization.trim()) {
      alert('Please provide both Internship Role and Organization.');
      return;
    }

    const record: InternshipRecord = {
      id: editingIndex !== null ? internships[editingIndex]?.id || `intern_${Date.now()}` : `intern_${Date.now()}`,
      role: role.trim(),
      organization: organization.trim(),
      duration: duration.trim(),
      description: description.trim(),
      certificateUrl: certificateUrl.trim() || undefined,
    };

    if (editingIndex !== null) {
      const updated = [...internships];
      updated[editingIndex] = record;
      onChange(updated);
    } else {
      onChange([...internships, record]);
    }
    resetForm();
  };

  const handleRemove = (idx: number) => {
    onChange(internships.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px', marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Award size={18} color="#0284c7" />
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            Internships & Practical Training
          </h4>
          <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
            {internships.length}
          </span>
        </div>
        {!isAdding && editingIndex === null && (
          <button
            type="button"
            onClick={handleStartAdd}
            style={{
              background: '#0284c7',
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
            <Plus size={14} /> Add Internship
          </button>
        )}
      </div>

      {/* Existing Internships List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {internships.map((item, idx) => (
          <div
            key={item.id || idx}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.role}</strong>
                <span style={{ fontSize: '13px', color: '#0284c7', fontWeight: 600 }}>@ {item.organization}</span>
                {item.duration && (
                  <span style={{ fontSize: '12px', color: '#64748b' }}>({item.duration})</span>
                )}
              </div>
              {item.description && (
                <p style={{ fontSize: '12px', color: '#334155', margin: '6px 0 0', lineHeight: 1.5 }}>
                  {item.description}
                </p>
              )}
              {item.certificateUrl && (
                <div style={{ marginTop: 6 }}>
                  <a
                    href={item.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '11px', color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
                  >
                    <ExternalLink size={11} /> Certificate Credential Link
                  </a>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => handleStartEdit(idx)}
                title="Edit internship"
                style={{ background: '#f1f5f9', border: 'none', padding: '6px', borderRadius: 6, cursor: 'pointer', color: '#475569' }}
              >
                <Edit2 size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                title="Delete internship"
                style={{ background: '#fee2e2', border: 'none', padding: '6px', borderRadius: 6, cursor: 'pointer', color: '#dc2626' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}

        {internships.length === 0 && !isAdding && (
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0', fontStyle: 'italic' }}>
            No internships added yet. Click "+ Add Internship" if you have practical training, apprentice work, or verified certificates.
          </p>
        )}
      </div>

      {/* Add / Edit Form */}
      {(isAdding || editingIndex !== null) && (
        <div style={{ background: '#ffffff', border: '1.5px solid #0284c7', borderRadius: 12, padding: '16px', marginTop: 14 }}>
          <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: '#0369a1' }}>
            {editingIndex !== null ? 'Edit Internship Record' : 'Add New Internship / Apprenticeship'}
          </h5>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Role / Position *</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Frontend Engineering Intern"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Company / Organization *</label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Global Tech Labs"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Duration / Dates</label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 6 Months (June 2023 – Dec 2023)"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Certificate / Credential Verification URL</label>
              <input
                type="url"
                value={certificateUrl}
                onChange={(e) => setCertificateUrl(e.target.value)}
                placeholder="https://verify.example.com/cert/12345"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Learnings, Responsibilities & Contributions</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Developed responsive UI components in React and assisted senior engineers in REST API integrations."
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px', lineHeight: 1.5 }}
            />
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
              style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Check size={14} /> Save Internship
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
