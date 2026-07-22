import React, { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Icon } from '@/components/ui/Icon';
import { LucaPanel } from './LucaPanel';

export const LucaBubble = () => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Ouvrir Luca"
        style={{
          position: 'fixed',
          right: 24,
          bottom: isMobile ? 72 : 24,
          zIndex: 997,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--accent)', color: 'var(--accent-on)',
          border: 'none', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-accent), var(--shadow-3)',
          transition: 'transform 160ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
      >
        <Icon name={open ? 'x' : 'sparkle'} size={22} />
      </button>
      <LucaPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
};
