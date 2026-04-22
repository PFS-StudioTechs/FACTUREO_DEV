import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, Receipt, TrendingUp, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { pseudo, user } = useAuth();
  const navigate = useNavigate();

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
      const totalHT = (invoices.data || []).reduce((sum, inv) => sum + (inv.montant_ht || 0), 0);
      const totalTVA = (invoices.data || []).reduce((sum, inv) => sum + (inv.montant_tva || 0), 0);

      // Calculate forecast total
      let totalForecast = 0;
      if (forecasts.data && forecastMonths.data) {
        const tjmMap: Record<string, number> = {};
        forecasts.data.forEach((f: any) => { tjmMap[f.id] = f.tjm || 0; });
        forecastMonths.data.forEach((fm: any) => {
          const tjm = tjmMap[fm.forecast_id] || 0;
          totalForecast += (fm.planned_days || 0) * tjm;
        });
      }

      return {
        companies: companies.count || 0,
        clients: clients.count || 0,
        invoices: invoices.data?.length || 0,
        totalHT,
        totalTVA,
        totalForecast,
      };
    },
    enabled: !!user,
  });

  const cards = [
    { label: "Entreprises", value: stats?.companies || 0, icon: Building2, color: "bg-primary/10 text-primary", to: "/entreprises" },
    { label: "Clients", value: stats?.clients || 0, icon: Users, color: "bg-accent/10 text-accent", to: "/clients" },
    { label: "Factures", value: stats?.invoices || 0, icon: Receipt, color: "bg-warning/10 text-warning", to: "/factures" },
    {
      label: "Réalisé",
      value: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(stats?.totalHT || 0),
      icon: TrendingUp,
      color: "bg-success/10 text-success",
      to: "/factures",
    },
    {
      label: "Taxe collectée",
      value: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(stats?.totalTVA || 0),
      icon: Receipt,
      color: "bg-destructive/10 text-destructive",
      to: "/factures",
    },
    {
      label: "Prévisionnel " + new Date().getFullYear(),
      value: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(stats?.totalForecast || 0),
      icon: CalendarDays,
      color: "bg-primary/10 text-primary",
      to: "/previsionnel",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Bienvenue, {pseudo || "Utilisateur"} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Voici un aperçu de votre activité sur Facturéo
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card
            key={card.label}
            className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer hover:scale-[1.02]"
            onClick={() => navigate(card.to)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Index;
