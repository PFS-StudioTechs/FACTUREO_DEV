import React from 'react';
import { Icon } from '@/components/ui/Icon';

interface ExpenseUploadProps {
  onClick: () => void;
  uploading?: boolean;
}

export const ExpenseUpload = ({ onClick, uploading }: ExpenseUploadProps) => (
  <div
    onClick={uploading ? undefined : onClick}
    style={{
      border: '2px dashed var(--border-accent)',
      borderRadius: 'var(--r-4)',
      background: 'var(--accent-soft)',
      padding: '32px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      cursor: uploading ? 'not-allowed' : 'pointer',
      opacity: uploading ? 0.6 : 1,
      transition: 'background 160ms ease',
    }}
    onMouseEnter={e => { if (!uploading) e.currentTarget.style.background = 'var(--bg-3)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-soft)'; }}
  >
    <div style={{
      width: 48, height: 48, borderRadius: 'var(--r-4)',
      background: 'var(--bg-2)', border: '1px solid var(--border-accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={uploading ? 'refresh' : 'download'} size={22} color="var(--accent-bright)" />
    </div>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>
        {uploading ? 'Upload en cours…' : 'Glisse tes tickets ici'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
        ou clique pour prendre une photo
      </div>
    </div>
  </div>
);
