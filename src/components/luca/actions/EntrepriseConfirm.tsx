import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button, Input } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

export interface EntrepriseActionData {
  mode: 'create' | 'update';
  company_id: string | null;
  denomination: string;
  forme_juridique?: string;
  capital?: string;
  siret?: string;
  adresse?: string;
  ville?: string;
  code_postal?: string;
  telephone?: string;
  mail?: string;
}

export const EntrepriseConfirm = ({ data }: { data: EntrepriseActionData }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'checking' | 'ok' | 'invalid' | 'saving' | 'done' | 'error'>(
    data.mode === 'update' ? 'checking' : 'ok'
  );
  const [errorMsg, setErrorMsg] = useState('');

  const [denomination, setDenomination] = useState(data.denomination || '');
  const [formeJuridique, setFormeJuridique] = useState(data.forme_juridique || '');
  const [capital, setCapital] = useState(data.capital || '');
  const [siret, setSiret] = useState(data.siret || '');
  const [adresse, setAdresse] = useState(data.adresse || '');
  const [ville, setVille] = useState(data.ville || '');
  const [codePostal, setCodePostal] = useState(data.code_postal || '');
  const [telephone, setTelephone] = useState(data.telephone || '');
  const [mail, setMail] = useState(data.mail || '');

  useEffect(() => {
    if (data.mode !== 'update' || !data.company_id) return;
    let cancelled = false;
    (async () => {
      const { data: comp } = await supabase.from('companies').select('id').eq('id', data.company_id).maybeSingle();
      if (!cancelled) setStatus(comp ? 'ok' : 'invalid');
    })();
    return () => { cancelled = true; };
  }, [data.mode, data.company_id]);

  if (status === 'checking') {
    return <div style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '6px 2px' }}>Vérification…</div>;
  }
  if (status === 'invalid') {
    return (
      <div style={{
        fontSize: 12, color: 'var(--danger)', background: 'var(--danger-soft)',
        border: '1px solid var(--danger-soft)', borderRadius: 'var(--r-3)', padding: '8px 10px',
      }}>
        Entreprise introuvable parmi les tiennes — redemande à Luca en précisant le nom exact.
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
        {data.mode === 'create' ? 'Entreprise créée.' : 'Entreprise mise à jour.'}
      </div>
    );
  }

  const handleConfirm = async () => {
    if (!denomination.trim() || !user) return;
    setStatus('saving');
    const payload = {
      denomination: denomination.trim(),
      forme_juridique: formeJuridique.trim(),
      capital: capital.trim(),
      siret: siret.trim(),
      adresse: adresse.trim(),
      ville: ville.trim(),
      code_postal: codePostal.trim(),
      telephone: telephone.trim(),
      mail: mail.trim(),
    };
    try {
      if (data.mode === 'update' && data.company_id) {
        const { error } = await supabase.from('companies').update(payload).eq('id', data.company_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('companies').insert({ ...payload, user_id: user.id });
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
        <Icon name="building" size={13} />
        {data.mode === 'update' ? 'Modifier entreprise' : 'Nouvelle entreprise'}
      </div>

      <Input label="Dénomination" value={denomination} onChange={e => setDenomination(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Input label="Forme juridique" value={formeJuridique} onChange={e => setFormeJuridique(e.target.value)} />
        <Input label="Capital" value={capital} onChange={e => setCapital(e.target.value)} />
      </div>
      <Input label="SIRET" value={siret} onChange={e => setSiret(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Input label="Ville" value={ville} onChange={e => setVille(e.target.value)} />
        <Input label="Code postal" value={codePostal} onChange={e => setCodePostal(e.target.value)} />
      </div>
      <Input label="Adresse" value={adresse} onChange={e => setAdresse(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Input label="Téléphone" value={telephone} onChange={e => setTelephone(e.target.value)} />
        <Input label="Mail" value={mail} onChange={e => setMail(e.target.value)} />
      </div>

      {status === 'error' && (
        <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>{errorMsg}</div>
      )}

      <Button variant="primary" size="sm" icon="building" onClick={handleConfirm} disabled={!denomination.trim() || status === 'saving'}>
        {status === 'saving' ? 'Enregistrement…' : (data.mode === 'update' ? 'Enregistrer les modifications' : 'Créer cette entreprise')}
      </Button>
    </div>
  );
};
