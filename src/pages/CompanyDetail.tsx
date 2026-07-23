import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Tables } from "@/integrations/supabase/types";

type Company = Tables<"companies">;

const emptyCompany = {
  denomination: "", forme_juridique: "", capital: "", designation: "", nom_contact: "", adresse: "", code_postal: "", ville: "",
  telephone: "", mail: "", mail_envoi: "", siret: "", rcs_rm_ville: "", code_naf: "", tva_intracommunautaire: "",
  banque_titulaire: "", banque_nom: "", banque_adresse: "", bic_swift: "", code_iban: "",
  forme_juridique_categorie: "micro", regime_tva: "franchise", regime_fiscal: "micro",
};

const FORME_JURIDIQUE_CATEGORIE_OPTIONS: { value: string; label: string }[] = [
  { value: "micro", label: "Micro-entreprise" },
  { value: "ei", label: "Entreprise Individuelle (EI)" },
  { value: "eurl", label: "EURL" },
  { value: "sasu", label: "SASU" },
  { value: "sarl", label: "SARL" },
  { value: "autre", label: "Autre" },
];

const REGIME_TVA_OPTIONS: { value: string; label: string }[] = [
  { value: "franchise", label: "Franchise en base de TVA" },
  { value: "reel_simplifie", label: "Réel simplifié" },
  { value: "reel_normal", label: "Réel normal" },
];

const REGIME_FISCAL_OPTIONS: { value: string; label: string }[] = [
  { value: "micro", label: "Micro-fiscal" },
  { value: "ir", label: "Impôt sur le revenu (IR)" },
  { value: "is", label: "Impôt sur les sociétés (IS)" },
];

const labelFor = (options: { value: string; label: string }[], value?: string | null) =>
  options.find(o => o.value === value)?.label || value || "—";

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
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '4px 0' }}>
    <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: 13, color: 'var(--text-1)', textAlign: 'right', wordBreak: 'break-word', maxWidth: '60%', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>
      {value || '—'}
    </span>
  </div>
);

const SectionCard = ({ title, items }: { title: string; items: { label: string; value?: string | null; mono?: boolean }[] }) => (
  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-4)', overflow: 'hidden' }}>
    <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
      {title}
    </div>
    <div style={{ padding: '8px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map(item => <InfoRow key={item.label} {...item} />)}
    </div>
  </div>
);

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyCompany);
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    if (stripeParam === "done" && id) {
      supabase.functions.invoke("stripe-connect-status", { body: { company_id: id } }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["company", id] });
        const next = new URLSearchParams(searchParams);
        next.delete("stripe");
        setSearchParams(next, { replace: true });
      });
    }
  }, [id]);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const openEdit = () => {
    if (!company) return;
    const f: Record<string, string> = {};
    for (const field of fields) f[field.key] = (company as Record<string, unknown>)[field.key] as string || "";
    const c = company as Record<string, unknown>;
    f.forme_juridique_categorie = (c.forme_juridique_categorie as string) || "micro";
    f.regime_tva = (c.regime_tva as string) || "franchise";
    f.regime_fiscal = (c.regime_fiscal as string) || "micro";
    setForm(f as typeof emptyCompany);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (form.mail && !emailRegex.test(form.mail)) throw new Error("Adresse mail invalide");
      if (form.mail_envoi && !emailRegex.test(form.mail_envoi)) throw new Error("Adresse mail d'envoi invalide");
      const { error } = await supabase.from("companies").update(form).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Entreprise mise à jour");
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Entreprise supprimée");
      navigate("/entreprises");
    },
    onError: (err: Error) => toast.error(err.message),
  });

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

  if (isLoading) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton height={28} width={220} />
      <Skeleton height={16} width={140} />
      <div style={{ marginTop: 12 }}><Skeleton height={220} /></div>
    </div>
  );
  if (!company) return (
    <EmptyState icon="building" title="Entreprise introuvable" description="Elle a peut-être été supprimée ou l'adresse est incorrecte." />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Breadcrumb + header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <button
            onClick={() => navigate('/entreprises')}
            style={{ fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; }}
          >
            Entreprises
          </button>
          <Icon name="chevronRight" size={12} color="var(--text-3)" />
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{company.denomination || 'Sans nom'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              onClick={() => navigate('/entreprises')}
              style={{
                width: 32, height: 32, minWidth: isMobile ? 44 : 32, minHeight: isMobile ? 44 : 32,
                borderRadius: 'var(--r-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-3)', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-2)', flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-2)'; }}
            >
              <Icon name="arrowRight" size={14} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                fontSize: 20, fontWeight: 600, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {company.denomination || 'Sans nom'}
              </h1>
              <p style={{
                fontSize: 12, color: 'var(--text-3)', margin: '3px 0 0',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {[company.forme_juridique, company.capital ? `au capital de ${company.capital}` : ''].filter(Boolean).join(' ') || '—'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, ...(isMobile ? { width: '100%' } : {}) }}>
            <Button variant="ghost" size="sm" icon="edit" onClick={openEdit} style={isMobile ? { flex: 1, justifyContent: 'center' } : undefined}>Modifier</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="danger" size="sm" icon="trash" style={isMobile ? { flex: 1, justifyContent: 'center' } : undefined}>Supprimer</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette entreprise ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L'entreprise « {company.denomination} » sera définitivement supprimée. Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard
            title="Identité"
            items={[
              { label: "Dénomination", value: company.denomination },
              { label: "Forme juridique", value: company.forme_juridique },
              { label: "Capital", value: company.capital },
              { label: "Désignation", value: company.designation },
              { label: "Contact / dirigeant", value: company.nom_contact },
              { label: "Adresse", value: [company.adresse, company.code_postal, company.ville].filter(Boolean).join(', ') },
              { label: "Téléphone", value: company.telephone },
              { label: "Mail", value: company.mail },
              { label: "Mail d'envoi", value: company.mail_envoi },
              { label: "SIRET", value: company.siret, mono: true },
              { label: "RCS / RM", value: company.rcs_rm_ville },
              { label: "Code NAF", value: company.code_naf, mono: true },
              { label: "TVA Intracom.", value: company.tva_intracommunautaire, mono: true },
            ]}
          />
          <SectionCard
            title="Profil fiscal"
            items={[
              { label: "Forme juridique (catégorie)", value: labelFor(FORME_JURIDIQUE_CATEGORIE_OPTIONS, (company as Record<string, unknown>).forme_juridique_categorie as string) },
              { label: "Régime de TVA", value: labelFor(REGIME_TVA_OPTIONS, (company as Record<string, unknown>).regime_tva as string) },
              { label: "Régime fiscal", value: labelFor(REGIME_FISCAL_OPTIONS, (company as Record<string, unknown>).regime_fiscal as string) },
            ]}
          />
          <SectionCard
            title="Coordonnées bancaires"
            items={[
              { label: "Titulaire", value: company.banque_titulaire },
              { label: "Banque", value: company.banque_nom },
              { label: "Adresse banque", value: company.banque_adresse },
              { label: "BIC / SWIFT", value: company.bic_swift, mono: true },
              { label: "IBAN", value: company.code_iban, mono: true },
            ]}
          />

          {/* Stripe Connect */}
          {(() => {
            const stripeOnboardingDone = (company as Record<string, unknown>).stripe_onboarding_done as boolean;
            return (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-4)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                  Paiements en ligne (Stripe)
                </div>
                <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  {stripeOnboardingDone ? (
                    <>
                      <div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--green-subtle, #dcfce7)', color: 'var(--green, #16a34a)', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                          Stripe connecté
                        </span>
                        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '8px 0 0' }}>
                          Les paiements en ligne sont activés. Vos clients peuvent payer directement depuis leurs factures.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, maxWidth: 400 }}>
                        Connectez votre compte Stripe pour permettre à vos clients de payer en ligne directement depuis leurs factures.
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={stripeLoading}
                        onClick={async () => {
                          setStripeLoading(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("stripe-connect-start", {
                              body: { company_id: id },
                            });
                            if (error) throw error;
                            if (data?.url) window.location.href = data.url;
                          } catch (err) {
                            toast.error("Impossible de démarrer la connexion Stripe");
                          } finally {
                            setStripeLoading(false);
                          }
                        }}
                      >
                        {stripeLoading ? "Redirection…" : "Connecter Stripe"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'entreprise</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-6">
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
                  <Input
                    id={field.key}
                    type={field.type || "text"}
                    value={form[field.key]}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    pattern={field.type === "email" ? "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}" : field.key === "telephone" ? "[\\d+]*" : undefined}
                    title={field.type === "email" ? "Veuillez saisir une adresse email valide" : field.key === "telephone" ? "Uniquement des chiffres" : undefined}
                    inputMode={field.key === "telephone" ? "tel" : undefined}
                  />
                </div>
              </div>
            ))}

            <h3 className="text-lg font-semibold mb-3 mt-2 border-b pb-2">Profil fiscal</h3>
            <div className="space-y-1">
              <Label htmlFor="forme_juridique_categorie">Forme juridique (catégorie)</Label>
              <Select value={form.forme_juridique_categorie} onValueChange={(v) => handleFieldChange("forme_juridique_categorie", v)}>
                <SelectTrigger id="forme_juridique_categorie"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORME_JURIDIQUE_CATEGORIE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="regime_tva">Régime de TVA</Label>
              <Select value={form.regime_tva} onValueChange={(v) => handleFieldChange("regime_tva", v)}>
                <SelectTrigger id="regime_tva"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIME_TVA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="regime_fiscal">Régime fiscal</Label>
              <Select value={form.regime_fiscal} onValueChange={(v) => handleFieldChange("regime_fiscal", v)}>
                <SelectTrigger id="regime_fiscal"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIME_FISCAL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

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

export default CompanyDetail;
