import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, Trash2, CheckCircle2, User } from 'lucide-react';

interface CandidatePhotoEditorProps {
  photoUrl: string;
  includePhotoInResume: boolean;
  fullName: string;
  onChangePhoto: (url: string) => void;
  onChangeIncludeInResume: (include: boolean) => void;
}

export const CandidatePhotoEditor: React.FC<CandidatePhotoEditorProps> = ({
  photoUrl,
  includePhotoInResume,
  fullName,
  onChangePhoto,
  onChangeIncludeInResume,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result !== 'string') {
          resolve('');
          return;
        }
        const img = new Image();
        img.onload = () => {
          const MAX_SIZE = 600;
          let { width, height } = img;
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.88);
          resolve(compressed);
        };
        img.onerror = () => resolve(result);
        img.src = result;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, or WEBP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert('Image file is too large. Please select an image under 15MB.');
      return;
    }

    try {
      const compressedDataUrl = await compressImage(file);
      if (compressedDataUrl) {
        onChangePhoto(compressedDataUrl);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onChangePhoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = (name: string) => {
    return (name || 'Candidate')
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px', marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Camera size={18} color="#2563eb" />
        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
          Candidate Professional Photograph
        </h4>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        {/* Avatar Preview */}
        <div style={{ position: 'relative' }}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={fullName || 'Candidate Photo'}
              style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid #3b82f6',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
              }}
            />
          ) : (
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 800,
                color: '#64748b',
                border: '2px dashed #94a3b8',
              }}
            >
              {getInitials(fullName)}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/png, image/jpeg, image/webp"
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '7px 14px',
                borderRadius: 6,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ImageIcon size={14} /> Upload Photograph
            </button>
            {photoUrl && (
              <button
                type="button"
                onClick={() => onChangePhoto('')}
                style={{
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: 'none',
                  padding: '7px 12px',
                  borderRadius: 6,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Trash2 size={13} /> Remove Photo
              </button>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: 2 }}>Or enter photo image URL:</label>
            <input
              type="url"
              value={photoUrl.startsWith('data:') ? '' : photoUrl}
              onChange={(e) => onChangePhoto(e.target.value)}
              placeholder="https://example.com/my-photo.jpg"
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
            />
          </div>

          {/* Toggle for inclusion in resumes */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12px', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={includePhotoInResume}
              onChange={(e) => onChangeIncludeInResume(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            Include professional photograph in generated ATS resumes & preview layouts
          </label>
        </div>
      </div>
    </div>
  );
};
