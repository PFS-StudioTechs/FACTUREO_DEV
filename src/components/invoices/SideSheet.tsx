import React from 'react';
import { Button, Pill, FacturXBadge } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

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
  late:  { label: 'Retard',    tone: 'danger'  as const },
  paid:  { label: 'Payée',     tone: 'success' as const },
};

const STATUS_OPTS: { db: string; label: string; color: string }[] = [
  { db: 'brouillon', label: 'Brouillon', color: 'var(--status-draft)' },
  { db: 'envoyée',   label: 'Envoyée',   color: 'var(--status-sent)'  },
  { db: 'payée',     label: 'Payée',     color: 'var(--status-paid)'  },
];

function currentDbMatches(inv: any, db: string): boolean {
  if (db === 'brouillon') return !inv.status || inv.status === 'brouillon';
  if (db === 'envoyée')   return inv.status === 'envoyée' || inv.status === 'générée';
  return inv.status === db;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

interface SideSheetProps {
  invoice: any | null;
  open: boolean;
  onClose: () => void;
  onEdit: (invoice: any) => void;
  onDelete: (id: string) => void;
  onSend: (invoice: any) => void;
  onGenerateFacturx: (invoice: any) => void;
  onStatusChange: (invoiceId: string, dbStatus: string) => void;
  isAdmin: boolean;
  sendingId: string | null;
  generatingId: string | null;
}

const InfoRow = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
    <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{label}</span>
    <span style={{
      fontSize: accent ? 17 : 13,
      fontWeight: accent ? 600 : 400,
      fontFamily: accent ? 'var(--font-mono)' : 'inherit',
      color: accent ? 'var(--accent-bright)' : 'var(--text-1)',
      textAlign: 'right',
    }}>
      {value}
    </span>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <div style={{
      fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)',
      letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8,
    }}>
      {title}
    </div>
    <div style={{
      background: 'var(--bg-3)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-3)', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {children}
    </div>
  </section>
);

export const SideSheet = ({
  invoice, open, onClose,
  onEdit, onDelete, onSend, onGenerateFacturx, onStatusChange,
  isAdmin, sendingId, generatingId,
}: SideSheetProps) => {
  if (!invoice && !open) return null;
  const inv    = invoice;
  const status = inv ? getStatus(inv) : 'draft';
  const meta   = STATUS_META[status];
  const hasFx  = inv && (inv.status === 'générée' || inv.status === 'envoyée');

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'absolute', inset: 0, zIndex: 9,
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(2px)',
            animation: 'fade-in 180ms ease',
          }}
        />
      )}

      <aside style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 'min(440px, 100%)', zIndex: 10,
        background: 'var(--bg-2)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-12px 0 40px rgba(0,0,0,.30)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 280ms cubic-bezier(.2,.7,.3,1)',
        pointerEvents: open ? 'auto' : 'none',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 5 }}>
              {inv?.numero_facture}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
                {inv?.clients?.nom || '—'}
              </h3>
              <Pill tone={meta.tone} dot size="sm">{meta.label}</Pill>
              {hasFx && <FacturXBadge size="sm" />}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 'var(--r-2)', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-3)', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        {/* Body */}
        {inv && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Section title="Informations">
              <InfoRow label="Client" value={inv.clients?.nom || '—'} />
              <InfoRow label="Entreprise" value={inv.companies?.denomination || '—'} />
              <InfoRow label="Désignation" value={inv.designation || '—'} />
              {inv.numero_bon_commande && <InfoRow label="N° BC" value={inv.numero_bon_commande} />}
            </Section>

            <Section title="Dates">
              <InfoRow label="Émission" value={new Date(inv.date_facturation).toLocaleDateString('fr-FR')} />
              <InfoRow
                label="Échéance"
                value={inv.date_limite_paiement ? new Date(inv.date_limite_paiement).toLocaleDateString('fr-FR') : '—'}
              />
              <InfoRow label="Conditions" value={`${inv.conditions_paiement}j · ${inv.mode_paiement}`} />
            </Section>

            {inv.invoice_lines && inv.invoice_lines.length > 0 && (
              <Section title="Lignes">
                {[...inv.invoice_lines]
                  .sort((a: any, b: any) => a.position - b.position)
                  .map((l: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.designation} · {l.quantite} {l.unite}
                        {l.remise > 0 && <span style={{ color: 'var(--text-3)' }}> −{l.remise}%</span>}
                        <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>TVA {l.taux_tva}%</span>
                      </span>
                      <span style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{fmt(l.montant_ttc)}</span>
                    </div>
                  ))}
              </Section>
            )}

            <Section title="Montants">
              <InfoRow label="Montant HT" value={fmt(inv.montant_ht)} />
              {inv.invoice_lines && inv.invoice_lines.length > 0
                ? (() => {
                    const groups: Record<number, number> = {};
                    for (const l of inv.invoice_lines) {
                      groups[l.taux_tva] = (groups[l.taux_tva] || 0) + l.montant_tva;
                    }
                    return Object.entries(groups).map(([rate, amount]) => (
                      <InfoRow key={rate} label={`TVA ${rate}%`} value={fmt(amount as number)} />
                    ));
                  })()
                : <InfoRow label={`TVA ${inv.taux_tva ?? 20}%`} value={fmt(inv.montant_tva)} />
              }
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <InfoRow label="Total TTC" value={fmt(inv.montant_ttc)} accent />
              </div>
            </Section>

            {inv.descriptif_mission && (
              <Section title="Mission">
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  {inv.descriptif_mission}
                </p>
              </Section>
            )}
          </div>
        )}

        {/* Footer */}
        {inv && (
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-1)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {/* Status selector */}
            <div style={{ display: 'flex', gap: 6 }}>
              {STATUS_OPTS.map(opt => {
                const active = currentDbMatches(inv, opt.db);
                return (
                  <button
                    key={opt.db}
                    onClick={() => { if (!active) onStatusChange(inv.id, opt.db); }}
                    style={{
                      flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '5px 8px', borderRadius: 'var(--r-3)',
                      background: active ? 'var(--bg-3)' : 'transparent',
                      border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
                      color: active ? 'var(--text-1)' : 'var(--text-3)',
                      fontSize: 11, fontWeight: active ? 600 : 400,
                      cursor: active ? 'default' : 'pointer',
                      transition: 'all 120ms',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-2)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: opt.color, flexShrink: 0 }} />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="subtle" size="sm" icon="edit" onClick={() => onEdit(inv)} style={{ flex: 1, justifyContent: 'center' }}>
                Modifier
              </Button>
              <Button
                variant="ghost" size="sm" icon="fileCheck"
                disabled={generatingId === inv.id}
                onClick={() => onGenerateFacturx(inv)}
              >
                {generatingId === inv.id ? 'Génération…' : 'Factur-X'}
              </Button>
              <Button
                variant="primary" size="sm" icon="send"
                disabled={sendingId === inv.id}
                onClick={() => onSend(inv)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {sendingId === inv.id ? 'Envoi…' : 'Envoyer'}
              </Button>
            </div>
            {isAdmin && (
              <Button
                variant="danger" size="sm" icon="trash"
                onClick={() => { onDelete(inv.id); onClose(); }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Supprimer la facture
              </Button>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
