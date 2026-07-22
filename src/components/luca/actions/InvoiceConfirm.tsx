import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import type { InvoiceFormData } from '@/components/invoices/CreateInvoiceModal';

export interface FactureLineData {
  designation: string;
  quantite: number;
  unite: string;
  prix_unitaire_ht: number;
  remise: number;
  taux_tva: number;
  motif_exoneration: string;
}

export interface FactureData {
  company_id: string;
  company_denomination?: string;
  client_id: string;
  client_nom?: string;
  date_facturation?: string;
  conditions_paiement?: number;
  mode_paiement?: string;
  descriptif_mission?: string;
  numero_bon_commande?: string;
  type?: 'vente' | 'achat';
  lines: FactureLineData[];
}

const fmt2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const InvoiceConfirm = ({ data }: { data: FactureData }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'ok' | 'invalid'>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: comp }, { data: cli }] = await Promise.all([
        supabase.from('companies').select('id').eq('id', data.company_id).maybeSingle(),
        supabase.from('clients').select('id').eq('id', data.client_id).maybeSingle(),
      ]);
      if (!cancelled) setStatus(comp && cli ? 'ok' : 'invalid');
    })();
    return () => { cancelled = true; };
  }, [data.company_id, data.client_id]);

  if (status === 'checking') {
    return (
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '6px 2px' }}>
        Vérification du client et de l'entreprise…
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div style={{
        fontSize: 12, color: 'var(--danger)', background: 'var(--danger-soft)',
        border: '1px solid var(--danger-soft)', borderRadius: 'var(--r-3)', padding: '8px 10px',
      }}>
        Ce client ou cette entreprise n'a pas été retrouvé parmi les tiens — redemande à Luca en précisant le nom exact.
      </div>
    );
  }

  const totalHt = data.lines.reduce((s, l) => s + l.prix_unitaire_ht * l.quantite * (1 - l.remise / 100), 0);

  const handleConfirm = () => {
    const prefill: Partial<InvoiceFormData> = {
      selectedCompanyId: data.company_id,
      selectedClientId: data.client_id,
      dateFacturation: data.date_facturation ? new Date(data.date_facturation) : new Date(),
      conditionsPaiement: data.conditions_paiement ?? 30,
      modePaiement: data.mode_paiement ?? 'VIREMENT',
      descriptifMission: data.descriptif_mission ?? '',
      numeroBonCommande: data.numero_bon_commande ?? '',
      type: data.type ?? 'vente',
      lines: data.lines,
    };
    navigate('/factures', { state: { lucaPrefill: prefill } });
  };

  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-3)',
      padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
        <Icon name="invoice" size={13} />
        {data.company_denomination || 'Entreprise'} → {data.client_nom || 'Client'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)' }}>
            <span>{l.designation || '—'} ({l.quantite} {l.unite})</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(l.prix_unitaire_ht * l.quantite * (1 - l.remise / 100))} €</span>
          </div>
        ))}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '1px solid var(--border-subtle)', paddingTop: 6,
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Total HT</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13, color: 'var(--accent-bright)' }}>
          {fmt2(totalHt)} €
        </span>
      </div>
      <Button variant="primary" size="sm" icon="invoice" onClick={handleConfirm}>
        Créer cette facture
      </Button>
    </div>
  );
};
