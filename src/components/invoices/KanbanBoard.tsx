import React, { useRef, useState } from 'react';
import { InvoiceCard } from './InvoiceCard';
import { useIsMobile } from '@/hooks/use-mobile';

type Status = 'draft' | 'sent' | 'late' | 'paid';

const today = new Date(); today.setHours(0, 0, 0, 0);

function getStatus(inv: any): Status {
  if (!inv.status || inv.status === 'brouillon') return 'draft';
  if (inv.status === 'payée') return 'paid';
  const due = inv.date_limite_paiement ? new Date(inv.date_limite_paiement) : null;
  return (due && due < today) ? 'late' : 'sent';
}

const STATUS_TO_DB: Record<Status, string> = {
  draft: 'brouillon',
  sent:  'envoyée',
  late:  'envoyée',
  paid:  'payée',
};

const COL_META: { key: Status; title: string; color: string }[] = [
  { key: 'draft', title: 'Brouillons', color: 'var(--status-draft)' },
  { key: 'sent',  title: 'Envoyées',   color: 'var(--status-sent)'  },
  { key: 'late',  title: 'En retard',  color: 'var(--status-late)'  },
  { key: 'paid',  title: 'Payées',     color: 'var(--status-paid)'  },
];

const fmtTotal = (invoices: any[]) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(
    invoices.reduce((s, i) => s + (i.montant_ttc || 0), 0)
  );

interface KanbanBoardProps {
  invoices: any[];
  onCardClick: (invoice: any) => void;
  onStatusChange: (invoiceId: string, dbStatus: string) => void;
  sheetOpen: boolean;
}

export const KanbanBoard = ({ invoices, onCardClick, onStatusChange, sheetOpen }: KanbanBoardProps) => {
  const isMobile = useIsMobile();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [activeCol, setActiveCol] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const grouped = COL_META.reduce((acc, c) => {
    acc[c.key] = invoices.filter(i => getStatus(i) === c.key);
    return acc;
  }, {} as Record<Status, any[]>);

  const handleScroll = () => {
    if (!scrollerRef.current) return;
    const el = scrollerRef.current;
    const colWidth = el.scrollWidth / COL_META.length;
    setActiveCol(Math.round(el.scrollLeft / colWidth));
  };

  return (
    <div style={{
      flex: 1, overflow: 'auto',
      padding: isMobile ? '12px 0 24px' : '16px 24px 24px',
      paddingRight: sheetOpen ? 24 + 440 : (isMobile ? 0 : 24),
      transition: 'padding-right 280ms cubic-bezier(.2,.7,.3,1)',
    }}>
      <div
        ref={scrollerRef}
        onScroll={isMobile ? handleScroll : undefined}
        className={isMobile ? 'kanban-scroller-mobile' : undefined}
        style={isMobile ? {
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          gap: 12,
          WebkitOverflowScrolling: 'touch',
          scrollPadding: 16,
          padding: '0 16px',
          minHeight: '100%',
          scrollbarWidth: 'none',
        } : { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14, minHeight: '100%' }}
      >
        {COL_META.map(col => {
          const items = grouped[col.key];
          const isDragOver = overCol === col.key;
          return (
            <div
              key={col.key}
              onDragOver={e => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
              }}
              onDrop={e => {
                e.preventDefault();
                setOverCol(null);
                const id = e.dataTransfer.getData('invoiceId');
                if (id) onStatusChange(id, STATUS_TO_DB[col.key]);
              }}
              style={{
                background: isDragOver ? 'var(--bg-2)' : 'var(--bg-1)',
                border: `1px solid ${isDragOver ? 'var(--accent)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--r-4)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'background 120ms, border-color 120ms',
                ...(isMobile ? { flex: '0 0 82vw', maxWidth: 320, scrollSnapAlign: 'start' as const } : {}),
              }}
            >
              <div style={{
                padding: '11px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: col.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', flex: 1 }}>
                  {col.title}
                </span>
                <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                  {items.length}
                </span>
                {items.length > 0 && (
                  <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                    · {fmtTotal(items)} €
                  </span>
                )}
              </div>

              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
                {items.map(inv => (
                  <div
                    key={inv.id}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('invoiceId', inv.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingId(inv.id);
                    }}
                    onDragEnd={() => { setDraggingId(null); setOverCol(null); }}
                    style={{
                      opacity: draggingId === inv.id ? 0.4 : 1,
                      cursor: 'grab',
                      transition: 'opacity 120ms',
                    }}
                  >
                    <InvoiceCard invoice={inv} onClick={() => onCardClick(inv)} />
                  </div>
                ))}
                {items.length === 0 && (
                  <div style={{
                    padding: '24px 8px', textAlign: 'center', fontSize: 12,
                    color: isDragOver ? 'var(--accent)' : 'var(--text-3)',
                    border: `2px dashed ${isDragOver ? 'var(--accent)' : 'transparent'}`,
                    borderRadius: 'var(--r-3)',
                    transition: 'all 120ms',
                  }}>
                    {isDragOver ? 'Déposer ici' : 'Aucune'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
          {COL_META.map((col, i) => (
            <span
              key={col.key}
              style={{
                width: 6, height: 6, borderRadius: 999,
                background: i === activeCol ? 'var(--text-2)' : 'var(--border-subtle)',
                transition: 'background 120ms',
              }}
            />
          ))}
        </div>
      )}
      <style>{`.kanban-scroller-mobile::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};
