import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Avatar, FacturXBadge, Toggle, Kbd } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useIsMobile } from '@/hooks/use-mobile';

export interface InvoiceLine {
  designation: string;
  quantite: number;
  unite: string;
  prix_unitaire_ht: number;
  remise: number;
  taux_tva: number;
  motif_exoneration: string;
}

export interface InvoiceFormData {
  selectedCompanyId: string;
  selectedClientId: string;
  dateFacturation: Date;
  conditionsPaiement: number;
  modePaiement: string;
  descriptifMission: string;
  numeroBonCommande: string;
  factureNumber: string;
  type: 'vente' | 'achat';
  lines: InvoiceLine[];
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

const TVA_RATES = [0, 2.1, 5.5, 8.5, 10, 20];
const UNITS = ['Unité', 'Heure', 'Jour', 'Forfait', 'kg', 'm', 'm²', 'm³', 'l'];

const DEFAULT_LINE: InvoiceLine = {
  designation: '', quantite: 1, unite: 'Jour',
  prix_unitaire_ht: 0, remise: 0, taux_tva: 20, motif_exoneration: '',
};

const computeLine = (l: InvoiceLine) => {
  const base = l.prix_unitaire_ht * l.quantite;
  const ht = base * (1 - l.remise / 100);
  const tva = ht * (l.taux_tva / 100);
  return { ht, tva, ttc: ht + tva };
};

const fmt2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const Stepper = ({ step }: { step: number }) => {
  const steps = ['Client', 'Lignes', 'Révision'];
  return (
    <div style={{ display: 'flex', gap: 0, padding: '6px 0 16px' }}>
      {steps.map((s, i) => {
        const done = i < step;
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

const NumInput = ({ value, onChange, suffix, min, isMobile }: {
  value: number; onChange: (n: number) => void; suffix?: string; min?: number; isMobile?: boolean;
}) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 3,
    background: 'var(--bg-2)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-2)', padding: '3px 8px', height: isMobile ? 38 : 30,
  }}>
    <input
      type="number" value={value} min={min ?? 0}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      style={{
        background: 'transparent', border: 0, outline: 0, width: '100%', minWidth: 0,
        color: 'var(--text-1)', fontSize: isMobile ? 16 : 12, fontWeight: 600, fontFamily: 'var(--font-mono)',
      }}
    />
    {suffix && <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>{suffix}</span>}
  </div>
);

export const CreateInvoiceModal = ({
  open, onClose, companies, clients, onCompanyChange,
  editingInvoice, voicePrefill, onSave, isPending,
}: CreateInvoiceModalProps) => {
  const isMobile = useIsMobile();
  // 100dvh ne se recalcule pas quand le clavier virtuel s'ouvre sur certains
  // navigateurs mobiles (footer/bouton "Suivant" alors masqué derrière le clavier).
  // On suit la hauteur visible réelle via visualViewport pour compenser.
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!isMobile || !open || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setViewportHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, [isMobile, open]);
  const [step, setStep] = useState(0);
  const [companyId, setCompanyId] = useState('');
  const [clientId, setClientId] = useState('');
  const [invoiceType, setInvoiceType] = useState<'vente' | 'achat'>('vente');
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().split('T')[0]);
  const [conditions, setConditions] = useState(30);
  const [mode, setMode] = useState('VIREMENT');
  const [descriptif, setDescriptif] = useState('');
  const [numBC, setNumBC] = useState('');
  const [factureNum, setFactureNum] = useState('');
  const [genFx, setGenFx] = useState(true);
  const [lines, setLines] = useState<InvoiceLine[]>([{ ...DEFAULT_LINE }]);

  const totalHT = lines.reduce((s, l) => s + computeLine(l).ht, 0);
  const totalTVA = lines.reduce((s, l) => s + computeLine(l).tva, 0);
  const totalTTC = totalHT + totalTVA;

  const submitBlockers: string[] = [];
  if (!companyId) submitBlockers.push('entreprise');
  if (!clientId) submitBlockers.push('client');
  if (lines.length === 0 || lines.some(l => !l.designation.trim())) submitBlockers.push('désignation de chaque ligne');

  const tvaGroups = lines.reduce((acc, l) => {
    const { ht, tva } = computeLine(l);
    if (!acc[l.taux_tva]) acc[l.taux_tva] = { base: 0, tva: 0 };
    acc[l.taux_tva].base += ht;
    acc[l.taux_tva].tva += tva;
    return acc;
  }, {} as Record<number, { base: number; tva: number }>);

  useEffect(() => {
    if (!open) {
      setTimeout(() => setStep(0), 300);
      autofilledClientRef.current = null;
      linesSeededByVoiceRef.current = false;
      return;
    }
    if (editingInvoice) {
      setCompanyId(editingInvoice.company_id || '');
      setClientId(editingInvoice.client_id || '');
      setDateStr(editingInvoice.date_facturation || new Date().toISOString().split('T')[0]);
      setConditions(editingInvoice.conditions_paiement || 30);
      setMode(editingInvoice.mode_paiement || 'VIREMENT');
      setDescriptif(editingInvoice.descriptif_mission || '');
      setNumBC(editingInvoice.numero_bon_commande || '');
      setFactureNum(editingInvoice.numero_facture || '');
      setInvoiceType(editingInvoice.type || 'vente');
      const existingLines: InvoiceLine[] = editingInvoice.invoice_lines?.length > 0
        ? [...editingInvoice.invoice_lines]
            .sort((a: any, b: any) => a.position - b.position)
            .map((l: any) => ({
              designation: l.designation || '',
              quantite: l.quantite || 1,
              unite: l.unite || 'Jour',
              prix_unitaire_ht: l.prix_unitaire_ht || 0,
              remise: l.remise || 0,
              taux_tva: l.taux_tva ?? 20,
              motif_exoneration: l.motif_exoneration || '',
            }))
        : [{
            designation: editingInvoice.designation || '',
            quantite: editingInvoice.nombre_jours || 1,
            unite: 'Jour',
            prix_unitaire_ht: editingInvoice.tjm || 0,
            remise: 0,
            taux_tva: editingInvoice.taux_tva ?? 20,
            motif_exoneration: '',
          }];
      setLines(existingLines);
      setStep(1);
    }
  }, [open, editingInvoice]);

  const autofilledClientRef = useRef<string | null>(null);
  const linesSeededByVoiceRef = useRef(false);

  useEffect(() => {
    if (voicePrefill && open) {
      if (voicePrefill.selectedCompanyId) setCompanyId(voicePrefill.selectedCompanyId);
      if (voicePrefill.selectedClientId) setClientId(voicePrefill.selectedClientId);
      if (voicePrefill.dateFacturation) setDateStr(voicePrefill.dateFacturation.toISOString().split('T')[0]);
      if (voicePrefill.conditionsPaiement) setConditions(voicePrefill.conditionsPaiement);
      if (voicePrefill.modePaiement) setMode(voicePrefill.modePaiement);
      if (voicePrefill.descriptifMission) setDescriptif(voicePrefill.descriptifMission);
      if (voicePrefill.numeroBonCommande) setNumBC(voicePrefill.numeroBonCommande);
      if (voicePrefill.type) setInvoiceType(voicePrefill.type);
      if (voicePrefill.lines && voicePrefill.lines.length > 0) {
        setLines(voicePrefill.lines);
        linesSeededByVoiceRef.current = true;
      }
      setStep(1);
    }
  }, [voicePrefill, open]);

  useEffect(() => {
    if (clientId === autofilledClientRef.current) return;
    const client = clients.find(c => c.id === clientId);
    if (client) {
      autofilledClientRef.current = clientId;
      setConditions(client.conditions_paiement);
      setMode(client.mode_paiement);
      setDescriptif(client.descriptif_mission);
      setNumBC(client.numero_bon_commande || '');
      if (!linesSeededByVoiceRef.current && lines.length === 1 && lines[0].prix_unitaire_ht === 0 && client.tjm > 0) {
        setLines([{ ...DEFAULT_LINE, prix_unitaire_ht: client.tjm }]);
      }
      linesSeededByVoiceRef.current = false;
    }
  }, [clientId, clients]);

  const handleCompanyChange = (id: string) => {
    setCompanyId(id); setClientId(''); onCompanyChange(id);
  };

  const updateLine = (i: number, patch: Partial<InvoiceLine>) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  };

  const addLine = () => setLines(prev => [...prev, { ...DEFAULT_LINE }]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = () => {
    if (!companyId || !clientId || !dateStr || lines.length === 0) return;
    onSave({
      selectedCompanyId: companyId,
      selectedClientId: clientId,
      dateFacturation: new Date(dateStr),
      conditionsPaiement: conditions,
      modePaiement: mode,
      descriptifMission: descriptif,
      numeroBonCommande: numBC,
      factureNumber: factureNum,
      type: invoiceType,
      lines,
    });
  };

  if (!open) return null;

  const selStyle = {
    height: 38, padding: '0 12px', background: 'var(--bg-3)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-3)',
    color: 'var(--text-1)', fontSize: isMobile ? 16 : 13, outline: 0, cursor: 'pointer', width: '100%',
  } as React.CSSProperties;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? 0 : 24, animation: 'fade-in 200ms ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={isMobile ? {
          position: 'fixed', inset: 0,
          width: '100%', height: viewportHeight ?? '100dvh', maxHeight: viewportHeight ?? '100dvh',
          background: 'var(--bg-2)', borderRadius: 0,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        } : {
          width: 740, maxWidth: '100%', maxHeight: '92vh',
          background: 'var(--bg-2)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--r-5)', boxShadow: 'var(--shadow-3), var(--accent-glow)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'slide-in-up 280ms cubic-bezier(.2,.7,.3,1) backwards',
        }}
      >
        {/* Header */}
        <div style={{
          padding: isMobile ? '14px 16px 0' : '18px 24px 0',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              {factureNum && (
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 2 }}>
                  {factureNum} · {editingInvoice ? 'Modification' : invoiceType === 'achat' ? 'Achat' : 'Vente'}
                </div>
              )}
              <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>
                {editingInvoice ? 'Modifier la facture' : 'Nouvelle facture'}
              </h3>
            </div>
            <button
              onClick={onClose}
              style={{
                width: isMobile ? 44 : 32, height: isMobile ? 44 : 32, borderRadius: 'var(--r-3)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-3)', border: '1px solid var(--border-subtle)', cursor: 'pointer',
                flexShrink: 0,
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
              {/* Type vente / achat */}
              <div style={{ display: 'flex', gap: 8 }}>
                {(['vente', 'achat'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setInvoiceType(t)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 'var(--r-3)', cursor: 'pointer',
                      background: invoiceType === t ? 'var(--accent-soft)' : 'var(--bg-3)',
                      border: '1px solid ' + (invoiceType === t ? 'var(--border-accent)' : 'var(--border)'),
                      color: invoiceType === t ? 'var(--accent-bright)' : 'var(--text-2)',
                      fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                      transition: 'all 140ms ease',
                    }}
                  >
                    {t === 'vente' ? 'Facture de vente' : "Facture d'achat"}
                  </button>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 500 }}>Entreprise</div>
                <select value={companyId} onChange={e => handleCompanyChange(e.target.value)} style={selStyle}>
                  <option value="">Sélectionner une entreprise…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.denomination}</option>)}
                </select>
              </div>

              {companyId && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 500 }}>
                    {invoiceType === 'vente' ? 'Pour quel client ?' : 'Fournisseur'}
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
                          onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-4)'; }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'var(--bg-3)'; }}
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

          {/* Step 1 — Lignes */}
          {step === 1 && (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, animation: 'slide-in-right 240ms ease' }}>
              {/* Numéro + Date */}
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
                    type="date" value={dateStr} onChange={e => setDateStr(e.target.value)}
                    style={{
                      background: 'var(--bg-3)', border: '1px solid var(--border)',
                      borderRadius: 'var(--r-3)', padding: '0 12px', height: 38,
                      color: 'var(--text-1)', fontSize: isMobile ? 16 : 13, outline: 0, cursor: 'pointer', width: '100%',
                    }}
                  />
                </label>
              </div>

              {/* Lines table */}
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-3)', overflow: 'hidden' }}>
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
                    {lines.map((l, i) => {
                      const { ht } = computeLine(l);
                      return (
                        <div key={i} style={{
                          background: 'var(--bg-2)', border: '1px solid var(--border)',
                          borderRadius: 'var(--r-3)', padding: 10,
                          display: 'flex', flexDirection: 'column', gap: 8,
                        }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <input
                              value={l.designation}
                              onChange={e => updateLine(i, { designation: e.target.value })}
                              placeholder="Désignation…"
                              style={{
                                flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)',
                                borderRadius: 'var(--r-2)', padding: '0 10px', height: 44,
                                color: 'var(--text-1)', fontSize: 16, outline: 0, minWidth: 0,
                              }}
                            />
                            <button
                              onClick={() => removeLine(i)}
                              disabled={lines.length === 1}
                              style={{
                                width: 44, height: 44, borderRadius: 'var(--r-2)', flexShrink: 0,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                color: lines.length === 1 ? 'var(--text-4)' : 'var(--text-3)',
                                cursor: lines.length === 1 ? 'not-allowed' : 'pointer',
                                opacity: lines.length === 1 ? 0.4 : 1,
                              }}
                            >
                              <Icon name="trash2" size={16} />
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                            <NumInput value={l.quantite} onChange={v => updateLine(i, { quantite: v })} min={0} isMobile />
                            <NumInput value={l.prix_unitaire_ht} onChange={v => updateLine(i, { prix_unitaire_ht: v })} suffix="€" isMobile />
                            <NumInput value={l.remise} onChange={v => updateLine(i, { remise: Math.min(100, v) })} suffix="%" isMobile />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            <select
                              value={l.unite}
                              onChange={e => updateLine(i, { unite: e.target.value })}
                              style={{
                                height: 40, padding: '0 8px', background: 'var(--bg-3)',
                                border: '1px solid var(--border)', borderRadius: 'var(--r-2)',
                                color: 'var(--text-1)', fontSize: 16, outline: 0, width: '100%',
                              }}
                            >
                              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <select
                              value={l.taux_tva}
                              onChange={e => updateLine(i, { taux_tva: parseFloat(e.target.value), motif_exoneration: '' })}
                              style={{
                                height: 40, padding: '0 8px', background: 'var(--bg-3)',
                                border: '1px solid var(--border)', borderRadius: 'var(--r-2)',
                                color: 'var(--text-1)', fontSize: 16, outline: 0, width: '100%',
                              }}
                            >
                              {TVA_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </div>

                          {l.taux_tva === 0 && (
                            <input
                              value={l.motif_exoneration}
                              onChange={e => updateLine(i, { motif_exoneration: e.target.value })}
                              placeholder="Motif d'exonération (ex: Franchise en base de TVA — Art. 293 B CGI)"
                              style={{
                                width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border-accent)',
                                borderRadius: 'var(--r-2)', padding: '0 10px', height: 40,
                                color: 'var(--text-2)', fontSize: 16, outline: 0,
                              }}
                            />
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)' }}>
                            <span>Total HT</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-1)' }}>{fmt2(ht)} €</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                <div style={{ overflowX: 'auto' }}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 54px 72px 80px 54px 68px 72px 28px',
                  minWidth: 520,
                  gap: 6, padding: '8px 10px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>
                  <span>Désignation</span>
                  <span style={{ textAlign: 'center' }}>Qté</span>
                  <span>Unité</span>
                  <span style={{ textAlign: 'right' }}>Prix HT</span>
                  <span style={{ textAlign: 'center' }}>Remise</span>
                  <span style={{ textAlign: 'center' }}>TVA</span>
                  <span style={{ textAlign: 'right' }}>Total HT</span>
                  <span />
                </div>

                {lines.map((l, i) => {
                  const { ht } = computeLine(l);
                  return (
                    <div key={i}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 54px 72px 80px 54px 68px 72px 28px',
                        gap: 6, padding: '8px 10px',
                        borderBottom: '1px solid var(--border-subtle)',
                        alignItems: 'center',
                        minWidth: 520,
                      }}>
                        <input
                          value={l.designation}
                          onChange={e => updateLine(i, { designation: e.target.value })}
                          placeholder="Désignation…"
                          style={{
                            background: 'var(--bg-2)', border: '1px solid var(--border)',
                            borderRadius: 'var(--r-2)', padding: '3px 8px', height: 30,
                            color: 'var(--text-1)', fontSize: 12, outline: 0, width: '100%',
                          }}
                        />
                        <NumInput value={l.quantite} onChange={v => updateLine(i, { quantite: v })} min={0} />
                        <select
                          value={l.unite}
                          onChange={e => updateLine(i, { unite: e.target.value })}
                          style={{
                            height: 30, padding: '0 6px', background: 'var(--bg-2)',
                            border: '1px solid var(--border)', borderRadius: 'var(--r-2)',
                            color: 'var(--text-1)', fontSize: 12, outline: 0, width: '100%',
                          }}
                        >
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <NumInput value={l.prix_unitaire_ht} onChange={v => updateLine(i, { prix_unitaire_ht: v })} suffix="€" />
                        <NumInput value={l.remise} onChange={v => updateLine(i, { remise: Math.min(100, v) })} suffix="%" />
                        <select
                          value={l.taux_tva}
                          onChange={e => updateLine(i, { taux_tva: parseFloat(e.target.value), motif_exoneration: '' })}
                          style={{
                            height: 30, padding: '0 6px', background: 'var(--bg-2)',
                            border: '1px solid var(--border)', borderRadius: 'var(--r-2)',
                            color: 'var(--text-1)', fontSize: 12, outline: 0, width: '100%',
                          }}
                        >
                          {TVA_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                          color: 'var(--text-1)', textAlign: 'right',
                        }}>
                          {fmt2(ht)} €
                        </span>
                        <button
                          onClick={() => removeLine(i)}
                          disabled={lines.length === 1}
                          style={{
                            width: 24, height: 24, borderRadius: 'var(--r-2)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            color: lines.length === 1 ? 'var(--text-4)' : 'var(--text-3)',
                            cursor: lines.length === 1 ? 'not-allowed' : 'pointer',
                            opacity: lines.length === 1 ? 0.4 : 1,
                          }}
                          onMouseEnter={e => { if (lines.length > 1) e.currentTarget.style.color = 'var(--danger)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; }}
                        >
                          <Icon name="trash2" size={13} />
                        </button>
                      </div>
                      {/* Motif exonération si TVA 0% */}
                      {l.taux_tva === 0 && (
                        <div style={{ padding: '4px 10px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                          <input
                            value={l.motif_exoneration}
                            onChange={e => updateLine(i, { motif_exoneration: e.target.value })}
                            placeholder="Motif d'exonération (ex: Franchise en base de TVA — Art. 293 B CGI)"
                            style={{
                              width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border-accent)',
                              borderRadius: 'var(--r-2)', padding: '3px 8px', height: 28,
                              color: 'var(--text-2)', fontSize: 11, outline: 0,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
                )}

                {/* Add line + totals */}
                <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={addLine}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, color: 'var(--accent-bright)', cursor: 'pointer',
                      fontWeight: 500,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                  >
                    <Icon name="plus" size={13} />
                    Ajouter une ligne
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, fontSize: 12 }}>
                    <div style={{ color: 'var(--text-3)' }}>
                      HT <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-2)', fontWeight: 600 }}>{fmt2(totalHT)} €</span>
                    </div>
                    {Object.entries(tvaGroups).map(([rate, g]) => (
                      <div key={rate} style={{ color: 'var(--text-3)' }}>
                        TVA {rate}% <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-2)', fontWeight: 600 }}>{fmt2(g.tva)} €</span>
                      </div>
                    ))}
                    <div style={{ fontWeight: 700, color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                      {fmt2(totalTTC)} €
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="N° Bon de commande" value={numBC} onChange={e => setNumBC(e.target.value)} placeholder="Ex: BC-2026-001" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, gridColumn: 'span 1' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Conditions</span>
                    <select value={conditions} onChange={e => setConditions(parseInt(e.target.value))} style={{ ...selStyle, height: 38 }}>
                      {[0, 15, 30, 45, 60].map(d => <option key={d} value={d}>{d} jours</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Mode paiement</span>
                    <select value={mode} onChange={e => setMode(e.target.value)} style={{ ...selStyle, height: 38 }}>
                      {['VIREMENT', 'CHEQUE', 'CARTE', 'PRELEVEMENT'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Descriptif de la mission</span>
                <textarea
                  value={descriptif}
                  onChange={e => setDescriptif(e.target.value)}
                  rows={2}
                  style={{
                    background: 'var(--bg-3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-3)', padding: '8px 12px',
                    color: 'var(--text-1)', fontSize: isMobile ? 16 : 13, outline: 0,
                    resize: 'vertical', fontFamily: 'var(--font-sans)',
                  }}
                />
              </label>
            </div>
          )}

          {/* Step 2 — Révision */}
          {step === 2 && (
            <div style={{ padding: 24, animation: 'slide-in-right 240ms ease' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
                {/* Mini preview */}
                <div style={{
                  background: '#f5f3ec', borderRadius: 'var(--r-3)', padding: 22,
                  fontSize: 10, color: '#1a1815', fontFamily: 'var(--font-sans)',
                  aspectRatio: '0.71', boxShadow: '0 8px 24px rgba(0,0,0,.4)', overflowY: 'hidden',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{companies.find(c => c.id === companyId)?.denomination || '—'}</div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 8, color: '#6b6f78' }}>FACTURE N°</div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{factureNum || 'Auto'}</div>
                    </div>
                  </div>
                  <div style={{ height: 1, background: '#1a1815', opacity: 0.1, marginBottom: 10 }} />
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 8, color: '#6b6f78' }}>Émise à</div>
                    <div style={{ fontSize: 10, fontWeight: 600 }}>{clients.find(c => c.id === clientId)?.nom || '—'}</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 3, padding: 6, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7.5, color: '#6b6f78', marginBottom: 4 }}>
                      <span>DÉSIGNATION</span><span>TOTAL HT</span>
                    </div>
                    {lines.slice(0, 4).map((l, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, marginBottom: 2 }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                          {l.designation || '—'} ({l.quantite} {l.unite})
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{fmt2(computeLine(l).ht)} €</span>
                      </div>
                    ))}
                    {lines.length > 4 && (
                      <div style={{ fontSize: 8, color: '#6b6f78' }}>+ {lines.length - 4} ligne(s)…</div>
                    )}
                  </div>
                  <div style={{ marginLeft: 'auto', width: 130, fontSize: 8.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ color: '#6b6f78' }}>HT</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(totalHT)} €</span>
                    </div>
                    {Object.entries(tvaGroups).map(([rate, g]) => (
                      <div key={rate} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ color: '#6b6f78' }}>TVA {rate}%</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(g.tva)} €</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid #1a1815', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 9.5 }}>
                      <span>TTC</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(totalTTC)} €</span>
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
                      ['Type', invoiceType === 'vente' ? 'Vente' : 'Achat'],
                      ['Client', clients.find(c => c.id === clientId)?.nom || '—'],
                      ['Lignes', `${lines.length} ligne${lines.length > 1 ? 's' : ''}`],
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
                        {fmt2(totalTTC)} €
                      </span>
                    </div>
                  </div>

                  {invoiceType === 'vente' && genFx && (
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

                  {invoiceType === 'vente' && (
                    <Toggle on={genFx} onChange={setGenFx} label="Générer Factur-X" hint="PDF + XML conforme 2026" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : 0 }}>
          {step === 2 && submitBlockers.length > 0 && (
            <div style={{
              padding: '8px 16px', fontSize: 11.5, color: 'var(--warning)',
              background: 'var(--warning-soft)', borderTop: '1px solid var(--border)',
            }}>
              Manque avant de créer : {submitBlockers.join(', ')}.
            </div>
          )}
          <div style={{
            padding: isMobile ? '10px 16px' : '14px 24px',
            borderTop: step === 2 && submitBlockers.length > 0 ? 'none' : '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
          {!isMobile && (
            <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Kbd>esc</Kbd> annuler
            </span>
          )}
          {!isMobile && <div style={{ flex: 1 }} />}
          {step > 0 && (
            <Button variant="ghost" size="md" onClick={() => setStep(s => s - 1)} style={isMobile ? { flex: 1 } : undefined}>Retour</Button>
          )}
          {step < 2 ? (
            <Button
              variant="primary" size="md" iconRight="arrowRight"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 0 && (!companyId || !clientId)}
              style={isMobile ? { flex: 1 } : undefined}
            >
              Étape suivante
            </Button>
          ) : (
            <Button
              variant="primary" size="md" icon="send"
              onClick={handleSubmit}
              disabled={isPending || !companyId || !clientId || lines.length === 0 || lines.some(l => !l.designation.trim())}
              style={isMobile ? { flex: 1 } : undefined}
            >
              {isPending ? 'Enregistrement…' : editingInvoice ? 'Mettre à jour' : 'Créer la facture'}
            </Button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
