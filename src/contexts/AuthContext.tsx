import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "user" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  pseudo: string;
  role: AppRole;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  pseudo: "",
  role: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [pseudo, setPseudo] = useState("");
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("pseudo").eq("user_id", userId).single(),
        supabase.rpc("get_user_role", { _user_id: userId }),
      ]);
      setPseudo(profileRes.data?.pseudo || "");
      setRole((roleRes.data as AppRole) || null);
    } catch (err) {
      console.error("Failed to fetch user data:", err);
      setPseudo("");
      setRole(null);
    }
  }, []);

  useEffect(() => {
    let initialized = false;
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          setPseudo("");
          setRole(null);
        }

        // Set loading=false only after the first event (INITIAL_SESSION) is fully processed
        if (!initialized && mounted) {
          initialized = true;
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, pseudo, role, loading, isAdmin: role === "admin", signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
