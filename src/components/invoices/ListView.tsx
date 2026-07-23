import React from 'react';
import { FacturXBadge } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useIsMobile } from '@/hooks/use-mobile';

const today = new Date(); today.setHours(0, 0, 0, 0);

function getStatus(inv: any): 'draft' | 'sent' | 'late' | 'paid' {
  if (!inv.status || inv.status === 'brouillon') return 'draft';
  if (inv.status === 'payée') return 'paid';
  const due = inv.date_limite_paiement ? new Date(inv.date_limite_paiement) : null;
  return (due && due < today) ? 'late' : 'sent';
}

const STATUS_META = {
  draft: { label: 'Brouillon', tone: 'neutral' as const },
  sent:  { label: 'Envoyée',   tone: 'info'    as const },
  late:  { label: 'En retard', tone: 'danger'  as const },
  paid:  { label: 'Payée',     tone: 'success' as const },
};

const STATUS_OPTIONS = [
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'envoyée',   label: 'Envoyée'   },
  { value: 'payée',     label: 'Payée'     },
];

const TONE_COLOR: Record<string, string> = {
  neutral: 'var(--text-3)',
  info:    'var(--info)',
  danger:  'var(--danger)',
  success: 'var(--success)',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

interface ListViewProps {
  invoices: any[];
  onEdit: (invoice: any) => void;
  onDelete: (id: string) => void;
  onSend: (invoice: any) => void;
  onGenerateFacturx: (invoice: any) => void;
  onStatusChange: (id: string, status: string) => void;
  isAdmin: boolean;
  sendingId: string | null;
  generatingId: string | null;
}

const IconBtn = ({
  title, icon, onClick, disabled, danger,
}: { title: string; icon: string; onClick: () => void; disabled?: boolean; danger?: boolean }) => (
  <button
    title={title}
    onClick={onClick}
    disabled={disabled}
    style={{
      width: 36, height: 36, borderRadius: 'var(--r-2)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: danger ? 'var(--danger)' : 'var(--text-3)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      background: 'transparent', border: 'none',
    }}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = danger ? 'var(--danger-soft)' : 'var(--bg-3)'; e.currentTarget.style.color = danger ? 'var(--danger)' : 'var(--text-1)'; } }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = danger ? 'var(--danger)' : 'var(--text-3)'; }}
  >
    <Icon name={icon} size={16} />
  </button>
);

export const ListView = ({
  invoices, onEdit, onDelete, onSend, onGenerateFacturx, onStatusChange, isAdmin, sendingId, generatingId,
}: ListViewProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {invoices.map(inv => {
          const status = getStatus(inv);
          const meta   = STATUS_META[status];
          return (
            <div key={inv.id} style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-4)',
              padding: '14px 16px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                    {inv.numero_facture}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginTop: 3 }}>
                    {inv.clients?.nom || '—'}
                  </div>
                </div>
                <select
                  value={inv.status || 'brouillon'}
                  onChange={e => { e.stopPropagation(); onStatusChange(inv.id, e.target.value); }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    appearance: 'none', WebkitAppearance: 'none',
                    background: 'var(--bg-3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-2)', padding: '3px 10px 3px 8px',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    color: TONE_COLOR[meta.tone],
                  }}
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                  <div>Émise le {new Date(inv.date_facturation).toLocaleDateString('fr-FR')}</div>
                  {inv.date_limite_paiement && (
                    <div style={{ color: status === 'late' ? 'var(--status-late)' : 'var(--text-3)' }}>
                      Échéance {new Date(inv.date_limite_paiement).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
                  color: 'var(--text-1)', whiteSpace: 'nowrap',
                }}>
                  {fmt(inv.montant_ttc)} €
                </div>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end',
                borderTop: '1px solid var(--border-subtle)', paddingTop: 6,
              }}>
                {(inv.status === 'générée' || inv.status === 'envoyée') && <FacturXBadge size="sm" />}
                <div style={{ flex: 1 }} />
                <IconBtn title="Modifier" icon="edit" onClick={() => onEdit(inv)} />
                <IconBtn title="Télécharger Factur-X" icon="fileCheck" onClick={() => onGenerateFacturx(inv)} disabled={generatingId === inv.id} />
                <IconBtn title="Envoyer" icon="send" onClick={() => onSend(inv)} disabled={sendingId === inv.id} />
                {isAdmin && <IconBtn title="Supprimer" icon="trash" onClick={() => onDelete(inv.id)} danger />}
              </div>
            </div>
          );
        })}
        {invoices.length === 0 && (
          <EmptyState icon="invoice" title="Aucune facture" description="Crée ta première facture avec le bouton ci-dessus." />
        )}
      </div>
    );
  }

  return (
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
                    <select
                      value={inv.status || 'brouillon'}
                      onChange={e => { e.stopPropagation(); onStatusChange(inv.id, e.target.value); }}
                      onClick={e => e.stopPropagation()}
                      style={{
                        appearance: 'none', WebkitAppearance: 'none',
                        background: 'var(--bg-3)', border: '1px solid var(--border)',
                        borderRadius: 'var(--r-2)', padding: '3px 10px 3px 8px',
                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        color: TONE_COLOR[meta.tone],
                      }}
                    >
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
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
          <EmptyState icon="invoice" title="Aucune facture" description="Crée ta première facture avec le bouton ci-dessus." />
        )}
      </div>
    </div>
  );
};
