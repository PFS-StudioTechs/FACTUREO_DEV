import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, Upload, FileText, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

const Clients = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [isParsingContract, setIsParsingContract] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    nom: "", adresse: "", ville: "", code_postal: "", numero_bon_commande: "",
    tjm: "", descriptif_mission: "", conditions_paiement: "30", mode_paiement: "VIREMENT",
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("denomination");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", user?.id, selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from("clients").select("*").order("nom");
      if (selectedCompanyId) query = query.eq("company_id", selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId) throw new Error("Sélectionnez une entreprise");

      const tjmNum = parseFloat(form.tjm);
      if (isNaN(tjmNum)) throw new Error("Le TJM doit être numérique");

      const condNum = parseInt(form.conditions_paiement);
      if (isNaN(condNum)) throw new Error("Les conditions de paiement doivent être numériques");

      const payload = {
        nom: form.nom,
        adresse: form.adresse,
        ville: form.ville,
        code_postal: form.code_postal,
        numero_bon_commande: form.numero_bon_commande,
        tjm: tjmNum,
        descriptif_mission: form.descriptif_mission,
        conditions_paiement: condNum,
        mode_paiement: form.mode_paiement,
      };

      if (editingClient) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert({
          ...payload,
          company_id: selectedCompanyId,
          user_id: user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(editingClient ? "Client mis à jour" : "Client créé");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client supprimé");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      nom: client.nom, adresse: client.adresse, ville: client.ville, code_postal: client.code_postal,
      numero_bon_commande: client.numero_bon_commande, tjm: String(client.tjm),
      descriptif_mission: client.descriptif_mission, conditions_paiement: String(client.conditions_paiement),
      mode_paiement: client.mode_paiement,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingClient(null);
    setForm({ nom: "", adresse: "", ville: "", code_postal: "", numero_bon_commande: "", tjm: "", descriptif_mission: "", conditions_paiement: "30", mode_paiement: "VIREMENT" });
  };

  const handleTjmChange = (value: string) => {
    if (value === "" || /^\d*[.,]?\d*$/.test(value)) {
      setForm({ ...form, tjm: value.replace(",", ".") });
    }
  };

  const handleConditionsChange = (value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      setForm({ ...form, conditions_paiement: value });
    } else {
      toast.error("Les conditions de paiement doivent être un nombre entier");
    }
  };

  const handleImportContract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith(".pdf") && !file.name.endsWith(".docx") && !file.name.endsWith(".doc") && !file.name.endsWith(".txt")) {
      toast.error("Format non supporté. Utilisez un PDF, DOCX ou TXT.");
      return;
    }

    setIsParsingContract(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-contract`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de l'analyse");
      }

      if (result.success && result.data) {
        const d = result.data;
        setForm({
          nom: d.nom || "",
          adresse: d.adresse || "",
          ville: d.ville || "",
          code_postal: d.code_postal || "",
          numero_bon_commande: d.numero_bon_commande || "",
          tjm: d.tjm || "",
          descriptif_mission: d.descriptif_mission || "",
          conditions_paiement: d.conditions_paiement || "30",
          mode_paiement: d.mode_paiement && ["VIREMENT", "CHEQUE", "PRELEVEMENT", "ESPECES"].includes(d.mode_paiement) ? d.mode_paiement : "VIREMENT",
        });
        setDialogOpen(true);
        toast.success("Contrat analysé ! Vérifiez les informations avant d'enregistrer.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'import");
    } finally {
      setIsParsingContract(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Gérez les clients de vos entreprises</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Toutes les entreprises" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.denomination}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Import depuis contrat */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.webp,.heic,.heif"
            className="hidden"
            onChange={handleImportContract}
          />
          <Button
            variant="outline"
            disabled={!selectedCompanyId || isParsingContract}
            onClick={() => fileInputRef.current?.click()}
          >
            {isParsingContract ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            {isParsingContract ? "Analyse..." : "Importer contrat"}
          </Button>

          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button disabled={!selectedCompanyId}><Plus className="w-4 h-4 mr-2" />Ajouter</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingClient ? "Modifier le client" : "Nouveau client"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                <div className="space-y-1"><Label>Nom</Label><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Adresse</Label><Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Ville</Label><Input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Code postal</Label><Input value={form.code_postal} onChange={(e) => setForm({ ...form, code_postal: e.target.value })} /></div>
                </div>
                <div className="space-y-1"><Label>N° Bon de commande</Label><Input value={form.numero_bon_commande} onChange={(e) => setForm({ ...form, numero_bon_commande: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>TJM (€)</Label><Input value={form.tjm} onChange={(e) => handleTjmChange(e.target.value)} placeholder="ex: 690.00" required /></div>
                  <div className="space-y-1"><Label>Conditions de paiement (jours)</Label><Input value={form.conditions_paiement} onChange={(e) => handleConditionsChange(e.target.value)} required /></div>
                </div>
                <div className="space-y-1">
                  <Label>Mode de paiement</Label>
                  <Select value={form.mode_paiement} onValueChange={(v) => setForm({ ...form, mode_paiement: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIREMENT">Virement</SelectItem>
                      <SelectItem value="CHEQUE">Chèque</SelectItem>
                      <SelectItem value="PRELEVEMENT">Prélèvement</SelectItem>
                      <SelectItem value="ESPECES">Espèces</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Descriptif de la mission</Label><Textarea value={form.descriptif_mission} onChange={(e) => setForm({ ...form, descriptif_mission: e.target.value })} rows={3} /></div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!selectedCompanyId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Sélectionnez une entreprise pour voir ses clients</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : clients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun client enregistré</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>TJM</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Mode paiement</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.nom}</TableCell>
                  <TableCell>{client.ville}</TableCell>
                  <TableCell>{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(client.tjm)}</TableCell>
                  <TableCell>{client.conditions_paiement} jours</TableCell>
                  <TableCell>{client.mode_paiement}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(client)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(client.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default Clients;
