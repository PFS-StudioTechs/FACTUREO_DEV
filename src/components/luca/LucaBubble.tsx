import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Icon } from '@/components/ui/Icon';
import { LucaPanel } from './LucaPanel';
import { useLucaGreeting } from '@/hooks/useLucaGreeting';

const BUBBLE_SIZE = 56;
const POS_KEY = 'luca-bubble-pos';
const DRAG_THRESHOLD = 6;

export const LucaBubble = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const greetingState = useLucaGreeting();
  const autoOpenedRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const defaultPos = () => ({
    x: window.innerWidth - BUBBLE_SIZE - 24,
    y: window.innerHeight - BUBBLE_SIZE - (isMobile ? 72 : 24),
  });

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; dragging: boolean } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(POS_KEY);
    if (saved) {
      try { setPos(JSON.parse(saved)); return; } catch { /* ignore */ }
    }
    setPos(defaultPos());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reclamp si la fenêtre change de taille (rotation, redimensionnement).
  useEffect(() => {
    const onResize = () => {
      setPos(p => p ? {
        x: Math.min(p.x, window.innerWidth - BUBBLE_SIZE),
        y: Math.min(p.y, window.innerHeight - BUBBLE_SIZE),
      } : p);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Ouverture proactive une fois par session, quand l'accueil de Luca est prêt.
  useEffect(() => {
    if (!user || autoOpenedRef.current || !greetingState.greeting) return;
    const key = `luca-bubble-auto-opened-${user.id}`;
    if (sessionStorage.getItem(key)) return;
    autoOpenedRef.current = true;
    sessionStorage.setItem(key, '1');
    setOpen(true);
  }, [user, greetingState.greeting]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!pos) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y, dragging: false };
    btnRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.dragging = true;
    const x = Math.max(8, Math.min(window.innerWidth - BUBBLE_SIZE - 8, drag.originX + dx));
    const y = Math.max(8, Math.min(window.innerHeight - BUBBLE_SIZE - 8, drag.originY + dy));
    setPos({ x, y });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    btnRef.current?.releasePointerCapture(e.pointerId);
    if (drag?.dragging) {
      setPos(p => {
        if (p) localStorage.setItem(POS_KEY, JSON.stringify(p));
        return p;
      });
    } else {
      setOpen(o => !o);
    }
  };

  if (!pos) return null;

  return (
    <>
      <button
        ref={btnRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-label="Ouvrir Luca (glisser pour déplacer)"
        style={{
          position: 'fixed',
          left: pos.x, top: pos.y,
          zIndex: 997,
          width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: '50%',
          background: 'var(--ai)', color: 'var(--ai-on)',
          border: 'none', cursor: 'grab', padding: 0, overflow: 'hidden',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--ai-glow), var(--shadow-3)',
          touchAction: 'none', userSelect: 'none',
        }}
      >
        {open ? (
          <Icon name="x" size={22} />
        ) : (
          <img src="/Avatar Luca.png" alt="Luca" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        )}
      </button>
      <LucaPanel open={open} onClose={() => setOpen(false)} greeting={greetingState} />
    </>
  );
};
