import React, { useState } from 'react';
import { GraduationCap, Plus, Trash2, Edit2, Check } from 'lucide-react';
import type { EducationRecord } from '../types';

interface EducationEditorProps {
  education: EducationRecord[];
  onChange: (education: EducationRecord[]) => void;
}

export const EducationEditor: React.FC<EducationEditorProps> = ({ education = [], onChange }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state
  const [degree, setDegree] = useState('');
  const [field, setField] = useState('');
  const [institution, setInstitution] = useState('');
  const [year, setYear] = useState('');
  const [gpa, setGpa] = useState('');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setDegree('');
    setField('');
    setInstitution('');
    setYear('');
    setGpa('');
    setDescription('');
    setIsAdding(false);
    setEditingIndex(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (idx: number) => {
    const item = education[idx];
    setDegree(item.degree);
    setField(item.field);
    setInstitution(item.institution);
    setYear(item.year);
    setGpa(item.gpa || '');
    setDescription(item.description || '');
    setEditingIndex(idx);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!institution.trim() || !degree.trim()) {
      alert('Please provide Degree and Institution name.');
      return;
    }

    const record: EducationRecord = {
      id: editingIndex !== null ? education[editingIndex]?.id || `edu_${Date.now()}` : `edu_${Date.now()}`,
      degree: degree.trim(),
      field: field.trim(),
      institution: institution.trim(),
      year: year.trim(),
      gpa: gpa.trim() || undefined,
      description: description.trim() || undefined,
    };

    if (editingIndex !== null) {
      const updated = [...education];
      updated[editingIndex] = record;
      onChange(updated);
    } else {
      onChange([...education, record]);
    }
    resetForm();
  };

  const handleRemove = (idx: number) => {
    onChange(education.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px', marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GraduationCap size={18} color="#059669" />
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            Education & Academic Background
          </h4>
          <span style={{ fontSize: '11px', background: '#d1fae5', color: '#065f46', fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
            {education.length}
          </span>
        </div>
        {!isAdding && editingIndex === null && (
          <button
            type="button"
            onClick={handleStartAdd}
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
              gap: 4,
            }}
          >
            <Plus size={14} /> Add Education
          </button>
        )}
      </div>

      {/* Existing Education Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {education.map((item, idx) => (
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
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                  {[item.degree, item.field].filter(Boolean).join(' in ')}
                </strong>
                <span style={{ fontSize: '13px', color: '#059669', fontWeight: 600 }}>@ {item.institution}</span>
                {item.year && <span style={{ fontSize: '12px', color: '#64748b' }}>({item.year})</span>}
                {item.gpa && <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', fontWeight: 600, padding: '1px 6px', borderRadius: 4 }}>GPA: {item.gpa}</span>}
              </div>
              {item.description && (
                <p style={{ fontSize: '12px', color: '#334155', margin: '6px 0 0', lineHeight: 1.5 }}>
                  {item.description}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => handleStartEdit(idx)}
                title="Edit education"
                style={{ background: '#f1f5f9', border: 'none', padding: '6px', borderRadius: 6, cursor: 'pointer', color: '#475569' }}
              >
                <Edit2 size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                title="Delete education"
                style={{ background: '#fee2e2', border: 'none', padding: '6px', borderRadius: 6, cursor: 'pointer', color: '#dc2626' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}

        {education.length === 0 && !isAdding && (
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0', fontStyle: 'italic' }}>
            No education entries added. Click "+ Add Education" to add your degree or academic milestones.
          </p>
        )}
      </div>

      {/* Add / Edit Form */}
      {(isAdding || editingIndex !== null) && (
        <div style={{ background: '#ffffff', border: '1.5px solid #059669', borderRadius: 12, padding: '16px', marginTop: 14 }}>
          <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: '#065f46' }}>
            {editingIndex !== null ? 'Edit Education Entry' : 'Add New Academic Degree'}
          </h5>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Degree Level *</label>
              <input
                type="text"
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                placeholder="e.g. Bachelor of Science / Master of Science"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Field of Study</label>
              <input
                type="text"
                value={field}
                onChange={(e) => setField(e.target.value)}
                placeholder="e.g. Computer Science / Software Engineering"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Institution / University *</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. University of Engineering and Technology"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Graduation Year</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2021"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>GPA / Honors (Optional)</label>
              <input
                type="text"
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
                placeholder="e.g. 3.8 / 4.0 or Dean's Honor Roll"
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
              style={{ background: '#059669', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Check size={14} /> Save Education
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
