import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { buildInvoiceSendEmail } from '@/lib/payments/invoiceSendTemplate';

export interface FinaliserFactureActionData {
  invoice_id: string;
}

interface InvoiceRow {
  id: string;
  numero_facture: string;
  montant_ttc: number;
  status: string;
  date_limite_paiement: string;
  clients: { nom: string; email: string | null } | null;
}

export const FinaliserFactureConfirm = ({ data }: { data: FinaliserFactureActionData }) => {
  const [status, setStatus] = useState<'checking' | 'ok' | 'invalid' | 'sending' | 'done' | 'error'>('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [body, setBody] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: inv } = await supabase
        .from('invoices')
        .select('id, numero_facture, montant_ttc, status, date_limite_paiement, clients(nom, email)')
        .eq('id', data.invoice_id)
        .maybeSingle();
      if (cancelled) return;
      if (!inv) { setStatus('invalid'); return; }
      const row = inv as unknown as InvoiceRow;
      setInvoice(row);
      setBody(buildInvoiceSendEmail({
        clientNom: row.clients?.nom || 'Client',
        numeroFacture: row.numero_facture,
        montantTtc: row.montant_ttc,
        dateLimitePaiement: new Date(row.date_limite_paiement).toLocaleDateString('fr-FR'),
      }));
      setStatus('ok');
    })();
    return () => { cancelled = true; };
  }, [data.invoice_id]);

  if (status === 'checking') {
    return <div style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '6px 2px' }}>Vérification…</div>;
  }
  if (status === 'invalid') {
    return (
      <div style={{
        fontSize: 12, color: 'var(--danger)', background: 'var(--danger-soft)',
        border: '1px solid var(--danger-soft)', borderRadius: 'var(--r-3)', padding: '8px 10px',
      }}>
        Facture introuvable parmi les tiennes — redemande à Luca en précisant laquelle.
      </div>
    );
  }
  if (status === 'done') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--success)',
        background: 'var(--success-soft)', border: '1px solid var(--success-soft)', borderRadius: 'var(--r-3)', padding: '8px 10px',
      }}>
        <Icon name="check" size={13} />
        Facture envoyée.
      </div>
    );
  }

  const handleConfirm = async () => {
    if (!invoice) return;
    const clientEmail = invoice.clients?.email;
    if (!clientEmail) { setErrorMsg("Le client n'a pas d'adresse email — ajoute-la avant d'envoyer."); setStatus('error'); return; }

    setStatus('sending');
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: { session: s } } = await supabase.auth.getSession();

      const facturxRes = await fetch(`${supabaseUrl}/functions/v1/generate-facturx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token ?? ''}`, apikey: anonKey },
        body: JSON.stringify({ invoice_id: invoice.id }),
      });
      if (!facturxRes.ok) { const e = await facturxRes.json().catch(() => ({ error: 'Erreur inconnue' })); throw new Error(e.error); }
      const buf = await facturxRes.arrayBuffer();
      let bin = ''; new Uint8Array(buf).forEach(b => bin += String.fromCharCode(b));
      const pdfBase64 = btoa(bin);

      const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token ?? ''}`, apikey: anonKey },
        body: JSON.stringify({
          recipientEmails: [clientEmail], fileName: `${invoice.numero_facture}.pdf`,
          pdfBase64, emailBody: body, invoiceNumber: invoice.numero_facture,
        }),
      });
      if (!sendRes.ok) { const e = await sendRes.json().catch(() => ({ error: 'Erreur inconnue' })); throw new Error(e.error || `Erreur envoi (${sendRes.status})`); }

      const { error } = await supabase.from('invoices').update({ status: 'envoyée', sent_at: new Date().toISOString() }).eq('id', invoice.id);
      if (error) throw error;
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur inconnue');
      setStatus('error');
    }
  };

  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-3)',
      padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
        <Icon name="send" size={13} />
        Finaliser et envoyer — {invoice?.numero_facture}
      </div>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={7}
        style={{
          width: '100%', padding: '8px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-3)', color: 'var(--text-1)', fontSize: 12.5, resize: 'vertical', fontFamily: 'inherit',
        }}
      />
      {status === 'error' && (
        <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>{errorMsg}</div>
      )}
      <Button variant="primary" size="sm" icon="send" onClick={handleConfirm} disabled={status === 'sending'}>
        {status === 'sending' ? 'Envoi…' : 'Envoyer la facture'}
      </Button>
    </div>
  );
};
