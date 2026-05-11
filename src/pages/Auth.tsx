import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";

type AuthView = "login" | "signup" | "forgot-password";

const Auth = () => {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [telephone, setTelephone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const formatPhone = (value: string) => value.replace(/[^\d+]/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (view === "forgot-password") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) toast.error(error.message);
      else toast.success("Un email de réinitialisation vous a été envoyé. Vérifiez votre boîte mail.");
      setLoading(false);
      return;
    }

    if (view === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      if (!pseudo.trim()) { toast.error("Veuillez saisir un pseudo"); setLoading(false); return; }
      const { data: signUpData, error } = await supabase.auth.signUp({ email, password, options: { data: { pseudo, telephone } } });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Compte créé ! Vérifiez votre email pour confirmer. Un administrateur validera votre accès.");
        try { await supabase.functions.invoke("notify-admin-new-signup", { body: { pseudo, email, telephone } }); }
        catch (err) { console.error("Failed to notify admin:", err); }
      }
    }
    setLoading(false);
  };

  const getTitle = () => {
    if (view === "login") return "Connexion";
    if (view === "signup") return "Créer un compte";
    return "Mot de passe oublié";
  };

  const getDesc = () => {
    if (view === "login") return "Connectez-vous à votre espace Facturéo";
    if (view === "signup") return "Inscrivez-vous pour commencer à facturer";
    return "Entrez votre email pour recevoir un lien de réinitialisation";
  };

  const getButtonText = () => {
    if (loading) return "Chargement…";
    if (view === "login") return "Se connecter";
    if (view === "signup") return "Créer mon compte";
    return "Envoyer le lien";
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', background: 'var(--bg-3)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-3)',
    color: 'var(--text-1)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6,
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-0)', padding: 16,
      backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 'var(--r-4)',
            background: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12, boxShadow: 'var(--shadow-accent)',
          }}>
            <Icon name="invoice" size={26} color="rgba(0,0,0,0.8)" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.025em' }}>
            Factur<span style={{ color: 'var(--accent-bright)' }}>éo</span>
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)', margin: '6px 0 0' }}>Votre solution de facturation intelligente</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-4)', padding: 28,
          boxShadow: 'var(--shadow-3)',
        }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>{getTitle()}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>{getDesc()}</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {view === "signup" && (
              <>
                <div>
                  <label style={labelStyle}>Pseudo</label>
                  <input style={inputStyle} type="text" placeholder="Votre pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} required />
                </div>
                <div>
                  <label style={labelStyle}>Téléphone</label>
                  <input style={inputStyle} type="tel" placeholder="+33612345678" value={telephone} onChange={e => setTelephone(formatPhone(e.target.value))} />
                </div>
              </>
            )}

            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            {view !== "forgot-password" && (
              <div>
                <label style={labelStyle}>Mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: 38 }}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-3)', cursor: 'pointer', background: 'none', border: 'none', padding: 2,
                      display: 'flex', alignItems: 'center',
                    }}
                    tabIndex={-1}
                  >
                    <Icon name="eye" size={16} />
                  </button>
                </div>
              </div>
            )}

            {view === "login" && (
              <div style={{ textAlign: 'right' }}>
                <button type="button" onClick={() => setView("forgot-password")} style={{ fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; }}
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px 18px', background: 'var(--accent)', color: 'var(--accent-on)',
                border: 'none', borderRadius: 'var(--r-3)', fontWeight: 500, fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 4, boxShadow: 'var(--shadow-accent)',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-bright)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; }}
            >
              {getButtonText()}
              {!loading && <Icon name="arrowRight" size={16} />}
            </button>
          </form>

          <div style={{ marginTop: 18, textAlign: 'center' }}>
            {view === "forgot-password" ? (
              <button type="button" onClick={() => setView("login")} style={{ fontSize: 13, color: 'var(--text-3)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-bright)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; }}
              >
                Retour à la connexion
              </button>
            ) : (
              <button type="button" onClick={() => setView(view === "login" ? "signup" : "login")} style={{ fontSize: 13, color: 'var(--text-3)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-bright)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; }}
              >
                {view === "login" ? "Pas encore de compte ? Inscrivez-vous" : "Déjà un compte ? Connectez-vous"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
