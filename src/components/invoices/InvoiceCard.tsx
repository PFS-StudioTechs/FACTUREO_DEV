import React, { useState } from 'react';
import { FacturXBadge, Progress } from '@/components/ui/primitives';

interface InvoiceCardProps {
  invoice: any;
  onClick: () => void;
}

const fmtTTC = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const InvoiceCard = ({ invoice, onClick }: InvoiceCardProps) => {
  const [hovered, setHovered] = useState(false);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = invoice.date_limite_paiement ? new Date(invoice.date_limite_paiement) : null;
  const isLate = due && due < today;

  const start = invoice.date_facturation ? new Date(invoice.date_facturation).getTime() : 0;
  const end   = due ? due.getTime() : 0;
  const hasPeriod = start && end && end > start;
  const progress = hasPeriod
    ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100))
    : undefined;

  const hasFx = invoice.status === 'générée' || invoice.status === 'envoyée';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--r-3)',
        background: 'var(--bg-3)',
        border: '1px solid ' + (hovered ? 'var(--border-strong)' : 'var(--border)'),
        boxShadow: hovered ? 'var(--shadow-2)' : 'none',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all 140ms ease',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
          {invoice.numero_facture}
        </span>
        {hasFx && <FacturXBadge size="sm" />}
      </div>

      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>
        {invoice.clients?.nom || '—'}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>
          {fmtTTC(invoice.montant_ttc)} €
        </span>
        {due && (
          <span style={{ fontSize: 10.5, color: isLate ? 'var(--status-late)' : 'var(--text-3)' }}>
            éch. {due.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
          </span>
        )}
      </div>

      {progress !== undefined && (
        <Progress value={progress} tone={isLate ? 'danger' : 'accent'} />
      )}
    </div>
  );
};
