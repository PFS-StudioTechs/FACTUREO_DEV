import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceData } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Tu es un assistant professionnel français. Génère un email professionnel court pour accompagner l'envoi d'une facture.

Données de la facture :
- Numéro de facture : ${invoiceData.numero_facture}
- Nom du client : ${invoiceData.client_nom}
- Nom de l'expéditeur : ${invoiceData.nom_contact}
- Nombre de jours travaillés : ${invoiceData.nombre_jours}
- Montant TTC : ${invoiceData.montant_ttc} €
- Mois de prestation : ${invoiceData.mois_prestation}
- Descriptif mission : ${invoiceData.descriptif_mission}
- Désignation : ${invoiceData.designation}

Génère UNIQUEMENT le corps du mail (sans objet). Le ton doit être professionnel et courtois.
Commence par "Bonjour à toutes et à tous," ou "Bonjour,".
Mentionne le numéro de la facture, le mois de prestation et le nombre de jours travaillés.
Termine par "Vous en souhaitant bonne réception" puis "Cordialement" suivi du nom complet de l'expéditeur.
Ne mets PAS de balises HTML, juste du texte brut.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Tu es un assistant professionnel français spécialisé dans la rédaction d'emails de facturation." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Trop de requêtes, veuillez réessayer dans quelques instants." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Crédits AI épuisés, veuillez recharger votre espace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI gateway error [${response.status}]: ${errText}`);
    }

    const result = await response.json();
    const emailBody = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ emailBody }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error generating email:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
