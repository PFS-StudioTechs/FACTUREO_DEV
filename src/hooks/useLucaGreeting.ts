import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useAssistantSignals } from "@/hooks/useAssistantSignals";
import { buildLucaContext, getActionChips, type ActionChip, type LucaGreetingContext } from "@/lib/luca/lucaContext";
import { buildFallbackGreeting } from "@/lib/luca/greetingFallback";
import { buildOnboardingMessage, ONBOARDING_CHIPS } from "@/lib/luca/onboarding";

const GREETING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/luca-greeting`;

export function useLucaGreeting() {
  const { user, pseudo } = useAuth();
  const { signals, isLoading: signalsLoading } = useAssistantSignals();
  const [greeting, setGreeting] = useState<string | null>(null);
  const [chips, setChips] = useState<ActionChip[]>([]);
  const [loading, setLoading] = useState(false);

  const sessionKey = user ? `luca-greeting-shown-${user.id}` : null;

  // Compte neuf = jamais créé de client ni de facture — on propose un
  // onboarding guidé plutôt que le résumé de signaux (qui serait vide/faux).
  const { data: onboardingCounts, isLoading: countsLoading } = useQuery({
    queryKey: ["luca-onboarding-counts", user?.id],
    queryFn: async () => {
      const [clients, invoices] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("id", { count: "exact", head: true }),
      ]);
      return { clients: clients.count || 0, invoices: invoices.count || 0 };
    },
    enabled: !!user,
  });
  const isNewUser = !!onboardingCounts && onboardingCounts.clients === 0 && onboardingCounts.invoices === 0;

  const generate = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    if (isNewUser) {
      setGreeting(buildOnboardingMessage(pseudo || "toi"));
      setChips(ONBOARDING_CHIPS);
      setLoading(false);
      if (sessionKey) sessionStorage.setItem(sessionKey, "1");
      return;
    }

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
  }, [user, pseudo, signals, sessionKey, isNewUser]);

  // Génère une fois par session (sessionStorage) — pas à chaque navigation.
  // Se régénère naturellement à une nouvelle connexion (nouvel onglet/session)
  // ou via `regenerate()` appelé manuellement.
  useEffect(() => {
    if (!user || signalsLoading || countsLoading || greeting) return;
    if (sessionKey && sessionStorage.getItem(sessionKey)) return;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, signalsLoading, countsLoading]);

  return { greeting, chips, loading, regenerate: generate };
}
