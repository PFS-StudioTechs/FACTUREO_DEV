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
import { Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp, CalendarDays } from "lucide-react";
import { fr } from "date-fns/locale";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// French public holidays for a given year
function getFrenchHolidays(year: number): Date[] {
  const holidays: Date[] = [
    new Date(year, 0, 1),   // Jour de l'an
    new Date(year, 4, 1),   // Fête du travail
    new Date(year, 4, 8),   // Victoire 1945
    new Date(year, 6, 14),  // Fête nationale
    new Date(year, 7, 15),  // Assomption
    new Date(year, 10, 1),  // Toussaint
    new Date(year, 10, 11), // Armistice
    new Date(year, 11, 25), // Noël
  ];

  // Easter-based holidays (Meeus algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(year, month, day);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);
  const whitMonday = new Date(easter);
  whitMonday.setDate(easter.getDate() + 50);

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
    const isHoliday = holidays.some(
      (h) => h.getDate() === d && h.getMonth() === month - 1
    );
    if (!isHoliday) count++;
  }
  return count;
}

type Forecast = {
  id: string;
  mission_name: string;
  tjm: number;
  year: number;
};

type ForecastMonth = {
  id: string;
  forecast_id: string;
  month: number;
  planned_days: number;
};

const Previsionnel = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number | null>(null);
  const [newMission, setNewMission] = useState({ name: "", tjm: "" });
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch forecasts for selected year
  const { data: forecasts = [] } = useQuery({
    queryKey: ["forecasts", user?.id, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forecasts")
        .select("*")
        .eq("year", year)
        .order("created_at");
      if (error) throw error;
      return data as Forecast[];
    },
    enabled: !!user,
  });

  // Fetch all forecast_months for the year's forecasts
  const forecastIds = forecasts.map((f) => f.id);
  const { data: forecastMonths = [] } = useQuery({
    queryKey: ["forecast_months", forecastIds],
    queryFn: async () => {
      if (forecastIds.length === 0) return [];
      const { data, error } = await supabase
        .from("forecast_months")
        .select("*")
        .in("forecast_id", forecastIds);
      if (error) throw error;
      return data as ForecastMonth[];
    },
    enabled: forecastIds.length > 0,
  });

  // Add mission
  const addMission = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("forecasts").insert({
        user_id: user!.id,
        mission_name: newMission.name,
        tjm: parseFloat(newMission.tjm) || 0,
        year,
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

  // Delete mission
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

  // Update planned days
  const updateDays = useMutation({
    mutationFn: async ({ forecastId, month, days }: { forecastId: string; month: number; days: number }) => {
      // Try upsert
      const { error } = await supabase
        .from("forecast_months")
        .upsert(
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

  // Debounced day update
  const [localDays, setLocalDays] = useState<Record<string, number>>({});

  useEffect(() => {
    const map: Record<string, number> = {};
    forecastMonths.forEach((fm) => {
      map[`${fm.forecast_id}-${fm.month}`] = fm.planned_days;
    });
    setLocalDays(map);
  }, [forecastMonths]);

  const handleDayChange = useCallback(
    (forecastId: string, month: number, value: string) => {
      const days = parseFloat(value) || 0;
      const key = `${forecastId}-${month}`;
      setLocalDays((prev) => ({ ...prev, [key]: days }));
    },
    []
  );

  const handleDayBlur = useCallback(
    (forecastId: string, month: number) => {
      const key = `${forecastId}-${month}`;
      const days = localDays[key] || 0;
      updateDays.mutate({ forecastId, month, days });
    },
    [localDays, updateDays]
  );

  // Compute totals
  const getPlannedDays = (forecastId: string, month: number) =>
    localDays[`${forecastId}-${month}`] || 0;

  const getMonthlyCa = (forecastId: string, month: number, tjm: number) =>
    getPlannedDays(forecastId, month) * tjm;

  const getTotalCaForForecast = (forecast: Forecast) =>
    Array.from({ length: 12 }, (_, i) => getMonthlyCa(forecast.id, i + 1, forecast.tjm)).reduce((a, b) => a + b, 0);

  const grandTotal = forecasts.reduce((sum, f) => sum + getTotalCaForForecast(f), 0);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

  // Color coding for utilization
  const getUtilColor = (planned: number, working: number) => {
    if (planned === 0) return "text-muted-foreground";
    const ratio = planned / working;
    if (ratio >= 0.9) return "text-red-600 dark:text-red-400 font-semibold";
    if (ratio >= 0.7) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prévisionnel</h1>
          <p className="text-muted-foreground mt-1">
            Anticipez vos revenus et votre charge de travail
          </p>
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

      {/* Grand total card */}
      <Card className="border-0 shadow-md bg-primary/5">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CA Prévisionnel Total {year}</p>
              <p className="text-2xl font-bold">{formatCurrency(grandTotal)}</p>
            </div>
          </div>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nouvelle mission
          </Button>
        </CardContent>
      </Card>

      {/* Add mission form */}
      {showAddForm && (
        <Card className="border-2 border-dashed border-primary/30">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Nom de la mission</label>
              <Input
                placeholder="Ex: Mission Client ABC"
                value={newMission.name}
                onChange={(e) => setNewMission((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="w-full sm:w-40 space-y-1">
              <label className="text-sm font-medium">TJM (€)</label>
              <Input
                type="number"
                placeholder="500"
                value={newMission.tjm}
                onChange={(e) => setNewMission((p) => ({ ...p, tjm: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addMission.mutate()} disabled={!newMission.name || !newMission.tjm}>
                Ajouter
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No missions */}
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

      {/* Mission tables */}
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
                  <AlertDialogAction onClick={() => deleteMission.mutate(forecast.id)}>
                    Supprimer
                  </AlertDialogAction>
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
                          </button>
                        </td>
                        <td className="text-center px-4 py-3 text-muted-foreground">{workingDays}</td>
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
                        <td className={`text-right px-4 py-3 ${getUtilColor(planned, workingDays)}`}>
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

      {/* Calendar dialog */}
      <Dialog open={calendarMonth !== null} onOpenChange={() => setCalendarMonth(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {calendarMonth !== null ? `${MONTH_NAMES[calendarMonth]} ${year}` : ""}
            </DialogTitle>
          </DialogHeader>
          {calendarMonth !== null && (
            <div className="flex justify-center py-4">
              <Calendar
                mode="single"
                month={new Date(year, calendarMonth)}
                locale={fr}
                className="rounded-md border"
                disabled={(date) => {
                  const dow = date.getDay();
                  if (dow === 0 || dow === 6) return true;
                  const holidays = getFrenchHolidays(year);
                  return holidays.some(
                    (h) => h.getDate() === date.getDate() && h.getMonth() === date.getMonth()
                  );
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Previsionnel;
