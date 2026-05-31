import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";

type AuthView = "login" | "signup" | "forgot-password";
type SiretStatus = "idle" | "checking" | "valid" | "invalid";

interface SiretCompany {
  siret: string;
  siren: string;
  denomination: string;
  forme_juridique: string;
  adresse: string;
  code_postal: string;
  ville: string;
  code_naf: string;
}

const Auth = () => {
  const [view, setView] = useState<AuthView>("login");
  // Login / forgot-password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Signup wizard
  const [step, setStep] = useState(1);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [siret, setSiret] = useState("");
  const [siretStatus, setSiretStatus] = useState<SiretStatus>("idle");
  const [siretError, setSiretError] = useState("");
  const [siretCompany, setSiretCompany] = useState<SiretCompany | null>(null);
  const [awaitingEmail, setAwaitingEmail] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "var(--bg-3)",
    border: "1px solid var(--border)", borderRadius: "var(--r-3)",
    color: "var(--text-1)", fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: "var(--text-2)", display: "block", marginBottom: 6,
  };
  const btnStyle = (disabled?: boolean): React.CSSProperties => ({
    width: "100%", padding: "11px 18px", background: "var(--accent)", color: "var(--accent-on)",
    border: "none", borderRadius: "var(--r-3)", fontWeight: 500, fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.7 : 1,
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 4, boxShadow: "var(--shadow-accent)",
  });

  const handleForgotPassword = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Email de réinitialisation envoyé. Vérifiez votre boîte mail.");
    setLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleValidateSiret = async () => {
    const clean = siret.replace(/\s/g, "");
    if (clean.length !== 14 || !/^\d+$/.test(clean)) {
      setSiretError("SIRET invalide — 14 chiffres requis");
      return;
    }
    setSiretStatus("checking");
    setSiretError("");
    try {
      const { data, error } = await supabase.functions.invoke("validate-siret", {
        body: { siret: clean },
      });
      if (error || !data?.valid) {
        setSiretStatus("invalid");
        setSiretError(data?.error ?? "SIRET non reconnu");
      } else {
        setSiretStatus("valid");
        setSiretCompany(data.company);
      }
    } catch {
      setSiretStatus("invalid");
      setSiretError("Erreur lors de la validation");
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          nom,
          prenom,
          siret: siretCompany?.siret ?? siret,
          siret_data: siretCompany,
        },
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      // Supabase returns fake success when email already exists (unconfirmed) — resend explicitly
      if (data.user && data.user.identities?.length === 0) {
        await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      }
      setAwaitingEmail(true);
      try {
        await supabase.functions.invoke("notify-admin-new-signup", {
          body: { pseudo: `${prenom} ${nom}`, email, telephone: "" },
        });
      } catch {
        // non-blocking
      }
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === "forgot-password") { await handleForgotPassword(); return; }
    if (view === "login") { await handleLogin(); return; }
    if (view === "signup") {
      if (step === 1) {
        if (!prenom.trim() || !nom.trim()) { toast.error("Prénom et nom requis"); return; }
        setStep(2);
      } else if (step === 2) {
        if (siretStatus !== "valid") { toast.error("Validez votre SIRET avant de continuer"); return; }
        setStep(3);
      } else {
        await handleSignup();
      }
    }
  };

  const resetSignup = () => {
    setStep(1); setPrenom(""); setNom(""); setSiret("");
    setSiretStatus("idle"); setSiretError(""); setSiretCompany(null);
    setEmail(""); setPassword(""); setAwaitingEmail(false);
  };

  const switchView = (v: AuthView) => {
    setView(v);
    resetSignup();
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-0)", padding: 16,
      backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "var(--r-4)",
            background: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12, boxShadow: "var(--shadow-accent)",
          }}>
            <Icon name="invoice" size={26} color="rgba(0,0,0,0.8)" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-1)", margin: 0, letterSpacing: "-0.025em" }}>
            Factur<span style={{ color: "var(--accent-bright)" }}>éo</span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: "6px 0 0" }}>Votre solution de facturation intelligente</p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--bg-2)", border: "1px solid var(--border)",
          borderRadius: "var(--r-4)", padding: 28, boxShadow: "var(--shadow-3)",
        }}>

          {/* ─── Awaiting email confirmation ─── */}
          {awaitingEmail ? (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", background: "var(--accent)",
                display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
              }}>
                <Icon name="mail" size={28} color="rgba(0,0,0,0.8)" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-1)", margin: "0 0 8px" }}>
                Vérifiez votre email
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 8px", lineHeight: 1.5 }}>
                Un lien de confirmation a été envoyé à
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-bright)", margin: "0 0 20px" }}>
                {email}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 20px", lineHeight: 1.5 }}>
                Cliquez sur le lien pour activer votre compte et compléter votre profil.
              </p>
              <button
                type="button"
                onClick={() => supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } }).then(() => toast.success("Email renvoyé"))}
                style={{ fontSize: 13, color: "var(--text-3)", cursor: "pointer", background: "none", border: "none", padding: 0, textDecoration: "underline" }}
              >
                Renvoyer l'email
              </button>
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => { setAwaitingEmail(false); switchView("login"); }}
                  style={{ fontSize: 13, color: "var(--text-3)", cursor: "pointer", background: "none", border: "none", padding: 0 }}
                >
                  Retour à la connexion
                </button>
              </div>
            </div>
          ) : view === "signup" ? (
            /* ─── Signup wizard ─── */
            <>
              {/* Step progress */}
              <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                {[1, 2, 3].map(s => (
                  <div key={s} style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: step >= s ? "var(--accent)" : "var(--border)",
                    transition: "background 0.2s",
                  }} />
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-1)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                  {step === 1 ? "Votre identité" : step === 2 ? "Votre entreprise" : "Vos accès"}
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
                  {step === 1 ? "Étape 1 sur 3 — Prénom et nom" : step === 2 ? "Étape 2 sur 3 — SIRET de votre entreprise" : "Étape 3 sur 3 — Email et mot de passe"}
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {step === 1 && (
                  <>
                    <div>
                      <label style={labelStyle}>Prénom</label>
                      <input style={inputStyle} type="text" placeholder="Jean" value={prenom} onChange={e => setPrenom(e.target.value)} required autoFocus />
                    </div>
                    <div>
                      <label style={labelStyle}>Nom</label>
                      <input style={inputStyle} type="text" placeholder="Dupont" value={nom} onChange={e => setNom(e.target.value)} required />
                    </div>
                  </>
                )}

                {step === 2 && (
                  <div>
                    <label style={labelStyle}>SIRET</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        type="text"
                        placeholder="12345678901234"
                        value={siret}
                        onChange={e => { setSiret(e.target.value); setSiretStatus("idle"); setSiretError(""); setSiretCompany(null); }}
                        maxLength={17}
                      />
                      <button
                        type="button"
                        onClick={handleValidateSiret}
                        disabled={siretStatus === "checking"}
                        style={{
                          padding: "10px 14px", background: "var(--bg-3)", border: "1px solid var(--border)",
                          borderRadius: "var(--r-3)", color: "var(--text-1)", fontSize: 13, fontWeight: 500,
                          cursor: siretStatus === "checking" ? "not-allowed" : "pointer", whiteSpace: "nowrap",
                        }}
                      >
                        {siretStatus === "checking" ? "…" : "Valider"}
                      </button>
                    </div>

                    {siretError && (
                      <p style={{ fontSize: 12, color: "var(--error, #ef4444)", marginTop: 6 }}>{siretError}</p>
                    )}

                    {siretStatus === "valid" && siretCompany && (
                      <div style={{
                        marginTop: 10, padding: "10px 12px", background: "var(--bg-3)",
                        border: "1px solid var(--accent)", borderRadius: "var(--r-3)",
                      }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: "0 0 4px" }}>
                          {siretCompany.denomination}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
                          {siretCompany.forme_juridique} · {siretCompany.ville} {siretCompany.code_postal}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <>
                    <div>
                      <label style={labelStyle}>Email</label>
                      <input style={inputStyle} type="email" placeholder="jean@entreprise.fr" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                    </div>
                    <div>
                      <label style={labelStyle}>Mot de passe</label>
                      <div style={{ position: "relative" }}>
                        <input
                          style={{ ...inputStyle, paddingRight: 38 }}
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} style={{
                          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                          color: "var(--text-3)", cursor: "pointer", background: "none", border: "none", padding: 2,
                          display: "flex", alignItems: "center",
                        }}>
                          <Icon name="eye" size={16} />
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {step > 1 && (
                    <button
                      type="button"
                      onClick={() => setStep(s => s - 1)}
                      style={{
                        flex: "0 0 auto", padding: "11px 16px", background: "var(--bg-3)",
                        border: "1px solid var(--border)", borderRadius: "var(--r-3)",
                        color: "var(--text-1)", fontSize: 15, fontWeight: 500, cursor: "pointer",
                      }}
                    >
                      <Icon name="arrowLeft" size={16} />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading || (step === 2 && siretStatus !== "valid")}
                    style={{ ...btnStyle(loading || (step === 2 && siretStatus !== "valid")), flex: 1, marginTop: 0 }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "var(--accent-bright)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
                  >
                    {loading ? "Chargement…" : step < 3 ? "Continuer" : "Créer mon compte"}
                    {!loading && <Icon name="arrowRight" size={16} />}
                  </button>
                </div>
              </form>

              <div style={{ marginTop: 18, textAlign: "center" }}>
                <button type="button" onClick={() => switchView("login")} style={{ fontSize: 13, color: "var(--text-3)", cursor: "pointer", background: "none", border: "none", padding: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--accent-bright)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; }}
                >
                  Déjà un compte ? Connectez-vous
                </button>
              </div>
            </>
          ) : (
            /* ─── Login / Forgot password ─── */
            <>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-1)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                  {view === "login" ? "Connexion" : "Mot de passe oublié"}
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
                  {view === "login" ? "Connectez-vous à votre espace Facturéo" : "Entrez votre email pour recevoir un lien de réinitialisation"}
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>

                {view === "login" && (
                  <div>
                    <label style={labelStyle}>Mot de passe</label>
                    <div style={{ position: "relative" }}>
                      <input
                        style={{ ...inputStyle, paddingRight: 38 }}
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} style={{
                        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                        color: "var(--text-3)", cursor: "pointer", background: "none", border: "none", padding: 2,
                        display: "flex", alignItems: "center",
                      }}>
                        <Icon name="eye" size={16} />
                      </button>
                    </div>
                    <div style={{ textAlign: "right", marginTop: 6 }}>
                      <button type="button" onClick={() => setView("forgot-password")} style={{ fontSize: 12, color: "var(--text-3)", cursor: "pointer", background: "none", border: "none", padding: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--text-1)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; }}
                      >
                        Mot de passe oublié ?
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" disabled={loading} style={btnStyle(loading)}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "var(--accent-bright)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
                >
                  {loading ? "Chargement…" : view === "login" ? "Se connecter" : "Envoyer le lien"}
                  {!loading && <Icon name="arrowRight" size={16} />}
                </button>
              </form>

              <div style={{ marginTop: 18, textAlign: "center" }}>
                {view === "forgot-password" ? (
                  <button type="button" onClick={() => setView("login")} style={{ fontSize: 13, color: "var(--text-3)", cursor: "pointer", background: "none", border: "none", padding: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--accent-bright)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; }}
                  >
                    Retour à la connexion
                  </button>
                ) : (
                  <button type="button" onClick={() => switchView("signup")} style={{ fontSize: 13, color: "var(--text-3)", cursor: "pointer", background: "none", border: "none", padding: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--accent-bright)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; }}
                  >
                    Pas encore de compte ? Inscrivez-vous
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
