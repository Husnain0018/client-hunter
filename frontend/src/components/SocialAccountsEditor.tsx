import React, { useState } from 'react';
import { Plus, X, ExternalLink, Globe, Edit2, Check, AlertCircle } from 'lucide-react';
import type { SocialAccount, SocialPlatform } from '../types';

interface SocialAccountsEditorProps {
  accounts: SocialAccount[];
  onChange: (accounts: SocialAccount[]) => void;
}

const PLATFORM_OPTIONS: SocialPlatform[] = [
  'LinkedIn',
  'GitHub',
  'GitLab',
  'Portfolio',
  'Website',
  'X (Twitter)',
  'Instagram',
  'Behance',
  'Dribbble',
  'Other',
];

export const SocialAccountsEditor: React.FC<SocialAccountsEditorProps> = ({ accounts = [], onChange }) => {
  const [platform, setPlatform] = useState<SocialPlatform>('LinkedIn');
  const [customPlatform, setCustomPlatform] = useState('');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');

  const validateUrl = (raw: string): boolean => {
    let testUrl = raw.trim();
    if (!testUrl) return false;
    if (!/^https?:\/\//i.test(testUrl)) {
      testUrl = `https://${testUrl}`;
    }
    try {
      const parsed = new URL(testUrl);
      return Boolean(parsed.hostname && parsed.hostname.includes('.'));
    } catch {
      return false;
    }
  };

  const handleAdd = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setUrlError(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError('Please enter a profile or portfolio URL.');
      return;
    }

    if (!validateUrl(trimmed)) {
      setUrlError('Please enter a valid URL (e.g. https://linkedin.com/in/yourname or github.com/username).');
      return;
    }

    let finalUrl = trimmed;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }

    const newAccount: SocialAccount = {
      id: `soc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      platform,
      customPlatform: platform === 'Other' ? customPlatform.trim() || 'Custom Profile' : undefined,
      url: finalUrl,
    };

    onChange([...accounts, newAccount]);
    setUrl('');
    setCustomPlatform('');
  };

  const handleRemove = (id: string) => {
    onChange(accounts.filter((a) => a.id !== id));
  };

  const startEdit = (acc: SocialAccount) => {
    setEditingId(acc.id);
    setEditUrl(acc.url);
  };

  const saveEdit = (id: string) => {
    const trimmed = editUrl.trim();
    if (!validateUrl(trimmed)) {
      alert('Please enter a valid URL format.');
      return;
    }
    let finalUrl = trimmed;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }
    onChange(accounts.map((a) => (a.id === id ? { ...a, url: finalUrl } : a)));
    setEditingId(null);
    setEditUrl('');
  };

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Globe size={18} color="#2563eb" />
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
          Social Media & Professional Networking Accounts
        </h4>
      </div>
      <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px', lineHeight: 1.4 }}>
        Add your professional profile links (LinkedIn, GitHub, Portfolio, Behance, etc.). These verified links are supplied to the AI when generating targeted resumes, tailored cover letters, and email applications. (Optional)
      </p>

      {/* Add New Account Controls (type="button" to prevent nested form submissions) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ minWidth: 140 }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: 4 }}>Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
          >
            {PLATFORM_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {platform === 'Other' && (
          <div style={{ minWidth: 130 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: 4 }}>Custom Name</label>
            <input
              type="text"
              value={customPlatform}
              onChange={(e) => setCustomPlatform(e.target.value)}
              placeholder="e.g. Medium, Substack"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
            />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: 4 }}>Profile or Portfolio URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            placeholder="e.g. https://linkedin.com/in/yourname or github.com/username"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: urlError ? '1px solid #ef4444' : '1px solid #cbd5e1', fontSize: '12px' }}
          />
          {urlError && (
            <div style={{ color: '#ef4444', fontSize: '11px', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={12} /> {urlError}
            </div>
          )}
        </div>

        <div style={{ paddingTop: 20 }}>
          <button
            type="button"
            onClick={handleAdd}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus size={14} /> Add Account
          </button>
        </div>
      </div>

      {/* List of Configured Accounts */}
      {accounts.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '14px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
          No social or professional accounts linked yet. Use the form above to add your LinkedIn, GitHub, or Portfolio.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {accounts.map((acc) => {
            const isEditing = editingId === acc.id;
            return (
              <div
                key={acc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: '12px',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{
                    background: '#e0e7ff',
                    color: '#3730a3',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                  }}>
                    {acc.platform === 'Other' && acc.customPlatform ? acc.customPlatform : acc.platform}
                  </span>

                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <input
                        type="text"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        style={{ flex: 1, padding: '4px 8px', fontSize: '12px', border: '1px solid #3b82f6', borderRadius: 4 }}
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(acc.id)}
                        style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                      >
                        <Check size={12} /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        style={{ background: '#e2e8f0', color: '#64748b', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <a
                      href={acc.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {acc.url} <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {!isEditing && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => startEdit(acc)}
                      title="Edit URL"
                      style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2 }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(acc.id)}
                      title="Remove Account"
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
