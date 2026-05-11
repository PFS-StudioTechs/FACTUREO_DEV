import React from 'react';
import { Pill } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export type ExpenseScan = {
  id: string; user_id: string; file_url: string; image_url: string | null;
  pdf_url: string | null; status: string; amount: number | null; merchant: string | null;
  category: string | null; expense_date: string | null; notes: string | null; created_at: string;
};

function scanTone(status: string): 'warning' | 'info' | 'success' | 'neutral' {
  if (status === 'traitement') return 'warning';
  if (status === 'à revoir') return 'info';
  if (status === 'transmis') return 'success';
  return 'neutral';
}

function scanLabel(status: string) {
  if (status === 'traitement') return 'Traitement IA…';
  if (status === 'à revoir') return 'À revoir';
  if (status === 'transmis') return 'Transmis';
  return status;
}

interface ExpenseGridProps {
  scans: ExpenseScan[];
  selectable?: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (scan: ExpenseScan) => void;
  onOpenPdf: (e: React.MouseEvent, scan: ExpenseScan) => void;
}

export const ExpenseGrid = ({
  scans, selectable, selectedIds, onToggle, onEdit, onOpenPdf,
}: ExpenseGridProps) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
    {scans.map(scan => {
      const isReady  = scan.status === 'à revoir';
      const isSelected = selectedIds.has(scan.id);
      return (
        <div
          key={scan.id}
          onClick={() => selectable && isReady && onToggle(scan.id)}
          style={{
            background: isSelected ? 'var(--accent-soft)' : 'var(--bg-2)',
            border: `1px solid ${isSelected ? 'var(--border-accent)' : 'var(--border)'}`,
            borderRadius: 'var(--r-4)',
            overflow: 'hidden',
            cursor: selectable && isReady ? 'pointer' : 'default',
            transition: 'transform 200ms cubic-bezier(.2,.7,.3,1), box-shadow 200ms ease',
          }}
          onMouseEnter={e => {
            if (selectable && isReady) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-2)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{
            height: 100, background: 'var(--bg-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          }}>
            {selectable && (
              <div style={{ position: 'absolute', top: 8, left: 8 }}>
                <Checkbox
                  checked={isSelected}
                  disabled={!isReady}
                  onCheckedChange={() => onToggle(scan.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <Icon name="fileCheck" size={32} color="var(--text-3)" />
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text-1)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>
                {scan.merchant || '—'}
              </span>
              <Pill tone={scanTone(scan.status)} size="sm">{scanLabel(scan.status)}</Pill>
            </div>
            {scan.expense_date && (
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                {format(new Date(scan.expense_date), 'dd MMM yyyy', { locale: fr })}
              </span>
            )}
            {scan.amount != null && (
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>
                {scan.amount.toFixed(2)} €
              </span>
            )}
            {scan.notes && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {scan.notes}
              </span>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
              {(scan.pdf_url || scan.file_url) && (
                <button
                  onClick={(e) => onOpenPdf(e, scan)}
                  style={{ fontSize: 11, color: 'var(--accent-bright)', cursor: 'pointer', padding: 0, border: 0, background: 'none' }}
                >
                  Voir PDF
                </button>
              )}
              {isReady && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(scan); }}
                  style={{
                    fontSize: 11, color: 'var(--text-3)', cursor: 'pointer',
                    padding: 0, border: 0, background: 'none',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}
                >
                  <Icon name="edit" size={11} />
                  Modifier
                </button>
              )}
            </div>
          </div>
        </div>
      );
    })}
  </div>
);
