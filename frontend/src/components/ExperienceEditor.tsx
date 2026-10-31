import React, { useState } from 'react';
import { Briefcase, Plus, Trash2, Edit2, Check, X, Calendar, MapPin } from 'lucide-react';
import type { ExperienceRecord } from '../types';

interface ExperienceEditorProps {
  experience: ExperienceRecord[];
  onChange: (experience: ExperienceRecord[]) => void;
}

export const ExperienceEditor: React.FC<ExperienceEditorProps> = ({ experience = [], onChange }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [current, setCurrent] = useState(false);
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setTitle('');
    setCompany('');
    setLocation('');
    setStartDate('');
    setEndDate('');
    setCurrent(false);
    setDescription('');
    setIsAdding(false);
    setEditingIndex(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (idx: number) => {
    const item = experience[idx];
    setTitle(item.title);
    setCompany(item.company);
    setLocation(item.location || '');
    setStartDate(item.startDate);
    setEndDate(item.endDate || '');
    setCurrent(Boolean(item.current));
    setDescription(item.description || '');
    setEditingIndex(idx);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!title.trim() || !company.trim()) {
      alert('Please provide both Job Title and Company.');
      return;
    }

    const record: ExperienceRecord = {
      id: editingIndex !== null ? experience[editingIndex]?.id || `exp_${Date.now()}` : `exp_${Date.now()}`,
      title: title.trim(),
      company: company.trim(),
      location: location.trim() || undefined,
      startDate: startDate.trim(),
      endDate: current ? 'Present' : (endDate.trim() || undefined),
      current,
      description: description.trim(),
    };

    if (editingIndex !== null) {
      const updated = [...experience];
      updated[editingIndex] = record;
      onChange(updated);
    } else {
      onChange([...experience, record]);
    }
    resetForm();
  };

  const handleRemove = (idx: number) => {
    onChange(experience.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px', marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Briefcase size={18} color="#2563eb" />
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            Professional Work Experience
          </h4>
          <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
            {experience.length}
          </span>
        </div>
        {!isAdding && editingIndex === null && (
          <button
            type="button"
            onClick={handleStartAdd}
            style={{
              background: '#2563eb',
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
            <Plus size={14} /> Add Role
          </button>
        )}
      </div>

      {/* Existing Experience Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {experience.map((item, idx) => (
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
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.title}</strong>
                <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600 }}>@ {item.company}</span>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: '12px', color: '#64748b', marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={13} /> {item.startDate} – {item.current ? 'Present' : item.endDate || 'Present'}
                </span>
                {item.location && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={13} /> {item.location}
                  </span>
                )}
              </div>
              {item.description && (
                <p style={{ fontSize: '12px', color: '#334155', margin: '8px 0 0', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {item.description}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => handleStartEdit(idx)}
                title="Edit role"
                style={{ background: '#f1f5f9', border: 'none', padding: '6px', borderRadius: 6, cursor: 'pointer', color: '#475569' }}
              >
                <Edit2 size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                title="Delete role"
                style={{ background: '#fee2e2', border: 'none', padding: '6px', borderRadius: 6, cursor: 'pointer', color: '#dc2626' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}

        {experience.length === 0 && !isAdding && (
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0', fontStyle: 'italic' }}>
            No prior experience added yet. Click "+ Add Role" to include your career history.
          </p>
        )}
      </div>

      {/* Add / Edit Form Modal/Drawer */}
      {(isAdding || editingIndex !== null) && (
        <div style={{ background: '#ffffff', border: '1.5px solid #3b82f6', borderRadius: 12, padding: '16px', marginTop: 14 }}>
          <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: '#1e3a8a' }}>
            {editingIndex !== null ? 'Edit Experience Role' : 'Add New Work Experience'}
          </h5>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Job Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Full Stack Engineer"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Company / Organization *</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Cloud Corp"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Remote / New York, NY"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Start Date</label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="e.g. Jan 2022 or 2022"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>End Date</label>
                <label style={{ fontSize: '11px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={current}
                    onChange={(e) => setCurrent(e.target.checked)}
                  /> Currently Working Here
                </label>
              </div>
              <input
                type="text"
                disabled={current}
                value={current ? 'Present' : endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="e.g. Dec 2023 or Present"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px', background: current ? '#f1f5f9' : '#fff' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Key Responsibilities & Quantifiable Achievements</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="- Architected high-throughput REST APIs handling 100k+ requests/day&#10;- Mentored junior engineers and raised sprint delivery velocity"
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
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Check size={14} /> Save Role
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
