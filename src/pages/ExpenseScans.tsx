import { useState, useRef, useCallback } from "react";
import { WEBHOOK_URLS } from "@/lib/config";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Camera, Send, Loader2, FileText, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import jsPDF from "jspdf";

const ExpenseScans = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: scans = [], isLoading } = useQuery({
    queryKey: ["expense_scans", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_scans")
        .select("*")
        .eq("status", "à envoyer")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";

    setUploading(true);
    try {
      // Read image as base64
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64 = btoa(binary);
      const mimeType = file.type || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // Step 1: Send to AI for analysis (date extraction)
      toast({ title: "Analyse en cours...", description: "L'IA analyse votre ticket de caisse." });

      const { data: aiResult, error: fnError } = await supabase.functions.invoke("process-expense-scan", {
        body: { imageBase64: base64, mimeType },
      });

      if (fnError) throw fnError;

      const extractedDate = aiResult?.date || new Date().toISOString().split("T")[0];
      const description = aiResult?.description || "Note de frais";

      // Step 2: Create image element for PDF generation
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      });

      // Step 3: Generate PDF with jsPDF
      const isLandscape = img.width > img.height;
      const pdf = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const availW = pageWidth - 2 * margin;
      const availH = pageHeight - 2 * margin;
      const ratio = Math.min(availW / img.width, availH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = (pageWidth - w) / 2;
      const y = (pageHeight - h) / 2;

      pdf.addImage(dataUrl, "JPEG", x, y, w, h);
      const pdfBlob = pdf.output("blob");

      // Step 4: Upload with smart naming [DATE]_NoteDeFrais.pdf
      const dateForName = extractedDate.replace(/-/g, "");
      const fileName = `${user.id}/${dateForName}_NoteDeFrais_${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("expense-scans")
        .upload(fileName, pdfBlob, { contentType: "application/pdf" });

      if (uploadError) throw uploadError;

      // Step 5: Insert record with the storage path (not public URL)
      const { error: insertError } = await supabase
        .from("expense_scans")
        .insert({ user_id: user.id, file_url: fileName, status: "à envoyer" });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["expense_scans"] });
      toast({ title: "Note de frais traitée ✓", description: `${description} — Date: ${extractedDate}` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erreur", description: err.message || "Échec du traitement", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [user, queryClient]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) return;
    setSending(true);
    try {
      const selectedScans = scans.filter((s: any) => selectedIds.has(s.id));
      const signedUrls = await Promise.all(
        selectedScans.map(async (s: any) => {
          const { data } = await supabase.storage
            .from("expense-scans")
            .createSignedUrl(s.file_url, 3600);
          return data?.signedUrl || s.file_url;
        })
      );

      const res = await fetch(WEBHOOK_URLS.EXPENSE_SCANS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: signedUrls }),
      });

      if (!res.ok) throw new Error(`Webhook error: ${res.status}`);

      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await supabase.from("expense_scans").update({ status: "transmis" }).eq("id", id);
      }

      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["expense_scans"] });
      toast({ title: "Transmis !", description: `${ids.length} note(s) de frais envoyée(s) au comptable.` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erreur d'envoi", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scanner Notes de Frais</h1>
        <div className="flex gap-2">
          <Button onClick={handleCapture} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
            {uploading ? "Traitement IA..." : "Prendre une photo"}
          </Button>
          {selectedIds.size > 0 && (
            <Button onClick={handleSend} disabled={sending} variant="default">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Transmettre la sélection ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : scans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium">Aucune note de frais à envoyer</p>
            <p className="text-sm">Prenez une photo pour commencer</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {scans.map((scan: any) => (
            <Card
              key={scan.id}
              className={`cursor-pointer transition-colors ${selectedIds.has(scan.id) ? "border-primary bg-primary/5" : ""}`}
              onClick={() => toggleSelect(scan.id)}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <Checkbox
                  checked={selectedIds.has(scan.id)}
                  onCheckedChange={() => toggleSelect(scan.id)}
                />
                <FileText className="w-8 h-8 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {scan.file_url.split("/").pop()?.replace(/_\d+\.pdf$/, ".pdf") || "Note de frais"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(scan.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
                  </p>
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const { data } = await supabase.storage
                        .from("expense-scans")
                        .createSignedUrl(scan.file_url, 300);
                      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                    }}
                  >
                    Voir le PDF
                  </button>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 shrink-0">
                  À envoyer
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpenseScans;
