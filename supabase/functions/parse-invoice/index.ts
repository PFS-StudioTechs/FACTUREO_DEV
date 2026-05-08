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

    let base64 = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      base64 += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    base64 = btoa(base64);

    // Build content part based on file type
    let filePart: unknown;
    if (ext === "pdf") {
      filePart = {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      };
    } else if (IMAGE_EXTS[ext]) {
      filePart = {
        type: "image",
        source: { type: "base64", media_type: IMAGE_EXTS[ext], data: base64 },
      };
    } else {
      return new Response(
        JSON.stringify({ error: `Format .${ext} non supporté. Utilisez PDF, JPG, PNG ou WEBP.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Tu es un assistant spécialisé dans l'extraction d'informations de factures professionnelles françaises.
À partir du document fourni, extrais les données et retourne un JSON avec exactement ces champs :
- numero_facture: numéro de la facture
- date_facturation: date au format YYYY-MM-DD
- designation: nom de la personne qui exécute la mission
- nombre_jours: nombre de jours travaillés (nombre, 0 si non trouvé)
- tjm: taux journalier moyen en euros (nombre, 0 si non trouvé)
- montant_ht: montant hors taxe en euros (nombre)
- taux_tva: taux de TVA en % (nombre, ex: 20)
- montant_tva: montant de TVA en euros (nombre)
- montant_ttc: montant TTC en euros (nombre)
- numero_bon_commande: numéro de bon de commande (chaîne vide si non trouvé)
- descriptif_mission: description de la mission
- conditions_paiement: délai de paiement en jours (nombre, 30 par défaut)
- mode_paiement: VIREMENT, CHEQUE, PRELEVEMENT ou ESPECES
- client_nom: nom ou raison sociale du client (celui qui reçoit la facture)

Retourne UNIQUEMENT le JSON valide, sans markdown, sans backticks, sans explication.`;

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
        messages: [{
          role: "user",
          content: [
            filePart,
            { type: "text", text: `Analyse cette facture (${file.name}) et extrais les données au format JSON strict.` },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erreur Anthropic (${response.status})`);
    }

    const result = await response.json();
    const textContent = result.content?.[0]?.text;
    if (!textContent) throw new Error("Impossible d'extraire les informations de la facture");

    const cleaned = textContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const extracted = JSON.parse(cleaned);

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
