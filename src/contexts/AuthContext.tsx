import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

  // Fetch profile + role whenever user changes
  useEffect(() => {
    let cancelled = false;

    const fetchUserData = async (userId: string) => {
      try {
        const [profileRes, roleRes] = await Promise.all([
          supabase.from("profiles").select("pseudo").eq("user_id", userId).single(),
          supabase.rpc("get_user_role", { _user_id: userId }),
        ]);
        if (cancelled) return;
        setPseudo(profileRes.data?.pseudo || "");
        setRole((roleRes.data as AppRole) || null);
      } catch (err) {
        console.error("Failed to fetch user data:", err);
        if (cancelled) return;
        setPseudo("");
        setRole(null);
      }
    };

    if (user) {
      fetchUserData(user.id).finally(() => {
        if (!cancelled) setLoading(false);
      });
    } else {
      setPseudo("");
      setRole(null);
      setLoading(false);
    }

    return () => { cancelled = true; };
  }, [user]);

  // Listen to auth state changes — no async work here
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, pseudo, role, loading, isAdmin: role === "admin", signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
