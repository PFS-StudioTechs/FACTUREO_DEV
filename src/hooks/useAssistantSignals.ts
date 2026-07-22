import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  rankSignals,
  signalsFromEcheances,
  signalsFromInvoices,
  signalsFromInvoiceDrafts,
  signalsFromExpenseScans,
  signalsFromMissingRecurrence,
  type Signal,
  type EcheanceLite,
  type InvoiceLite,
  type DraftInvoiceLite,
  type ExpenseScanLite,
  type CompanyForSync,
} from "@/lib/assistant/signals";

// Lecture seule : le client Supabase est déjà borné par RLS (auth.uid() = user_id
// sur companies/echeances/invoices/expense_scans) — aucune fuite inter-utilisateur possible ici.

export function useAssistantSignals() {
  const { user } = useAuth();

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ["assistant-companies", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies")
        .select("id, denomination, forme_juridique_categorie, regime_tva, regime_fiscal");
      if (error) throw error;
      return (data ?? []).map(c => ({
        company_id: c.id,
        denomination: c.denomination,
        forme_juridique_categorie: c.forme_juridique_categorie,
        regime_tva: c.regime_tva,
        regime_fiscal: c.regime_fiscal,
      })) as CompanyForSync[];
    },
    enabled: !!user,
  });

  const { data: echeances = [], isLoading: loadingEcheances } = useQuery({
    queryKey: ["assistant-echeances", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("echeances")
        .select("id, company_id, titre, categorie, date_echeance, statut, source");
      if (error) throw error;
      return (data ?? []) as (EcheanceLite & { source: string })[];
    },
    enabled: !!user,
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["assistant-invoices", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("id, numero_facture, status, statut_paiement, date_limite_paiement, reminder_level, last_reminder_at");
      if (error) throw error;
      return (data ?? []) as (InvoiceLite & DraftInvoiceLite)[];
    },
    enabled: !!user,
  });

  const { data: expenseScans = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["assistant-expense-scans", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_scans")
        .select("id, status, image_url, merchant")
        .in("status", ["traitement", "à revoir"]);
      if (error) throw error;
      return (data ?? []) as ExpenseScanLite[];
    },
    enabled: !!user,
  });

  const signals = useMemo(() => {
    const today = new Date();
    const existingKeys = echeances.map(e => ({
      company_id: e.company_id, categorie: e.categorie, date_echeance: e.date_echeance, source: e.source,
    }));
    return rankSignals([
      ...signalsFromEcheances(echeances, today),
      ...signalsFromInvoices(invoices, today),
      ...signalsFromInvoiceDrafts(invoices),
      ...signalsFromExpenseScans(expenseScans),
      ...signalsFromMissingRecurrence(companies, existingKeys, today),
    ]);
  }, [companies, echeances, invoices, expenseScans]);

  return {
    signals,
    isLoading: loadingCompanies || loadingEcheances || loadingInvoices || loadingExpenses,
  };
}
