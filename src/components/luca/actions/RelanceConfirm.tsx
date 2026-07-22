import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { generateReminderDraft, REMINDER_LEVELS, type ReminderLevel } from '@/lib/payments/reminderTemplates';

export interface RelanceActionData {
  invoice_id: string;
}

interface InvoiceRow {
  id: string;
  numero_facture: string;
  montant_ttc: number;
  date_limite_paiement: string;
  reminder_level: number;
  clients: { nom: string; email: string | null } | null;
}

const LEVEL_NUM: Record<ReminderLevel, number> = { courtois: 1, ferme: 2, mise_en_demeure: 3 };

export const RelanceConfirm = ({ data }: { data: RelanceActionData }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'checking' | 'ok' | 'invalid' | 'sending' | 'done' | 'error'>('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [level, setLevel] = useState<ReminderLevel>('courtois');
  const [body, setBody] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: inv } = await supabase
        .from('invoices')
        .select('id, numero_facture, montant_ttc, date_limite_paiement, reminder_level, clients(nom, email)')
        .eq('id', data.invoice_id)
        .maybeSingle();
      if (cancelled) return;
      if (!inv) { setStatus('invalid'); return; }
      const row = inv as unknown as InvoiceRow;
      setInvoice(row);
      const suggested: ReminderLevel = row.reminder_level >= 2 ? 'mise_en_demeure' : row.reminder_level === 1 ? 'ferme' : 'courtois';
      setLevel(suggested);
      setBody(generateReminderDraft(suggested, {
        clientNom: row.clients?.nom || 'Client',
        numeroFacture: row.numero_facture,
        montantTtc: row.montant_ttc,
        dateEcheance: new Date(row.date_limite_paiement).toLocaleDateString('fr-FR'),
      }).body);
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
        Relance envoyée.
      </div>
    );
  }

  const changeLevel = (next: ReminderLevel) => {
    if (!invoice) return;
    setLevel(next);
    setBody(generateReminderDraft(next, {
      clientNom: invoice.clients?.nom || 'Client',
      numeroFacture: invoice.numero_facture,
      montantTtc: invoice.montant_ttc,
      dateEcheance: new Date(invoice.date_limite_paiement).toLocaleDateString('fr-FR'),
    }).body);
  };

  const handleConfirm = async () => {
    if (!invoice || !user) return;
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

      const levelNum = LEVEL_NUM[level];
      await supabase.from('payment_reminders').insert({ invoice_id: invoice.id, level: levelNum, channel: 'email', user_id: user.id });
      await supabase.from('invoices').update({ reminder_level: levelNum }).eq('id', invoice.id);
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
        <Icon name="mail" size={13} />
        Relance — {invoice?.numero_facture}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {REMINDER_LEVELS.map(o => (
          <button
            key={o.value}
            onClick={() => changeLevel(o.value)}
            style={{
              flex: 1, padding: '5px 8px', fontSize: 11, borderRadius: 'var(--r-2)', cursor: 'pointer',
              background: level === o.value ? 'var(--accent-soft)' : 'var(--bg-3)',
              color: level === o.value ? 'var(--accent-bright)' : 'var(--text-3)',
              border: `1px solid ${level === o.value ? 'var(--border-accent)' : 'var(--border)'}`,
            }}
          >
            {o.label}
          </button>
        ))}
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
      <Button variant="primary" size="sm" icon="mail" onClick={handleConfirm} disabled={status === 'sending'}>
        {status === 'sending' ? 'Envoi…' : 'Envoyer la relance'}
      </Button>
    </div>
  );
};
