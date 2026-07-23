import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runExpenseOcr } from "@/lib/expenseOcr";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button, Pill } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { useIsMobile } from "@/hooks/use-mobile";
import { ExpenseGrid, type ExpenseScan } from "@/components/expenses/ExpenseGrid";
import { ExpenseSkeleton } from "@/components/expenses/ExpenseSkeleton";
import { ExpenseUpload } from "@/components/expenses/ExpenseUpload";
import { EmptyState } from "@/components/ui/EmptyState";
import { buildExpenseScanDocument } from "@/lib/documents/buildDocumentPayload";

type EditForm = { merchant: string; amount: string; category: string; expense_date: string; notes: string };

type TabKey = 'pending' | 'history';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ExpenseScans = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingScan, setEditingScan] = useState<ExpenseScan | null>(null);
  const [tab, setTab] = useState<TabKey>('pending');
  const [editForm, setEditForm] = useState<EditForm>({ merchant: "", amount: "", category: "", expense_date: "", notes: "" });

  const { data: pendingScans = [], isLoading: loadingPending } = useQuery({
    queryKey: ["expense_scans", "pending", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_scans").select("*").eq("user_id", user!.id).in("status", ["traitement", "à revoir"]).order("created_at", { ascending: false });
      if (error) throw error;
      return data as ExpenseScan[];
    },
    enabled: !!user,
  });

  const { data: historyScans = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["expense_scans", "history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_scans").select("*").eq("user_id", user!.id).eq("status", "transmis").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ExpenseScan[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("expense_scans_realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "expense_scans", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["expense_scans"] })
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const handleCapture = () => fileInputRef.current?.click();

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const imagePath = `${user.id}/images/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("expense-scans").upload(imagePath, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: record, error: insertError } = await supabase.from("expense_scans")
        .insert({ user_id: user.id, image_url: imagePath, file_url: imagePath, status: "traitement" })
        .select().single();
      if (insertError) throw insertError;

      await supabase.from("documents").upsert(
        buildExpenseScanDocument({
          userId: user.id, scanId: record.id, storagePath: imagePath,
          dateDocument: new Date().toISOString().slice(0, 10),
        }),
        { onConflict: "storage_bucket,storage_path" }
      );

      queryClient.invalidateQueries({ queryKey: ["expense_scans"] });
      toast({ title: "Photo reçue", description: "L'IA analyse votre note de frais..." });

      // Analyse OCR puis passage en statut "à revoir" — l'utilisateur complète
      // ensuite les champs manquants (marchand/montant/catégorie) via l'édition.
      const imageBase64 = await fileToBase64(file);
      await runExpenseOcr(record.id, imageBase64, file.type, {
        invoke: (name, opts) => supabase.functions.invoke(name, opts),
        updateStatus: async (scanId, patch) => { await supabase.from("expense_scans").update(patch).eq("id", scanId); },
      });
      queryClient.invalidateQueries({ queryKey: ["expense_scans"] });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [user, queryClient]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openEdit = (scan: ExpenseScan) => {
    setEditingScan(scan);
    setEditForm({
      merchant: scan.merchant ?? "", amount: scan.amount != null ? String(scan.amount) : "",
      category: scan.category ?? "", expense_date: scan.expense_date ?? "", notes: scan.notes ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editingScan) return;
    const { error } = await supabase.from("expense_scans").update({
      merchant: editForm.merchant || null,
      amount: editForm.amount ? parseFloat(editForm.amount) : null,
      category: editForm.category || null,
      expense_date: editForm.expense_date || null,
      notes: editForm.notes || null,
    }).eq("id", editingScan.id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["expense_scans"] });
    setEditingScan(null);
    toast({ title: "Modifié", description: "Note de frais mise à jour." });
  };

  const handleSend = async () => {
    const toSend = pendingScans.filter(s => selectedIds.has(s.id) && s.status === "à revoir");
    if (toSend.length === 0) {
      toast({ title: "Aucune note prête", description: "Sélectionnez des notes dont l'analyse est terminée.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const scans = await Promise.all(toSend.map(async s => {
        const path = s.pdf_url || s.file_url;
        const { data } = await supabase.storage.from("expense-scans").createSignedUrl(path, 3600);
        return { id: s.id, pdf_url: data?.signedUrl ?? path, merchant: s.merchant, amount: s.amount, expense_date: s.expense_date, category: s.category };
      }));
      const { error } = await supabase.functions.invoke("send-expense-email", { body: { scans } });
      if (error) throw error;
      await Promise.all(toSend.map(s => supabase.from("expense_scans").update({ status: "transmis" }).eq("id", s.id)));
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["expense_scans"] });
      toast({ title: "Envoyé !", description: `${toSend.length} note(s) transmise(s) au comptable.` });
    } catch (err: any) {
      toast({ title: "Erreur d'envoi", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const openPdf = async (e: React.MouseEvent, scan: ExpenseScan) => {
    e.stopPropagation();
    const path = scan.pdf_url || scan.file_url;
    if (!path) return;
    const { data } = await supabase.storage.from("expense-scans").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const readyCount = pendingScans.filter(s => selectedIds.has(s.id) && s.status === "à revoir").length;

  const TabBtn = ({ value, label, count }: { value: TabKey; label: string; count: number }) => (
    <button
      onClick={() => setTab(value)}
      style={{
        padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        border: 'none', borderRadius: 'var(--r-3)',
        background: tab === value ? 'var(--bg-3)' : 'transparent',
        color: tab === value ? 'var(--text-1)' : 'var(--text-3)',
        display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 140ms ease',
      }}
    >
      {label}
      {count > 0 && <Pill size="sm" tone={tab === value ? 'accent' : 'neutral'}>{count}</Pill>}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '12px 16px' : '16px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center', gap: 12,
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em', flex: isMobile ? undefined : 1 }}>Notes de frais</h1>
        <div style={{ display: 'flex', gap: 8, ...(isMobile ? { width: '100%' } : {}) }}>
          {readyCount > 0 && (
            <Button variant="primary" size="sm" icon="send" disabled={sending} onClick={handleSend} style={isMobile ? { flex: 1, justifyContent: 'center' } : undefined}>
              {sending ? 'Envoi…' : `Envoyer au comptable (${readyCount})`}
            </Button>
          )}
          <Button variant="subtle" size="sm" disabled={uploading} onClick={handleCapture} style={isMobile ? { flex: 1, justifyContent: 'center' } : undefined}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="plus" size={14} />}
            {uploading ? 'Upload…' : 'Prendre une photo'}
          </Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Tabs */}
      <div style={{ padding: '12px 24px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4 }}>
        <TabBtn value="pending" label="À traiter" count={pendingScans.length} />
        <TabBtn value="history" label="Historique" count={historyScans.length} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
        {tab === 'pending' && (
          loadingPending ? <ExpenseSkeleton /> :
          pendingScans.length === 0 ? (
            <ExpenseUpload onClick={handleCapture} uploading={uploading} />
          ) : (
            <ExpenseGrid scans={pendingScans} selectable selectedIds={selectedIds} onToggle={toggleSelect} onEdit={openEdit} onOpenPdf={openPdf} />
          )
        )}
        {tab === 'history' && (
          loadingHistory ? <ExpenseSkeleton /> :
          historyScans.length === 0 ? (
            <EmptyState icon="fileCheck" title="Aucune note transmise" description="Les notes de frais traitées apparaîtront ici." />
          ) : (
            <ExpenseGrid scans={historyScans} selectedIds={new Set()} onToggle={() => {}} onEdit={() => {}} onOpenPdf={openPdf} />
          )
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingScan} onOpenChange={open => !open && setEditingScan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier la note de frais</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Marchand</Label>
              <Input value={editForm.merchant} onChange={e => setEditForm(f => ({ ...f, merchant: e.target.value }))} placeholder="Nom du magasin / prestataire" />
            </div>
            <div className="grid gap-2">
              <Label>Montant (€)</Label>
              <Input type="number" step="0.01" min="0" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="grid gap-2">
              <Label>Catégorie</Label>
              <Input value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} placeholder="ex: Restauration, Transport..." />
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input type="date" value={editForm.expense_date} onChange={e => setEditForm(f => ({ ...f, expense_date: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Commentaire libre" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setEditingScan(null)} style={{ padding: '8px 14px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-3)', color: 'var(--text-1)', cursor: 'pointer', fontSize: 13 }}>
              Annuler
            </button>
            <Button variant="primary" size="sm" onClick={saveEdit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpenseScans;
