import { useState, useEffect, useRef } from "react";
import { N8N_INVOICE_WEBHOOK } from "@/lib/config";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plus, FileDown, Receipt, CalendarIcon, Trash2, Upload, Loader2, Send, Pencil, ChevronDown, Mic, HelpCircle, CheckCircle, Clock, FileCheck } from "lucide-react";
import { generateInvoicePDF, generateInvoicePDFBase64 } from "@/lib/pdf-generator";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type Company = Tables<"companies">;
type Invoice = Tables<"invoices">;

const Invoices = () => {
  const { user, session, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [dateFacturation, setDateFacturation] = useState<Date | undefined>();
  const [nombreJours, setNombreJours] = useState("");
  const [designation, setDesignation] = useState("");

  const [tjm, setTjm] = useState(0);
  const [conditionsPaiement, setConditionsPaiement] = useState(30);
  const [modePaiement, setModePaiement] = useState("VIREMENT");
  const [descriptifMission, setDescriptifMission] = useState("");
  const [numeroBonCommande, setNumeroBonCommande] = useState("");
  const [factureNumber, setFactureNumber] = useState("");

  const [importing, setImporting] = useState(false);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [currentInvoiceToSend, setCurrentInvoiceToSend] = useState<any>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const recognitionRef = useRef<any>(null);

  const montantHT = tjm * (parseFloat(nombreJours) || 0);
  const montantTVA = montantHT * 0.2;
  const montantTTC = montantHT + montantTVA;

  // Realtime : mise à jour du statut quand n8n a fini la génération Factur-X
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("invoices_status_realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "invoices", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["invoices"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("denomination");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-company", selectedCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("company_id", selectedCompanyId).order("nom");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompanyId,
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", user?.id, selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from("invoices").select("*, clients(nom), companies(denomination)").order("date_facturation", { ascending: false });
      if (selectedCompanyId) query = query.eq("company_id", selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    const client = clients.find((c) => c.id === selectedClientId);
    if (client) {
      setTjm(client.tjm);
      setConditionsPaiement(client.conditions_paiement);
      setModePaiement(client.mode_paiement);
      setDescriptifMission(client.descriptif_mission);
      setNumeroBonCommande(client.numero_bon_commande);
    }
  }, [selectedClientId, clients]);

  const generateInvoiceNumber = async () => {
    const { data: settings } = await supabase.from("invoice_settings")
      .select("*")
      .eq("company_id", selectedCompanyId)
      .single();

    if (!settings) return `FAC-${String(1).padStart(3, "0")}`;

    const numLen = settings.numero_format.length;
    const numStr = String(settings.next_number).padStart(numLen, "0");
    let result = "";
    const sep = settings.separator || "";
    if (settings.prefix) result += settings.prefix + sep;
    if (settings.code) result += settings.code;
    result += numStr;
    if (settings.suffix_date_format) {
      const dateForFormat = dateFacturation || new Date();
      let datePart = settings.suffix_date_format
        .replace("AAAA", String(dateForFormat.getFullYear()))
        .replace("MM", String(dateForFormat.getMonth() + 1).padStart(2, "0"))
        .replace("JJ", String(dateForFormat.getDate()).padStart(2, "0"));
      result += sep + datePart;
    }

    await supabase.from("invoice_settings")
      .update({ next_number: settings.next_number + 1 })
      .eq("id", settings.id);

    return result;
  };

  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedCompanyId) return;

    // Need at least one client for the company to link the invoice
    const { data: companyClients } = await supabase.from("clients").select("id, nom").eq("company_id", selectedCompanyId);
    if (!companyClients || companyClients.length === 0) {
      toast.error("Veuillez d'abord créer un client pour cette entreprise avant d'importer des factures.");
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await supabase.functions.invoke("parse-invoice", {
          body: formData,
        });

        if (response.error) throw new Error(response.error.message);
        const extracted = response.data?.data;
        if (!extracted) throw new Error("Données non extraites");

        // Try to match client by name
        const matchedClient = companyClients.find(
          (c) => c.nom.toLowerCase().includes(extracted.client_nom?.toLowerCase() || "") ||
                 (extracted.client_nom || "").toLowerCase().includes(c.nom.toLowerCase())
        );
        const clientId = matchedClient?.id || companyClients[0].id;

        const montantTtc = parseFloat(extracted.montant_ttc) || 0;
        const montantHt = parseFloat(extracted.montant_ht) || 0;
        const montantTva = parseFloat(extracted.montant_tva) || 0;
        const tauxTva = parseFloat(extracted.taux_tva) || 20;

        const payload = {
          company_id: selectedCompanyId,
          client_id: clientId,
          user_id: user!.id,
          numero_facture: extracted.numero_facture || `IMP-${Date.now()}`,
          date_facturation: extracted.date_facturation || new Date().toISOString().split("T")[0],
          date_limite_paiement: extracted.date_facturation || new Date().toISOString().split("T")[0],
          designation: extracted.designation || "",
          nombre_jours: parseFloat(extracted.nombre_jours) || 0,
          tjm: parseFloat(extracted.tjm) || 0,
          montant_ht: montantHt,
          taux_tva: tauxTva,
          montant_tva: montantTva,
          montant_ttc: montantTtc,
          conditions_paiement: parseInt(extracted.conditions_paiement) || 30,
          mode_paiement: extracted.mode_paiement || "VIREMENT",
          descriptif_mission: extracted.descriptif_mission || "",
          numero_bon_commande: extracted.numero_bon_commande || "",
        };

        const { error } = await supabase.from("invoices").insert(payload);
        if (error) throw error;
        successCount++;
      } catch (err: any) {
        console.error(`Erreur import ${file.name}:`, err);
        toast.error(`Erreur pour ${file.name}: ${err.message}`);
        errorCount++;
      }
    }

    setImporting(false);
    if (successCount > 0) {
      toast.success(`${successCount} facture(s) importée(s) avec succès`);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    }
    if (importInputRef.current) importInputRef.current.value = "";
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId || !selectedClientId || !dateFacturation || !nombreJours || !designation || !descriptifMission) {
        throw new Error("Veuillez remplir tous les champs obligatoires");
      }

      const dateLimite = new Date(dateFacturation);
      dateLimite.setDate(dateLimite.getDate() + conditionsPaiement);

      const payload = {
        company_id: selectedCompanyId,
        client_id: selectedClientId,
        user_id: user!.id,
        date_facturation: dateFacturation.toISOString().split("T")[0],
        date_limite_paiement: dateLimite.toISOString().split("T")[0],
        designation,
        nombre_jours: parseFloat(nombreJours),
        tjm,
        montant_ht: montantHT,
        taux_tva: 20,
        montant_tva: montantTVA,
        montant_ttc: montantTTC,
        conditions_paiement: conditionsPaiement,
        mode_paiement: modePaiement,
        descriptif_mission: descriptifMission,
        numero_bon_commande: numeroBonCommande,
      };

      if (editingInvoice) {
        const { data, error } = await supabase.from("invoices").update({ ...payload, numero_facture: factureNumber }).eq("id", editingInvoice.id).select("*").single();
        if (error) throw error;
        return data;
      } else {
        const generatedNumero = factureNumber.trim() || await generateInvoiceNumber();
        const { data, error } = await supabase.from("invoices").insert({ ...payload, numero_facture: generatedNumero }).select("*").single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: async (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(editingInvoice ? "Facture mise à jour" : "Facture créée — génération Factur-X en cours...");

      // Déclenche n8n pour générer le PDF Factur-X (création et modification)
      if (N8N_INVOICE_WEBHOOK) {
        fetch(N8N_INVOICE_WEBHOOK, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ invoice_id: invoice.id, user_id: invoice.user_id }),
        }).catch(console.error);
      }

      setDialogOpen(false);
      setEditingInvoice(null);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Facture supprimée");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setSelectedClientId("");
    setDateFacturation(undefined);
    setNombreJours("");
    setDesignation("");
    setTjm(0);
    setConditionsPaiement(30);
    setModePaiement("VIREMENT");
    setDescriptifMission("");
    setNumeroBonCommande("");
    setFactureNumber("");
    setEditingInvoice(null);
  };

  const openEditInvoice = (inv: any) => {
    setEditingInvoice(inv);
    setSelectedCompanyId(inv.company_id);
    setSelectedClientId(inv.client_id);
    setDateFacturation(new Date(inv.date_facturation));
    setNombreJours(String(inv.nombre_jours));
    setDesignation(inv.designation);
    setTjm(inv.tjm);
    setConditionsPaiement(inv.conditions_paiement);
    setModePaiement(inv.mode_paiement);
    setDescriptifMission(inv.descriptif_mission);
    setNumeroBonCommande(inv.numero_bon_commande);
    setFactureNumber(inv.numero_facture);
    setDialogOpen(true);
  };

  const handleSendInvoice = async () => {
    if (!currentInvoiceToSend || !recipientEmail) return;
    const inv = currentInvoiceToSend;
    setSendingInvoiceId(inv.id);

    try {
      const { data: company } = await supabase.from("companies").select("*").eq("id", inv.company_id).single();
      const { data: client } = await supabase.from("clients").select("*").eq("id", inv.client_id).single();
      if (!company || !client) throw new Error("Données entreprise/client introuvables");

      const dateFactStr = new Date(inv.date_facturation);
      const moisPrestation = dateFactStr.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

      const pdfBase64 = generateInvoicePDFBase64(inv, company, client);

      let emailBody = `Bonjour,\n\nVeuillez trouver ci-joint la facture N° ${inv.numero_facture} pour ${moisPrestation}.\n\nCordialement`;
      try {
        const { data: emailData } = await supabase.functions.invoke("generate-invoice-email", {
          body: {
            invoiceData: {
              numero_facture: inv.numero_facture,
              client_nom: client.nom,
              nom_contact: company.nom_contact,
              nombre_jours: inv.nombre_jours,
              montant_ttc: inv.montant_ttc,
              mois_prestation: moisPrestation,
              descriptif_mission: inv.descriptif_mission,
              designation: inv.designation,
            },
          },
        });
        if (emailData?.emailBody) emailBody = emailData.emailBody;
      } catch (_) {}

      const { error: sendError } = await supabase.functions.invoke("send-invoice-email", {
        body: {
          recipientEmail,
          fileName: `${inv.numero_facture}.pdf`,
          pdfBase64,
          emailBody,
          invoiceNumber: inv.numero_facture,
        },
      });
      if (sendError) throw sendError;

      // Marquer la facture comme envoyée
      await supabase
        .from("invoices")
        .update({ status: "envoyée", sent_at: new Date().toISOString() })
        .eq("id", inv.id);

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Facture envoyée avec succès");
      setSendDialogOpen(false);
      setRecipientEmail("");
      setCurrentInvoiceToSend(null);
    } catch (err: any) {
      toast.error(`Erreur : ${err.message}`);
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const downloadExistingPDF = async (invoice: any) => {
    // Priorité : PDF Factur-X dans Supabase Storage
    if (invoice.facturx_url) {
      const { data } = await supabase.storage
        .from("invoices")
        .createSignedUrl(invoice.facturx_url, 300);
      if (data?.signedUrl) {
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.download = `${invoice.numero_facture}.pdf`;
        a.click();
        return;
      }
    }
    // Fallback : génération jsPDF locale (anciennes factures sans Factur-X)
    const { data: company } = await supabase.from("companies").select("*").eq("id", invoice.company_id).single();
    const { data: client } = await supabase.from("clients").select("*").eq("id", invoice.client_id).single();
    if (company && client) generateInvoicePDF(invoice, company, client);
  };

  const startVoiceRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("La reconnaissance vocale n'est pas supportée par votre navigateur. Utilisez Chrome.");
      return;
    }
    if (!selectedCompanyId) {
      toast.error("Veuillez d'abord sélectionner une entreprise");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      toast.info("🎤 Parlez maintenant... Exemple : \"Facture pour Société ABC, 20 jours, le 15 mars 2026\"");
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      setIsProcessingVoice(true);
      toast.info(`Transcription : "${transcript}". Analyse en cours...`);

      try {
        const { data, error } = await supabase.functions.invoke("extract-voice-invoice", {
          body: { transcript, clients },
        });

        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        const extracted = data?.data;
        if (!extracted) throw new Error("Données non extraites");

        // Match client
        const matchedClient = clients.find(
          (c) => c.nom.toLowerCase().includes(extracted.client_name?.toLowerCase() || "") ||
                 (extracted.client_name || "").toLowerCase().includes(c.nom.toLowerCase())
        );
        if (matchedClient) {
          setSelectedClientId(matchedClient.id);
        }

        if (extracted.date_facturation) {
          setDateFacturation(new Date(extracted.date_facturation));
        }
        if (extracted.nombre_jours) {
          setNombreJours(String(extracted.nombre_jours));
        }

        setDialogOpen(true);
        toast.success("Données extraites ! Vérifiez et complétez le formulaire.");
      } catch (err: any) {
        toast.error(`Erreur d'analyse : ${err.message}`);
      } finally {
        setIsProcessingVoice(false);
      }
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      if (event.error === "no-speech") {
        toast.error("Aucune parole détectée. Réessayez.");
      } else {
        toast.error(`Erreur micro : ${event.error}`);
      }
    };

    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  const StatusBadge = ({ status }: { status?: string }) => {
    if (!status || status === "brouillon")
      return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />En cours</span>;
    if (status === "générée")
      return <span className="inline-flex items-center gap-1 text-xs text-blue-600"><FileCheck className="w-3 h-3" />Factur-X</span>;
    if (status === "envoyée")
      return <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" />Envoyée</span>;
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mes factures</h1>
          <p className="text-muted-foreground">Créez et gérez vos factures</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCompanyId} onValueChange={(val) => {
              setSelectedCompanyId(val);
              const company = companies.find((c) => c.id === val);
              if (company) setDesignation((company as any).designation || "");
            }}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Sélectionner une entreprise" /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.denomination}</SelectItem>)}
            </SelectContent>
          </Select>

          <input
            ref={importInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            multiple
            className="hidden"
            onChange={(e) => handleImportFiles(e.target.files)}
          />
          <Button
            variant="outline"
            disabled={!selectedCompanyId || importing}
            onClick={() => importInputRef.current?.click()}
          >
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {importing ? "Import..." : "Importer"}
          </Button>

          {(isRecording || isProcessingVoice) && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-sm animate-pulse">
              {isRecording ? <><Mic className="w-4 h-4" />Écoute...</> : <><Loader2 className="w-4 h-4 animate-spin" />Analyse...</>}
            </div>
          )}

          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { resetForm(); } setDialogOpen(open); }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!selectedCompanyId}>
                  <Plus className="w-4 h-4 mr-2" />Nouvelle facture<ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />Saisie manuelle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={startVoiceRecording} disabled={isRecording || isProcessingVoice}>
                  <Mic className="w-4 h-4 mr-2" />{isRecording ? "Écoute en cours..." : isProcessingVoice ? "Analyse..." : "Saisie vocale"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingInvoice ? "Modifier la facture" : "Nouvelle facture"}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                <div className="space-y-1">
                  <Label>N° Facture</Label>
                  <Input
                    value={factureNumber}
                    onChange={(e) => setFactureNumber(e.target.value)}
                    placeholder={editingInvoice ? "" : "Laissez vide pour numérotation automatique"}
                    className={!editingInvoice && !factureNumber ? "text-muted-foreground" : ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Client *</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                    <SelectTrigger><SelectValue placeholder="Choisir un client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Date de facturation *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFacturation && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFacturation ? format(dateFacturation, "dd/MM/yyyy") : "Sélectionner une date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFacturation}
                        onSelect={setDateFacturation}
                        initialFocus
                        className="p-3 pointer-events-auto"
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label>Désignation *</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>Nom de la personne qui exécute la mission</TooltipContent>
                    </Tooltip>
                  </div>
                  <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Nom de la personne qui exécute la mission" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>TJM (€) {editingInvoice ? "" : ""}</Label>
                    <Input value={tjm} onChange={editingInvoice ? (e) => setTjm(parseFloat(e.target.value) || 0) : undefined} readOnly={!editingInvoice} className={!editingInvoice ? "bg-muted" : ""} />
                  </div>
                  <div className="space-y-1">
                    <Label>Nombre de jours *</Label>
                    <Input value={nombreJours} onChange={(e) => { if (/^\d*[.,]?\d*$/.test(e.target.value)) setNombreJours(e.target.value.replace(",", ".")); }} placeholder="ex: 20" required />
                  </div>
                </div>
                <div className="space-y-1"><Label>N° Bon de commande *</Label><Input value={numeroBonCommande} onChange={(e) => setNumeroBonCommande(e.target.value)} required /></div>
                <div className="space-y-1"><Label>Descriptif de la mission *</Label><Textarea value={descriptifMission} onChange={(e) => setDescriptifMission(e.target.value)} rows={2} required /></div>

                <Card className="bg-muted/50">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex justify-between"><span>Montant HT</span><span className="font-semibold">{fmt(montantHT)}</span></div>
                    <div className="flex justify-between"><span>TVA 20%</span><span>{fmt(montantTVA)}</span></div>
                    <div className="flex justify-between border-t pt-2"><span className="font-bold">Total TTC</span><span className="font-bold text-lg">{fmt(montantTTC)}</span></div>
                    <div className="flex justify-between text-sm text-muted-foreground"><span>Conditions</span><span>{conditionsPaiement} jours</span></div>
                    <div className="flex justify-between text-sm text-muted-foreground"><span>Mode</span><span>{modePaiement}</span></div>
                  </CardContent>
                </Card>

                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Enregistrement..." : editingInvoice ? "Mettre à jour la facture" : "Créer la facture"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : invoices.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune facture</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Facture</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Montant TTC</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[50px]">PDF</TableHead>
                <TableHead className="w-[50px]">Envoyer</TableHead>
                {isAdmin && <TableHead className="w-[50px]">Suppr.</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.numero_facture}</TableCell>
                  <TableCell>{inv.clients?.nom}</TableCell>
                  <TableCell>{new Date(inv.date_facturation).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>{fmt(inv.montant_ttc)}</TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEditInvoice(inv)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => downloadExistingPDF(inv)}>
                      <FileDown className="w-4 h-4" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={sendingInvoiceId === inv.id}
                      onClick={() => {
                        setCurrentInvoiceToSend(inv);
                        setRecipientEmail("");
                        setSendDialogOpen(true);
                      }}
                    >
                      {sendingInvoiceId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              La facture {inv.numero_facture} sera définitivement supprimée. Cette action est irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(inv.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Envoyer la facture {currentInvoiceToSend?.numero_facture}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Adresse email du destinataire *</Label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="exemple@client.com"
                required
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Les données de la facture seront envoyées au webhook pour traitement automatique.
            </p>
            <Button
              className="w-full"
              disabled={!recipientEmail || sendingInvoiceId !== null}
              onClick={handleSendInvoice}
            >
              {sendingInvoiceId ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi en cours...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" />Envoyer la facture</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
