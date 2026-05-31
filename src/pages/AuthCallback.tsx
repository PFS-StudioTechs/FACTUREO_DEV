import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.search
      );

      if (error || !data.session) {
        toast.error("Lien invalide ou expiré. Veuillez vous reconnecter.");
        navigate("/auth", { replace: true });
        return;
      }

      // Check if profile is completed
      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("user_id", data.session.user.id)
        .single();

      if (!profile?.profile_completed) {
        navigate("/complete-profile", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-0)",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "3px solid var(--accent)", borderTopColor: "transparent",
          animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
        }} />
        <p style={{ fontSize: 14, color: "var(--text-3)" }}>Vérification en cours…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AuthCallback;
