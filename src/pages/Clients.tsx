import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button, Pill, Avatar, Money } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Tables } from "@/integrations/supabase/types";
import SiretLookupField from "@/components/ui/SiretLookupField";

type Client = Tables<"clients">;

const fmtTjm = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const ClientCard = ({ client, onEdit, onDelete, isMobile }: { client: Client; onEdit: (c: Client) => void; onDelete: (id: string) => void; isMobile: boolean }) => (
  <div
    style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-4)', padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'transform 200ms cubic-bezier(.2,.7,.3,1), box-shadow 200ms ease, border-color 200ms ease',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = 'var(--shadow-2), var(--accent-glow)';
      e.currentTarget.style.borderColor = 'var(--border-strong)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.borderColor = 'var(--border)';
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar name={client.nom} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {client.nom}
        </div>
        {client.siret && (
          <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginTop: 2 }}>
            {client.siret}
          </div>
        )}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Money value={fmtTjm(client.tjm)} color="var(--accent-bright)" weight={600} size={15} />
        <Pill size="sm">{client.conditions_paiement}j · {client.mode_paiement}</Pill>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {['edit', 'trash'].map(icon => (
          <button
            key={icon}
            onClick={() => icon === 'edit' ? onEdit(client) : onDelete(client.id)}
            style={{
              width: 28, height: 28, minWidth: isMobile ? 44 : 28, minHeight: isMobile ? 44 : 28,
              borderRadius: 'var(--r-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: icon === 'trash' ? 'var(--danger)' : 'var(--text-3)', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = icon === 'trash' ? 'var(--danger-soft)' : 'var(--bg-3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Icon name={icon} size={14} />
          </button>
        ))}
      </div>
    </div>
  </div>
);

const Clients = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [isParsingContract, setIsParsingContract] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    siret: "", nom: "", adresse: "", ville: "", code_postal: "", numero_bon_commande: "",
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
      if (form.siret && !editingClient) {
        const { data: dup } = await supabase.from("clients").select("id").eq("siret", form.siret).eq("user_id", user!.id).maybeSingle();
        if (dup) throw new Error("Un client avec ce SIRET existe déjà");
      }
      const payload = {
        siret: form.siret || null, nom: form.nom, adresse: form.adresse, ville: form.ville,
        code_postal: form.code_postal, numero_bon_commande: form.numero_bon_commande,
        tjm: tjmNum, descriptif_mission: form.descriptif_mission,
        conditions_paiement: condNum, mode_paiement: form.mode_paiement,
      };
      if (editingClient) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert({ ...payload, company_id: selectedCompanyId, user_id: user!.id });
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
      siret: client.siret ?? "", nom: client.nom, adresse: client.adresse, ville: client.ville,
      code_postal: client.code_postal, numero_bon_commande: client.numero_bon_commande,
      tjm: String(client.tjm), descriptif_mission: client.descriptif_mission,
      conditions_paiement: String(client.conditions_paiement), mode_paiement: client.mode_paiement,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingClient(null);
    setForm({ siret: "", nom: "", adresse: "", ville: "", code_postal: "", numero_bon_commande: "", tjm: "", descriptif_mission: "", conditions_paiement: "30", mode_paiement: "VIREMENT" });
  };

  const handleTjmChange = (value: string) => {
    if (value === "" || /^\d*[.,]?\d*$/.test(value)) setForm({ ...form, tjm: value.replace(",", ".") });
  };

  const handleConditionsChange = (value: string) => {
    if (value === "" || /^\d+$/.test(value)) setForm({ ...form, conditions_paiement: value });
    else toast.error("Les conditions de paiement doivent être un nombre entier");
  };

  const handleImportContract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "text/plain"];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith(".pdf") && !file.name.endsWith(".docx") && !file.name.endsWith(".doc") && !file.name.endsWith(".txt")) {
      toast.error("Format non supporté. Utilisez un PDF, DOCX ou TXT.");
      return;
    }
    setIsParsingContract(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-contract`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erreur lors de l'analyse");
      if (result.success && result.data) {
        const d = result.data;
        setForm({
          siret: "", nom: d.nom || "", adresse: d.adresse || "", ville: d.ville || "",
          code_postal: d.code_postal || "", numero_bon_commande: d.numero_bon_commande || "",
          tjm: d.tjm || "", descriptif_mission: d.descriptif_mission || "",
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

  const filtered = clients.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    (c.siret || '').includes(search)
  );

  const selectStyle: React.CSSProperties = {
    padding: '0 10px', height: 36, borderRadius: 'var(--r-3)',
    background: 'var(--bg-3)', border: '1px solid var(--border)',
    color: 'var(--text-1)', fontSize: 13, cursor: 'pointer', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '12px 16px' : '16px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center', gap: 12, flexWrap: isMobile ? 'nowrap' : 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: isMobile ? undefined : 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>Clients</h1>
          <Pill>{clients.length}</Pill>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Nom, SIRET…"
          style={{
            width: isMobile ? '100%' : 240, padding: '7px 12px', background: 'var(--bg-3)',
            border: '1px solid var(--border)', borderRadius: 'var(--r-3)',
            color: 'var(--text-1)', fontSize: isMobile ? 16 : 13, outline: 'none',
          }}
        />
        <select
          value={selectedCompanyId}
          onChange={e => setSelectedCompanyId(e.target.value)}
          style={{ ...selectStyle, width: isMobile ? '100%' : 200, fontSize: isMobile ? 16 : 13 }}
        >
          <option value="">Toutes les entreprises</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.denomination}</option>)}
        </select>
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.webp,.heic,.heif" style={{ display: 'none' }} onChange={handleImportContract} />
        <div style={{ display: 'flex', gap: 12, ...(isMobile ? { width: '100%' } : {}) }}>
          <Button
            variant="ghost" size="sm"
            disabled={!selectedCompanyId || isParsingContract}
            onClick={() => fileInputRef.current?.click()}
            style={isMobile ? { flex: 1, justifyContent: 'center' } : undefined}
          >
            {isParsingContract ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="fileCheck" size={14} />}
            {isParsingContract ? 'Analyse…' : 'Importer contrat'}
          </Button>
          <Button
            variant="primary" size="sm" icon="plus" disabled={!selectedCompanyId} onClick={() => setDialogOpen(true)}
            style={isMobile ? { flex: 1, justifyContent: 'center' } : undefined}
          >
            Ajouter
          </Button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px 24px' }}>
        {!selectedCompanyId ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-3)' }}>
            <Icon name="users" size={40} />
            <p style={{ fontSize: 14, margin: 0 }}>Sélectionnez une entreprise pour voir ses clients</p>
          </div>
        ) : isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 0', color: 'var(--text-3)' }}>
            <Icon name="users" size={36} />
            <p style={{ fontSize: 13, margin: 0 }}>Aucun client enregistré</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map(client => (
              <ClientCard key={client.id} client={client} onEdit={openEdit} onDelete={id => deleteMutation.mutate(id)} isMobile={isMobile} />
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Modifier le client" : "Nouveau client"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1">
              <Label>SIRET</Label>
              <SiretLookupField
                value={form.siret}
                onChange={(v) => setForm({ ...form, siret: v })}
                onResolved={(d) => setForm(prev => ({
                  ...prev,
                  nom: prev.nom || d.nom,
                  adresse: prev.adresse || d.adresse,
                  code_postal: prev.code_postal || d.code_postal,
                  ville: prev.ville || d.ville,
                }))}
              />
            </div>
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
            <button
              type="submit"
              disabled={saveMutation.isPending}
              style={{
                width: '100%', padding: '10px', background: 'var(--accent)', color: 'var(--accent-on)',
                border: 'none', borderRadius: 'var(--r-3)', fontWeight: 500, fontSize: 14, cursor: 'pointer',
                opacity: saveMutation.isPending ? 0.7 : 1,
              }}
            >
              {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;
