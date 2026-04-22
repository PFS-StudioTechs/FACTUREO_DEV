import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plus, Building2, HelpCircle, Upload, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

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

const Companies = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyCompany);
  const [isParsing, setIsParsing] = useState(false);
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (form.mail && !emailRegex.test(form.mail)) throw new Error("Adresse mail invalide");
      if (form.mail_envoi && !emailRegex.test(form.mail_envoi)) throw new Error("Adresse mail d'envoi invalide");

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

  const closeDialog = () => {
    setDialogOpen(false);
    setForm(emptyCompany);
    setIsParsing(false);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error("Format non supporté. Utilisez une image (JPG, PNG, WEBP) ou un PDF.");
      return;
    }

    setIsParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const { data: json, error: fnError } = await supabase.functions.invoke("parse-company", {
        body: fd,
      });

      if (fnError) throw new Error(fnError.message || "Erreur d'extraction");
      if (!json?.success) throw new Error(json?.error || "Erreur d'extraction");

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
    if (key === "telephone") {
      setForm({ ...form, [key]: sanitizePhone(value) });
    } else {
      setForm({ ...form, [key]: value });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Entreprises</h1>
          <p className="text-muted-foreground">Gérez vos entreprises émettrices de factures</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else { setForm(emptyCompany); setDialogOpen(true); }}}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Ajouter</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvelle entreprise</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-6">
              {/* Import automatique par document */}
              <div
                className="flex items-center gap-3 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                onClick={() => !isParsing && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  className="hidden"
                  onChange={handleFileImport}
                />
                {isParsing ? (
                  <>
                    <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Analyse en cours...</p>
                      <p className="text-xs text-muted-foreground">L'IA extrait les informations du document</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Importer un document</p>
                      <p className="text-xs text-muted-foreground">JPG, PNG, WEBP ou PDF — les champs seront remplis automatiquement</p>
                    </div>
                  </>
                )}
              </div>

              {fields.map((field) => (
                <div key={field.key}>
                  {field.section && (
                    <h3 className="text-lg font-semibold mb-3 mt-2 border-b pb-2">{field.section}</h3>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      {field.tooltip && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>{field.tooltip}</TooltipContent>
                        </Tooltip>
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
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : companies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune entreprise enregistrée</p>
            <p className="text-sm text-muted-foreground">Ajoutez votre première entreprise pour commencer</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((company) => (
            <Card
              key={company.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/entreprises/${company.id}`)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{company.denomination || "Sans nom"}</CardTitle>
                <CardDescription>{company.forme_juridique} {company.capital ? `au capital de ${company.capital}` : ""}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>{company.adresse}, {company.code_postal} {company.ville}</p>
                <p>SIRET : {company.siret}</p>
                <p>TVA : {company.tva_intracommunautaire}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Companies;
