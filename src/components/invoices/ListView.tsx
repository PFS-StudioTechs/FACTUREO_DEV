import React from 'react';
import { Pill, FacturXBadge } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

const today = new Date(); today.setHours(0, 0, 0, 0);

function getStatus(inv: any): 'draft' | 'sent' | 'late' | 'paid' {
  if (!inv.status || inv.status === 'brouillon') return 'draft';
  if (inv.status === 'envoyée') return 'paid';
  const due = inv.date_limite_paiement ? new Date(inv.date_limite_paiement) : null;
  return (due && due < today) ? 'late' : 'sent';
}

const STATUS_META = {
  draft: { label: 'Brouillon', tone: 'neutral' as const },
  sent:  { label: 'Envoyée',   tone: 'info'    as const },
  late:  { label: 'Retard',    tone: 'danger'  as const },
  paid:  { label: 'Payée',     tone: 'success' as const },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

interface ListViewProps {
  invoices: any[];
  onEdit: (invoice: any) => void;
  onDelete: (id: string) => void;
  onSend: (invoice: any) => void;
  onGenerateFacturx: (invoice: any) => void;
  isAdmin: boolean;
  sendingId: string | null;
  generatingId: string | null;
}

const IconBtn = ({ title, icon, onClick, disabled, danger }: { title: string; icon: string; onClick: () => void; disabled?: boolean; danger?: boolean }) => (
  <button
    title={title}
    onClick={onClick}
    disabled={disabled}
    style={{
      width: 28, height: 28, borderRadius: 'var(--r-2)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: danger ? 'var(--danger)' : 'var(--text-3)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = danger ? 'var(--danger-soft)' : 'var(--bg-3)'; e.currentTarget.style.color = danger ? 'var(--danger)' : 'var(--text-1)'; } }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = danger ? 'var(--danger)' : 'var(--text-3)'; }}
  >
    <Icon name={icon} size={14} />
  </button>
);

export const ListView = ({
  invoices, onEdit, onDelete, onSend, onGenerateFacturx, isAdmin, sendingId, generatingId,
}: ListViewProps) => (
  <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px 24px' }}>
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-4)',
      overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['N°', 'Client', 'Émise', 'Échéance', 'TTC', 'Statut', 'FX', ''].map((h, i) => (
              <th key={i} style={{
                textAlign: h === 'TTC' || h === '' ? 'right' : 'left',
                fontSize: 11, color: 'var(--text-3)', fontWeight: 500,
                padding: '10px 14px', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv, i) => {
            const status = getStatus(inv);
            const meta   = STATUS_META[status];
            return (
              <tr
                key={inv.id}
                style={{ borderBottom: i < invoices.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                  {inv.numero_facture}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>
                  {inv.clients?.nom || '—'}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-3)' }}>
                  {new Date(inv.date_facturation).toLocaleDateString('fr-FR')}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: status === 'late' ? 'var(--status-late)' : 'var(--text-3)' }}>
                  {inv.date_limite_paiement ? new Date(inv.date_limite_paiement).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>
                  {fmt(inv.montant_ttc)} €
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <Pill tone={meta.tone} dot size="sm">{meta.label}</Pill>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {(inv.status === 'générée' || inv.status === 'envoyée') && <FacturXBadge size="sm" />}
                </td>
                <td style={{ padding: '6px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                    <IconBtn title="Modifier" icon="edit" onClick={() => onEdit(inv)} />
                    <IconBtn title="Télécharger Factur-X" icon="fileCheck" onClick={() => onGenerateFacturx(inv)} disabled={generatingId === inv.id} />
                    <IconBtn title="Envoyer" icon="send" onClick={() => onSend(inv)} disabled={sendingId === inv.id} />
                    {isAdmin && <IconBtn title="Supprimer" icon="trash" onClick={() => onDelete(inv.id)} danger />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {invoices.length === 0 && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          Aucune facture
        </div>
      )}
    </div>
  </div>
);
