import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { FileText, ArrowRight, Eye, EyeOff } from "lucide-react";

type AuthView = "login" | "signup" | "forgot-password";

const Auth = () => {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [telephone, setTelephone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const formatPhone = (value: string) => {
    return value.replace(/[^\d+]/g, "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (view === "forgot-password") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Un email de réinitialisation vous a été envoyé. Vérifiez votre boîte mail.");
      }
      setLoading(false);
      return;
    }

    if (view === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      }
    } else {
      if (!pseudo.trim()) {
        toast.error("Veuillez saisir un pseudo");
        setLoading(false);
        return;
      }
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { pseudo, telephone } },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Compte créé ! Vérifiez votre email pour confirmer. Un administrateur validera votre accès.");
        
        // Notify admin of new signup
        try {
          await supabase.functions.invoke("notify-admin-new-signup", {
            body: { pseudo, email, telephone },
          });
        } catch (err) {
          console.error("Failed to notify admin:", err);
        }
      }
    }
    setLoading(false);
  };

  const getTitle = () => {
    if (view === "login") return "Connexion";
    if (view === "signup") return "Créer un compte";
    return "Mot de passe oublié";
  };

  const getDescription = () => {
    if (view === "login") return "Connectez-vous à votre espace Facturéo";
    if (view === "signup") return "Inscrivez-vous pour commencer à facturer";
    return "Entrez votre email pour recevoir un lien de réinitialisation";
  };

  const getButtonText = () => {
    if (loading) return "Chargement...";
    if (view === "login") return "Se connecter";
    if (view === "signup") return "Créer mon compte";
    return "Envoyer le lien";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <FileText className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Facturéo</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Votre solution de facturation intelligente
          </p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl">{getTitle()}</CardTitle>
            <CardDescription>{getDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {view === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="pseudo">Pseudo</Label>
                    <Input
                      id="pseudo"
                      type="text"
                      placeholder="Votre pseudo"
                      value={pseudo}
                      onChange={(e) => setPseudo(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telephone">Téléphone</Label>
                    <Input
                      id="telephone"
                      type="tel"
                      placeholder="+33612345678"
                      value={telephone}
                      onChange={(e) => setTelephone(formatPhone(e.target.value))}
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {view !== "forgot-password" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {view === "login" && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setView("forgot-password")}
                    className="text-sm text-primary hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {getButtonText()}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>
            <div className="mt-6 text-center space-y-2">
              {view === "forgot-password" ? (
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="text-sm text-primary hover:underline"
                >
                  Retour à la connexion
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setView(view === "login" ? "signup" : "login")}
                  className="text-sm text-primary hover:underline"
                >
                  {view === "login" ? "Pas encore de compte ? Inscrivez-vous" : "Déjà un compte ? Connectez-vous"}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
