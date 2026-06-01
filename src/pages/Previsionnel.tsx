import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { fr } from "date-fns/locale";
import { Button, Money } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function getFrenchHolidays(year: number): Date[] {
  const holidays: Date[] = [
    new Date(year, 0, 1), new Date(year, 4, 1), new Date(year, 4, 8),
    new Date(year, 6, 14), new Date(year, 7, 15), new Date(year, 10, 1),
    new Date(year, 10, 11), new Date(year, 11, 25),
  ];
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month, day);
  const easterMonday = new Date(easter); easterMonday.setDate(easter.getDate() + 1);
  const ascension = new Date(easter); ascension.setDate(easter.getDate() + 39);
  const whitMonday = new Date(easter); whitMonday.setDate(easter.getDate() + 50);
  holidays.push(easterMonday, ascension, whitMonday);
  return holidays;
}

function getWorkingDays(year: number, month: number): number {
  const holidays = getFrenchHolidays(year);
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    if (holidays.some(h => h.getDate() === d && h.getMonth() === month - 1)) continue;
    count++;
  }
  return count;
}

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

type Forecast = { id: string; mission_name: string; tjm: number; year: number };
type ForecastMonth = { id: string; forecast_id: string; month: number; planned_days: number };
type VacationDay = { id: string; user_id: string; date: string; duration: number; created_at: string };

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

const getUtilColor = (planned: number, available: number): string => {
  if (planned === 0) return 'var(--text-3)';
  const ratio = planned / available;
  if (ratio >= 0.9) return 'var(--danger)';
  if (ratio >= 0.7) return 'var(--warning)';
  return 'var(--success)';
};

const Previsionnel = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number | null>(null);
  const [newMission, setNewMission] = useState({ name: "", tjm: "" });
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: forecasts = [] } = useQuery({
    queryKey: ["forecasts", user?.id, year],
    queryFn: async () => {
      const { data, error } = await supabase.from("forecasts").select("*").eq("year", year).order("created_at");
      if (error) throw error;
      return data as Forecast[];
    },
    enabled: !!user,
  });

  const forecastIds = forecasts.map(f => f.id);
  const { data: forecastMonths = [] } = useQuery({
    queryKey: ["forecast_months", forecastIds],
    queryFn: async () => {
      if (forecastIds.length === 0) return [];
      const { data, error } = await supabase.from("forecast_months").select("*").in("forecast_id", forecastIds);
      if (error) throw error;
      return data as ForecastMonth[];
    },
    enabled: forecastIds.length > 0,
  });

  const { data: vacationDaysData = [] } = useQuery({
    queryKey: ["vacation_days", user?.id, year],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("vacation_days").select("*").eq("user_id", user!.id).gte("date", `${year}-01-01`).lte("date", `${year}-12-31`);
      if (error) throw error;
      return (data || []) as VacationDay[];
    },
    enabled: !!user,
  });

  const fullDayVacationDates = vacationDaysData
    .filter(v => (v.duration ?? 1) >= 1)
    .map(v => { const [y, m, d] = v.date.split("-").map(Number); return new Date(y, m - 1, d); });

  const halfDayDates = vacationDaysData
    .filter(v => (v.duration ?? 1) < 1)
    .map(v => { const [y, m, d] = v.date.split("-").map(Number); return new Date(y, m - 1, d); });

  const vacationDatesForCalendar = [...fullDayVacationDates, ...halfDayDates];

  const toggleVacation = useMutation({
    mutationFn: async (date: Date) => {
      const dateStr = toDateStr(date);
      const existing = vacationDaysData.find(v => v.date === dateStr);
      if (!existing) {
        // No vacation → full day
        const { error } = await (supabase as any).from("vacation_days").insert({ user_id: user!.id, date: dateStr, duration: 1.0 });
        if (error) throw error;
      } else if ((existing.duration ?? 1) >= 1) {
        // Full day → half day
        const { error } = await (supabase as any).from("vacation_days").update({ duration: 0.5 }).eq("id", existing.id);
        if (error) throw error;
      } else {
        // Half day → remove
        const { error } = await (supabase as any).from("vacation_days").delete().eq("id", existing.id);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vacation_days"] }),
    onError: () => toast.error("Erreur lors de la mise à jour des congés"),
  });

  const handleCalendarSelect = (newDates: Date[] | undefined) => {
    if (!newDates) return;
    // Compare against full-day dates only (half-day dates appear as "new additions")
    const oldStrs = new Set(fullDayVacationDates.map(toDateStr));
    const newStrs = new Set(newDates.map(toDateStr));
    let changedStr: string | undefined;
    for (const s of newStrs) if (!oldStrs.has(s)) { changedStr = s; break; }
    if (!changedStr) for (const s of oldStrs) if (!newStrs.has(s)) { changedStr = s; break; }
    if (changedStr) {
      const [y, m, d] = changedStr.split("-").map(Number);
      toggleVacation.mutate(new Date(y, m - 1, d));
    }
  };

  const getVacationCount = (month: number) =>
    vacationDaysData
      .filter(v => { const [y, m] = v.date.split("-").map(Number); return y === year && m === month; })
      .reduce((sum, v) => sum + (v.duration ?? 1), 0);

  const getAvailableDays = (month: number) => Math.max(0, getWorkingDays(year, month) - getVacationCount(month));

  const addMission = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("forecasts").insert({ user_id: user!.id, mission_name: newMission.name, tjm: parseFloat(newMission.tjm) || 0, year });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forecasts"] });
      setNewMission({ name: "", tjm: "" });
      setShowAddForm(false);
      toast.success("Mission ajoutée");
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const deleteMission = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("forecasts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forecasts"] });
      queryClient.invalidateQueries({ queryKey: ["forecast_months"] });
      toast.success("Mission supprimée");
    },
  });

  const updateDays = useMutation({
    mutationFn: async ({ forecastId, month, days, y }: { forecastId: string; month: number; days: number; y: number }) => {
      const { error } = await supabase.from("forecast_months").upsert(
        { forecast_id: forecastId, user_id: user!.id, month, planned_days: days },
        { onConflict: "forecast_id,month" }
      );
      if (error) throw error;

      // Sync to invoice first line if status allows
      const mm = String(month).padStart(2, "0");
      const { data: inv } = await (supabase as any)
        .from("invoices")
        .select("id")
        .eq("user_id", user!.id)
        .gte("date_facturation", `${y}-${mm}-01`)
        .lte("date_facturation", `${y}-${mm}-31`)
        .in("status", ["brouillon", "envoyée"])
        .order("date_facturation", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (inv?.id) {
        const { data: firstLine } = await supabase
          .from("invoice_lines")
          .select("id")
          .eq("invoice_id", inv.id)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (firstLine?.id) {
          await supabase.from("invoice_lines").update({ quantite: days } as any).eq("id", firstLine.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forecast_months"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  const [localDays, setLocalDays] = useState<Record<string, number>>({});

  useEffect(() => {
    const map: Record<string, number> = {};
    forecastMonths.forEach(fm => { map[`${fm.forecast_id}-${fm.month}`] = fm.planned_days; });
    setLocalDays(map);
  }, [forecastMonths]);

  const handleDayChange = useCallback((forecastId: string, month: number, value: string) => {
    const days = parseFloat(value) || 0;
    setLocalDays(prev => ({ ...prev, [`${forecastId}-${month}`]: days }));
  }, []);

  const handleDayBlur = useCallback((forecastId: string, month: number) => {
    const days = localDays[`${forecastId}-${month}`] || 0;
    updateDays.mutate({ forecastId, month, days, y: year });
  }, [localDays, updateDays, year]);

  const getPlannedDays = (forecastId: string, month: number) => localDays[`${forecastId}-${month}`] || 0;
  const getMonthlyCa = (forecastId: string, month: number, tjm: number) => getPlannedDays(forecastId, month) * tjm;
  const getTotalCaForForecast = (forecast: Forecast) =>
    Array.from({ length: 12 }, (_, i) => getMonthlyCa(forecast.id, i + 1, forecast.tjm)).reduce((a, b) => a + b, 0);
  const grandTotal = forecasts.reduce((sum, f) => sum + getTotalCaForForecast(f), 0);
  const totalVacationYear = vacationDaysData.reduce((sum, v) => sum + (v.duration ?? 1), 0);

  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '10px 14px', fontSize: 11,
    color: 'var(--text-3)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase',
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>Prévisionnel</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>Anticipez vos revenus et votre charge de travail</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setYear(y => y - 1)} style={{ width: 32, height: 32, borderRadius: 'var(--r-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
            <Icon name="arrowRight" size={14} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', minWidth: 50, textAlign: 'center' }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} style={{ width: 32, height: 32, borderRadius: 'var(--r-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
            <Icon name="arrowRight" size={14} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 14 }}>
        <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border-accent)', borderRadius: 'var(--r-4)', padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--r-3)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trending" size={22} color="var(--accent-bright)" />
          </div>
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 4px' }}>CA Prévisionnel {year}</p>
            <Money value={formatCurrency(grandTotal).replace(' €', '')} color="var(--accent-bright)" weight={700} size={22} />
          </div>
        </div>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-4)', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--r-3)', background: 'var(--warning-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="calendar" size={22} color="var(--warning)" />
            </div>
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 4px' }}>Congés posés {year}</p>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning)' }}>
                {totalVacationYear} jour{totalVacationYear !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" icon="plus" onClick={() => setShowAddForm(true)}>Mission</Button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{ background: 'var(--bg-2)', border: '2px dashed var(--border-accent)', borderRadius: 'var(--r-4)', padding: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Nom de la mission</label>
            <Input placeholder="Ex: Mission Client ABC" value={newMission.name} onChange={e => setNewMission(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ width: 140 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>TJM (€)</label>
            <Input type="number" placeholder="500" value={newMission.tjm} onChange={e => setNewMission(p => ({ ...p, tjm: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" size="sm" onClick={() => addMission.mutate()} disabled={!newMission.name || !newMission.tjm}>
              Ajouter
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Annuler</Button>
          </div>
        </div>
      )}

      {/* Empty */}
      {forecasts.length === 0 && !showAddForm && (
        <div style={{ background: 'var(--bg-2)', border: '1px dashed var(--border)', borderRadius: 'var(--r-4)', padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Icon name="calendar" size={40} color="var(--text-3)" />
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 4px' }}>Aucune mission prévisionnelle</h3>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Créez votre première mission pour commencer</p>
          </div>
          <Button variant="primary" size="sm" icon="plus" onClick={() => setShowAddForm(true)}>Nouvelle mission</Button>
        </div>
      )}

      {/* Forecast tables */}
      {forecasts.map(forecast => (
        <div key={forecast.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-4)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{forecast.mission_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                TJM : {formatCurrency(forecast.tjm)} · Total : {formatCurrency(getTotalCaForForecast(forecast))}
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button style={{ width: 28, height: 28, borderRadius: 'var(--r-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-soft)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette mission ?</AlertDialogTitle>
                  <AlertDialogDescription>Toutes les données prévisionnelles de « {forecast.mission_name} » seront supprimées.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMission.mutate(forecast.id)}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-3)' }}>
                  <th style={thStyle}>Mois</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Jours ouvrés</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Jours prévus</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>CA Prévisionnel</th>
                </tr>
              </thead>
              <tbody>
                {MONTH_NAMES.map((name, idx) => {
                  const month = idx + 1;
                  const workingDays = getWorkingDays(year, month);
                  const vacationCount = getVacationCount(month);
                  const availableDays = getAvailableDays(month);
                  const planned = getPlannedDays(forecast.id, month);
                  const ca = getMonthlyCa(forecast.id, month, forecast.tjm);
                  return (
                    <tr
                      key={month}
                      style={{ borderBottom: idx < 11 ? '1px solid var(--border-subtle)' : 'none' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '8px 14px' }}>
                        <button
                          onClick={() => setCalendarMonth(idx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, color: 'var(--accent-bright)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <Icon name="calendar" size={13} />
                          {name}
                          {vacationCount > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--warning)' }}>·{vacationCount}</span>
                          )}
                        </button>
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{workingDays}</div>
                        {vacationCount > 0 && <div style={{ fontSize: 11, color: 'var(--warning)' }}>−{vacationCount} = {availableDays} dispo</div>}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        <Input
                          type="number" min="0" step={0.5} max={availableDays}
                          className="w-20 mx-auto text-center h-8"
                          style={{ background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
                          value={localDays[`${forecast.id}-${month}`] ?? ""}
                          onChange={e => {
                            const raw = parseFloat(e.target.value) || 0;
                            const clamped = Math.min(raw, availableDays);
                            handleDayChange(forecast.id, month, String(clamped));
                          }}
                          onBlur={() => handleDayBlur(forecast.id, month)}
                        />
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: getUtilColor(planned, availableDays), fontWeight: planned > 0 ? 500 : 400 }}>
                        {formatCurrency(ca)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-3)', borderTop: '1px solid var(--border)', fontWeight: 600 }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-1)' }}>Total</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-2)' }}>
                    {Array.from({ length: 12 }, (_, i) => getWorkingDays(year, i + 1)).reduce((a, b) => a + b, 0)}
                    {totalVacationYear > 0 && <span style={{ fontSize: 11, color: 'var(--warning)', marginLeft: 4 }}>(−{totalVacationYear})</span>}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-2)' }}>
                    {Array.from({ length: 12 }, (_, i) => getPlannedDays(forecast.id, i + 1)).reduce((a, b) => a + b, 0)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-bright)' }}>
                    {formatCurrency(getTotalCaForForecast(forecast))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}

      {/* Calendar dialog */}
      <Dialog open={calendarMonth !== null} onOpenChange={() => setCalendarMonth(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{calendarMonth !== null ? `${MONTH_NAMES[calendarMonth]} ${year}` : ""}</DialogTitle>
          </DialogHeader>
          {calendarMonth !== null && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">1 clic = journée · 2 clics = demi-journée · 3 clics = retirer</p>
              {getVacationCount(calendarMonth + 1) > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm text-orange-600 font-medium">
                  <Icon name="calendar" size={14} color="var(--warning)" />
                  {getVacationCount(calendarMonth + 1)} jour{getVacationCount(calendarMonth + 1) > 1 ? "s" : ""} de congé ce mois
                </div>
              )}
              <div className="flex justify-center">
                <Calendar
                  mode="multiple"
                  month={new Date(year, calendarMonth)}
                  selected={fullDayVacationDates}
                  onSelect={handleCalendarSelect}
                  locale={fr}
                  className="rounded-md border"
                  disabled={(date) => {
                    if (date.getMonth() !== calendarMonth) return true;
                    const dow = date.getDay();
                    if (dow === 0 || dow === 6) return true;
                    const holidays = getFrenchHolidays(year);
                    return holidays.some(h => h.getDate() === date.getDate() && h.getMonth() === date.getMonth());
                  }}
                  modifiers={{ vacation: fullDayVacationDates, halfDay: halfDayDates }}
                  modifiersClassNames={{
                    vacation: "bg-orange-100 text-orange-700 hover:bg-orange-200 font-semibold rounded-full",
                    halfDay: "bg-orange-50 text-orange-500 hover:bg-orange-100 font-medium border border-dashed border-orange-400 rounded-sm",
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Previsionnel;
