import React, { useState, useEffect } from 'react';
import { Button, Input, Avatar, FacturXBadge, Toggle, Kbd } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

export interface InvoiceFormData {
  selectedCompanyId: string;
  selectedClientId: string;
  dateFacturation: Date;
  nombreJours: string;
  designation: string;
  tjm: number;
  conditionsPaiement: number;
  modePaiement: string;
  descriptifMission: string;
  numeroBonCommande: string;
  factureNumber: string;
}

interface CreateInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  companies: any[];
  clients: any[];
  onCompanyChange: (id: string) => void;
  editingInvoice: any | null;
  voicePrefill: Partial<InvoiceFormData> | null;
  onSave: (data: InvoiceFormData) => void;
  isPending: boolean;
}

const Stepper = ({ step }: { step: number }) => {
  const steps = ['Client', 'Détails', 'Révision'];
  return (
    <div style={{ display: 'flex', gap: 0, padding: '6px 0 16px' }}>
      {steps.map((s, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: done ? 'var(--accent)' : active ? 'var(--accent-soft)' : 'var(--bg-3)',
              border: '1px solid ' + (done || active ? 'var(--border-accent)' : 'var(--border)'),
              color: done ? '#fff' : active ? 'var(--accent-bright)' : 'var(--text-3)',
              fontSize: 11, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 200ms ease',
            }}>
              {done ? <Icon name="check" size={11} stroke={2.4} /> : i + 1}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 500,
              color: active ? 'var(--text-1)' : done ? 'var(--text-2)' : 'var(--text-3)',
            }}>
              {s}
            </span>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 1, marginLeft: 4,
                background: done ? 'var(--accent)' : 'var(--border)',
                transition: 'background 200ms ease',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const NumField = ({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</span>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-2)', padding: '4px 10px', height: 32,
    }}>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{
          background: 'transparent', border: 0, outline: 0, width: '100%', minWidth: 0,
          color: 'var(--text-1)', fontSize: 13, fontWeight: 600,
          fontFamily: 'var(--font-mono)',
        }}
      />
      {suffix && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{suffix}</span>}
    </div>
  </label>
);

const fmt2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const CreateInvoiceModal = ({
  open, onClose, companies, clients, onCompanyChange,
  editingInvoice, voicePrefill, onSave, isPending,
}: CreateInvoiceModalProps) => {
  const [step, setStep] = useState(0);
  const [companyId,    setCompanyId]    = useState('');
  const [clientId,     setClientId]     = useState('');
  const [dateStr,      setDateStr]      = useState(() => new Date().toISOString().split('T')[0]);
  const [nombreJours,  setNombreJours]  = useState('');
  const [designation,  setDesignation]  = useState('');
  const [tjm,          setTjm]          = useState(0);
  const [conditions,   setConditions]   = useState(30);
  const [mode,         setMode]         = useState('VIREMENT');
  const [descriptif,   setDescriptif]   = useState('');
  const [numBC,        setNumBC]        = useState('');
  const [factureNum,   setFactureNum]   = useState('');
  const [genFx,        setGenFx]        = useState(true);
  const [withTVA,      setWithTVA]      = useState(true);

  const ht  = tjm * (parseFloat(nombreJours) || 0);
  const tva = withTVA ? ht * 0.2 : 0;
  const ttc = ht + tva;

  useEffect(() => {
    if (!open) {
      setTimeout(() => setStep(0), 300);
      return;
    }
    if (editingInvoice) {
      setCompanyId(editingInvoice.company_id || '');
      setClientId(editingInvoice.client_id || '');
      setDateStr(editingInvoice.date_facturation || new Date().toISOString().split('T')[0]);
      setNombreJours(String(editingInvoice.nombre_jours || ''));
      setDesignation(editingInvoice.designation || '');
      setTjm(editingInvoice.tjm || 0);
      setConditions(editingInvoice.conditions_paiement || 30);
      setMode(editingInvoice.mode_paiement || 'VIREMENT');
      setDescriptif(editingInvoice.descriptif_mission || '');
      setNumBC(editingInvoice.numero_bon_commande || '');
      setFactureNum(editingInvoice.numero_facture || '');
      setStep(1);
    }
  }, [open, editingInvoice]);

  useEffect(() => {
    if (voicePrefill && open) {
      if (voicePrefill.selectedClientId) setClientId(voicePrefill.selectedClientId);
      if (voicePrefill.dateFacturation) setDateStr(voicePrefill.dateFacturation.toISOString().split('T')[0]);
      if (voicePrefill.nombreJours) setNombreJours(voicePrefill.nombreJours);
      setStep(1);
    }
  }, [voicePrefill, open]);

  useEffect(() => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setTjm(client.tjm);
      setConditions(client.conditions_paiement);
      setMode(client.mode_paiement);
      setDescriptif(client.descriptif_mission);
      setNumBC(client.numero_bon_commande || '');
    }
  }, [clientId, clients]);

  const handleCompanyChange = (id: string) => {
    setCompanyId(id);
    setClientId('');
    onCompanyChange(id);
    const company = companies.find(c => c.id === id);
    if (company) setDesignation((company as any).designation || '');
  };

  const handleSubmit = () => {
    if (!companyId || !clientId || !dateStr || !nombreJours || !designation) return;
    onSave({
      selectedCompanyId: companyId,
      selectedClientId: clientId,
      dateFacturation: new Date(dateStr),
      nombreJours,
      designation,
      tjm,
      conditionsPaiement: conditions,
      modePaiement: mode,
      descriptifMission: descriptif,
      numeroBonCommande: numBC,
      factureNumber: factureNum,
    });
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'fade-in 200ms ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 680, maxWidth: '100%', maxHeight: '90vh',
          background: 'var(--bg-2)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--r-5)',
          boxShadow: 'var(--shadow-3), var(--accent-glow)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slide-in-up 280ms cubic-bezier(.2,.7,.3,1) backwards',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              {factureNum && (
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 2 }}>
                  {factureNum} · {editingInvoice ? 'Modification' : 'Brouillon'}
                </div>
              )}
              <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>
                {editingInvoice ? 'Modifier la facture' : 'Nouvelle facture'}
              </h3>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 'var(--r-3)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-3)', border: '1px solid var(--border-subtle)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
          <Stepper step={step} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Step 0 — Client */}
          {step === 0 && (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, animation: 'slide-in-up 240ms ease' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 500 }}>Entreprise</div>
                <select
                  value={companyId}
                  onChange={e => handleCompanyChange(e.target.value)}
                  style={{
                    width: '100%', height: 40, padding: '0 12px',
                    background: 'var(--bg-3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-3)', color: 'var(--text-1)', fontSize: 13,
                    outline: 0, cursor: 'pointer',
                  }}
                >
                  <option value="">Sélectionner une entreprise…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.denomination}</option>)}
                </select>
              </div>

              {companyId && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 500 }}>
                    Pour quel client ?
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {clients.length === 0 && (
                      <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '12px 0' }}>
                        Aucun client pour cette entreprise.
                      </div>
                    )}
                    {clients.map(c => {
                      const active = clientId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => { setClientId(c.id); setTimeout(() => setStep(1), 200); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 12px', borderRadius: 'var(--r-3)',
                            background: active ? 'var(--accent-soft)' : 'var(--bg-3)',
                            border: '1px solid ' + (active ? 'var(--border-accent)' : 'var(--border)'),
                            textAlign: 'left', transition: 'all 140ms ease', cursor: 'pointer',
                          }}
                          onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-4)'; } }}
                          onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-3)'; } }}
                        >
                          <Avatar name={c.nom} size={36} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-1)' }}>{c.nom}</div>
                            {c.siret && (
                              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>
                                SIRET {c.siret}
                              </div>
                            )}
                          </div>
                          {c.email && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.email}</span>}
                          {active && <Icon name="check" size={15} color="var(--accent-bright)" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1 — Détails */}
          {step === 1 && (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, animation: 'slide-in-right 240ms ease' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input
                  label="N° Facture"
                  value={factureNum}
                  onChange={e => setFactureNum(e.target.value)}
                  placeholder="Auto-généré si vide"
                />
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Date d'émission</span>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={e => setDateStr(e.target.value)}
                    style={{
                      background: 'var(--bg-3)', border: '1px solid var(--border)',
                      borderRadius: 'var(--r-3)', padding: '0 12px', height: 38,
                      color: 'var(--text-1)', fontSize: 13, outline: 0, cursor: 'pointer', width: '100%',
                    }}
                  />
                </label>
              </div>

              <Input
                label="Désignation *"
                value={designation}
                onChange={e => setDesignation(e.target.value)}
                placeholder="Nom de la personne qui exécute la mission"
              />

              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-3)', padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <NumField label="Jours *" value={parseFloat(nombreJours) || 0} onChange={n => setNombreJours(String(n))} />
                  <NumField label="TJM" value={tjm} onChange={setTjm} suffix="€" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>HT calculé</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
                      {fmt2(ht)} €
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-2)' }}>
                    <span>TVA {withTVA ? '20%' : '0%'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(tva)} €</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Total TTC</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: 'var(--accent-bright)', letterSpacing: '-0.02em' }}>
                      {fmt2(ttc)} €
                    </span>
                  </div>
                </div>
              </div>

              <Input
                label="N° Bon de commande *"
                value={numBC}
                onChange={e => setNumBC(e.target.value)}
                placeholder="Ex: BC-2026-001"
              />

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Descriptif de la mission *</span>
                <textarea
                  value={descriptif}
                  onChange={e => setDescriptif(e.target.value)}
                  rows={3}
                  style={{
                    background: 'var(--bg-3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-3)', padding: '8px 12px',
                    color: 'var(--text-1)', fontSize: 14, outline: 0,
                    resize: 'vertical', fontFamily: 'var(--font-sans)',
                  }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Conditions paiement</span>
                  <select
                    value={conditions}
                    onChange={e => setConditions(parseInt(e.target.value))}
                    style={{
                      height: 38, padding: '0 12px', background: 'var(--bg-3)',
                      border: '1px solid var(--border)', borderRadius: 'var(--r-3)',
                      color: 'var(--text-1)', fontSize: 13, outline: 0, cursor: 'pointer',
                    }}
                  >
                    {[0, 15, 30, 45, 60].map(d => <option key={d} value={d}>{d} jours</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Mode de paiement</span>
                  <select
                    value={mode}
                    onChange={e => setMode(e.target.value)}
                    style={{
                      height: 38, padding: '0 12px', background: 'var(--bg-3)',
                      border: '1px solid var(--border)', borderRadius: 'var(--r-3)',
                      color: 'var(--text-1)', fontSize: 13, outline: 0, cursor: 'pointer',
                    }}
                  >
                    {['VIREMENT', 'CHEQUE', 'CARTE', 'PRELEVEMENT'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              </div>

              <Toggle on={withTVA} onChange={setWithTVA} label="Appliquer TVA 20%" hint="Décocher si en franchise de TVA" />
            </div>
          )}

          {/* Step 2 — Révision */}
          {step === 2 && (
            <div style={{ padding: 24, animation: 'slide-in-right 240ms ease' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
                {/* Mini PDF preview */}
                <div style={{
                  background: '#f5f3ec', borderRadius: 'var(--r-3)', padding: 22,
                  fontSize: 10, color: '#1a1815', fontFamily: 'var(--font-sans)',
                  aspectRatio: '0.71', boxShadow: '0 8px 24px rgba(0,0,0,.4)', position: 'relative',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{designation || 'Studio Méridien'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 8, color: '#6b6f78' }}>FACTURE N°</div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {factureNum || 'Auto'}
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 1, background: '#1a1815', opacity: 0.1, marginBottom: 12 }} />
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 8, color: '#6b6f78' }}>Émise à</div>
                    <div style={{ fontSize: 10, fontWeight: 600 }}>
                      {clients.find(c => c.id === clientId)?.nom || '—'}
                    </div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 3, padding: 8, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#6b6f78', marginBottom: 4 }}>
                      <span>DÉSIGNATION</span><span>TOTAL HT</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                      <span>{nombreJours}j × {tjm}€</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(ht)} €</span>
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', width: 140, fontSize: 9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ color: '#6b6f78' }}>HT</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(ht)} €</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ color: '#6b6f78' }}>TVA</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(tva)} €</span>
                    </div>
                    <div style={{ borderTop: '1px solid #1a1815', marginTop: 5, paddingTop: 5, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 10 }}>
                      <span>TTC</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(ttc)} €</span>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>Récapitulatif</div>
                  <div style={{
                    background: 'var(--bg-3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-3)', padding: 14,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    {[
                      ['Client', clients.find(c => c.id === clientId)?.nom || '—'],
                      ['Jours × TJM', `${nombreJours} × ${tjm} €`],
                      ['Conditions', `${conditions}j · ${mode}`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{k}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-1)' }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Total TTC</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 600, color: 'var(--accent-bright)' }}>
                        {fmt2(ttc)} €
                      </span>
                    </div>
                  </div>

                  {genFx && (
                    <div style={{
                      padding: 12, borderRadius: 'var(--r-3)',
                      background: 'var(--accent-soft)', border: '1px solid var(--border-accent)',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <FacturXBadge size="md" />
                      <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.4 }}>
                        PDF + XML Factur-X générés automatiquement
                      </div>
                    </div>
                  )}

                  <Toggle on={genFx} onChange={setGenFx} label="Générer Factur-X" hint="PDF + XML conforme 2026" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Kbd>esc</Kbd> annuler
          </span>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <Button variant="ghost" size="md" onClick={() => setStep(s => s - 1)}>Retour</Button>
          )}
          {step < 2 ? (
            <Button
              variant="primary" size="md" iconRight="arrowRight"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 0 && (!companyId || !clientId)}
            >
              Étape suivante
            </Button>
          ) : (
            <Button
              variant="primary" size="md" icon="send"
              onClick={handleSubmit}
              disabled={isPending || !companyId || !clientId || !nombreJours || !designation}
            >
              {isPending ? 'Enregistrement…' : editingInvoice ? 'Mettre à jour' : 'Créer la facture'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
