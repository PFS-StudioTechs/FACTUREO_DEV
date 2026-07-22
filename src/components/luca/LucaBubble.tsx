import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Icon } from '@/components/ui/Icon';
import { LucaPanel } from './LucaPanel';
import { useLucaGreeting } from '@/hooks/useLucaGreeting';

export const LucaBubble = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const greetingState = useLucaGreeting();
  const autoOpenedRef = useRef(false);

  // Ouverture proactive une fois par session, quand l'accueil de Luca est prêt.
  useEffect(() => {
    if (!user || autoOpenedRef.current || !greetingState.greeting) return;
    const key = `luca-bubble-auto-opened-${user.id}`;
    if (sessionStorage.getItem(key)) return;
    autoOpenedRef.current = true;
    sessionStorage.setItem(key, '1');
    setOpen(true);
  }, [user, greetingState.greeting]);

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
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--accent)', color: 'var(--accent-on)',
          border: 'none', cursor: 'pointer', padding: 0, overflow: 'hidden',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-accent), var(--shadow-3)',
          transition: 'transform 160ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
      >
        {open ? (
          <Icon name="x" size={22} />
        ) : (
          <img src="/luca-avatar.png" alt="Luca" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </button>
      <LucaPanel open={open} onClose={() => setOpen(false)} greeting={greetingState} />
    </>
  );
};
