import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button as ShadButton } from "@/components/ui/button";
import { Input as ShadInput } from "@/components/ui/input";
import { Loader2, Send } from "lucide-react";
import { InvoiceFilters, type FilterKey, type ViewKey } from "@/components/invoices/InvoiceFilters";
import { KanbanBoard } from "@/components/invoices/KanbanBoard";
import { ListView } from "@/components/invoices/ListView";
import { SideSheet } from "@/components/invoices/SideSheet";
import { CreateInvoiceModal, type InvoiceFormData } from "@/components/invoices/CreateInvoiceModal";

const getStatus = (inv: any): 'draft' | 'sent' | 'late' | 'paid' => {
  if (!inv.status || inv.status === 'brouillon') return 'draft';
  if (inv.status === 'payée') return 'paid';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = inv.date_limite_paiement ? new Date(inv.date_limite_paiement) : null;
  return (due && due < today) ? 'late' : 'sent';
};

const Invoices = () => {
  const { user, session, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [view,            setView]            = useState<ViewKey>('kanban');
  const [filter,          setFilter]          = useState<FilterKey>('all');
  const [sheetOpen,       setSheetOpen]       = useState(false);
  const [sheetInvoiceId,  setSheetInvoiceId]  = useState<string | null>(null);
  const [modalOpen,       setModalOpen]       = useState(false);
  const [editingInvoice,  setEditingInvoice]  = useState<any>(null);
  const [voicePrefill,    setVoicePrefill]    = useState<any>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [importing,       setImporting]       = useState(false);
  const [sendingId,       setSendingId]       = useState<string | null>(null);
  const [generatingId,    setGeneratingId]    = useState<string | null>(null);
  const [sendDialogOpen,  setSendDialogOpen]  = useState(false);
  const [sendInvoice,     setSendInvoice]     = useState<any>(null);
  const [recipientEmail,  setRecipientEmail]  = useState('');
  const [isRecording,     setIsRecording]     = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("invoices_rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "invoices", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["invoices"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, queryClient]);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies", user?.id],
    queryFn: async () => { const { data, error } = await supabase.from("companies").select("*").order("denomination"); if (error) throw error; return data; },
    enabled: !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-company", selectedCompanyId],
    queryFn: async () => { const { data, error } = await supabase.from("clients").select("*").eq("company_id", selectedCompanyId).order("nom"); if (error) throw error; return data; },
    enabled: !!selectedCompanyId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.id, selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("invoices").select("*, clients(nom), companies(denomination), invoice_lines(*)").order("date_facturation", { ascending: false });
      if (selectedCompanyId) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q; if (error) throw error; return data;
    },
    enabled: !!user,
  });

  const sheetInvoice = sheetInvoiceId ? (invoices as any[]).find(i => i.id === sheetInvoiceId) ?? null : null;

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Statut mis à jour');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const generateInvoiceNumber = async (companyId: string, date: Date) => {
    const { data: settings } = await supabase.from("invoice_settings").select("*").eq("company_id", companyId).single();
    if (!settings) return `FAC-${String(1).padStart(3, "0")}`;
    const numLen = settings.numero_format.length;
    const numStr = String(settings.next_number).padStart(numLen, "0");
    const sep = settings.separator || "";
    let result = "";
    if (settings.prefix) result += settings.prefix + sep;
    if (settings.code) result += settings.code;
    result += numStr;
    if (settings.suffix_date_format) {
      let datePart = settings.suffix_date_format
        .replace("AAAA", String(date.getFullYear()))
        .replace("MM", String(date.getMonth() + 1).padStart(2, "0"))
        .replace("JJ", String(date.getDate()).padStart(2, "0"));
      result += sep + datePart;
    }
    await supabase.from("invoice_settings").update({ next_number: settings.next_number + 1 }).eq("id", settings.id);
    return result;
  };

  const saveMutation = useMutation({
    mutationFn: async (form: InvoiceFormData) => {
      const dateLimite = new Date(form.dateFacturation);
      dateLimite.setDate(dateLimite.getDate() + form.conditionsPaiement);

      const computedLines = form.lines.map(l => {
        const base = l.prix_unitaire_ht * l.quantite;
        const ht = base * (1 - l.remise / 100);
        const tva = ht * (l.taux_tva / 100);
        return { ...l, montant_ht: ht, montant_tva: tva, montant_ttc: ht + tva };
      });
      const montant_ht  = computedLines.reduce((s, l) => s + l.montant_ht, 0);
      const montant_tva = computedLines.reduce((s, l) => s + l.montant_tva, 0);
      const montant_ttc = computedLines.reduce((s, l) => s + l.montant_ttc, 0);
      const taux_tva    = computedLines[0]?.taux_tva ?? 20;

      const payload = {
        company_id: form.selectedCompanyId, client_id: form.selectedClientId,
        user_id: user!.id,
        date_facturation: form.dateFacturation.toISOString().split("T")[0],
        date_limite_paiement: dateLimite.toISOString().split("T")[0],
        designation: form.lines[0]?.designation || '',
        nombre_jours: computedLines[0]?.quantite ?? null,
        tjm: computedLines[0]?.prix_unitaire_ht ?? null,
        montant_ht, taux_tva, montant_tva, montant_ttc,
        conditions_paiement: form.conditionsPaiement, mode_paiement: form.modePaiement,
        descriptif_mission: form.descriptifMission, numero_bon_commande: form.numeroBonCommande,
        type: form.type,
      };

      let invoice: any;
      if (editingInvoice) {
        const { data, error } = await supabase.from("invoices").update({ ...payload, numero_facture: form.factureNumber }).eq("id", editingInvoice.id).select("*").single();
        if (error) throw error;
        invoice = data;
        await supabase.from("invoice_lines").delete().eq("invoice_id", invoice.id);
      } else {
        const num = form.factureNumber.trim() || await generateInvoiceNumber(form.selectedCompanyId, form.dateFacturation);
        const { data, error } = await supabase.from("invoices").insert({ ...payload, numero_facture: num }).select("*").single();
        if (error) throw error;
        invoice = data;
      }

      if (computedLines.length > 0) {
        const { error: linesErr } = await supabase.from("invoice_lines").insert(
          computedLines.map((l, i) => ({
            invoice_id: invoice.id, user_id: user!.id, position: i,
            designation: l.designation, quantite: l.quantite, unite: l.unite,
            prix_unitaire_ht: l.prix_unitaire_ht, remise: l.remise,
            taux_tva: l.taux_tva, motif_exoneration: l.motif_exoneration,
            montant_ht: l.montant_ht, montant_tva: l.montant_tva, montant_ttc: l.montant_ttc,
          }))
        );
        if (linesErr) throw linesErr;
      }
      return invoice;
    },
    onSuccess: async (invoice, form) => {
      // Sync first line qty → forecast_months if invoice is still editable
      const status: string = invoice.status ?? 'brouillon';
      if ((status === 'brouillon' || status === 'envoyée') && form.lines.length > 0) {
        const firstLineQty = form.lines[0].quantite;
        const dateF = new Date(form.dateFacturation);
        const month = dateF.getMonth() + 1;
        const invoiceYear = dateF.getFullYear();
        const { data: forecastData } = await (supabase as any)
          .from("forecasts")
          .select("id")
          .eq("user_id", user!.id)
          .eq("year", invoiceYear)
          .order("created_at")
          .limit(1)
          .maybeSingle();
        if (forecastData) {
          await supabase.from("forecast_months").upsert(
            { forecast_id: forecastData.id, user_id: user!.id, month, planned_days: firstLineQty } as any,
            { onConflict: "forecast_id,month" }
          );
          queryClient.invalidateQueries({ queryKey: ["forecast_months"] });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(editingInvoice ? "Facture mise à jour" : "Facture créée — génération Factur-X en cours…");
      setModalOpen(false); setEditingInvoice(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("invoices").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }); toast.success("Facture supprimée"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSendInvoice = async () => {
    if (!sendInvoice || !recipientEmail) return;
    setSendingId(sendInvoice.id);
    try {
      const { data: company } = await supabase.from("companies").select("*").eq("id", sendInvoice.company_id).single();
      const { data: client }  = await supabase.from("clients").select("*").eq("id", sendInvoice.client_id).single();
      if (!company || !client) throw new Error("Données entreprise/client introuvables");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey     = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: { session: s } } = await supabase.auth.getSession();
      const facturxRes = await fetch(`${supabaseUrl}/functions/v1/generate-facturx`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s?.access_token ?? ""}`, "apikey": anonKey }, body: JSON.stringify({ invoice_id: sendInvoice.id }) });
      if (!facturxRes.ok) { const e = await facturxRes.json().catch(() => ({ error: "Erreur inconnue" })); throw new Error(e.error); }
      const buf = await facturxRes.arrayBuffer();
      let bin = ""; new Uint8Array(buf).forEach(b => bin += String.fromCharCode(b));
      const pdfBase64 = btoa(bin);
      const moisPrestation = new Date(sendInvoice.date_facturation).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      let emailBody = `Bonjour,\n\nVeuillez trouver ci-joint la facture N° ${sendInvoice.numero_facture} pour ${moisPrestation}.\n\nCordialement`;
      try {
        const { data: emailData } = await supabase.functions.invoke("generate-invoice-email", { body: { invoiceData: { numero_facture: sendInvoice.numero_facture, client_nom: client.nom, nom_contact: company.nom_contact, nombre_jours: sendInvoice.nombre_jours, montant_ttc: sendInvoice.montant_ttc, mois_prestation: moisPrestation, descriptif_mission: sendInvoice.descriptif_mission, designation: sendInvoice.designation } } });
        if (emailData?.emailBody) emailBody = emailData.emailBody;
      } catch (_) {}
      const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s?.access_token ?? ""}`, "apikey": anonKey }, body: JSON.stringify({ recipientEmail, fileName: `${sendInvoice.numero_facture}.pdf`, pdfBase64, emailBody, invoiceNumber: sendInvoice.numero_facture }) });
      if (!sendRes.ok) { const e = await sendRes.json().catch(() => ({ error: "Erreur inconnue" })); throw new Error(e.error || `Erreur envoi (${sendRes.status})`); }
      await supabase.from("invoices").update({ status: "envoyée", sent_at: new Date().toISOString() }).eq("id", sendInvoice.id);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Facture envoyée avec succès");
      setSendDialogOpen(false); setRecipientEmail(""); setSendInvoice(null);
    } catch (err: any) {
      toast.error(`Erreur : ${err.message}`);
    } finally { setSendingId(null); }
  };

  const handleGenerateFacturx = async (inv: any) => {
    setGeneratingId(inv.id);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey     = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-facturx`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s?.access_token ?? ""}`, "apikey": anonKey }, body: JSON.stringify({ invoice_id: inv.id }) });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: "Erreur inconnue" })); throw new Error(e.error || `HTTP ${res.status}`); }
      const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${inv.numero_facture}.pdf`; a.click(); URL.revokeObjectURL(a.href);
      toast.success("PDF Factur-X généré !");
    } catch (err: any) { toast.error(`Erreur Factur-X : ${err.message}`);
    } finally { setGeneratingId(null); }
  };

  const startVoiceRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Reconnaissance vocale non supportée. Utilisez Chrome."); return; }
    if (!selectedCompanyId) { toast.error("Sélectionnez d'abord une entreprise"); return; }
    const r = new SR(); r.lang = "fr-FR"; r.continuous = false; r.interimResults = false;
    recognitionRef.current = r;
    r.onstart = () => { setIsRecording(true); toast.info("🎤 Parlez maintenant…"); };
    r.onresult = async (e: any) => {
      setIsRecording(false); setIsProcessingVoice(true);
      const transcript = e.results[0][0].transcript;
      toast.info(`"${transcript}" — analyse en cours…`);
      try {
        const { data, error } = await supabase.functions.invoke("extract-voice-invoice", { body: { transcript, clients } });
        if (error || data?.error) throw new Error(error?.message || data?.error);
        const extracted = data?.data; if (!extracted) throw new Error("Données non extraites");
        const matched = clients.find(c => c.nom.toLowerCase().includes(extracted.client_name?.toLowerCase() || "") || (extracted.client_name || "").toLowerCase().includes(c.nom.toLowerCase()));
        setVoicePrefill({ selectedClientId: matched?.id, dateFacturation: extracted.date_facturation ? new Date(extracted.date_facturation) : undefined });
        setModalOpen(true); toast.success("Données extraites ! Vérifiez le formulaire.");
      } catch (err: any) { toast.error(`Erreur analyse : ${err.message}`);
      } finally { setIsProcessingVoice(false); }
    };
    r.onerror = (e: any) => { setIsRecording(false); toast.error(e.error === "no-speech" ? "Aucune parole détectée." : `Erreur micro : ${e.error}`); };
    r.onend = () => setIsRecording(false);
    r.start();
  };

  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedCompanyId) return;
    const { data: companyClients } = await supabase.from("clients").select("id, nom").eq("company_id", selectedCompanyId);
    if (!companyClients?.length) { toast.error("Créez d'abord un client pour cette entreprise."); return; }
    setImporting(true);
    let ok = 0, err = 0;
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData(); formData.append("file", file);
        const res = await supabase.functions.invoke("parse-invoice", { body: formData });
        if (res.error) throw new Error(res.error.message);
        const ext = res.data?.data; if (!ext) throw new Error("Données non extraites");
        const matched = companyClients.find(c => c.nom.toLowerCase().includes(ext.client_nom?.toLowerCase() || "") || (ext.client_nom || "").toLowerCase().includes(c.nom.toLowerCase()));
        const ht = parseFloat(ext.montant_ht) || 0;
        const { error: insErr } = await supabase.from("invoices").insert({ company_id: selectedCompanyId, client_id: matched?.id || companyClients[0].id, user_id: user!.id, numero_facture: ext.numero_facture || `IMP-${Date.now()}`, date_facturation: ext.date_facturation || new Date().toISOString().split("T")[0], date_limite_paiement: ext.date_facturation || new Date().toISOString().split("T")[0], designation: ext.designation || "", nombre_jours: parseFloat(ext.nombre_jours) || 0, tjm: parseFloat(ext.tjm) || 0, montant_ht: ht, taux_tva: parseFloat(ext.taux_tva) || 20, montant_tva: parseFloat(ext.montant_tva) || 0, montant_ttc: parseFloat(ext.montant_ttc) || 0, conditions_paiement: parseInt(ext.conditions_paiement) || 30, mode_paiement: ext.mode_paiement || "VIREMENT", descriptif_mission: ext.descriptif_mission || "", numero_bon_commande: ext.numero_bon_commande || "" });
        if (insErr) throw insErr;
        ok++;
      } catch (e: any) { toast.error(`Erreur ${file.name}: ${e.message}`); err++; }
    }
    setImporting(false);
    if (ok > 0) { toast.success(`${ok} facture(s) importée(s)`); queryClient.invalidateQueries({ queryKey: ["invoices"] }); queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }); }
    if (importRef.current) importRef.current.value = "";
  };

  const openEdit = (inv: any) => { setSelectedCompanyId(inv.company_id); setEditingInvoice(inv); setModalOpen(true); };
  const openSend = (inv: any) => { setSendInvoice(inv); setRecipientEmail(""); setSendDialogOpen(true); };
  const openSheet = (inv: any) => { setSheetInvoiceId(inv.id); setSheetOpen(true); };

  const filtered = filter === 'all' ? invoices : invoices.filter(i => getStatus(i) === filter);
  const counts = (['all', 'draft', 'sent', 'late', 'paid'] as FilterKey[]).reduce((acc, k) => {
    acc[k] = k === 'all' ? invoices.length : invoices.filter(i => getStatus(i) === k).length;
    return acc;
  }, {} as Record<FilterKey, number>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <input ref={importRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: 'none' }} onChange={e => handleImportFiles(e.target.files)} />

      <InvoiceFilters
        filter={filter} setFilter={setFilter}
        view={view} setView={setView}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        setSelectedCompanyId={id => { setSelectedCompanyId(id); }}
        counts={counts}
        importing={importing} onImport={() => importRef.current?.click()}
        isRecording={isRecording} isProcessingVoice={isProcessingVoice}
        onVoice={startVoiceRecording}
        onNewInvoice={() => { setEditingInvoice(null); setVoicePrefill(null); setModalOpen(true); }}
        isMobile={isMobile}
      />

      {!isMobile && view === 'kanban' ? (
        <KanbanBoard
          invoices={filtered} onCardClick={openSheet} sheetOpen={sheetOpen}
          onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
        />
      ) : (
        <ListView
          invoices={filtered} onEdit={openEdit} onDelete={id => deleteMutation.mutate(id)}
          onSend={openSend} onGenerateFacturx={handleGenerateFacturx}
          onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
          isAdmin={isAdmin} sendingId={sendingId} generatingId={generatingId}
        />
      )}

      <SideSheet
        invoice={sheetInvoice} open={sheetOpen} onClose={() => { setSheetOpen(false); setSheetInvoiceId(null); }}
        onEdit={inv => { setSheetOpen(false); openEdit(inv); }}
        onDelete={id => { deleteMutation.mutate(id); setSheetInvoiceId(null); }}
        onSend={inv => { setSheetOpen(false); openSend(inv); }}
        onGenerateFacturx={handleGenerateFacturx}
        onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
        isAdmin={isAdmin} sendingId={sendingId} generatingId={generatingId}
      />

      <CreateInvoiceModal
        open={modalOpen} onClose={() => { setModalOpen(false); setEditingInvoice(null); setVoicePrefill(null); }}
        companies={companies} clients={clients}
        onCompanyChange={setSelectedCompanyId}
        editingInvoice={editingInvoice} voicePrefill={voicePrefill}
        onSave={data => saveMutation.mutate(data)}
        isPending={saveMutation.isPending}
      />

      {/* Send email dialog — keep as shadcn for form accessibility */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Envoyer {sendInvoice?.numero_facture}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Email destinataire *</Label>
              <ShadInput type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="exemple@client.com" />
            </div>
            <ShadButton className="w-full" disabled={!recipientEmail || sendingId !== null} onClick={handleSendInvoice}>
              {sendingId ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi…</> : <><Send className="w-4 h-4 mr-2" />Envoyer</>}
            </ShadButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
