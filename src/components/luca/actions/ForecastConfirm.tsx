import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button, Input } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

const MONTH_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export interface ForecastMonthEntry {
  month: number;
  planned_days: number;
}

export interface ForecastActionData {
  mode: 'create' | 'update';
  forecast_id: string | null;
  mission_name?: string;
  tjm?: number;
  year?: number;
  months?: ForecastMonthEntry[];
}

export const ForecastConfirm = ({ data }: { data: ForecastActionData }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'checking' | 'ok' | 'invalid' | 'saving' | 'done' | 'error'>(
    data.mode === 'update' ? 'checking' : 'ok'
  );
  const [errorMsg, setErrorMsg] = useState('');

  const [missionName, setMissionName] = useState(data.mission_name || '');
  const [tjm, setTjm] = useState(String(data.tjm ?? ''));
  const [year, setYear] = useState(data.year ?? new Date().getFullYear());
  const [months, setMonths] = useState<ForecastMonthEntry[]>(data.months && data.months.length > 0 ? data.months : [{ month: new Date().getMonth() + 1, planned_days: 0 }]);

  useEffect(() => {
    if (data.mode !== 'update' || !data.forecast_id) return;
    let cancelled = false;
    (async () => {
      const { data: forecast } = await supabase.from('forecasts').select('id').eq('id', data.forecast_id).maybeSingle();
      if (!cancelled) setStatus(forecast ? 'ok' : 'invalid');
    })();
    return () => { cancelled = true; };
  }, [data.mode, data.forecast_id]);

  if (status === 'checking') {
    return <div style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '6px 2px' }}>Vérification…</div>;
  }
  if (status === 'invalid') {
    return (
      <div style={{
        fontSize: 12, color: 'var(--danger)', background: 'var(--danger-soft)',
        border: '1px solid var(--danger-soft)', borderRadius: 'var(--r-3)', padding: '8px 10px',
      }}>
        Mission prévisionnelle introuvable parmi les tiennes — redemande à Luca en précisant le nom exact.
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
        {data.mode === 'create' ? 'Mission créée.' : 'Prévisionnel mis à jour.'}
      </div>
    );
  }

  const updateMonthDays = (idx: number, value: string) => {
    const days = parseFloat(value) || 0;
    setMonths(prev => prev.map((m, i) => i === idx ? { ...m, planned_days: days } : m));
  };

  const handleConfirm = async () => {
    if (data.mode === 'create' && !missionName.trim()) return;
    if (!user) return;
    setStatus('saving');
    try {
      let forecastId = data.forecast_id;
      if (data.mode === 'update' && forecastId) {
        const patch: Record<string, unknown> = {};
        if (missionName.trim()) patch.mission_name = missionName.trim();
        if (tjm) patch.tjm = parseFloat(tjm) || 0;
        if (Object.keys(patch).length > 0) {
          const { error } = await supabase.from('forecasts').update(patch).eq('id', forecastId);
          if (error) throw error;
        }
      } else {
        const { data: created, error } = await supabase
          .from('forecasts')
          .insert({ user_id: user.id, mission_name: missionName.trim(), tjm: parseFloat(tjm) || 0, year })
          .select('id').single();
        if (error) throw error;
        forecastId = created.id;
      }

      for (const m of months) {
        const { error } = await supabase.from('forecast_months').upsert(
          { forecast_id: forecastId, user_id: user.id, month: m.month, planned_days: m.planned_days },
          { onConflict: 'forecast_id,month' }
        );
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
        <Icon name="trending" size={13} />
        {data.mode === 'update' ? 'Modifier prévisionnel' : 'Nouvelle mission prévisionnelle'} · {year}
      </div>

      {data.mode === 'create' && (
        <>
          <Input label="Nom de la mission" value={missionName} onChange={e => setMissionName(e.target.value)} />
          <Input label="TJM (€)" value={tjm} onChange={e => setTjm(e.target.value)} />
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {months.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
            <span style={{ color: 'var(--text-2)' }}>{MONTH_SHORT[m.month - 1]}</span>
            <input
              type="number" min={0} value={m.planned_days}
              onChange={e => updateMonthDays(i, e.target.value)}
              style={{
                width: 64, height: 28, padding: '0 8px', background: 'var(--bg-3)',
                border: '1px solid var(--border)', borderRadius: 'var(--r-2)',
                color: 'var(--text-1)', fontSize: 12, outline: 0, textAlign: 'right',
              }}
            />
          </div>
        ))}
      </div>

      {status === 'error' && (
        <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>{errorMsg}</div>
      )}

      <Button variant="primary" size="sm" icon="trending" onClick={handleConfirm} disabled={(data.mode === 'create' && !missionName.trim()) || status === 'saving'}>
        {status === 'saving' ? 'Enregistrement…' : (data.mode === 'update' ? 'Enregistrer les modifications' : 'Créer cette mission')}
      </Button>
    </div>
  );
};
