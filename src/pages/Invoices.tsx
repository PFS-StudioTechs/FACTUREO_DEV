import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button as ShadButton } from "@/components/ui/button";
import { Input as ShadInput } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Eye, Pencil } from "lucide-react";
import { InvoiceFilters, type FilterKey, type ViewKey } from "@/components/invoices/InvoiceFilters";
import { KanbanBoard } from "@/components/invoices/KanbanBoard";
import { ListView } from "@/components/invoices/ListView";
import { SideSheet } from "@/components/invoices/SideSheet";
import { CreateInvoiceModal, type InvoiceFormData } from "@/components/invoices/CreateInvoiceModal";
import { buildFacturxDocument } from "@/lib/documents/buildDocumentPayload";

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
  const location = useLocation();
  const navigate = useNavigate();

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
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [emailInput,      setEmailInput]      = useState('');
  const [emailBody,        setEmailBody]        = useState('');
  const [editingEmailBody, setEditingEmailBody] = useState(false);
  const [loadingEmailBody, setLoadingEmailBody] = useState(false);
  const [isRecording,     setIsRecording]     = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const prefill = (location.state as any)?.lucaPrefill;
    if (!prefill) return;
    setSelectedCompanyId(prefill.selectedCompanyId || '');
    setEditingInvoice(null);
    setVoicePrefill(prefill);
    setModalOpen(true);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const loadEmailBody = async (inv: any) => {
    setLoadingEmailBody(true);
    const moisPrestation = new Date(inv.date_facturation).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    setEmailBody(`Bonjour,\n\nVeuillez trouver ci-joint la facture N° ${inv.numero_facture} pour ${moisPrestation}.\n\nCordialement`);
    try {
      const { data: company } = await supabase.from("companies").select("*").eq("id", inv.company_id).single();
      const { data: client }  = await supabase.from("clients").select("*").eq("id", inv.client_id).single();
      if (company && client) {
        const { data: emailData } = await supabase.functions.invoke("generate-invoice-email", { body: { invoiceData: { numero_facture: inv.numero_facture, client_nom: client.nom, nom_contact: company.nom_contact, nombre_jours: inv.nombre_jours, montant_ttc: inv.montant_ttc, mois_prestation: moisPrestation, descriptif_mission: inv.descriptif_mission, designation: inv.designation } } });
        if (emailData?.emailBody) setEmailBody(emailData.emailBody);
      }
    } catch (_) {}
    setLoadingEmailBody(false);
  };

  const handleSendInvoice = async () => {
    const allEmails = emailInput.trim() ? [...new Set([...recipientEmails, emailInput.trim()])] : recipientEmails;
    if (!sendInvoice || allEmails.length === 0) return;
    setSendingId(sendInvoice.id);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey     = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: { session: s } } = await supabase.auth.getSession();
      const facturxRes = await fetch(`${supabaseUrl}/functions/v1/generate-facturx`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s?.access_token ?? ""}`, "apikey": anonKey }, body: JSON.stringify({ invoice_id: sendInvoice.id }) });
      if (!facturxRes.ok) { const e = await facturxRes.json().catch(() => ({ error: "Erreur inconnue" })); throw new Error(e.error); }
      const buf = await facturxRes.arrayBuffer();
      let bin = ""; new Uint8Array(buf).forEach(b => bin += String.fromCharCode(b));
      const pdfBase64 = btoa(bin);
      const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s?.access_token ?? ""}`, "apikey": anonKey }, body: JSON.stringify({ recipientEmails: allEmails, fileName: `${sendInvoice.numero_facture}.pdf`, pdfBase64, emailBody, invoiceNumber: sendInvoice.numero_facture }) });
      if (!sendRes.ok) { const e = await sendRes.json().catch(() => ({ error: "Erreur inconnue" })); throw new Error(e.error || `Erreur envoi (${sendRes.status})`); }
      await supabase.from("invoices").update({ status: "envoyée", sent_at: new Date().toISOString() }).eq("id", sendInvoice.id);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`Facture envoyée à ${allEmails.length} destinataire${allEmails.length > 1 ? "s" : ""}`);
      setSendDialogOpen(false); setRecipientEmails([]); setEmailInput(""); setSendInvoice(null);
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

      // Persiste le PDF dans le Storage et indexe-le au Coffre documentaire
      if (user) {
        const storagePath = `${user.id}/${inv.id}-facturx.pdf`;
        const { error: uploadError } = await supabase.storage.from("invoices").upload(storagePath, blob, { contentType: "application/pdf", upsert: true });
        if (!uploadError) {
          await supabase.from("invoices").update({ facturx_url: storagePath }).eq("id", inv.id);
          await supabase.from("documents").upsert(
            buildFacturxDocument({
              userId: user.id, companyId: inv.company_id ?? null, invoiceId: inv.id,
              numeroFacture: inv.numero_facture, storagePath,
              dateDocument: inv.date_facturation || new Date().toISOString().slice(0, 10),
            }),
            { onConflict: "storage_bucket,storage_path" }
          );
        }
      }

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
        setVoicePrefill({
          selectedClientId: matched?.id,
          dateFacturation: extracted.date_facturation ? new Date(extracted.date_facturation) : undefined,
          lines: extracted.nombre_jours ? [{
            designation: matched?.descriptif_mission || '',
            quantite: extracted.nombre_jours,
            unite: 'Jour',
            prix_unitaire_ht: matched?.tjm || 0,
            remise: 0,
            taux_tva: 20,
            motif_exoneration: '',
          }] : undefined,
        });
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
  const openSend = (inv: any) => {
    setSendInvoice(inv);
    setRecipientEmails([]);
    setEmailInput("");
    setEmailBody("");
    setEditingEmailBody(false);
    setSendDialogOpen(true);
    loadEmailBody(inv);
  };

  const addEmail = (raw: string) => {
    const emails = raw.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes("@"));
    if (emails.length === 0) return;
    setRecipientEmails(prev => [...new Set([...prev, ...emails])]);
    setEmailInput("");
  };

  const removeEmail = (email: string) => setRecipientEmails(prev => prev.filter(e => e !== email));
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
            <div className="space-y-2">
              <Label>Destinataires *</Label>
              {recipientEmails.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {recipientEmails.map(email => (
                    <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                      {email}
                      <button type="button" onClick={() => removeEmail(email)} className="ml-0.5 hover:text-destructive transition-colors">×</button>
                    </span>
                  ))}
                </div>
              )}
              <ShadInput
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === "," || e.key === ";") { e.preventDefault(); addEmail(emailInput); } }}
                onBlur={() => { if (emailInput.trim()) addEmail(emailInput); }}
                placeholder="email@client.com — Entrée pour ajouter"
              />
              <p className="text-xs text-muted-foreground">Tapez un email et appuyez sur Entrée pour ajouter plusieurs destinataires</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Message</Label>
                {loadingEmailBody ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Génération…</span>
                ) : (
                  <button type="button" className="text-xs flex items-center gap-1 text-primary hover:underline" onClick={() => setEditingEmailBody(e => !e)}>
                    {editingEmailBody ? <><Eye className="w-3 h-3" />Aperçu</> : <><Pencil className="w-3 h-3" />Modifier</>}
                  </button>
                )}
              </div>
              {editingEmailBody ? (
                <Textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={8}
                  className="text-sm font-mono resize-none"
                />
              ) : (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap min-h-[100px] text-foreground">
                  {loadingEmailBody
                    ? <span className="text-muted-foreground italic">Génération du message…</span>
                    : emailBody || <span className="text-muted-foreground italic">Aucun message</span>}
                </div>
              )}
            </div>
            <ShadButton className="w-full" disabled={(recipientEmails.length === 0 && !emailInput.trim()) || sendingId !== null} onClick={handleSendInvoice}>
              {sendingId ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi…</> : <><Send className="w-4 h-4 mr-2" />Envoyer</>}
            </ShadButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
