import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_VISION_MODEL = "gpt-4o-mini";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) throw new Error("No image provided");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const OPENAI_BASE_URL = Deno.env.get("OPENAI_API_BASE_URL") || DEFAULT_OPENAI_BASE_URL;
    const OPENAI_VISION_MODEL = Deno.env.get("OPENAI_VISION_MODEL") || DEFAULT_VISION_MODEL;

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
            content: `Tu es un assistant spécialisé dans l'analyse de tickets de caisse et notes de frais.
Analyse l'image fournie et extrais les informations demandées.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyse ce ticket de caisse / note de frais. Extrais la date de facturation et donne une courte description (nom du magasin/prestataire et montant total si visible).",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_receipt_info",
              description: "Extract receipt date and description from the image",
              parameters: {
                type: "object",
                properties: {
                  date: {
                    type: "string",
                    description: "Date on the receipt in YYYY-MM-DD format. Use today's date if not found.",
                  },
                  description: {
                    type: "string",
                    description: "Short description: store name and total amount if visible",
                  },
                },
                required: ["date", "description"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_receipt_info" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), {
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
      throw new Error(`OpenAI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();

    let extractedDate = new Date().toISOString().split("T")[0];
    let description = "Note de frais";

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
          extractedDate = parsed.date;
        }
        if (parsed.description) {
          description = parsed.description;
        }
      } else {
        const content = aiData.choices?.[0]?.message?.content;
        if (typeof content === "string") {
          description = content.slice(0, 140);
        }
      }
    } catch (parseErr) {
      console.error("Parse error, using defaults:", parseErr);
    }

    return new Response(
      JSON.stringify({ date: extractedDate, description }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
