import { useState } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isUnpaid, isLate, effectiveStatutPaiement } from "@/lib/payments/lateStatus";
import { generateReminderDraft, REMINDER_LEVELS, type ReminderLevel } from "@/lib/payments/reminderTemplates";

interface InvoiceRow {
  id: string;
  numero_facture: string;
  montant_ttc: number;
  statut_paiement: string;
  date_limite_paiement: string;
  client_id: string;
  reminder_level: number;
  clients: { nom: string; email: string | null } | null;
}

const LEVEL_NUM: Record<ReminderLevel, number> = { courtois: 1, ferme: 2, mise_en_demeure: 3 };

const STATUT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  impaye: { bg: "var(--bg-3)", color: "var(--text-2)", label: "Impayée" },
  en_cours: { bg: "var(--accent-soft)", color: "var(--accent)", label: "Lien envoyé" },
  partiel: { bg: "var(--warning-soft, #fef3c7)", color: "var(--warning, #d97706)", label: "Partiel" },
  en_retard: { bg: "var(--danger-soft)", color: "var(--danger)", label: "En retard" },
};

const relanceSchema = z.object({
  level: z.enum(["courtois", "ferme", "mise_en_demeure"]),
  body: z.string().min(1, "Message requis"),
});
type RelanceFormValues = z.infer<typeof relanceSchema>;

const Relances = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [dialogInvoice, setDialogInvoice] = useState<InvoiceRow | null>(null);
  const [sending, setSending] = useState(false);

  const form = useForm<RelanceFormValues>({ resolver: zodResolver(relanceSchema), defaultValues: { level: "courtois", body: "" } });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices-unpaid", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("id, numero_facture, montant_ttc, statut_paiement, date_limite_paiement, client_id, reminder_level, clients(nom, email)")
        .eq("user_id", user!.id)
        .order("date_limite_paiement", { ascending: true });
      if (error) throw error;
      return (data as unknown as InvoiceRow[]).filter(inv => isUnpaid(inv.statut_paiement));
    },
    enabled: !!user,
  });

  const today = new Date();

  const openReminder = (invoice: InvoiceRow) => {
    const suggestedLevel: ReminderLevel = invoice.reminder_level >= 2 ? "mise_en_demeure" : invoice.reminder_level === 1 ? "ferme" : "courtois";
    const draft = generateReminderDraft(suggestedLevel, {
      clientNom: invoice.clients?.nom || "Client",
      numeroFacture: invoice.numero_facture,
      montantTtc: invoice.montant_ttc,
      dateEcheance: new Date(invoice.date_limite_paiement).toLocaleDateString("fr-FR"),
    });
    form.reset({ level: suggestedLevel, body: draft.body });
    setDialogInvoice(invoice);
  };

  const regenerateBody = (level: ReminderLevel) => {
    if (!dialogInvoice) return;
    const draft = generateReminderDraft(level, {
      clientNom: dialogInvoice.clients?.nom || "Client",
      numeroFacture: dialogInvoice.numero_facture,
      montantTtc: dialogInvoice.montant_ttc,
      dateEcheance: new Date(dialogInvoice.date_limite_paiement).toLocaleDateString("fr-FR"),
    });
    form.setValue("body", draft.body);
  };

  const sendMutation = useMutation({
    mutationFn: async (values: RelanceFormValues) => {
      if (!dialogInvoice || !user) return;
      const clientEmail = dialogInvoice.clients?.email;
      if (!clientEmail) throw new Error("Le client n'a pas d'adresse email — ajoutez-en une avant d'envoyer.");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: { session: s } } = await supabase.auth.getSession();

      const facturxRes = await fetch(`${supabaseUrl}/functions/v1/generate-facturx`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token ?? ""}`, apikey: anonKey },
        body: JSON.stringify({ invoice_id: dialogInvoice.id }),
      });
      if (!facturxRes.ok) { const e = await facturxRes.json().catch(() => ({ error: "Erreur inconnue" })); throw new Error(e.error); }
      const buf = await facturxRes.arrayBuffer();
      let bin = ""; new Uint8Array(buf).forEach(b => bin += String.fromCharCode(b));
      const pdfBase64 = btoa(bin);

      const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token ?? ""}`, apikey: anonKey },
        body: JSON.stringify({
          recipientEmails: [clientEmail], fileName: `${dialogInvoice.numero_facture}.pdf`,
          pdfBase64, emailBody: values.body, invoiceNumber: dialogInvoice.numero_facture,
        }),
      });
      if (!sendRes.ok) { const e = await sendRes.json().catch(() => ({ error: "Erreur inconnue" })); throw new Error(e.error || `Erreur envoi (${sendRes.status})`); }

      const levelNum = LEVEL_NUM[values.level];
      await supabase.from("payment_reminders").insert({ invoice_id: dialogInvoice.id, level: levelNum, channel: "email", user_id: user.id });
      await supabase.from("invoices").update({ reminder_level: levelNum }).eq("id", dialogInvoice.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices-unpaid"] });
      toast.success("Relance envoyée");
      setDialogInvoice(null);
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setSending(false),
  });

  const companyName = (inv: InvoiceRow) => inv.clients?.nom || "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        padding: isMobile ? "12px 16px" : "16px 24px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-1)", margin: 0, letterSpacing: "-0.02em", flex: 1 }}>
          Impayés &amp; relances
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>
        {isLoading ? (
          <div style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            <Icon name="check" size={36} style={{ marginBottom: 10, display: "block", margin: "0 auto 10px" }} />
            Aucune facture impayée
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invoices.map(inv => {
              const effectiveStatut = effectiveStatutPaiement(inv.date_limite_paiement, inv.statut_paiement, today);
              const style = STATUT_STYLE[effectiveStatut] ?? STATUT_STYLE.impaye;
              const late = isLate(inv.date_limite_paiement, inv.statut_paiement, today);
              return (
                <div key={inv.id} style={{
                  background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r-3)",
                  padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: style.bg, color: style.color, flexShrink: 0 }}>
                    {style.label}
                  </span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>
                      {inv.numero_facture} — {companyName(inv)}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                      Échéance {new Date(inv.date_limite_paiement).toLocaleDateString("fr-FR")}
                      {late && " · dépassée"}
                      {inv.reminder_level > 0 && ` · ${inv.reminder_level} relance(s) envoyée(s)`}
                    </div>
                  </div>
                  <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{inv.montant_ttc.toFixed(2)} €</span>
                  <Pill size="sm" tone="neutral">{inv.statut_paiement}</Pill>
                  <Button variant="subtle" size="sm" icon="mail" onClick={() => openReminder(inv)}>
                    Préparer une relance
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!dialogInvoice} onOpenChange={open => { if (!open) setDialogInvoice(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Relance — {dialogInvoice?.numero_facture}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(values => { setSending(true); sendMutation.mutate(values); })} className="space-y-4">
              <FormField control={form.control} name="level" render={({ field }) => (
                <FormItem>
                  <FormLabel>Niveau de relance</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => { field.onChange(v); regenerateBody(v as ReminderLevel); }}
                  >
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {REMINDER_LEVELS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="body" render={({ field }) => (
                <FormItem>
                  <FormLabel>Message (le client recevra la facture Factur-X en pièce jointe)</FormLabel>
                  <FormControl><Textarea rows={10} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <p style={{ fontSize: 11.5, color: "var(--text-3)", margin: 0 }}>
                L'objet de l'email reste "Facture N° {dialogInvoice?.numero_facture}" (contrainte du service d'envoi actuel) —
                le ton de la relance est porté par ce message.
              </p>

              <button
                type="submit"
                disabled={sending}
                style={{
                  width: "100%", padding: "10px", background: "var(--accent)", color: "var(--accent-on)",
                  border: "none", borderRadius: "var(--r-3)", fontWeight: 500, fontSize: 14, cursor: "pointer",
                  opacity: sending ? 0.7 : 1,
                }}
              >
                {sending ? "Envoi…" : "Envoyer la relance"}
              </button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Relances;
