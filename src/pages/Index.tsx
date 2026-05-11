import React from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, Button, Pill, Progress, FacturXBadge, Money } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

/* ─── Helpers ─── */
const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);

const computeProgress = (start: string, end: string): number => {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (e <= s) return 100;
  return Math.min(100, Math.max(0, Math.round(((Date.now() - s) / (e - s)) * 100)));
};

const getMonthLabels = (): string[] =>
  Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return d.toLocaleDateString('fr-FR', { month: 'short' });
  });

/* ─── Types ─── */
interface KanbanItem {
  id: string;
  num: string;
  client: string;
  amount: string;
  amountRaw: number;
  due: string;
  fx: boolean;
  progress: number;
  note?: { text: string; tone: string };
}

interface KanbanColData {
  title: string;
  tone: 'draft' | 'sent' | 'late' | 'paid';
  count: number;
  total: string;
  items: KanbanItem[];
}

interface KanbanColProps extends KanbanColData {
  onCardClick?: () => void;
}

/* ─── KPI ─── */
const KPI = ({
  label, value, hint, trend, accent,
}: {
  label: string; value: string; hint?: string;
  trend?: { dir: 'up' | 'down'; value: string }; accent?: boolean;
}) => (
  <Card padding={18} hover style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 96 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
      {trend && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11,
          color: trend.dir === 'up' ? 'var(--success)' : 'var(--danger)',
        }}>
          <Icon name={trend.dir === 'up' ? 'arrowUp' : 'arrowDown'} size={11} />
          {trend.value}
        </span>
      )}
    </div>
    <Money
      value={value}
      size={26}
      weight={600}
      color={accent ? 'var(--accent-bright)' : 'var(--text-1)'}
      style={{ letterSpacing: '-0.02em' }}
    />
    {hint && <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{hint}</span>}
  </Card>
);

/* ─── KanbanCard ─── */
const KanbanCard = ({ inv, onClick }: { inv: KanbanItem; onClick?: () => void }) => (
  <div
    onClick={onClick}
    style={{
      background: 'var(--bg-3)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-3)',
      padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 6,
      cursor: 'pointer',
      transition: 'all 160ms ease',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.borderColor = 'var(--border-strong)';
      e.currentTarget.style.boxShadow = 'var(--shadow-2)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.borderColor = 'var(--border)';
      e.currentTarget.style.boxShadow = 'none';
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)', fontWeight: 500 }}>
        {inv.num}
      </span>
      {inv.fx && <FacturXBadge size="sm" />}
    </div>
    <div style={{
      fontSize: 13, fontWeight: 500, color: 'var(--text-1)', lineHeight: 1.3,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {inv.client}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Money value={inv.amount} size={14} weight={600} color="var(--text-1)" />
      <span style={{ fontSize: 11, color: inv.note?.tone === 'danger' ? 'var(--danger)' : 'var(--text-3)' }}>
        {inv.note?.text || inv.due}
      </span>
    </div>
    {inv.progress > 0 && (
      <div style={{ marginTop: 2 }}>
        <Progress value={inv.progress} tone={inv.progress >= 90 ? 'danger' : 'accent'} height={3} />
      </div>
    )}
  </div>
);

/* ─── KanbanColumn ─── */
const STATUS_DOT: Record<string, string> = {
  draft: 'var(--status-draft)',
  sent:  'var(--status-sent)',
  late:  'var(--status-late)',
  paid:  'var(--status-paid)',
};

const KanbanColumn = ({ title, count, total, tone, items, onCardClick }: KanbanColProps) => (
  <div style={{
    background: 'var(--bg-1)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-4)',
    padding: 12,
    display: 'flex', flexDirection: 'column', gap: 10,
    minHeight: 0,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_DOT[tone], flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{title}</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{count}</span>
      </div>
      <Money value={total} size={11} color="var(--text-3)" weight={500} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', minHeight: 0, paddingRight: 2 }}>
      {items.map(it => (
        <KanbanCard key={it.id} inv={it} onClick={onCardClick} />
      ))}
      <button
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: 10, borderRadius: 'var(--r-3)',
          border: '1px dashed var(--border)',
          color: 'var(--text-3)', fontSize: 12, cursor: 'pointer',
          width: '100%',
        }}
      >
        <Icon name="plus" size={12} /> Ajouter
      </button>
    </div>
  </div>
);

/* ─── HeroCTA ─── */
const HeroCTA = ({ onCreate }: { onCreate: () => void }) => (
  <Card padding={0} style={{
    background: 'linear-gradient(135deg, var(--bg-3) 0%, var(--bg-2) 100%)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  }}>
    <div aria-hidden style={{
      position: 'absolute', right: -120, top: -120, width: 320, height: 320,
      borderRadius: '50%',
      background: 'radial-gradient(closest-side, var(--accent-soft-2), transparent)',
      pointerEvents: 'none',
    }} />
    <div
      className="grain"
      style={{ position: 'relative', padding: 28, display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', zIndex: 1, maxWidth: 540 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11,
          color: 'var(--accent-bright)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          <Icon name="zap" size={12} /> Action rapide
        </span>
        <h2 style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
          Crée une facture<span style={{ color: 'var(--accent)' }}>.</span>
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
          3 clics. Factur-X généré automatiquement. Envoyée par email.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Button variant="primary" size="lg" icon="plus" iconRight="arrowRight" onClick={onCreate}>
            Nouvelle facture
          </Button>
          <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 6 }}>
            ou accéder aux factures →
          </span>
        </div>
      </div>

      {/* Floating invoice preview */}
      <div style={{
        width: 240, transform: 'rotate(2deg)',
        background: 'var(--bg-4)', border: '1px solid var(--border-strong)',
        borderRadius: 'var(--r-4)', padding: 16,
        position: 'relative', zIndex: 1,
        boxShadow: 'var(--shadow-3)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>F-2026-043</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginTop: 2 }}>Acme Corp</div>
          </div>
          <FacturXBadge size="sm" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-2)', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Conseil produit · 8j</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>5 200 €</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>TVA 20%</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>1 040 €</span>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Total TTC</span>
          <Money value="6 240,00" size={18} weight={600} color="var(--accent-bright)" />
        </div>
      </div>
    </div>
  </Card>
);

/* ─── SimpleChart ─── */
const SimpleChart = ({ data, labels }: { data: number[]; labels: string[] }) => {
  const w = 600, h = 140, pad = 8;
  const max = Math.max(...data, 1);
  const minRaw = Math.min(...data);
  const min = minRaw * 0.92;
  const pts: [number, number][] = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (w - pad * 2),
    h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2 - 12),
  ]);
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]} ${p[1]}` : `L${p[0]} ${p[1]}`)).join(' ');
  const area = `${path} L${pts[pts.length - 1][0]} ${h - pad} L${pts[0][0]} ${h - pad} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 140 }}>
        <defs>
          <linearGradient id="ch-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map(i => (
          <line
            key={i}
            x1={pad} x2={w - pad}
            y1={pad + i * ((h - pad * 2) / 3)}
            y2={pad + i * ((h - pad * 2) / 3)}
            stroke="var(--border-subtle)" strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#ch-grad)" />
        <path d={path} stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle
            key={i} cx={p[0]} cy={p[1]}
            r={i === pts.length - 1 ? 4 : 2.5}
            fill="var(--accent)"
            stroke={i === pts.length - 1 ? 'var(--bg-2)' : 'transparent'}
            strokeWidth="2"
          />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {labels.map(l => (
          <span key={l} style={{ fontSize: 10, color: 'var(--text-3)' }}>{l}</span>
        ))}
      </div>
    </div>
  );
};

/* ─── Main ─── */
const Index = () => {
  const { pseudo, user } = useAuth();
  const navigate = useNavigate();

  /* Existing query — kept unchanged */
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async () => {
      const [companies, clients, invoices, forecasts, forecastMonths] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("montant_ht, montant_tva, montant_ttc"),
        supabase.from("forecasts").select("id, tjm").eq("year", new Date().getFullYear()),
        supabase.from("forecast_months").select("forecast_id, planned_days"),
      ]);
      const totalHT  = (invoices.data || []).reduce((s, inv) => s + (inv.montant_ht  || 0), 0);
      const totalTVA = (invoices.data || []).reduce((s, inv) => s + (inv.montant_tva || 0), 0);

      let totalForecast = 0;
      if (forecasts.data && forecastMonths.data) {
        const tjmMap: Record<string, number> = {};
        forecasts.data.forEach((f: { id: string; tjm: number }) => { tjmMap[f.id] = f.tjm || 0; });
        forecastMonths.data.forEach((fm: { forecast_id: string; planned_days: number }) => {
          totalForecast += (fm.planned_days || 0) * (tjmMap[fm.forecast_id] || 0);
        });
      }

      return {
        companies: companies.count || 0,
        clients:   clients.count   || 0,
        invoices:  invoices.data?.length || 0,
        totalHT, totalTVA, totalForecast,
      };
    },
    enabled: !!user,
  });

  /* Kanban invoices */
  const { data: kanbanRaw = [] } = useQuery({
    queryKey: ["kanban-invoices", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, numero_facture, montant_ttc, date_facturation, date_limite_paiement, clients(nom)")
        .order("date_facturation", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        numero_facture: string;
        montant_ttc: number;
        date_facturation: string;
        date_limite_paiement: string;
        clients: { nom: string } | null;
      }>;
    },
    enabled: !!user,
  });

  /* Chart invoices — last 6 months */
  const { data: chartRaw = [] } = useQuery({
    queryKey: ["chart-invoices", user?.id],
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 6);
      const { data, error } = await supabase
        .from("invoices")
        .select("date_facturation, montant_ht")
        .gte("date_facturation", since.toISOString().split('T')[0]);
      if (error) throw error;
      return (data || []) as Array<{ date_facturation: string; montant_ht: number }>;
    },
    enabled: !!user,
  });

  /* Derive kanban items */
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toItem = (raw: typeof kanbanRaw[0], isLate: boolean): KanbanItem => {
    const d = new Date(raw.date_limite_paiement);
    const diffDays = Math.round(Math.abs(today.getTime() - d.getTime()) / 86400000);
    return {
      id:         raw.id,
      num:        raw.numero_facture,
      client:     raw.clients?.nom || '—',
      amount:     fmt(raw.montant_ttc),
      amountRaw:  raw.montant_ttc,
      due: isLate
        ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        : `échéance ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`,
      fx:       false,
      progress: computeProgress(raw.date_facturation, raw.date_limite_paiement),
      ...(isLate ? { note: { text: `+${diffDays}j`, tone: 'danger' } } : {}),
    };
  };

  const lateItems   = kanbanRaw.filter(r => new Date(r.date_limite_paiement) < today).map(r => toItem(r, true));
  const activeItems = kanbanRaw.filter(r => new Date(r.date_limite_paiement) >= today).map(r => toItem(r, false));

  /* Monthly chart values */
  const monthLabels = getMonthLabels();
  const chartValues = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const y = d.getFullYear(), m = d.getMonth() + 1;
    return chartRaw
      .filter(r => {
        const [ry, rm] = r.date_facturation.split('-').map(Number);
        return ry === y && rm === m;
      })
      .reduce((s, r) => s + (r.montant_ht || 0), 0);
  });
  const chartDisplay = chartValues.some(v => v > 0) ? chartValues : [0, 0, 0, 0, 0, 1];

  /* Kanban cols */
  const kanbanCols: KanbanColData[] = [
    { title: 'Brouillons', tone: 'draft', count: 0,                 total: '0',                                       items: [] },
    { title: 'Envoyées',   tone: 'sent',  count: activeItems.length, total: fmt(activeItems.reduce((s, i) => s + i.amountRaw, 0)), items: activeItems },
    { title: 'En retard',  tone: 'late',  count: lateItems.length,   total: fmt(lateItems.reduce((s, i) => s + i.amountRaw, 0)),   items: lateItems },
    { title: 'Payées',     tone: 'paid',  count: 0,                 total: '0',                                       items: [] },
  ];

  /* Dynamic todos */
  const todos = [
    ...(lateItems.length > 0 ? [{
      ic: 'alert', tone: 'danger',
      t: lateItems.length === 1 ? 'Relancer 1 client en retard' : `Relancer ${lateItems.length} clients en retard`,
      s: `${lateItems.length} facture${lateItems.length > 1 ? 's' : ''} dépassée${lateItems.length > 1 ? 's' : ''}`,
    }] : []),
    {
      ic: 'trending', tone: 'info',
      t: 'Consulter le prévisionnel',
      s: `${fmt(stats?.totalForecast || 0)} € planifiés`,
    },
    {
      ic: 'invoice', tone: 'warning',
      t: 'Vérifier les factures actives',
      s: `${activeItems.length} facture${activeItems.length !== 1 ? 's' : ''} en cours`,
    },
  ].slice(0, 3);

  const monthStr = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>
            Salut {pseudo || 'toi'},
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '4px 0 0' }}>
            Voilà où tu en es ce mois-ci.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
          <Icon name="calendar" size={13} />
          {monthStr.charAt(0).toUpperCase() + monthStr.slice(1)}
        </div>
      </div>

      {/* Hero CTA */}
      <HeroCTA onCreate={() => navigate('/factures')} />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <KPI
          label="CA réalisé"
          value={fmt(stats?.totalHT || 0)}
          hint={`${stats?.invoices || 0} facture${(stats?.invoices || 0) !== 1 ? 's' : ''} au total`}
          accent
        />
        <KPI
          label="TVA collectée"
          value={fmt(stats?.totalTVA || 0)}
          hint="20% du CA HT"
        />
        <KPI
          label={`Prévisionnel ${new Date().getFullYear()}`}
          value={fmt(stats?.totalForecast || 0)}
          hint={`${stats?.clients || 0} client${(stats?.clients || 0) !== 1 ? 's' : ''} · ${stats?.companies || 0} entreprise${(stats?.companies || 0) !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Chart + todos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
        <Card padding={20}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Évolution du CA</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>6 derniers mois · HT</div>
            </div>
            <Pill tone="accent" dot size="sm">HT · €</Pill>
          </div>
          <SimpleChart data={chartDisplay} labels={monthLabels} />
        </Card>

        <Card padding={18}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>À faire</div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{todos.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {todos.map((task, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 0',
                borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 'var(--r-2)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: `var(--${task.tone}-soft)`,
                  color: `var(--${task.tone})`,
                  flexShrink: 0,
                }}>
                  <Icon name={task.ic} size={13} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-1)' }}>{task.t}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{task.s}</div>
                </div>
                <Icon name="chevronRight" size={13} color="var(--text-3)" />
              </div>
            ))}
            {todos.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '10px 0' }}>
                Aucune tâche en attente
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Kanban */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
            Tes factures, par statut
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="ghost" size="sm" icon="filter">Filtrer</Button>
            <Button variant="subtle" size="sm" iconRight="arrowRight" onClick={() => navigate('/factures')}>
              Voir tout
            </Button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, minHeight: 300 }}>
          {kanbanCols.map(col => (
            <KanbanColumn
              key={col.title}
              {...col}
              onCardClick={() => navigate('/factures')}
            />
          ))}
        </div>
      </div>

    </div>
  );
};

export default Index;
