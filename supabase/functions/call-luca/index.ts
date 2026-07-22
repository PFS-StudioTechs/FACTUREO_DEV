import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { anthropicToOpenAiSse } from "../_shared/anthropic-stream.ts";
import { getLucaSystemPrompt, type LucaContext } from "../_shared/system-prompts-luca.ts";

const MAX_HISTORY_MESSAGES = 20;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Authentification requise" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Session invalide" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversationId, message, route } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message manquant" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!conversationId || typeof conversationId !== "string") {
      return new Response(JSON.stringify({ error: "conversationId manquant" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The conversation is created client-side (RLS-scoped) before this call —
    // here we only verify it actually belongs to the authenticated user.
    const { data: conv } = await supabase
      .from("luca_conversations").select("id").eq("id", conversationId).eq("user_id", user.id).maybeSingle();
    if (!conv) {
      return new Response(JSON.stringify({ error: "Conversation introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const convId = conversationId;

    await supabase.from("luca_messages").insert({
      conversation_id: convId, user_id: user.id, role: "user", content: message,
    });

    const { data: history } = await supabase
      .from("luca_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY_MESSAGES);

    const claudeMessages = (history ?? []).map(m => ({ role: m.role, content: m.content }));

    const [{ data: companies }, { data: clients }, { data: recentInvoices }, { data: forecasts }, { data: expenseScans }] = await Promise.all([
      supabase.from("companies").select("id, denomination").eq("user_id", user.id),
      supabase.from("clients").select("id, nom, company_id").eq("user_id", user.id),
      supabase.from("invoices")
        .select("id, numero_facture, client_id, montant_ttc, status, statut_paiement, date_limite_paiement, reminder_level")
        .eq("user_id", user.id)
        .order("date_facturation", { ascending: false })
        .limit(10),
      supabase.from("forecasts").select("id, mission_name, tjm, year").eq("user_id", user.id),
      supabase.from("expense_scans")
        .select("id, merchant, amount, category, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const context: LucaContext = {
      route: typeof route === "string" ? route : undefined,
      companies: companies ?? [],
      clients: clients ?? [],
      recentInvoices: recentInvoices ?? [],
      forecasts: forecasts ?? [],
      expenseScans: expenseScans ?? [],
    };

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4096,
        system: getLucaSystemPrompt(context),
        messages: claudeMessages,
        stream: true,
      }),
    });

    if (!anthropicResponse.ok) {
      if (anthropicResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans un instant." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await anthropicResponse.text();
      console.error("Anthropic error:", anthropicResponse.status, errText);
      throw new Error(`Erreur du service IA (${anthropicResponse.status})`);
    }

    const stream = anthropicToOpenAiSse(anthropicResponse.body!, (fullText) => {
      supabase.from("luca_messages").insert({
        conversation_id: convId, user_id: user.id, role: "assistant", content: fullText,
      }).then(({ error }) => { if (error) console.error("Failed to persist Luca reply:", error); });
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("call-luca error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
