import React, { useState } from 'react';
import { Languages, Plus, Trash2, Edit2, Check } from 'lucide-react';
import type { LanguageRecord } from '../types';

interface LanguagesEditorProps {
  languages: Array<LanguageRecord | string>;
  onChange: (languages: Array<LanguageRecord | string>) => void;
}

const PROFICIENCIES: Array<LanguageRecord['proficiency']> = [
  'Native',
  'Fluent',
  'Professional',
  'Intermediate',
  'Basic',
];

export const LanguagesEditor: React.FC<LanguagesEditorProps> = ({ languages = [], onChange }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [languageName, setLanguageName] = useState('');
  const [proficiency, setProficiency] = useState<LanguageRecord['proficiency']>('Professional');

  const handleAdd = () => {
    if (!languageName.trim()) {
      alert('Please enter a language name.');
      return;
    }

    const record: LanguageRecord = {
      language: languageName.trim(),
      proficiency,
    };

    onChange([...languages, record]);
    setLanguageName('');
    setProficiency('Professional');
    setIsAdding(false);
  };

  const handleRemove = (idx: number) => {
    onChange(languages.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px', marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Languages size={18} color="#d97706" />
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            Languages & Fluency
          </h4>
          <span style={{ fontSize: '11px', background: '#fef3c7', color: '#b45309', fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
            {languages.length}
          </span>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            style={{
              background: '#d97706',
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
            <Plus size={14} /> Add Language
          </button>
        )}
      </div>

      {/* Languages List */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {languages.map((item, idx) => {
          const lang = typeof item === 'string' ? item : item.language;
          const prof = typeof item === 'string' ? 'Proficient' : item.proficiency;

          return (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 999,
                padding: '6px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '12px',
              }}
            >
              <strong style={{ color: '#0f172a' }}>{lang}</strong>
              <span style={{ color: '#d97706', fontSize: '11px', fontWeight: 600 }}>({prof})</span>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                title="Remove language"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#94a3b8' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}

        {languages.length === 0 && !isAdding && (
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0', fontStyle: 'italic' }}>
            No languages specified. Click "+ Add Language" to indicate spoken/written competencies.
          </p>
        )}
      </div>

      {isAdding && (
        <div style={{ background: '#ffffff', border: '1.5px solid #d97706', borderRadius: 12, padding: '14px', marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Language Name *</label>
            <input
              type="text"
              value={languageName}
              onChange={(e) => setLanguageName(e.target.value)}
              placeholder="e.g. English, German, Urdu, Arabic"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
            />
          </div>

          <div style={{ minWidth: 140 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Proficiency</label>
            <select
              value={proficiency}
              onChange={(e) => setProficiency(e.target.value as any)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
            >
              {PROFICIENCIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 6, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              style={{ background: '#d97706', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Check size={14} /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
