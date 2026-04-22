import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, HelpCircle } from "lucide-react";
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

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyCompany);

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
    setForm(f as typeof emptyCompany);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate email fields
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
    if (key === "telephone") {
      setForm({ ...form, [key]: sanitizePhone(value) });
    } else {
      setForm({ ...form, [key]: value });
    }
  };

  if (isLoading) return <p className="text-muted-foreground p-6">Chargement...</p>;
  if (!company) return <p className="text-muted-foreground p-6">Entreprise introuvable</p>;

  const infoSections = [
    {
      title: "Informations générales",
      items: [
        { label: "Dénomination", value: company.denomination },
        { label: "Forme juridique", value: company.forme_juridique },
        { label: "Capital", value: company.capital },
        { label: "Désignation", value: company.designation },
        { label: "Nom du contact", value: company.nom_contact },
        { label: "Adresse", value: `${company.adresse}, ${company.code_postal} ${company.ville}` },
        { label: "Téléphone", value: company.telephone },
        { label: "Mail", value: company.mail },
        { label: "Mail d'envoi", value: company.mail_envoi },
        { label: "SIRET", value: company.siret },
        { label: "RCS / RM", value: company.rcs_rm_ville },
        { label: "Code NAF", value: company.code_naf },
        { label: "TVA Intracom.", value: company.tva_intracommunautaire },
      ],
    },
    {
      title: "Coordonnées Bancaires",
      items: [
        { label: "Titulaire", value: company.banque_titulaire },
        { label: "Banque", value: company.banque_nom },
        { label: "Adresse Banque", value: company.banque_adresse },
        { label: "BIC / SWIFT", value: company.bic_swift },
        { label: "IBAN", value: company.code_iban },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/entreprises")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{company.denomination || "Sans nom"}</h1>
          <p className="text-muted-foreground">{company.forme_juridique} {company.capital ? `au capital de ${company.capital}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEdit}>
            <Pencil className="w-4 h-4 mr-2" />Modifier
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />Supprimer
              </Button>
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

      <div className="grid gap-6 md:grid-cols-2">
        {infoSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-lg">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                {section.items.map((item) => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd className="font-medium text-right max-w-[60%] break-words">{item.value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'entreprise</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-6">
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
  );
};

export default CompanyDetail;
