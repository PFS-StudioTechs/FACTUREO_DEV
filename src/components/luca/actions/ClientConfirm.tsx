import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button, Input } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

export interface ClientActionData {
  mode: 'create' | 'update';
  client_id: string | null;
  company_id: string;
  company_denomination?: string;
  nom: string;
  siret?: string;
  adresse?: string;
  ville?: string;
  code_postal?: string;
  numero_bon_commande?: string;
  tjm?: number;
  conditions_paiement?: number;
  mode_paiement?: string;
  descriptif_mission?: string;
}

export const ClientConfirm = ({ data }: { data: ClientActionData }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'checking' | 'ok' | 'invalid' | 'saving' | 'done' | 'error'>('checking');
  const [errorMsg, setErrorMsg] = useState('');

  const [nom, setNom] = useState(data.nom || '');
  const [siret, setSiret] = useState(data.siret || '');
  const [adresse, setAdresse] = useState(data.adresse || '');
  const [ville, setVille] = useState(data.ville || '');
  const [codePostal, setCodePostal] = useState(data.code_postal || '');
  const [tjm, setTjm] = useState(String(data.tjm ?? ''));
  const [conditions, setConditions] = useState(String(data.conditions_paiement ?? 30));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const checks = [supabase.from('companies').select('id').eq('id', data.company_id).maybeSingle()];
      if (data.mode === 'update' && data.client_id) {
        checks.push(supabase.from('clients').select('id').eq('id', data.client_id).maybeSingle());
      }
      const results = await Promise.all(checks);
      if (cancelled) return;
      const allOk = results.every(r => !!r.data);
      setStatus(allOk ? 'ok' : 'invalid');
    })();
    return () => { cancelled = true; };
  }, [data.company_id, data.client_id, data.mode]);

  if (status === 'checking') {
    return <div style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '6px 2px' }}>Vérification…</div>;
  }
  if (status === 'invalid') {
    return (
      <div style={{
        fontSize: 12, color: 'var(--danger)', background: 'var(--danger-soft)',
        border: '1px solid var(--danger-soft)', borderRadius: 'var(--r-3)', padding: '8px 10px',
      }}>
        Entreprise ou client introuvable parmi les tiens — redemande à Luca en précisant le nom exact.
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
        {data.mode === 'create' ? 'Client créé.' : 'Client mis à jour.'}
      </div>
    );
  }

  const handleConfirm = async () => {
    if (!nom.trim() || !user) return;
    setStatus('saving');
    const payload = {
      nom: nom.trim(),
      siret: siret.trim() || null,
      adresse: adresse.trim(),
      ville: ville.trim(),
      code_postal: codePostal.trim(),
      numero_bon_commande: data.numero_bon_commande || '',
      tjm: parseFloat(tjm) || 0,
      conditions_paiement: parseInt(conditions, 10) || 30,
      mode_paiement: data.mode_paiement || 'VIREMENT',
      descriptif_mission: data.descriptif_mission || '',
    };
    try {
      if (data.mode === 'update' && data.client_id) {
        const { error } = await supabase.from('clients').update(payload).eq('id', data.client_id);
        if (error) throw error;
      } else {
        if (siret.trim()) {
          const { data: dup } = await supabase.from('clients').select('id').eq('siret', siret.trim()).eq('user_id', user.id).maybeSingle();
          if (dup) throw new Error('Un client avec ce SIRET existe déjà');
        }
        const { error } = await supabase.from('clients').insert({ ...payload, company_id: data.company_id, user_id: user.id });
        if (error) throw error;
      }
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
        <Icon name="user" size={13} />
        {data.mode === 'update' ? 'Modifier client' : 'Nouveau client'} · {data.company_denomination || 'Entreprise'}
      </div>

      <Input label="Nom" value={nom} onChange={e => setNom(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Input label="SIRET" value={siret} onChange={e => setSiret(e.target.value)} />
        <Input label="TJM (€)" value={tjm} onChange={e => setTjm(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Input label="Ville" value={ville} onChange={e => setVille(e.target.value)} />
        <Input label="Code postal" value={codePostal} onChange={e => setCodePostal(e.target.value)} />
      </div>
      <Input label="Adresse" value={adresse} onChange={e => setAdresse(e.target.value)} />

      {status === 'error' && (
        <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>{errorMsg}</div>
      )}

      <Button variant="primary" size="sm" icon="user" onClick={handleConfirm} disabled={!nom.trim() || status === 'saving'}>
        {status === 'saving' ? 'Enregistrement…' : (data.mode === 'update' ? 'Enregistrer les modifications' : 'Créer ce client')}
      </Button>
    </div>
  );
};
