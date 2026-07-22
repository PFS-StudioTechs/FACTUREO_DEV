import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button, Pill } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { computeDateConservationMin, type DocumentType } from "@/lib/documents/conservation";
import { fetchUserDocuments, getSignedDocumentUrl, type DocumentRow } from "@/lib/documents/documentsClient";

interface CompanyLite {
  id: string;
  denomination: string;
}

const TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "facture", label: "Facture" },
  { value: "facturx", label: "Factur-X" },
  { value: "justificatif", label: "Justificatif" },
  { value: "contrat", label: "Contrat" },
  { value: "autre", label: "Autre" },
];

const labelForType = (type: string) => TYPE_OPTIONS.find(o => o.value === type)?.label || type;

const documentSchema = z.object({
  titre: z.string().min(1, "Titre requis"),
  type: z.enum(["facture", "facturx", "justificatif", "contrat", "autre"]),
  company_id: z.string().optional(),
  date_document: z.string().min(1, "Date requise"),
  file: z.instanceof(FileList).refine(f => f.length === 1, "Fichier requis"),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

const emptyValues = { titre: "", type: "autre" as const, company_id: "", date_document: "" };

// Ce module n'indexe QUE des documents pointant vers le Storage : jamais de duplication
// de fichier, un simple index de métadonnées + référence bucket/chemin.
const Coffre = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<string>("tous");
  const [companyFilter, setCompanyFilter] = useState<string>("toutes");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<DocumentFormValues>({ resolver: zodResolver(documentSchema), defaultValues: emptyValues });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-lite", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, denomination").order("denomination");
      if (error) throw error;
      return data as CompanyLite[];
    },
    enabled: !!user,
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents", user?.id],
    queryFn: () => fetchUserDocuments(supabase, user!.id),
    enabled: !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async (values: DocumentFormValues) => {
      const file = values.file[0];
      const path = `${user!.id}/documents/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("artisan-documents").upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("documents").insert({
        user_id: user!.id,
        company_id: values.company_id || null,
        type: values.type,
        titre: values.titre,
        storage_bucket: "artisan-documents",
        storage_path: path,
        date_document: values.date_document,
        date_conservation_min: computeDateConservationMin(values.date_document, values.type),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document ajouté au Coffre");
      setDialogOpen(false);
      form.reset(emptyValues);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openDocument = async (doc: DocumentRow) => {
    try {
      const url = await getSignedDocumentUrl(supabase, doc);
      window.open(url, "_blank");
    } catch {
      toast.error("Impossible d'ouvrir ce document");
    }
  };

  const companyName = (id: string | null) => companies.find(c => c.id === id)?.denomination || "—";

  const filtered = documents.filter(d =>
    (typeFilter === "tous" || d.type === typeFilter) &&
    (companyFilter === "toutes" || d.company_id === companyFilter) &&
    (search.trim() === "" || d.titre.toLowerCase().includes(search.trim().toLowerCase()))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        padding: isMobile ? "12px 16px" : "16px 24px", borderBottom: "1px solid var(--border)",
        display: "flex", flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center", gap: 12,
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-1)", margin: 0, letterSpacing: "-0.02em", flex: isMobile ? undefined : 1 }}>
          Coffre documentaire
        </h1>
        <Button variant="primary" size="sm" icon="plus" onClick={() => setDialogOpen(true)} style={isMobile ? { justifyContent: "center" } : undefined}>
          Ajouter un document
        </Button>
      </div>

      <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Input placeholder="Rechercher un titre…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: isMobile ? "100%" : 240 }} />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger style={{ width: isMobile ? "100%" : 180 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les types</SelectItem>
            {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger style={{ width: isMobile ? "100%" : 200 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="toutes">Toutes entreprises</SelectItem>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.denomination}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>
        {isLoading ? (
          <div style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            <Icon name="fileCheck" size={36} style={{ marginBottom: 10, display: "block", margin: "0 auto 10px" }} />
            Aucun document
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(d => (
              <button
                key={d.id}
                onClick={() => openDocument(d)}
                style={{
                  background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r-3)",
                  padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                  cursor: "pointer", textAlign: "left", width: "100%",
                }}
              >
                <Pill size="sm" tone="neutral">{labelForType(d.type)}</Pill>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{d.titre}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                    {companyName(d.company_id)} · {new Date(d.date_document).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                  {d.date_conservation_min
                    ? `À conserver jusqu'au ${new Date(d.date_conservation_min).toLocaleDateString("fr-FR")} (indicatif)`
                    : "Durée de conservation non définie"}
                </span>
                <Icon name="arrowRight" size={14} color="var(--text-3)" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); form.reset(emptyValues); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Ajouter un document</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(values => uploadMutation.mutate(values))} className="space-y-4">
              <FormField control={form.control} name="titre" render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre</FormLabel>
                  <FormControl><Input {...field} placeholder="ex: Contrat de prestation Client X" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="date_document" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="company_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Entreprise (optionnel)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.denomination}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="file" render={({ field: { onChange, onBlur, name, ref } }) => (
                <FormItem>
                  <FormLabel>Fichier</FormLabel>
                  <FormControl>
                    <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => onChange(e.target.files)} onBlur={onBlur} name={name} ref={ref} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <button
                type="submit"
                disabled={uploadMutation.isPending}
                style={{
                  width: "100%", padding: "10px", background: "var(--accent)", color: "var(--accent-on)",
                  border: "none", borderRadius: "var(--r-3)", fontWeight: 500, fontSize: 14, cursor: "pointer",
                  opacity: uploadMutation.isPending ? 0.7 : 1,
                }}
              >
                {uploadMutation.isPending ? "Envoi…" : "Ajouter"}
              </button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Coffre;
