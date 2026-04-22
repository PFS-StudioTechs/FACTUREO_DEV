import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIME_MAP: Record<string, string> = {
  "pdf": "application/pdf",
  "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "doc": "application/msword",
  "txt": "text/plain",
  "jpg": "image/jpeg",
  "jpeg": "image/jpeg",
  "png": "image/png",
  "webp": "image/webp",
  "heic": "image/heic",
  "heif": "image/heif",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new Error("Aucun fichier fourni");

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Convert to base64
    let base64 = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      base64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    base64 = btoa(base64);

    // Determine MIME type
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const mimeType = MIME_MAP[ext] || file.type || "application/octet-stream";

    const systemPrompt = `Tu es un assistant spécialisé dans l'extraction d'informations de contrats et avenants professionnels français.
À partir du contenu du document fourni, extrais les informations du CLIENT (pas du prestataire/fournisseur) et retourne un JSON avec les champs suivants :
- nom: Nom ou raison sociale du client
- adresse: Adresse postale du client
- ville: Ville du client  
- code_postal: Code postal du client
- numero_bon_commande: Numéro de bon de commande s'il existe
- tjm: Taux Journalier Moyen en euros (nombre uniquement, sans symbole €)
- descriptif_mission: Description de la mission/prestation
- conditions_paiement: Délai de paiement en jours (nombre uniquement)
- mode_paiement: Mode de paiement (VIREMENT, CHEQUE, PRELEVEMENT ou ESPECES)

IMPORTANT: 
- Identifie bien le CLIENT (celui qui commande la prestation) vs le PRESTATAIRE (celui qui réalise la prestation).
- Si une information n'est pas trouvée, retourne une chaîne vide "" pour les textes et "0" pour les nombres.
- Retourne UNIQUEMENT le JSON valide, sans markdown, sans backticks, sans explication.`;

    // Call Gemini API directly with multimodal support
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
            { text: `Analyse ce document (${file.name}) et extrais les informations du client au format JSON.` },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            nom: { type: "STRING" },
            adresse: { type: "STRING" },
            ville: { type: "STRING" },
            code_postal: { type: "STRING" },
            numero_bon_commande: { type: "STRING" },
            tjm: { type: "STRING" },
            descriptif_mission: { type: "STRING" },
            conditions_paiement: { type: "STRING" },
            mode_paiement: { type: "STRING" },
          },
          required: ["nom", "adresse", "ville", "code_postal", "numero_bon_commande", "tjm", "descriptif_mission", "conditions_paiement", "mode_paiement"],
        },
      },
    };

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes vers Gemini, réessayez dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 403) {
        return new Response(JSON.stringify({ error: "Clé API Gemini invalide ou quota dépassé." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erreur Gemini (${response.status}): ${errText}`);
    }

    const geminiResult = await response.json();
    const textContent = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textContent) {
      console.error("Gemini response:", JSON.stringify(geminiResult));
      throw new Error("L'IA n'a pas pu extraire les informations du document");
    }

    const extracted = JSON.parse(textContent);

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-contract error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
