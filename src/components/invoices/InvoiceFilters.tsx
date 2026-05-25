import React from 'react';
import { Button } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

export type FilterKey = 'all' | 'draft' | 'sent' | 'late' | 'paid';
export type ViewKey   = 'kanban' | 'list';

interface InvoiceFiltersProps {
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  view: ViewKey;
  setView: (v: ViewKey) => void;
  companies: any[];
  selectedCompanyId: string;
  setSelectedCompanyId: (id: string) => void;
  counts: Record<FilterKey, number>;
  importing: boolean;
  onImport: () => void;
  isRecording: boolean;
  isProcessingVoice: boolean;
  onVoice: () => void;
  onNewInvoice: () => void;
  isMobile?: boolean;
}

const FILTERS: [FilterKey, string, string][] = [
  ['all',   'Toutes',     'var(--text-3)'],
  ['draft', 'Brouillons', 'var(--status-draft)'],
  ['sent',  'Envoyées',   'var(--status-sent)'],
  ['late',  'En retard',  'var(--status-late)'],
  ['paid',  'Payées',     'var(--status-paid)'],
];

export const InvoiceFilters = ({
  filter, setFilter, view, setView,
  companies, selectedCompanyId, setSelectedCompanyId,
  counts, importing, onImport,
  isRecording, isProcessingVoice, onVoice, onNewInvoice,
  isMobile = false,
}: InvoiceFiltersProps) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    padding: '12px 24px',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-1)',
    flexShrink: 0,
  }}>
    <select
      value={selectedCompanyId}
      onChange={e => setSelectedCompanyId(e.target.value)}
      style={{
        height: 30, padding: '0 10px', borderRadius: 'var(--r-3)',
        background: 'var(--bg-3)', border: '1px solid var(--border)',
        color: 'var(--text-1)', fontSize: 12, cursor: 'pointer',
      }}
    >
      <option value="">Toutes les entreprises</option>
      {companies.map(c => <option key={c.id} value={c.id}>{c.denomination}</option>)}
    </select>

    <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

    <div style={{ display: 'flex', gap: 3 }}>
      {FILTERS.map(([key, label, dot]) => {
        const active = filter === key;
        return (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', height: 28, borderRadius: 'var(--r-pill)',
              background: active ? 'var(--bg-3)' : 'transparent',
              border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent'),
              color: active ? 'var(--text-1)' : 'var(--text-2)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-2)'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: dot, flexShrink: 0 }} />
            {label}
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>

    <div style={{ flex: 1 }} />

    {(isRecording || isProcessingVoice) && (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
        borderRadius: 'var(--r-pill)', background: 'var(--danger-soft)',
        color: 'var(--danger)', fontSize: 12,
      }}>
        <Icon name={isRecording ? 'sparkle' : 'refresh'} size={12} />
        {isRecording ? 'Écoute…' : 'Analyse…'}
      </div>
    )}

    {!isMobile && (
      <div style={{
        display: 'flex', background: 'var(--bg-2)',
        border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-3)', padding: 2, gap: 1,
      }}>
        {(['kanban', 'list'] as ViewKey[]).map(k => (
          <button
            key={k}
            onClick={() => setView(k)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 'var(--r-2)',
              background: view === k ? 'var(--bg-4)' : 'transparent',
              color: view === k ? 'var(--text-1)' : 'var(--text-3)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <Icon name={k === 'kanban' ? 'layers' : 'flow'} size={13} />
            {k === 'kanban' ? 'Kanban' : 'Liste'}
          </button>
        ))}
      </div>
    )}

    <Button variant="ghost" size="sm" icon="download" onClick={onImport} disabled={importing}>
      {importing ? 'Import…' : 'Importer'}
    </Button>

    <Button variant="ghost" size="sm" icon="sparkle" onClick={onVoice} disabled={isRecording || isProcessingVoice}>
      Voix
    </Button>

    <Button variant="primary" size="sm" icon="plus" onClick={onNewInvoice}>
      Nouvelle facture
    </Button>
  </div>
);
