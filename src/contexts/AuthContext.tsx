import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "user" | null;

interface ProfileData {
  pseudo: string;
  nom: string;
  prenom: string;
  profileCompleted: boolean;
  kbisUrl: string | null;
  kbisDeadline: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  pseudo: string;
  nom: string;
  prenom: string;
  role: AppRole;
  loading: boolean;
  isAdmin: boolean;
  profileCompleted: boolean;
  kbisUrl: string | null;
  kbisDeadline: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  pseudo: "",
  nom: "",
  prenom: "",
  role: null,
  loading: true,
  isAdmin: false,
  profileCompleted: false,
  kbisUrl: null,
  kbisDeadline: null,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileData>({
    pseudo: "",
    nom: "",
    prenom: "",
    profileCompleted: false,
    kbisUrl: null,
    kbisDeadline: null,
  });
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("pseudo, nom, prenom, profile_completed, kbis_url, kbis_deadline")
          .eq("user_id", userId)
          .single(),
        supabase.rpc("get_user_role", { _user_id: userId }),
      ]);
      setProfile({
        pseudo: profileRes.data?.pseudo ?? "",
        nom: profileRes.data?.nom ?? "",
        prenom: profileRes.data?.prenom ?? "",
        profileCompleted: profileRes.data?.profile_completed ?? false,
        kbisUrl: profileRes.data?.kbis_url ?? null,
        kbisDeadline: profileRes.data?.kbis_deadline ?? null,
      });
      setRole((roleRes.data as AppRole) || null);
    } catch (err) {
      console.error("Failed to fetch user data:", err);
      setProfile({ pseudo: "", nom: "", prenom: "", profileCompleted: false, kbisUrl: null, kbisDeadline: null });
      setRole(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchUserData(user.id);
  }, [user, fetchUserData]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserData(session.user.id);
      } else {
        setProfile({ pseudo: "", nom: "", prenom: "", profileCompleted: false, kbisUrl: null, kbisDeadline: null });
        setRole(null);
      }
      if (mounted) {
        initializedRef.current = true;
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!initializedRef.current) return;
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile({ pseudo: "", nom: "", prenom: "", profileCompleted: false, kbisUrl: null, kbisDeadline: null });
        setRole(null);
      } else {
        fetchUserData(session.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      pseudo: profile.pseudo,
      nom: profile.nom,
      prenom: profile.prenom,
      role,
      loading,
      isAdmin: role === "admin",
      profileCompleted: profile.profileCompleted,
      kbisUrl: profile.kbisUrl,
      kbisDeadline: profile.kbisDeadline,
      refreshProfile,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
