import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";

const InvoiceSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [prefix, setPrefix] = useState("");
  const [code, setCode] = useState("");
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
      const { data } = await supabase.from("invoice_settings").select("*").eq("company_id", selectedCompanyId).single();
      return data;
    },
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (settings) {
      setPrefix(settings.prefix);
      setCode(settings.code || "");
      setNumeroFormat(settings.numero_format);
      setNextNumber(settings.next_number);
      setSuffixDateFormat(settings.suffix_date_format || "none");
      setSeparator(settings.separator || "none");
    } else {
      setPrefix(""); setCode(""); setNumeroFormat("001"); setNextNumber(1);
      setSuffixDateFormat("none"); setSeparator("-");
    }
  }, [settings]);

  const previewNumber = () => {
    const numStr = String(nextNumber).padStart(numeroFormat.length, "0");
    let result = "";
    const sep = separator === "none" ? "" : separator;
    if (prefix) result += prefix + sep;
    if (code) result += code;
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
        company_id: selectedCompanyId, user_id: user!.id, prefix, code,
        numero_format: numeroFormat, next_number: nextNumber,
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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', background: 'var(--bg-3)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-3)',
    color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', background: 'var(--bg-3)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-3)',
    color: 'var(--text-1)', fontSize: 13, outline: 'none', cursor: 'pointer',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6,
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--text-3)', marginTop: 4,
  };

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <span style={labelStyle}>{label}</span>
      {children}
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 560 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Paramétrage</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Configurez le format de numérotation de vos factures</p>
        </div>

        <Field label="Entreprise">
          <select value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)} style={selectStyle}>
            <option value="">Sélectionner une entreprise</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.denomination}</option>)}
          </select>
        </Field>

        {!selectedCompanyId && (
          <div style={{ marginTop: 20 }}>
            <EmptyState icon="building" title="Choisis une entreprise" description="Sélectionne une entreprise ci-dessus pour configurer sa numérotation de facture." />
          </div>
        )}

        {selectedCompanyId && (
          <div style={{ marginTop: 20, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-4)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>Format de numérotation</span>
            </div>
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Préfixe (optionnel)" hint="Mot clé placé en début de numéro, suivi du séparateur">
                <input style={inputStyle} value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="ex: Facture, FACT" />
              </Field>

              <Field label="Séparateur">
                <select style={selectStyle} value={separator} onChange={e => setSeparator(e.target.value)}>
                  <option value="-">Tiret (-)</option>
                  <option value="/">Slash (/)</option>
                  <option value="_">Underscore (_)</option>
                  <option value=".">Point (.)</option>
                  <option value="none">Aucun</option>
                </select>
              </Field>

              <Field label="Code personnalisé (optionnel)" hint="Collé directement devant le numéro, sans séparateur — ex : Facture_KSD0031">
                <input style={inputStyle} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ex: KSD, AB, 2024" maxLength={10} />
              </Field>

              <Field label="Format du numéro (nombre de chiffres)">
                <select style={selectStyle} value={numeroFormat} onChange={e => setNumeroFormat(e.target.value)}>
                  <option value="01">2 chiffres (01, 02…)</option>
                  <option value="001">3 chiffres (001, 002…)</option>
                  <option value="0001">4 chiffres (0001, 0002…)</option>
                  <option value="00001">5 chiffres (00001, 00002…)</option>
                </select>
              </Field>

              <Field label="Prochain numéro">
                <input style={inputStyle} type="number" min={1} value={nextNumber} onChange={e => setNextNumber(parseInt(e.target.value) || 1)} />
              </Field>

              <Field label="Suffixe date (optionnel)">
                <select style={selectStyle} value={suffixDateFormat} onChange={e => setSuffixDateFormat(e.target.value)}>
                  <option value="none">Aucun</option>
                  <option value="MM/AAAA">MM/AAAA</option>
                  <option value="JJ/MM/AAAA">JJ/MM/AAAA</option>
                  <option value="AAAA">AAAA</option>
                  <option value="MMAAAA">MMAAAA</option>
                  <option value="AAAAMM">AAAAMM</option>
                  <option value="JJMMAAAA">JJMMAAAA</option>
                  <option value="AAAAMMJJ">AAAAMMJJ</option>
                </select>
              </Field>

              {/* Preview */}
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-3)', padding: '14px 16px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 6px' }}>Aperçu du prochain numéro :</p>
                <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-bright)', margin: 0 }}>
                  {previewNumber()}
                </p>
              </div>

              <Button
                variant="primary"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {saveMutation.isPending ? "Enregistrement…" : "Enregistrer le paramétrage"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceSettings;
