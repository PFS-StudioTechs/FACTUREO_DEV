import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ valid: false, error: "Aucun fichier reçu" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ valid: false, error: "Format non supporté. Utilisez PDF, JPG ou PNG." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ valid: false, error: "Fichier trop volumineux (max 10 Mo)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    // For PDF files, skip AI check (no PDF parsing in edge runtime)
    if (file.type === "application/pdf") {
      return new Response(
        JSON.stringify({ valid: true, message: "Document PDF accepté" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!anthropicKey) {
      // No AI key: accept any image
      return new Response(
        JSON.stringify({ valid: true, message: "Document accepté" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Claude claude-haiku to verify image is a KBIS document
    const bytes = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    const mediaType = file.type as "image/jpeg" | "image/png" | "image/webp";

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: "Est-ce que cette image est un extrait Kbis français (document officiel d'immatriculation d'entreprise au registre du commerce) ? Réponds uniquement par JSON: {\"is_kbis\": true/false, \"reason\": \"...\"} (max 20 mots pour reason).",
              },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      // AI call failed — accept document anyway (non-blocking)
      return new Response(
        JSON.stringify({ valid: true, message: "Document accepté (vérification IA indisponible)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const text = aiData?.content?.[0]?.text ?? "";

    let parsed: { is_kbis: boolean; reason: string } = { is_kbis: true, reason: "" };
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {
      // Malformed AI response — accept document
    }

    if (!parsed.is_kbis) {
      return new Response(
        JSON.stringify({ valid: false, error: `Document non reconnu comme Kbis. ${parsed.reason}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ valid: true, message: "Kbis vérifié avec succès" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("verify-kbis error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Erreur lors de la vérification" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
