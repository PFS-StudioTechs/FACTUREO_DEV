import { useState, useRef, useCallback, useEffect } from "react";
import { N8N_EXPENSE_WEBHOOK } from "@/lib/config";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Camera,
  Send,
  Loader2,
  FileText,
  Image as ImageIcon,
  Pencil,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type ExpenseScan = {
  id: string;
  user_id: string;
  file_url: string;
  image_url: string | null;
  pdf_url: string | null;
  status: string;
  amount: number | null;
  merchant: string | null;
  category: string | null;
  expense_date: string | null;
  notes: string | null;
  created_at: string;
};

type EditForm = {
  merchant: string;
  amount: string;
  category: string;
  expense_date: string;
  notes: string;
};

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "traitement")
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="w-3 h-3" />
        Traitement IA...
      </Badge>
    );
  if (status === "à revoir")
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600">
        À revoir
      </Badge>
    );
  if (status === "transmis")
    return <Badge className="bg-green-600 hover:bg-green-700">Transmis</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
};

const ExpenseScans = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingScan, setEditingScan] = useState<ExpenseScan | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    merchant: "",
    amount: "",
    category: "",
    expense_date: "",
    notes: "",
  });

  const { data: pendingScans = [], isLoading: loadingPending } = useQuery({
    queryKey: ["expense_scans", "pending", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_scans")
        .select("*")
        .eq("user_id", user!.id)
        .in("status", ["traitement", "à revoir"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ExpenseScan[];
    },
    enabled: !!user,
  });

  const { data: historyScans = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["expense_scans", "history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_scans")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "transmis")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ExpenseScan[];
    },
    enabled: !!user,
  });

  // Realtime : rafraîchit quand n8n met à jour un record
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("expense_scans_realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "expense_scans",
          filter: `user_id=eq.${user.id}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["expense_scans"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const handleCapture = () => fileInputRef.current?.click();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;
      e.target.value = "";
      setUploading(true);

      try {
        // 1. Upload image brute
        const ext = file.name.split(".").pop() || "jpg";
        const imagePath = `${user.id}/images/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("expense-scans")
          .upload(imagePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        // 2. Créer le record en BDD
        const { data: record, error: insertError } = await supabase
          .from("expense_scans")
          .insert({ user_id: user.id, image_url: imagePath, file_url: "", status: "traitement" })
          .select()
          .single();
        if (insertError) throw insertError;

        // 3. Signed URL pour n8n
        const { data: signedData } = await supabase.storage
          .from("expense-scans")
          .createSignedUrl(imagePath, 3600);

        // 4. Déclencher le workflow n8n
        if (N8N_EXPENSE_WEBHOOK) {
          fetch(N8N_EXPENSE_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              record_id: record.id,
              user_id: user.id,
              image_url: signedData?.signedUrl,
              image_path: imagePath,
            }),
          }).catch(console.error);
        }

        queryClient.invalidateQueries({ queryKey: ["expense_scans"] });
        toast({ title: "Photo reçue", description: "L'IA analyse votre note de frais..." });
      } catch (err: any) {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    },
    [user, queryClient]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openEdit = (scan: ExpenseScan) => {
    setEditingScan(scan);
    setEditForm({
      merchant: scan.merchant ?? "",
      amount: scan.amount != null ? String(scan.amount) : "",
      category: scan.category ?? "",
      expense_date: scan.expense_date ?? "",
      notes: scan.notes ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editingScan) return;
    const { error } = await supabase
      .from("expense_scans")
      .update({
        merchant: editForm.merchant || null,
        amount: editForm.amount ? parseFloat(editForm.amount) : null,
        category: editForm.category || null,
        expense_date: editForm.expense_date || null,
        notes: editForm.notes || null,
      })
      .eq("id", editingScan.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["expense_scans"] });
    setEditingScan(null);
    toast({ title: "Modifié", description: "Note de frais mise à jour." });
  };

  const handleSend = async () => {
    const toSend = pendingScans.filter(
      (s) => selectedIds.has(s.id) && s.status === "à revoir"
    );
    if (toSend.length === 0) {
      toast({
        title: "Aucune note prête",
        description: "Sélectionnez des notes dont l'analyse est terminée.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      const scans = await Promise.all(
        toSend.map(async (s) => {
          const path = s.pdf_url || s.file_url;
          const { data } = await supabase.storage
            .from("expense-scans")
            .createSignedUrl(path, 3600);
          return {
            id: s.id,
            pdf_url: data?.signedUrl ?? path,
            merchant: s.merchant,
            amount: s.amount,
            expense_date: s.expense_date,
            category: s.category,
          };
        })
      );

      const { error } = await supabase.functions.invoke("send-expense-email", {
        body: { scans },
      });
      if (error) throw error;

      await Promise.all(
        toSend.map((s) =>
          supabase.from("expense_scans").update({ status: "transmis" }).eq("id", s.id)
        )
      );

      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["expense_scans"] });
      toast({
        title: "Envoyé !",
        description: `${toSend.length} note(s) transmise(s) au comptable.`,
      });
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
    const { data } = await supabase.storage
      .from("expense-scans")
      .createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const ScanCard = ({
    scan,
    selectable = false,
  }: {
    scan: ExpenseScan;
    selectable?: boolean;
  }) => {
    const isReady = scan.status === "à revoir";
    const isSelected = selectedIds.has(scan.id);

    return (
      <Card
        className={`transition-colors ${selectable && isReady ? "cursor-pointer" : ""} ${isSelected ? "border-primary bg-primary/5" : ""}`}
        onClick={() => selectable && isReady && toggleSelect(scan.id)}
      >
        <CardContent className="flex items-start gap-4 py-4">
          {selectable && (
            <Checkbox
              checked={isSelected}
              disabled={!isReady}
              onCheckedChange={() => toggleSelect(scan.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />
          )}
          <FileText className="w-8 h-8 text-muted-foreground shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">{scan.merchant || "—"}</p>
              {scan.amount != null && (
                <span className="text-sm font-medium text-primary">
                  {scan.amount.toFixed(2)} €
                </span>
              )}
              <StatusBadge status={scan.status} />
            </div>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {scan.expense_date && (
                <span>
                  {format(new Date(scan.expense_date), "dd MMM yyyy", { locale: fr })}
                </span>
              )}
              {scan.category && <span>{scan.category}</span>}
              {scan.notes && (
                <span className="italic truncate max-w-[200px]">{scan.notes}</span>
              )}
            </div>
            <div className="flex gap-3 mt-2">
              {(scan.pdf_url || scan.file_url) && (
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={(e) => openPdf(e, scan)}
                >
                  Voir le PDF
                </button>
              )}
              {isReady && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(scan);
                  }}
                >
                  <Pencil className="w-3 h-3" />
                  Modifier
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const readyCount = pendingScans.filter(
    (s) => selectedIds.has(s.id) && s.status === "à revoir"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notes de Frais</h1>
        <div className="flex gap-2">
          <Button onClick={handleCapture} disabled={uploading}>
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Camera className="w-4 h-4 mr-2" />
            )}
            {uploading ? "Upload..." : "Prendre une photo"}
          </Button>
          {readyCount > 0 && (
            <Button onClick={handleSend} disabled={sending}>
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Envoyer au comptable ({readyCount})
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

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            À traiter
            {pendingScans.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                {pendingScans.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            Historique
            {historyScans.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                {historyScans.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {loadingPending ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingScans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mb-4" />
                <p className="text-lg font-medium">Aucune note de frais en attente</p>
                <p className="text-sm">Prenez une photo pour commencer</p>
              </CardContent>
            </Card>
          ) : (
            pendingScans.map((scan) => (
              <ScanCard key={scan.id} scan={scan} selectable />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3 mt-4">
          {loadingHistory ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : historyScans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mb-4" />
                <p className="text-lg font-medium">Aucune note transmise</p>
              </CardContent>
            </Card>
          ) : (
            historyScans.map((scan) => <ScanCard key={scan.id} scan={scan} />)
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingScan} onOpenChange={(open) => !open && setEditingScan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la note de frais</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Marchand</Label>
              <Input
                value={editForm.merchant}
                onChange={(e) => setEditForm((f) => ({ ...f, merchant: e.target.value }))}
                placeholder="Nom du magasin / prestataire"
              />
            </div>
            <div className="grid gap-2">
              <Label>Montant (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editForm.amount}
                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label>Catégorie</Label>
              <Input
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="ex: Restauration, Transport..."
              />
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={editForm.expense_date}
                onChange={(e) => setEditForm((f) => ({ ...f, expense_date: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Commentaire libre"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingScan(null)}>
              Annuler
            </Button>
            <Button onClick={saveEdit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpenseScans;
