import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp, CalendarDays, Palmtree } from "lucide-react";
import { fr } from "date-fns/locale";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function getFrenchHolidays(year: number): Date[] {
  const holidays: Date[] = [
    new Date(year, 0, 1),
    new Date(year, 4, 1),
    new Date(year, 4, 8),
    new Date(year, 6, 14),
    new Date(year, 7, 15),
    new Date(year, 10, 1),
    new Date(year, 10, 11),
    new Date(year, 11, 25),
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
    if (holidays.some((h) => h.getDate() === d && h.getMonth() === month - 1)) continue;
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
type VacationDay = { id: string; user_id: string; date: string; created_at: string };

const Previsionnel = () => {
  const { user } = useAuth();
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

  const forecastIds = forecasts.map((f) => f.id);
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

  // Vacation days for the year
  const { data: vacationDaysData = [] } = useQuery({
    queryKey: ["vacation_days", user?.id, year],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vacation_days")
        .select("*")
        .eq("user_id", user!.id)
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`);
      if (error) throw error;
      return (data || []) as VacationDay[];
    },
    enabled: !!user,
  });

  // Convert DB vacation dates to Date objects for the Calendar component
  const vacationDatesForCalendar = vacationDaysData.map((v) => {
    const [y, m, d] = v.date.split("-").map(Number);
    return new Date(y, m - 1, d);
  });

  // Toggle a vacation day (insert or delete)
  const toggleVacation = useMutation({
    mutationFn: async (date: Date) => {
      const dateStr = toDateStr(date);
      const existing = vacationDaysData.find((v) => v.date === dateStr);
      if (existing) {
        const { error } = await (supabase as any).from("vacation_days").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("vacation_days").insert({ user_id: user!.id, date: dateStr });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vacation_days"] }),
    onError: () => toast.error("Erreur lors de la mise à jour des congés"),
  });

  const handleCalendarSelect = (newDates: Date[] | undefined) => {
    if (!newDates) return;
    const oldStrs = new Set(vacationDatesForCalendar.map(toDateStr));
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
    vacationDaysData.filter((v) => {
      const [y, m] = v.date.split("-").map(Number);
      return y === year && m === month;
    }).length;

  const getAvailableDays = (month: number) =>
    Math.max(0, getWorkingDays(year, month) - getVacationCount(month));

  const addMission = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("forecasts").insert({
        user_id: user!.id, mission_name: newMission.name, tjm: parseFloat(newMission.tjm) || 0, year,
      });
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
    mutationFn: async ({ forecastId, month, days }: { forecastId: string; month: number; days: number }) => {
      const { error } = await supabase.from("forecast_months").upsert(
        { forecast_id: forecastId, user_id: user!.id, month, planned_days: days },
        { onConflict: "forecast_id,month" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forecast_months"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  const [localDays, setLocalDays] = useState<Record<string, number>>({});

  useEffect(() => {
    const map: Record<string, number> = {};
    forecastMonths.forEach((fm) => { map[`${fm.forecast_id}-${fm.month}`] = fm.planned_days; });
    setLocalDays(map);
  }, [forecastMonths]);

  const handleDayChange = useCallback((forecastId: string, month: number, value: string) => {
    const days = parseFloat(value) || 0;
    setLocalDays((prev) => ({ ...prev, [`${forecastId}-${month}`]: days }));
  }, []);

  const handleDayBlur = useCallback((forecastId: string, month: number) => {
    const days = localDays[`${forecastId}-${month}`] || 0;
    updateDays.mutate({ forecastId, month, days });
  }, [localDays, updateDays]);

  const getPlannedDays = (forecastId: string, month: number) => localDays[`${forecastId}-${month}`] || 0;
  const getMonthlyCa = (forecastId: string, month: number, tjm: number) => getPlannedDays(forecastId, month) * tjm;
  const getTotalCaForForecast = (forecast: Forecast) =>
    Array.from({ length: 12 }, (_, i) => getMonthlyCa(forecast.id, i + 1, forecast.tjm)).reduce((a, b) => a + b, 0);
  const grandTotal = forecasts.reduce((sum, f) => sum + getTotalCaForForecast(f), 0);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

  const getUtilColor = (planned: number, available: number) => {
    if (planned === 0) return "text-muted-foreground";
    const ratio = planned / available;
    if (ratio >= 0.9) return "text-red-600 dark:text-red-400 font-semibold";
    if (ratio >= 0.7) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  const totalVacationYear = vacationDaysData.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prévisionnel</h1>
          <p className="text-muted-foreground mt-1">Anticipez vos revenus et votre charge de travail</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-lg font-bold min-w-[60px] text-center">{year}</span>
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md bg-primary/5">
          <CardContent className="p-6 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CA Prévisionnel {year}</p>
              <p className="text-2xl font-bold">{formatCurrency(grandTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <Palmtree className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Congés posés {year}</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {totalVacationYear} jour{totalVacationYear !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button onClick={() => setShowAddForm(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Mission
            </Button>
          </CardContent>
        </Card>
      </div>

      {showAddForm && (
        <Card className="border-2 border-dashed border-primary/30">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Nom de la mission</label>
              <Input placeholder="Ex: Mission Client ABC" value={newMission.name} onChange={(e) => setNewMission((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="w-full sm:w-40 space-y-1">
              <label className="text-sm font-medium">TJM (€)</label>
              <Input type="number" placeholder="500" value={newMission.tjm} onChange={(e) => setNewMission((p) => ({ ...p, tjm: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addMission.mutate()} disabled={!newMission.name || !newMission.tjm}>Ajouter</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {forecasts.length === 0 && !showAddForm && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">Aucune mission prévisionnelle</h3>
            <p className="text-muted-foreground mt-1">Créez votre première mission pour commencer</p>
            <Button className="mt-4" onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nouvelle mission
            </Button>
          </CardContent>
        </Card>
      )}

      {forecasts.map((forecast) => (
        <Card key={forecast.id} className="border-0 shadow-md overflow-hidden">
          <CardHeader className="bg-muted/50 flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle className="text-lg">{forecast.mission_name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                TJM : {formatCurrency(forecast.tjm)} · Total : {formatCurrency(getTotalCaForForecast(forecast))}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette mission ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Toutes les données prévisionnelles de « {forecast.mission_name} » seront supprimées.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMission.mutate(forecast.id)}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold">Mois</th>
                    <th className="text-center px-4 py-3 font-semibold">Jours ouvrés</th>
                    <th className="text-center px-4 py-3 font-semibold">Jours prévus</th>
                    <th className="text-right px-4 py-3 font-semibold">CA Prévisionnel</th>
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
                      <tr key={month} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <button
                            className="text-left font-medium text-primary hover:underline cursor-pointer flex items-center gap-2"
                            onClick={() => setCalendarMonth(idx)}
                          >
                            <CalendarDays className="w-4 h-4" />
                            {name}
                            {vacationCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-orange-500 font-normal">
                                <Palmtree className="w-3 h-3" />{vacationCount}
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="text-center px-4 py-3">
                          <div className="text-muted-foreground">{workingDays}</div>
                          {vacationCount > 0 && (
                            <div className="text-xs text-orange-500">−{vacationCount} = {availableDays} dispo</div>
                          )}
                        </td>
                        <td className="text-center px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            max={workingDays}
                            className="w-20 mx-auto text-center h-8"
                            value={localDays[`${forecast.id}-${month}`] ?? ""}
                            onChange={(e) => handleDayChange(forecast.id, month, e.target.value)}
                            onBlur={() => handleDayBlur(forecast.id, month)}
                          />
                        </td>
                        <td className={`text-right px-4 py-3 ${getUtilColor(planned, availableDays)}`}>
                          {formatCurrency(ca)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 font-bold">
                    <td className="px-4 py-3">Total</td>
                    <td className="text-center px-4 py-3">
                      {Array.from({ length: 12 }, (_, i) => getWorkingDays(year, i + 1)).reduce((a, b) => a + b, 0)}
                      {totalVacationYear > 0 && (
                        <span className="ml-1 text-xs text-orange-500 font-normal">(−{totalVacationYear} congés)</span>
                      )}
                    </td>
                    <td className="text-center px-4 py-3">
                      {Array.from({ length: 12 }, (_, i) => getPlannedDays(forecast.id, i + 1)).reduce((a, b) => a + b, 0)}
                    </td>
                    <td className="text-right px-4 py-3">{formatCurrency(getTotalCaForForecast(forecast))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Calendar dialog — click a day to toggle vacation */}
      <Dialog open={calendarMonth !== null} onOpenChange={() => setCalendarMonth(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {calendarMonth !== null ? `${MONTH_NAMES[calendarMonth]} ${year}` : ""}
            </DialogTitle>
          </DialogHeader>
          {calendarMonth !== null && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Cliquez sur un jour ouvré pour le marquer / retirer comme congé
              </p>
              {getVacationCount(calendarMonth + 1) > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm text-orange-600 font-medium">
                  <Palmtree className="w-4 h-4" />
                  {getVacationCount(calendarMonth + 1)} jour{getVacationCount(calendarMonth + 1) > 1 ? "s" : ""} de congé ce mois
                </div>
              )}
              <div className="flex justify-center">
                <Calendar
                  mode="multiple"
                  month={new Date(year, calendarMonth)}
                  selected={vacationDatesForCalendar}
                  onSelect={handleCalendarSelect}
                  locale={fr}
                  className="rounded-md border"
                  disabled={(date) => {
                    if (date.getMonth() !== calendarMonth) return true;
                    const dow = date.getDay();
                    if (dow === 0 || dow === 6) return true;
                    const holidays = getFrenchHolidays(year);
                    return holidays.some(
                      (h) => h.getDate() === date.getDate() && h.getMonth() === date.getMonth()
                    );
                  }}
                  modifiers={{ vacation: vacationDatesForCalendar }}
                  modifiersClassNames={{
                    vacation: "bg-orange-100 text-orange-700 hover:bg-orange-200 font-semibold rounded-full",
                  }}
                />
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-orange-200 inline-block" /> Congé posé
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-muted inline-block" /> Jour non ouvré
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Previsionnel;
