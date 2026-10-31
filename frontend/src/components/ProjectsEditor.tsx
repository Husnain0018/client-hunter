import React, { useState } from 'react';
import { FolderGit2, Plus, Trash2, Edit2, Check, ExternalLink } from 'lucide-react';
import type { ProjectRecord } from '../types';

interface ProjectsEditorProps {
  projects: ProjectRecord[];
  onChange: (projects: ProjectRecord[]) => void;
}

export const ProjectsEditor: React.FC<ProjectsEditorProps> = ({ projects = [], onChange }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [techInput, setTechInput] = useState('');
  const [link, setLink] = useState('');
  const [repoUrl, setRepoUrl] = useState('');

  const resetForm = () => {
    setName('');
    setDescription('');
    setTechInput('');
    setLink('');
    setRepoUrl('');
    setIsAdding(false);
    setEditingIndex(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (idx: number) => {
    const item = projects[idx];
    setName(item.name);
    setDescription(item.description);
    setTechInput((item.technologies || []).join(', '));
    setLink(item.link || '');
    setRepoUrl(item.repoUrl || '');
    setEditingIndex(idx);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please provide a Project Name.');
      return;
    }

    const techList = techInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const record: ProjectRecord = {
      id: editingIndex !== null ? projects[editingIndex]?.id || `proj_${Date.now()}` : `proj_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      technologies: techList,
      link: link.trim() || undefined,
      repoUrl: repoUrl.trim() || undefined,
    };

    if (editingIndex !== null) {
      const updated = [...projects];
      updated[editingIndex] = record;
      onChange(updated);
    } else {
      onChange([...projects, record]);
    }
    resetForm();
  };

  const handleRemove = (idx: number) => {
    onChange(projects.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px', marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FolderGit2 size={18} color="#7c3aed" />
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            Featured Software & Technical Projects
          </h4>
          <span style={{ fontSize: '11px', background: '#f3e8ff', color: '#6b21a8', fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
            {projects.length}
          </span>
        </div>
        {!isAdding && editingIndex === null && (
          <button
            type="button"
            onClick={handleStartAdd}
            style={{
              background: '#7c3aed',
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
            <Plus size={14} /> Add Project
          </button>
        )}
      </div>

      {/* Projects List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {projects.map((item, idx) => (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.name}</strong>
                {item.link && (
                  <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <ExternalLink size={11} /> Live Demo
                  </a>
                )}
                {item.repoUrl && (
                  <a href={item.repoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <ExternalLink size={11} /> Code
                  </a>
                )}
              </div>
              {item.technologies && item.technologies.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {item.technologies.map((t, i) => (
                    <span key={i} style={{ background: '#f1f5f9', color: '#475569', fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: 4 }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
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
                title="Edit project"
                style={{ background: '#f1f5f9', border: 'none', padding: '6px', borderRadius: 6, cursor: 'pointer', color: '#475569' }}
              >
                <Edit2 size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                title="Delete project"
                style={{ background: '#fee2e2', border: 'none', padding: '6px', borderRadius: 6, cursor: 'pointer', color: '#dc2626' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}

        {projects.length === 0 && !isAdding && (
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0', fontStyle: 'italic' }}>
            No projects added. Click "+ Add Project" to highlight your key engineering builds, open-source work, or portfolio items.
          </p>
        )}
      </div>

      {/* Add / Edit Form */}
      {(isAdding || editingIndex !== null) && (
        <div style={{ background: '#ffffff', border: '1.5px solid #7c3aed', borderRadius: 12, padding: '16px', marginTop: 14 }}>
          <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: '#5b21b6' }}>
            {editingIndex !== null ? 'Edit Project' : 'Add New Project'}
          </h5>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Project Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Distributed Task Queue"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Technologies (comma-separated)</label>
              <input
                type="text"
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                placeholder="e.g. TypeScript, Redis, Node.js, Docker"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Live Demo URL</label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://myproject.app"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>GitHub / Repo URL</label>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/project"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Description & Impact</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Built an asynchronous message queue worker reducing background task latency by 45%."
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
              style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Check size={14} /> Save Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
