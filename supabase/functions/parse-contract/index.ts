import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const IMAGE_EXTS: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", webp: "image/webp",
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new Error("Aucun fichier fourni");

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

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

    // Build content parts based on file type
    let contentParts: unknown[];

    if (ext === "txt") {
      const text = new TextDecoder().decode(bytes);
      contentParts = [{ type: "text", text: `Contenu du document (${file.name}):\n${text}` }];
    } else if (IMAGE_EXTS[ext]) {
      let base64 = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        base64 += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      base64 = btoa(base64);
      contentParts = [{
        type: "image",
        source: { type: "base64", media_type: IMAGE_EXTS[ext], data: base64 },
      }];
    } else if (ext === "pdf") {
      let base64 = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        base64 += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      base64 = btoa(base64);
      contentParts = [{
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      }];
    } else if (ext === "docx" || ext === "doc") {
      return new Response(
        JSON.stringify({ error: "Format DOCX non supporté. Veuillez convertir votre contrat en PDF avant de l'importer." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: `Format .${ext} non supporté. Utilisez PDF, TXT ou une image.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    contentParts.push({
      type: "text",
      text: `Analyse ce document (${file.name}) et extrais les informations du client au format JSON strict.`,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: contentParts }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Clé API Anthropic invalide." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erreur Anthropic (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const textContent = result.content?.[0]?.text;

    if (!textContent) {
      console.error("Anthropic response:", JSON.stringify(result));
      throw new Error("L'IA n'a pas pu extraire les informations du document");
    }

    const cleaned = textContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const extracted = JSON.parse(cleaned);

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
