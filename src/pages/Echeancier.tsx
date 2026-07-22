import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button, Pill } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { computeAutoEcheances, dedupeAgainstExisting, type NewEcheance } from "@/lib/obligations/generateEcheances";
import { regenerateNextOccurrence } from "@/lib/obligations/recurrence";
import { getUrgencyLevel, type UrgencyLevel } from "@/lib/obligations/urgency";

interface Echeance {
  id: string;
  user_id: string;
  company_id: string;
  titre: string;
  categorie: string;
  date_echeance: string;
  statut: string;
  montant: number | null;
  recurrence: string;
  source: string;
  document_url: string | null;
}

interface CompanyLite {
  id: string;
  denomination: string;
  forme_juridique_categorie: string;
  regime_tva: string;
  regime_fiscal: string;
}

const CATEGORIE_OPTIONS = [
  { value: "tva", label: "TVA" },
  { value: "urssaf", label: "URSSAF" },
  { value: "impot", label: "Impôt" },
  { value: "facture", label: "Facture" },
  { value: "contrat", label: "Contrat" },
  { value: "autre", label: "Autre" },
];

const STATUT_OPTIONS = [
  { value: "a_faire", label: "À faire" },
  { value: "fait", label: "Fait" },
  { value: "en_retard", label: "En retard" },
];

const RECURRENCE_OPTIONS = [
  { value: "aucune", label: "Aucune" },
  { value: "mensuelle", label: "Mensuelle" },
  { value: "trimestrielle", label: "Trimestrielle" },
  { value: "annuelle", label: "Annuelle" },
];

const URGENCY_STYLE: Record<UrgencyLevel, { bg: string; color: string; label: string }> = {
  vert: { bg: "var(--success-soft)", color: "var(--success)", label: "OK" },
  orange: { bg: "var(--warning-soft, #fef3c7)", color: "var(--warning, #d97706)", label: "Bientôt" },
  rouge: { bg: "var(--danger-soft)", color: "var(--danger)", label: "Urgent" },
  gris: { bg: "var(--bg-3)", color: "var(--text-3)", label: "—" },
};

const labelFor = (options: { value: string; label: string }[], value: string) =>
  options.find(o => o.value === value)?.label || value;

const echeanceSchema = z.object({
  company_id: z.string().min(1, "Entreprise requise"),
  titre: z.string().min(1, "Titre requis"),
  categorie: z.enum(["tva", "urssaf", "impot", "facture", "contrat", "autre"]),
  date_echeance: z.string().min(1, "Date requise"),
  statut: z.enum(["a_faire", "fait", "en_retard"]),
  montant: z.string().optional(),
  recurrence: z.enum(["aucune", "mensuelle", "trimestrielle", "annuelle"]),
});

type EcheanceFormValues = z.infer<typeof echeanceSchema>;

const emptyValues: EcheanceFormValues = {
  company_id: "", titre: "", categorie: "autre", date_echeance: "",
  statut: "a_faire", montant: "", recurrence: "aucune",
};

const Echeancier = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const syncedRef = useRef(false);

  const [categorieFilter, setCategorieFilter] = useState<string>("toutes");
  const [statutFilter, setStatutFilter] = useState<string>("tous");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<EcheanceFormValues>({ resolver: zodResolver(echeanceSchema), defaultValues: emptyValues });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-fiscal", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies")
        .select("id, denomination, forme_juridique_categorie, regime_tva, regime_fiscal")
        .order("denomination");
      if (error) throw error;
      return data as unknown as CompanyLite[];
    },
    enabled: !!user,
  });

  const { data: echeances = [], isLoading } = useQuery({
    queryKey: ["echeances", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("echeances").select("*")
        .eq("user_id", user!.id).order("date_echeance", { ascending: true });
      if (error) throw error;
      return data as Echeance[];
    },
    enabled: !!user,
  });

  // Alimentation automatique depuis le profil fiscal — une fois par montage,
  // le partial unique index (migration) protège contre les doublons résiduels.
  useEffect(() => {
    if (syncedRef.current || !user || companies.length === 0) return;
    syncedRef.current = true;
    (async () => {
      const today = new Date();
      const allCandidates: NewEcheance[] = companies.flatMap(c =>
        computeAutoEcheances({
          company_id: c.id,
          forme_juridique_categorie: c.forme_juridique_categorie as any,
          regime_tva: c.regime_tva as any,
          regime_fiscal: c.regime_fiscal as any,
        }, today)
      );
      const existingKeys = echeances.map(e => ({
        company_id: e.company_id, categorie: e.categorie, date_echeance: e.date_echeance, source: e.source,
      }));
      const toInsert = dedupeAgainstExisting(allCandidates, existingKeys);
      if (toInsert.length === 0) return;
      const { error } = await supabase.from("echeances").insert(
        toInsert.map(e => ({ ...e, user_id: user.id }))
      );
      if (error && (error as { code?: string }).code !== "23505") {
        console.error("Sync échéances auto échouée:", error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["echeances"] });
    })();
  }, [user, companies, echeances, queryClient]);

  const upsertMutation = useMutation({
    mutationFn: async (values: EcheanceFormValues) => {
      const payload = {
        company_id: values.company_id, titre: values.titre, categorie: values.categorie,
        date_echeance: values.date_echeance, statut: values.statut,
        montant: values.montant ? parseFloat(values.montant) : null,
        recurrence: values.recurrence,
      };
      if (editingId) {
        const { error } = await supabase.from("echeances").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("echeances").insert({ ...payload, user_id: user!.id, source: "manuelle" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["echeances"] });
      toast.success(editingId ? "Échéance mise à jour" : "Échéance créée");
      setDialogOpen(false);
      setEditingId(null);
      form.reset(emptyValues);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markDoneMutation = useMutation({
    mutationFn: async (echeance: Echeance) => {
      const { error } = await supabase.from("echeances").update({ statut: "fait" }).eq("id", echeance.id);
      if (error) throw error;

      const next = regenerateNextOccurrence({
        company_id: echeance.company_id, titre: echeance.titre, categorie: echeance.categorie as any,
        date_echeance: echeance.date_echeance, recurrence: echeance.recurrence as any,
        source: echeance.source as "manuelle" | "auto",
      });
      if (next) {
        const { error: insertError } = await supabase.from("echeances").insert({ ...next, user_id: user!.id });
        if (insertError && (insertError as { code?: string }).code !== "23505") throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["echeances"] });
      toast.success("Échéance marquée comme faite");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("echeances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["echeances"] });
      toast.success("Échéance supprimée");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingId(null);
    form.reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (e: Echeance) => {
    setEditingId(e.id);
    form.reset({
      company_id: e.company_id, titre: e.titre, categorie: e.categorie as any,
      date_echeance: e.date_echeance, statut: e.statut as any,
      montant: e.montant != null ? String(e.montant) : "", recurrence: e.recurrence as any,
    });
    setDialogOpen(true);
  };

  const today = new Date();
  const filtered = echeances.filter(e =>
    (categorieFilter === "toutes" || e.categorie === categorieFilter) &&
    (statutFilter === "tous" || e.statut === statutFilter)
  );

  const companyName = (id: string) => companies.find(c => c.id === id)?.denomination || "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        padding: isMobile ? "12px 16px" : "16px 24px", borderBottom: "1px solid var(--border)",
        display: "flex", flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center", gap: 12,
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-1)", margin: 0, letterSpacing: "-0.02em", flex: isMobile ? undefined : 1 }}>
          Échéancier
        </h1>
        <Button variant="primary" size="sm" icon="plus" onClick={openCreate} style={isMobile ? { justifyContent: "center" } : undefined}>
          Nouvelle échéance
        </Button>
      </div>

      <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Select value={categorieFilter} onValueChange={setCategorieFilter}>
          <SelectTrigger style={{ width: isMobile ? "100%" : 200 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="toutes">Toutes catégories</SelectItem>
            {CATEGORIE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger style={{ width: isMobile ? "100%" : 200 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous statuts</SelectItem>
            {STATUT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>
        {isLoading ? (
          <div style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            <Icon name="calendar" size={36} style={{ marginBottom: 10, display: "block", margin: "0 auto 10px" }} />
            Aucune échéance
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(e => {
              const urgency = getUrgencyLevel(e.date_echeance, e.statut, today);
              const style = URGENCY_STYLE[urgency];
              return (
                <div key={e.id} style={{
                  background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r-3)",
                  padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                    background: style.bg, color: style.color, flexShrink: 0,
                  }}>
                    {style.label}
                  </span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{e.titre}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                      {companyName(e.company_id)} · {labelFor(CATEGORIE_OPTIONS, e.categorie)} · {new Date(e.date_echeance).toLocaleDateString("fr-FR")}
                      {e.source === "auto" && " · auto"}
                    </div>
                  </div>
                  <Pill size="sm" tone="neutral">{labelFor(STATUT_OPTIONS, e.statut)}</Pill>
                  {e.montant != null && <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{e.montant.toFixed(2)} €</span>}
                  <div style={{ display: "flex", gap: 6 }}>
                    {e.statut !== "fait" && (
                      <Button variant="subtle" size="sm" icon="check" onClick={() => markDoneMutation.mutate(e)}>
                        Fait
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" icon="edit" onClick={() => openEdit(e)} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="danger" size="sm" icon="trash" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette échéance ?</AlertDialogTitle>
                          <AlertDialogDescription>« {e.titre} » sera définitivement supprimée.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(e.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); setEditingId(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier l'échéance" : "Nouvelle échéance"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(values => upsertMutation.mutate(values))} className="space-y-4">
              <FormField control={form.control} name="company_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Entreprise</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choisir une entreprise" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.denomination}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="titre" render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre</FormLabel>
                  <FormControl><Input {...field} placeholder="ex: Déclaration TVA T2" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="categorie" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {CATEGORIE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="statut" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {STATUT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="date_echeance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="montant" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant (€)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} placeholder="Optionnel" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="recurrence" render={({ field }) => (
                <FormItem>
                  <FormLabel>Récurrence</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <button
                type="submit"
                disabled={upsertMutation.isPending}
                style={{
                  width: "100%", padding: "10px", background: "var(--accent)", color: "var(--accent-on)",
                  border: "none", borderRadius: "var(--r-3)", fontWeight: 500, fontSize: 14, cursor: "pointer",
                  opacity: upsertMutation.isPending ? 0.7 : 1,
                }}
              >
                {upsertMutation.isPending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Echeancier;
