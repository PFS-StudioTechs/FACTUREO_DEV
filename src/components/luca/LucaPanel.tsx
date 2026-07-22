import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLucaConversation } from '@/hooks/useLucaConversation';
import { Icon } from '@/components/ui/Icon';
import { LucaMessage } from './LucaMessage';

interface LucaPanelProps {
  open: boolean;
  onClose: () => void;
}

export const LucaPanel = ({ open, onClose }: LucaPanelProps) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { messages, sendMessage, loading, sending } = useLucaConversation();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  if (!open) return null;

  const handleSend = () => {
    if (!input.trim() || sending) return;
    const text = input;
    setInput('');
    sendMessage(text, location.pathname);
  };

  return (
    <>
      {isMobile && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,0.4)' }}
        />
      )}
      <div style={isMobile ? {
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'var(--bg-2)', display: 'flex', flexDirection: 'column',
      } : {
        position: 'fixed', bottom: 88, right: 24, zIndex: 999,
        width: 380, height: 560, maxHeight: 'calc(100vh - 120px)',
        background: 'var(--bg-2)', border: '1px solid var(--border-strong)',
        borderRadius: 'var(--r-5)', boxShadow: 'var(--shadow-3), var(--accent-glow)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slide-in-up 220ms cubic-bezier(.2,.7,.3,1) backwards',
      }}>
        {/* Header */}
        <div style={{
          padding: isMobile ? '14px 16px' : '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent-soft)', color: 'var(--accent-bright)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="sparkle" size={15} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>Luca</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Assistant compta &amp; finance</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: isMobile ? 44 : 32, height: isMobile ? 44 : 32, borderRadius: 'var(--r-3)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-3)', border: '1px solid var(--border-subtle)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>Chargement…</div>
          ) : messages.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', padding: 24, lineHeight: 1.6 }}>
              Salut, je suis Luca. Pose-moi une question sur ta compta, tes factures, ou demande-moi de t'en créer une.
            </div>
          ) : (
            messages.map(m => <LucaMessage key={m.id} message={m} />)
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: isMobile ? '10px 16px' : '10px 14px',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Écris à Luca…"
            style={{
              flex: 1, height: 40, padding: '0 12px',
              background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-3)',
              color: 'var(--text-1)', fontSize: isMobile ? 16 : 13, outline: 0,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: 'var(--r-3)', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--accent)', color: 'var(--accent-on)', border: 'none',
              cursor: (!input.trim() || sending) ? 'not-allowed' : 'pointer',
              opacity: (!input.trim() || sending) ? 0.5 : 1,
            }}
          >
            <Icon name="send" size={16} />
          </button>
        </div>
      </div>
    </>
  );
};
