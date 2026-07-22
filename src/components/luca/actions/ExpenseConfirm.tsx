import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button, Input } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

export interface ExpenseActionData {
  scan_id: string;
  merchant?: string;
  amount?: number;
  category?: string;
  expense_date?: string;
  notes?: string;
}

export const ExpenseConfirm = ({ data }: { data: ExpenseActionData }) => {
  const [status, setStatus] = useState<'checking' | 'ok' | 'invalid' | 'saving' | 'done' | 'error'>('checking');
  const [errorMsg, setErrorMsg] = useState('');

  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: scan } = await supabase
        .from('expense_scans')
        .select('merchant, amount, category, expense_date, notes')
        .eq('id', data.scan_id)
        .maybeSingle();
      if (cancelled) return;
      if (!scan) { setStatus('invalid'); return; }
      setMerchant(data.merchant ?? scan.merchant ?? '');
      setAmount(String(data.amount ?? scan.amount ?? ''));
      setCategory(data.category ?? scan.category ?? '');
      setExpenseDate(data.expense_date ?? scan.expense_date ?? '');
      setNotes(data.notes ?? scan.notes ?? '');
      setStatus('ok');
    })();
    return () => { cancelled = true; };
  }, [data.scan_id]);

  if (status === 'checking') {
    return <div style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '6px 2px' }}>Vérification…</div>;
  }
  if (status === 'invalid') {
    return (
      <div style={{
        fontSize: 12, color: 'var(--danger)', background: 'var(--danger-soft)',
        border: '1px solid var(--danger-soft)', borderRadius: 'var(--r-3)', padding: '8px 10px',
      }}>
        Note de frais introuvable parmi les tiennes — redemande à Luca en précisant laquelle.
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
        Note de frais mise à jour.
      </div>
    );
  }

  const handleConfirm = async () => {
    setStatus('saving');
    try {
      const { error } = await supabase.from('expense_scans').update({
        merchant: merchant || null,
        amount: amount ? parseFloat(amount) : null,
        category: category || null,
        expense_date: expenseDate || null,
        notes: notes || null,
      }).eq('id', data.scan_id);
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
        <Icon name="receipt" size={13} />
        Modifier la note de frais
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Input label="Marchand" value={merchant} onChange={e => setMerchant(e.target.value)} />
        <Input label="Montant (€)" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Input label="Catégorie" value={category} onChange={e => setCategory(e.target.value)} />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Date</span>
          <input
            type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)}
            style={{
              height: 38, padding: '0 12px', background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-3)', color: 'var(--text-1)', fontSize: 13, outline: 0,
            }}
          />
        </label>
      </div>
      <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />

      {status === 'error' && (
        <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>{errorMsg}</div>
      )}

      <Button variant="primary" size="sm" icon="receipt" onClick={handleConfirm} disabled={status === 'saving'}>
        {status === 'saving' ? 'Enregistrement…' : 'Enregistrer les modifications'}
      </Button>
    </div>
  );
};
