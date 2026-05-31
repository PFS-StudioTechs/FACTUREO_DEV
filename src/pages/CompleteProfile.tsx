import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";

interface SiretData {
  siret: string;
  denomination: string;
  forme_juridique: string;
  adresse: string;
  code_postal: string;
  ville: string;
  code_naf: string;
}

const CompleteProfile = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const meta = user?.user_metadata ?? {};
  const siretData: SiretData | null = meta.siret_data ?? null;

  const [denomination, setDenomination] = useState(siretData?.denomination ?? "");
  const [formeJuridique, setFormeJuridique] = useState(siretData?.forme_juridique ?? "");
  const [adresse, setAdresse] = useState(siretData?.adresse ?? "");
  const [codePostal, setCodePostal] = useState(siretData?.code_postal ?? "");
  const [ville, setVille] = useState(siretData?.ville ?? "");
  const [codeNaf, setCodeNaf] = useState(siretData?.code_naf ?? "");
  const [telephone, setTelephone] = useState("");
  const [mail, setMail] = useState(user?.email ?? "");

  // KBIS upload (optional)
  const [kbisFile, setKbisFile] = useState<File | null>(null);
  const [kbisStatus, setKbisStatus] = useState<"idle" | "verifying" | "valid" | "invalid">("idle");
  const [kbisError, setKbisError] = useState("");
  const [showKbis, setShowKbis] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);

  const siret = meta.siret ?? siretData?.siret ?? "";

  // Check if already completed — redirect away
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("profile_completed")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.profile_completed) navigate("/", { replace: true });
      });
  }, [user, navigate]);

  const handleKbisChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKbisFile(file);
    setKbisStatus("verifying");
    setKbisError("");

    const form = new FormData();
    form.append("file", file);
    try {
      const { data, error } = await supabase.functions.invoke("verify-kbis", {
        body: form,
      });
      if (error || !data?.valid) {
        setKbisStatus("invalid");
        setKbisError(data?.error ?? "Document non reconnu comme Kbis");
        setKbisFile(null);
      } else {
        setKbisStatus("valid");
      }
    } catch {
      setKbisStatus("invalid");
      setKbisError("Erreur lors de la vérification");
      setKbisFile(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!denomination.trim() || !siret.trim() || !adresse.trim() || !codePostal.trim() || !ville.trim()) {
      toast.error("Complétez les champs obligatoires");
      return;
    }

    setLoading(true);
    try {
      // Upload KBIS if provided
      let kbisUrl: string | null = null;
      if (kbisFile && kbisStatus === "valid") {
        const ext = kbisFile.name.split(".").pop() ?? "pdf";
        const path = `${user.id}/kbis/kbis.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("artisan-documents")
          .upload(path, kbisFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("artisan-documents").getPublicUrl(path);
        kbisUrl = urlData.publicUrl;
      }

      // Skip company insert if already exists (idempotent re-submit)
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingCompany) {
        // Check SIRET availability before insert
        const { data: available } = await supabase.rpc("check_siret_available", { p_siret: siret });
        if (available === false) {
          toast.error("Ce SIRET est déjà associé à un compte");
          setLoading(false);
          return;
        }

        const { error: companyError } = await supabase.from("companies").insert({
          user_id: user.id,
          denomination: denomination.trim(),
          siret: siret.trim(),
          forme_juridique: formeJuridique.trim(),
          adresse: adresse.trim(),
          code_postal: codePostal.trim(),
          ville: ville.trim(),
          code_naf: codeNaf.trim(),
          telephone: telephone.trim(),
          mail: mail.trim(),
        });
        if (companyError) throw companyError;
      }

      // Mark profile completed + save kbis if uploaded
      const profileUpdate: Record<string, unknown> = {
        nom: meta.nom ?? "",
        prenom: meta.prenom ?? "",
        profile_completed: true,
      };
      if (kbisUrl) {
        profileUpdate.kbis_url = kbisUrl;
        profileUpdate.kbis_uploaded_at = new Date().toISOString();
      }
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("user_id", user.id);
      if (profileError) throw profileError;

      await refreshProfile();
      toast.success("Profil complété !");
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "var(--bg-3)",
    border: "1px solid var(--border)", borderRadius: "var(--r-3)",
    color: "var(--text-1)", fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const readonlyStyle: React.CSSProperties = {
    ...inputStyle, color: "var(--text-3)", cursor: "default",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: "var(--text-2)", display: "block", marginBottom: 6,
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-0)", padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "var(--r-4)",
            background: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12, boxShadow: "var(--shadow-accent)",
          }}>
            <Icon name="invoice" size={26} color="rgba(0,0,0,0.8)" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-1)", margin: 0, letterSpacing: "-0.025em" }}>
            Compléter votre profil
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: "6px 0 0" }}>
            Ces informations apparaîtront sur vos factures
          </p>
        </div>

        <div style={{
          background: "var(--bg-2)", border: "1px solid var(--border)",
          borderRadius: "var(--r-4)", padding: 28, boxShadow: "var(--shadow-3)",
        }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* SIRET (readonly) */}
            <div>
              <label style={labelStyle}>SIRET</label>
              <input style={readonlyStyle} type="text" value={siret} readOnly tabIndex={-1} />
            </div>

            {/* Dénomination */}
            <div>
              <label style={labelStyle}>Dénomination / Raison sociale *</label>
              <input style={inputStyle} type="text" value={denomination} onChange={e => setDenomination(e.target.value)} required />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Forme juridique</label>
                <input style={inputStyle} type="text" value={formeJuridique} onChange={e => setFormeJuridique(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Code NAF</label>
                <input style={inputStyle} type="text" value={codeNaf} onChange={e => setCodeNaf(e.target.value)} />
              </div>
            </div>

            {/* Address */}
            <div>
              <label style={labelStyle}>Adresse siège *</label>
              <input style={inputStyle} type="text" value={adresse} onChange={e => setAdresse(e.target.value)} required />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Code postal *</label>
                <input style={inputStyle} type="text" value={codePostal} onChange={e => setCodePostal(e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Ville *</label>
                <input style={inputStyle} type="text" value={ville} onChange={e => setVille(e.target.value)} required />
              </div>
            </div>

            {/* Contact */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Téléphone professionnel</label>
                <input style={inputStyle} type="tel" placeholder="+33612345678" value={telephone} onChange={e => setTelephone(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Email professionnel</label>
                <input style={inputStyle} type="email" value={mail} onChange={e => setMail(e.target.value)} />
              </div>
            </div>

            {/* KBIS optional */}
            <div style={{
              padding: "12px 14px", background: "var(--bg-3)", border: "1px solid var(--border)",
              borderRadius: "var(--r-3)", marginTop: 4,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", margin: 0 }}>Kbis (optionnel)</p>
                  <p style={{ fontSize: 12, color: "var(--text-3)", margin: "2px 0 0" }}>
                    Requis dans les 6 mois. Vous pouvez l'ajouter maintenant ou plus tard.
                  </p>
                </div>
                <button type="button" onClick={() => setShowKbis(s => !s)} style={{
                  padding: "6px 12px", background: "var(--bg-2)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-3)", fontSize: 12, color: "var(--text-2)", cursor: "pointer",
                }}>
                  {showKbis ? "Masquer" : "Ajouter"}
                </button>
              </div>

              {showKbis && (
                <div style={{ marginTop: 12 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleKbisChange}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={kbisStatus === "verifying"}
                    style={{
                      width: "100%", padding: "10px", border: "1px dashed var(--border)",
                      borderRadius: "var(--r-3)", background: "var(--bg-2)",
                      color: "var(--text-2)", fontSize: 13, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <Icon name="upload" size={16} />
                    {kbisStatus === "verifying" ? "Vérification…" :
                      kbisStatus === "valid" ? `✓ ${kbisFile?.name}` :
                        "Choisir un fichier (PDF, JPG, PNG)"}
                  </button>
                  {kbisError && (
                    <p style={{ fontSize: 12, color: "var(--error, #ef4444)", marginTop: 6 }}>{kbisError}</p>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "12px 18px", background: "var(--accent)", color: "var(--accent-on)",
                border: "none", borderRadius: "var(--r-3)", fontWeight: 500, fontSize: 15,
                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                marginTop: 8, boxShadow: "var(--shadow-accent)",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "var(--accent-bright)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
            >
              {loading ? "Enregistrement…" : "Accéder à Facturéo"}
              {!loading && <Icon name="arrowRight" size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;
