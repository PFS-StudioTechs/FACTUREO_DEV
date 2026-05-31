import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";

const UploadKbis = () => {
  const { user, kbisDeadline, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [kbisFile, setKbisFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "verifying" | "uploading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deadlineFormatted = kbisDeadline
    ? new Date(kbisDeadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKbisFile(file);
    setStatus("verifying");
    setErrorMsg("");

    const form = new FormData();
    form.append("file", file);
    try {
      const { data, error } = await supabase.functions.invoke("verify-kbis", {
        body: form,
      });
      if (error || !data?.valid) {
        setStatus("error");
        setErrorMsg(data?.error ?? "Document non reconnu comme Kbis");
        setKbisFile(null);
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Erreur lors de la vérification");
      setKbisFile(null);
    }
  };

  const handleUpload = async () => {
    if (!user || !kbisFile) return;
    setStatus("uploading");
    setErrorMsg("");

    try {
      const ext = kbisFile.name.split(".").pop() ?? "pdf";
      const path = `${user.id}/kbis/kbis.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("artisan-documents")
        .upload(path, kbisFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("artisan-documents").getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          kbis_url: urlData.publicUrl,
          kbis_uploaded_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      await refreshProfile();
      setStatus("done");
      toast.success("Kbis uploadé avec succès !");
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setStatus("error");
      setErrorMsg(msg);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-0)", padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
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
            Kbis requis
          </h1>
          {deadlineFormatted && (
            <p style={{ fontSize: 14, color: "var(--text-3)", margin: "6px 0 0" }}>
              Délai dépassé le {deadlineFormatted}
            </p>
          )}
        </div>

        <div style={{
          background: "var(--bg-2)", border: "1px solid var(--border)",
          borderRadius: "var(--r-4)", padding: 28, boxShadow: "var(--shadow-3)",
        }}>
          {/* Warning banner */}
          <div style={{
            padding: "12px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--r-3)", marginBottom: 20,
          }}>
            <p style={{ fontSize: 13, color: "var(--text-1)", margin: 0, lineHeight: 1.5 }}>
              Votre délai de 6 mois pour fournir un extrait Kbis est dépassé. L'accès à Facturéo est suspendu jusqu'à la validation de votre document.
            </p>
          </div>

          {/* Upload area */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={status === "verifying" || status === "uploading"}
              style={{
                width: "100%", padding: "24px 16px",
                border: `2px dashed ${kbisFile && status !== "error" ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "var(--r-3)", background: "var(--bg-3)",
                color: "var(--text-2)", fontSize: 14, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                transition: "border-color 0.2s",
              }}
            >
              <Icon name="upload" size={28} />
              {status === "verifying" ? (
                <span>Vérification en cours…</span>
              ) : status === "uploading" ? (
                <span>Upload en cours…</span>
              ) : kbisFile ? (
                <span style={{ fontWeight: 500, color: "var(--accent-bright)" }}>✓ {kbisFile.name}</span>
              ) : (
                <>
                  <span style={{ fontWeight: 500 }}>Glissez votre Kbis ici</span>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>PDF, JPG ou PNG · max 10 Mo</span>
                </>
              )}
            </button>

            {errorMsg && (
              <p style={{ fontSize: 12, color: "var(--error, #ef4444)", marginTop: 8 }}>{errorMsg}</p>
            )}
          </div>

          {kbisFile && status !== "error" && status !== "verifying" && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={status === "uploading"}
              style={{
                width: "100%", padding: "12px 18px", background: "var(--accent)", color: "var(--accent-on)",
                border: "none", borderRadius: "var(--r-3)", fontWeight: 500, fontSize: 15,
                cursor: status === "uploading" ? "not-allowed" : "pointer",
                opacity: status === "uploading" ? 0.7 : 1,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                marginTop: 14, boxShadow: "var(--shadow-accent)",
              }}
              onMouseEnter={e => { if (status !== "uploading") e.currentTarget.style.background = "var(--accent-bright)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
            >
              {status === "uploading" ? "Upload en cours…" : "Valider et accéder à Facturéo"}
              {status !== "uploading" && <Icon name="arrowRight" size={16} />}
            </button>
          )}

          <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 16, textAlign: "center", lineHeight: 1.5 }}>
            Besoin d'aide ? Contactez-nous à{" "}
            <a href="mailto:support@factureo.fr" style={{ color: "var(--accent-bright)" }}>
              support@factureo.fr
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default UploadKbis;
