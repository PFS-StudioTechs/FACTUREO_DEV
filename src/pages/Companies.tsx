import { useState, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { HelpCircle, Upload, Loader2 } from "lucide-react";
import { Button, Avatar } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Tables } from "@/integrations/supabase/types";
import SiretLookupField from "@/components/ui/SiretLookupField";

type Company = Tables<"companies">;

const emptyCompany = {
  denomination: "", forme_juridique: "", capital: "", designation: "", nom_contact: "", adresse: "", code_postal: "", ville: "",
  telephone: "", mail: "", mail_envoi: "", siret: "", rcs_rm_ville: "", code_naf: "", tva_intracommunautaire: "",
  banque_titulaire: "", banque_nom: "", banque_adresse: "", bic_swift: "", code_iban: "",
};

const fields: { key: keyof typeof emptyCompany; label: string; section?: string; type?: string; placeholder?: string; tooltip?: string }[] = [
  { key: "denomination", label: "Dénomination", section: "Informations générales" },
  { key: "forme_juridique", label: "Forme juridique" },
  { key: "capital", label: "Capital" },
  { key: "designation", label: "Désignation", placeholder: "Nom de la personne qui exécute la mission", tooltip: "Nom de la personne qui exécute la mission" },
  { key: "nom_contact", label: "Nom du contact / dirigeant" },
  { key: "adresse", label: "Adresse" },
  { key: "code_postal", label: "Code postal" },
  { key: "ville", label: "Ville" },
  { key: "telephone", label: "Téléphone", type: "tel" },
  { key: "mail", label: "Mail", type: "email" },
  { key: "mail_envoi", label: "Adresse mail d'envoi (Gmail)", type: "email" },
  { key: "siret", label: "Siret" },
  { key: "rcs_rm_ville", label: "RCS / RM (ville)" },
  { key: "code_naf", label: "Code NAF" },
  { key: "tva_intracommunautaire", label: "N° TVA Intracommunautaire" },
  { key: "banque_titulaire", label: "Titulaire du compte", section: "Coordonnées Bancaires" },
  { key: "banque_nom", label: "Nom Banque" },
  { key: "banque_adresse", label: "Adresse Banque" },
  { key: "bic_swift", label: "BIC / SWIFT" },
  { key: "code_iban", label: "Code IBAN" },
];

const sanitizePhone = (value: string) => value.replace(/[^\d+]/g, "");

const InfoRow = ({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
    <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: 13, color: 'var(--text-1)', textAlign: 'right', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>
      {value || '—'}
    </span>
  </div>
);

const DetailSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
      {title}
    </div>
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-3)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {children}
    </div>
  </section>
);

const Companies = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyCompany);
  const [isParsing, setIsParsing] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: invSettings } = useQuery({
    queryKey: ["invoice-settings", selectedCompany?.id],
    queryFn: async () => {
      const { data } = await supabase.from("invoice_settings").select("*").eq("company_id", selectedCompany!.id).maybeSingle();
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (form.mail && !emailRegex.test(form.mail)) throw new Error("Adresse mail invalide");
      if (form.mail_envoi && !emailRegex.test(form.mail_envoi)) throw new Error("Adresse mail d'envoi invalide");
      if (form.siret) {
        const { data: dup } = await supabase.from("companies").select("id").eq("siret", form.siret).eq("user_id", user!.id).maybeSingle();
        if (dup) throw new Error("Une entreprise avec ce SIRET existe déjà");
      }
      const { error } = await supabase.from("companies").insert({ ...form, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Entreprise créée");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => { setDialogOpen(false); setForm(emptyCompany); setIsParsing(false); };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!allowed.includes(file.type)) { toast.error("Format non supporté. Utilisez une image (JPG, PNG, WEBP) ou un PDF."); return; }
    setIsParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-company`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || `Erreur ${res.status}`);
      const d = json?.data;
      setForm((prev) => ({
        ...prev,
        denomination: d.denomination || prev.denomination,
        forme_juridique: d.forme_juridique || prev.forme_juridique,
        capital: d.capital || prev.capital,
        nom_contact: d.nom_contact || prev.nom_contact,
        adresse: d.adresse || prev.adresse,
        code_postal: d.code_postal || prev.code_postal,
        ville: d.ville || prev.ville,
        telephone: d.telephone ? sanitizePhone(d.telephone) : prev.telephone,
        mail: d.mail || prev.mail,
        siret: d.siret || prev.siret,
        rcs_rm_ville: d.rcs_rm_ville || prev.rcs_rm_ville,
        code_naf: d.code_naf || prev.code_naf,
        tva_intracommunautaire: d.tva_intracommunautaire || prev.tva_intracommunautaire,
        banque_titulaire: d.banque_titulaire || prev.banque_titulaire,
        banque_nom: d.banque_nom || prev.banque_nom,
        banque_adresse: d.banque_adresse || prev.banque_adresse,
        bic_swift: d.bic_swift || prev.bic_swift,
        code_iban: d.code_iban || prev.code_iban,
      }));
      toast.success("Informations extraites — vérifiez et complétez si nécessaire.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'extraction");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    const updated = { ...form, [key]: key === "telephone" ? sanitizePhone(value) : value };
    if (key === 'siret') {
      const siren = value.replace(/\s/g, '').slice(0, 9);
      if (siren.length === 9 && /^\d+$/.test(siren)) {
        const n = parseInt(siren, 10);
        const k = (12 + 3 * (n % 97)) % 97;
        updated.tva_intracommunautaire = `FR${String(k).padStart(2, '0')}${siren}`;
      } else {
        updated.tva_intracommunautaire = '';
      }
    }
    setForm(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em', flex: 1 }}>Entreprises</h1>
        <Button variant="primary" size="sm" icon="plus" onClick={() => { setForm(emptyCompany); setDialogOpen(true); }}>
          Ajouter
        </Button>
      </div>

      {/* 2-col body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left list - full width on mobile when no company selected */}
        {(!isMobile || !selectedCompany) && (
        <div style={{ width: isMobile ? '100%' : 280, flexShrink: 0, borderRight: isMobile ? 'none' : '1px solid var(--border)', overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isLoading ? (
            <div style={{ padding: 12 }}><SkeletonRows count={4} rowHeight={44} /></div>
          ) : companies.length === 0 ? (
            <EmptyState
              icon="building"
              title="Aucune entreprise"
              description="Ajoute ta première entreprise pour commencer à facturer."
              action={{ label: "Nouvelle entreprise", onClick: () => { setForm(emptyCompany); setDialogOpen(true); } }}
            />
          ) : companies.map(c => {
            const active = selectedCompany?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedCompany(c)}
                style={{
                  padding: '10px 12px', borderRadius: 'var(--r-3)', cursor: 'pointer',
                  background: active ? 'var(--bg-3)' : 'transparent',
                  border: active ? '1px solid var(--border-accent)' : '1px solid transparent',
                  borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background 140ms ease, border-color 140ms ease',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <Avatar name={c.denomination || '?'} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.denomination || 'Sans nom'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{c.forme_juridique || '—'}</div>
                  {c.siret && <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginTop: 1 }}>{c.siret}</div>}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Right detail - full width on mobile when company selected */}
        {(!isMobile || selectedCompany) && (
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 24 }}>
          {isMobile && selectedCompany && (
            <button
              onClick={() => setSelectedCompany(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                color: 'var(--accent-bright)', fontSize: 13, fontWeight: 500,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 0 16px', marginBottom: 4,
              }}
            >
              <Icon name="arrowRight" size={14} style={{ transform: 'rotate(180deg)' }} />
              Retour
            </button>
          )}
          {!selectedCompany ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-3)' }}>
              <Icon name="building" size={40} />
              <p style={{ fontSize: 14, margin: 0 }}>Sélectionnez une entreprise</p>
            </div>
          ) : (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{selectedCompany.denomination || 'Sans nom'}</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
                    {[selectedCompany.forme_juridique, selectedCompany.capital ? `au capital de ${selectedCompany.capital}` : ''].filter(Boolean).join(' ')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" icon="edit" onClick={() => navigate(`/entreprises/${selectedCompany.id}`)}>
                  Modifier
                </Button>
              </div>

              <DetailSection title="Identité">
                <InfoRow label="Dénomination" value={selectedCompany.denomination} />
                <InfoRow label="Forme juridique" value={selectedCompany.forme_juridique} />
                <InfoRow label="Capital" value={selectedCompany.capital} />
                <InfoRow label="SIRET" value={selectedCompany.siret} mono />
                <InfoRow label="TVA Intracom." value={selectedCompany.tva_intracommunautaire} mono />
              </DetailSection>

              <DetailSection title="Coordonnées bancaires">
                <InfoRow label="Titulaire" value={selectedCompany.banque_titulaire} />
                <InfoRow label="IBAN" value={selectedCompany.code_iban} mono />
                <InfoRow label="BIC" value={selectedCompany.bic_swift} mono />
              </DetailSection>

              {invSettings && (
                <DetailSection title="Paramètres facturation">
                  <InfoRow label="Préfixe" value={invSettings.prefix} />
                  <InfoRow label="Format numéro" value={invSettings.numero_format} mono />
                  <InfoRow label="Prochain N°" value={String(invSettings.next_number)} mono />
                </DetailSection>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle entreprise</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-6">
            <div
              className="flex items-center gap-3 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
              onClick={() => !isParsing && fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="hidden" onChange={handleFileImport} />
              {isParsing ? (
                <><Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" /><div><p className="text-sm font-medium">Analyse en cours...</p><p className="text-xs text-muted-foreground">L'IA extrait les informations du document</p></div></>
              ) : (
                <><Upload className="w-5 h-5 text-muted-foreground shrink-0" /><div><p className="text-sm font-medium">Importer un document</p><p className="text-xs text-muted-foreground">JPG, PNG, WEBP ou PDF — les champs seront remplis automatiquement</p></div></>
              )}
            </div>
            {fields.map((field) => (
              <div key={field.key}>
                {field.section && <h3 className="text-lg font-semibold mb-3 mt-2 border-b pb-2">{field.section}</h3>}
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    {field.tooltip && (
                      <Tooltip><TooltipTrigger asChild><HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent>{field.tooltip}</TooltipContent></Tooltip>
                    )}
                  </div>
                  {field.key === "siret" ? (
                    <SiretLookupField
                      value={form.siret}
                      onChange={(v) => setForm({ ...form, siret: v })}
                      onResolved={(d) => setForm(prev => ({
                        ...prev,
                        denomination: prev.denomination || d.denomination,
                        adresse: prev.adresse || d.adresse,
                        code_postal: prev.code_postal || d.code_postal,
                        ville: prev.ville || d.ville,
                      }))}
                    />
                  ) : (
                    <Input
                      id={field.key}
                      type={field.type || "text"}
                      value={form[field.key]}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              </div>
            ))}
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

export default Companies;
