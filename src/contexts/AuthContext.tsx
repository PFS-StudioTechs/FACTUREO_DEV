import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from "react";
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
  const initializedRef = useRef(false);

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
    let mounted = true;

    // Initialize from current session — sets loading=false only after role is fetched
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserData(session.user.id);
      } else {
        setPseudo("");
        setRole(null);
      }
      if (mounted) {
        initializedRef.current = true;
        setLoading(false);
      }
    });

    // Handle subsequent auth changes (sign in, sign out, token refresh)
    // onAuthStateChange must NOT be async — call async helper without awaiting
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Skip INITIAL_SESSION — already handled by getSession() above
      if (!initializedRef.current) return;
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setPseudo("");
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
    <AuthContext.Provider value={{ user, session, pseudo, role, loading, isAdmin: role === "admin", signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
