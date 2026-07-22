import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useAssistantSignals } from "@/hooks/useAssistantSignals";
import { buildLucaContext, getActionChips, type ActionChip, type LucaGreetingContext } from "@/lib/luca/lucaContext";
import { buildFallbackGreeting } from "@/lib/luca/greetingFallback";

const GREETING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/luca-greeting`;

export function useLucaGreeting() {
  const { user, pseudo } = useAuth();
  const { signals, isLoading: signalsLoading } = useAssistantSignals();
  const [greeting, setGreeting] = useState<string | null>(null);
  const [chips, setChips] = useState<ActionChip[]>([]);
  const [loading, setLoading] = useState(false);

  const sessionKey = user ? `luca-greeting-shown-${user.id}` : null;

  const generate = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const context: LucaGreetingContext = buildLucaContext(signals, pseudo || "toi");
    setChips(getActionChips(context));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(GREETING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ context }),
      });
      if (!res.ok) throw new Error(`luca-greeting HTTP ${res.status}`);
      const data = await res.json();
      setGreeting(data.message ?? buildFallbackGreeting(context));
    } catch {
      setGreeting(buildFallbackGreeting(context));
    } finally {
      setLoading(false);
      if (sessionKey) sessionStorage.setItem(sessionKey, "1");
    }
  }, [user, pseudo, signals, sessionKey]);

  // Génère une fois par session (sessionStorage) — pas à chaque navigation.
  // Se régénère naturellement à une nouvelle connexion (nouvel onglet/session)
  // ou via `regenerate()` appelé manuellement.
  useEffect(() => {
    if (!user || signalsLoading || greeting) return;
    if (sessionKey && sessionStorage.getItem(sessionKey)) return;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, signalsLoading]);

  return { greeting, chips, loading, regenerate: generate };
}
