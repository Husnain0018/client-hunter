import React, { useState } from 'react';
import { Plus, X, Edit2, Check } from 'lucide-react';

interface MultiItemEditorProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  helperText?: string;
  description?: string;
  badgeColor?: string;
}

export const MultiItemEditor: React.FC<MultiItemEditorProps> = ({
  label,
  items,
  onChange,
  placeholder = 'Type and press Enter or click Add...',
  helperText,
  description,
  badgeColor = '#e0e7ff',
}) => {
  const [draft, setDraft] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const displayHelper = helperText || description;

  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!draft.trim()) return;

    // Support comma-separated items if user pastes or types "React, TypeScript"
    const newItems = draft
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !items.includes(s));

    if (newItems.length > 0) {
      onChange([...items, ...newItems]);
    }
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleRemoveItem = (indexToRemove: number) => {
    const updated = items.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
    if (editingIndex === indexToRemove) {
      setEditingIndex(null);
      setEditingValue('');
    }
  };

  const startEditing = (idx: number) => {
    setEditingIndex(idx);
    setEditingValue(items[idx]);
  };

  const saveEditing = (idx: number) => {
    const trimmed = editingValue.trim();
    if (trimmed) {
      const updated = [...items];
      updated[idx] = trimmed;
      onChange(updated);
    }
    setEditingIndex(null);
    setEditingValue('');
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
        {label}
      </label>

      {/* Input Row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            fontSize: '13px',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => handleAddItem()}
          disabled={!draft.trim()}
          style={{
            background: draft.trim() ? '#2563eb' : '#94a3b8',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.15s ease',
          }}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {displayHelper && (
        <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: 8 }}>
          {displayHelper}
        </span>
      )}

      {/* Pills Container */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 32 }}>
        {items.length === 0 ? (
          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>
            No entries added yet. Type an entry above and press Enter.
          </span>
        ) : (
          items.map((item, idx) => (
            <div
              key={`${item}-${idx}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: badgeColor,
                color: '#1e293b',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              {editingIndex === idx ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveEditing(idx);
                      } else if (e.key === 'Escape') {
                        setEditingIndex(null);
                      }
                    }}
                    autoFocus
                    style={{
                      padding: '2px 6px',
                      fontSize: '12px',
                      borderRadius: 4,
                      border: '1px solid #3b82f6',
                      width: 140,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => saveEditing(idx)}
                    title="Save"
                    style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, padding: 2, cursor: 'pointer', display: 'flex' }}
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIndex(null)}
                    title="Cancel"
                    style={{ background: '#e2e8f0', color: '#64748b', border: 'none', borderRadius: 4, padding: 2, cursor: 'pointer', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <span>{item}</span>
                  <button
                    type="button"
                    onClick={() => startEditing(idx)}
                    title="Edit entry"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    title="Remove entry"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={13} />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
