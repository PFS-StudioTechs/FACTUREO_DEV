import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_VISION_MODEL = "gpt-4o-mini";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const OPENAI_BASE_URL = Deno.env.get("OPENAI_API_BASE_URL") || DEFAULT_OPENAI_BASE_URL;
    const OPENAI_VISION_MODEL = Deno.env.get("OPENAI_VISION_MODEL") || DEFAULT_VISION_MODEL;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new Error("Aucun fichier fourni");

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const mimeType = MIME_MAP[ext] || file.type || "application/octet-stream";

    const aiResponse = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_VISION_MODEL,
        messages: [
          {
            role: "system",
            content: `Tu es un assistant spécialisé dans l'extraction d'informations de factures professionnelles françaises.
À partir du document fourni (une facture), extrais les informations demandées et renvoie-les via la fonction fournie.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyse cette facture (${file.name}) et extrais toutes les informations attendues.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_data",
              description: "Extraire toutes les données structurées d'une facture",
              parameters: {
                type: "object",
                properties: {
                  numero_facture: { type: "string" },
                  date_facturation: { type: "string" },
                  designation: { type: "string" },
                  nombre_jours: { type: "number" },
                  tjm: { type: "number" },
                  montant_ht: { type: "number" },
                  taux_tva: { type: "number" },
                  montant_tva: { type: "number" },
                  montant_ttc: { type: "number" },
                  numero_bon_commande: { type: "string" },
                  descriptif_mission: { type: "string" },
                  conditions_paiement: { type: "number" },
                  mode_paiement: { type: "string", enum: ["VIREMENT", "CHEQUE", "PRELEVEMENT", "ESPECES", "AUTRE"] },
                  client_nom: { type: "string" },
                },
                required: [
                  "numero_facture",
                  "date_facturation",
                  "montant_ht",
                  "montant_tva",
                  "montant_ttc",
                  "taux_tva",
                  "client_nom",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`OpenAI error (${aiResponse.status})`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Impossible d'extraire les informations de la facture");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-invoice error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
