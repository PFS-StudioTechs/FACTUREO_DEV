import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, clients } = await req.json();

    if (!transcript) {
      return new Response(JSON.stringify({ error: "Aucune transcription fournie" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const clientNames = (clients || []).map((c: any) => c.nom).join(", ");

    const systemPrompt = `Tu es un assistant qui extrait des données de facturation à partir d'une transcription vocale en français.
Tu dois extraire:
- Le nom du client (parmi cette liste: ${clientNames})
- La date de facturation (format YYYY-MM-DD)
- Le nombre de jours travaillés

Réponds UNIQUEMENT en appelant la fonction extract_invoice_data.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transcription vocale: "${transcript}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_data",
              description: "Extraire les données de facturation de la transcription",
              parameters: {
                type: "object",
                properties: {
                  client_name: {
                    type: "string",
                    description: "Le nom du client tel qu'il apparaît dans la liste des clients",
                  },
                  date_facturation: {
                    type: "string",
                    description: "La date de facturation au format YYYY-MM-DD",
                  },
                  nombre_jours: {
                    type: "number",
                    description: "Le nombre de jours travaillés",
                  },
                },
                required: ["client_name", "date_facturation", "nombre_jours"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits AI épuisés. Ajoutez des fonds dans les paramètres." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("Impossible d'extraire les données de la transcription");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-voice-invoice error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
