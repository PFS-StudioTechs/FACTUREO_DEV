import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveCallerId, errorToResponse, jsonResponse, type CreateAnonClient } from "../_shared/ownership.ts";
import { getLucaGreetingPersona } from "../_shared/system-prompts-luca.ts";
import { buildFallbackGreeting, type LucaGreetingContext } from "../_shared/greetingFallback.ts";

export interface Deps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  anthropicApiKey: string | undefined;
  createAnonClient: CreateAnonClient;
  fetchImpl: typeof fetch;
}

function defaultDeps(): Deps {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL")!,
    supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
    anthropicApiKey: Deno.env.get("ANTHROPIC_API_KEY"),
    createAnonClient: (authHeader: string) =>
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      }),
    fetchImpl: fetch,
  };
}

function isValidContext(c: unknown): c is LucaGreetingContext {
  if (!c || typeof c !== "object") return false;
  const ctx = c as Record<string, unknown>;
  return typeof ctx.userName === "string"
    && typeof ctx.toutAuVert === "boolean"
    && Array.isArray(ctx.signauxCles)
    && typeof ctx.nbTotal === "number";
}

// Endpoint jamais ouvert : le JWT est exigé et l'utilisateur est dérivé de son propre
// token (resolveCallerId). Le résumé reçu ne contient que les faits déjà bornés par
// RLS côté front (useAssistantSignals) — aucune donnée d'un autre compte ne transite ici.
export async function handle(req: Request, corsHeaders: Record<string, string>, deps: Deps): Promise<Response> {
  const callerResult = await resolveCallerId(req, deps.supabaseUrl, deps.supabaseAnonKey, deps.createAnonClient);
  if ("error" in callerResult) return errorToResponse(callerResult.error, corsHeaders);

  const body = await req.json().catch(() => null);
  const context = body?.context;
  if (!isValidContext(context)) {
    return jsonResponse(400, { error: "context invalide" }, corsHeaders);
  }

  if (!deps.anthropicApiKey) {
    return jsonResponse(200, { message: buildFallbackGreeting(context), source: "fallback" }, corsHeaders);
  }

  try {
    const res = await deps.fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": deps.anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system: getLucaGreetingPersona(context.userName),
        messages: [{ role: "user", content: JSON.stringify(context) }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
    const data = await res.json();
    const text = data?.content?.[0]?.text?.trim();
    if (!text) throw new Error("Réponse IA vide");
    return jsonResponse(200, { message: text, source: "ia" }, corsHeaders);
  } catch (e) {
    console.error("luca-greeting: appel IA échoué, repli déterministe:", e);
    return jsonResponse(200, { message: buildFallbackGreeting(context), source: "fallback" }, corsHeaders);
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    return await handle(req, corsHeaders, defaultDeps());
  } catch (e) {
    console.error("luca-greeting error:", e);
    return jsonResponse(500, { error: e instanceof Error ? e.message : "Erreur inconnue" }, corsHeaders);
  }
});
