import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

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
  const corsHeaders = getCorsHeaders(req);
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
            content: `Tu es un assistant spécialisé dans l'extraction d'informations d'entreprises françaises.
À partir du document fourni (document d'identité d'entreprise, extrait Kbis, fiche entreprise, ou tout document contenant des informations sur une société), extrais les informations demandées et renvoie-les via la fonction fournie.
Si une information n'est pas présente dans le document, ne renvoie pas le champ ou renvoie une chaîne vide.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyse ce document (${file.name}) et extrais toutes les informations de l'entreprise.`,
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
              name: "extract_company_data",
              description: "Extraire toutes les données structurées d'une fiche entreprise",
              parameters: {
                type: "object",
                properties: {
                  denomination: { type: "string", description: "Nom/dénomination de l'entreprise" },
                  forme_juridique: { type: "string", description: "Forme juridique (SAS, SARL, EI, etc.)" },
                  capital: { type: "string", description: "Capital social" },
                  nom_contact: { type: "string", description: "Nom du dirigeant ou contact principal" },
                  adresse: { type: "string", description: "Adresse de l'entreprise (numéro et rue)" },
                  code_postal: { type: "string", description: "Code postal" },
                  ville: { type: "string", description: "Ville" },
                  telephone: { type: "string", description: "Numéro de téléphone" },
                  mail: { type: "string", description: "Adresse email de l'entreprise" },
                  siret: { type: "string", description: "Numéro SIRET (14 chiffres)" },
                  rcs_rm_ville: { type: "string", description: "Ville d'immatriculation RCS ou RM" },
                  code_naf: { type: "string", description: "Code NAF / APE" },
                  tva_intracommunautaire: { type: "string", description: "Numéro de TVA intracommunautaire" },
                  banque_titulaire: { type: "string", description: "Titulaire du compte bancaire" },
                  banque_nom: { type: "string", description: "Nom de la banque" },
                  banque_adresse: { type: "string", description: "Adresse de la banque" },
                  bic_swift: { type: "string", description: "Code BIC / SWIFT" },
                  code_iban: { type: "string", description: "Code IBAN" },
                },
                required: ["denomination"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_company_data" } },
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
      throw new Error("Impossible d'extraire les informations du document");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-company error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
