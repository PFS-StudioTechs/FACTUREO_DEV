import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Settings } from "lucide-react";

const InvoiceSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [prefix, setPrefix] = useState("");
  const [numeroFormat, setNumeroFormat] = useState("001");
  const [nextNumber, setNextNumber] = useState(1);
  const [suffixDateFormat, setSuffixDateFormat] = useState("");
  const [separator, setSeparator] = useState("-");

  const { data: companies = [] } = useQuery({
    queryKey: ["companies", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("denomination");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: settings } = useQuery({
    queryKey: ["invoice-settings", selectedCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("invoice_settings")
        .select("*")
        .eq("company_id", selectedCompanyId)
        .single();
      return data;
    },
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (settings) {
      setPrefix(settings.prefix);
      setNumeroFormat(settings.numero_format);
      setNextNumber(settings.next_number);
      setSuffixDateFormat(settings.suffix_date_format || "none");
      setSeparator(settings.separator || "none");
    } else {
      setPrefix("");
      setNumeroFormat("001");
      setNextNumber(1);
      setSuffixDateFormat("none");
      setSeparator("-");
    }
  }, [settings]);

  const previewNumber = () => {
    const numStr = String(nextNumber).padStart(numeroFormat.length, "0");
    let result = "";
    const sep = separator === "none" ? "" : separator;
    if (prefix) result += prefix + sep;
    result += numStr;
    if (suffixDateFormat && suffixDateFormat !== "none") {
      const now = new Date();
      let datePart = suffixDateFormat;
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      datePart = datePart.replace("AAAA", y).replace("MM", m).replace("JJ", d);
      result += sep + datePart;
    }
    return result;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: selectedCompanyId,
        user_id: user!.id,
        prefix,
        numero_format: numeroFormat,
        next_number: nextNumber,
        suffix_date_format: suffixDateFormat === "none" ? "" : suffixDateFormat,
        separator: separator === "none" ? "" : separator,
      };

      if (settings) {
        const { error } = await supabase.from("invoice_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoice_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-settings"] });
      toast.success("Paramétrage enregistré");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramétrage</h1>
        <p className="text-muted-foreground">Configurez le format de numérotation de vos factures</p>
      </div>

      <div className="max-w-xl space-y-6">
        <div className="space-y-1">
          <Label>Entreprise</Label>
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger><SelectValue placeholder="Sélectionner une entreprise" /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.denomination}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedCompanyId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Format de numérotation</CardTitle>
              <CardDescription>Définissez le format de vos numéros de facture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Préfixe (optionnel)</Label>
                <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="ex: FAC, FACT, KSD" />
              </div>

              <div className="space-y-1">
                <Label>Séparateur</Label>
                <Select value={separator} onValueChange={setSeparator}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-">Tiret (-)</SelectItem>
                    <SelectItem value="/">Slash (/)</SelectItem>
                    <SelectItem value="_">Underscore (_)</SelectItem>
                    <SelectItem value=".">Point (.)</SelectItem>
                    <SelectItem value="none">Aucun</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Format du numéro (nombre de chiffres)</Label>
                <Select value={numeroFormat} onValueChange={setNumeroFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">2 chiffres (01, 02...)</SelectItem>
                    <SelectItem value="001">3 chiffres (001, 002...)</SelectItem>
                    <SelectItem value="0001">4 chiffres (0001, 0002...)</SelectItem>
                    <SelectItem value="00001">5 chiffres (00001, 00002...)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Prochain numéro</Label>
                <Input type="number" min={1} value={nextNumber} onChange={(e) => setNextNumber(parseInt(e.target.value) || 1)} />
              </div>

              <div className="space-y-1">
                <Label>Suffixe date (optionnel)</Label>
                <Select value={suffixDateFormat} onValueChange={setSuffixDateFormat}>
                  <SelectTrigger><SelectValue placeholder="Aucun suffixe" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    <SelectItem value="MM/AAAA">MM/AAAA</SelectItem>
                    <SelectItem value="JJ/MM/AAAA">JJ/MM/AAAA</SelectItem>
                    <SelectItem value="AAAA">AAAA</SelectItem>
                    <SelectItem value="MMAAAA">MMAAAA</SelectItem>
                    <SelectItem value="AAAAMM">AAAAMM</SelectItem>
                    <SelectItem value="JJMMAAAA">JJMMAAAA</SelectItem>
                    <SelectItem value="AAAAMMJJ">AAAAMMJJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Aperçu du prochain numéro :</p>
                  <p className="text-2xl font-bold mt-1">{previewNumber()}</p>
                </CardContent>
              </Card>

              <Button onClick={() => saveMutation.mutate()} className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Enregistrement..." : "Enregistrer le paramétrage"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InvoiceSettings;
