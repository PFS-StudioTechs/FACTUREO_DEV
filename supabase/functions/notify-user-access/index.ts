import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, pseudo } = await req.json();

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "userEmail is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Lovable AI to generate confirmation email content
    const response = await fetch("https://api.lovable.dev/api/v3/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: `Generate a short, professional French email body (HTML format) confirming that the user "${pseudo || 'Utilisateur'}" now has access to the Facturéo application. The email should be warm and professional. Just the HTML body content, no subject line. Keep it concise.`,
          },
        ],
      }),
    });

    const fallback = `<p>Bonjour ${pseudo || ''},</p><p>Votre accès à l'application Facturéo a été validé par l'administrateur.</p><p>Vous pouvez maintenant vous connecter et utiliser toutes les fonctionnalités de l'application.</p><p>Cordialement,<br/>L'équipe Facturéo</p>`;
    
    let emailBody = fallback;
    try {
      const rawText = await response.text();
      // Try to extract JSON from the response
      const jsonStart = rawText.search(/[\{\[]/);
      const jsonEnd = rawText.lastIndexOf(jsonStart !== -1 && rawText[jsonStart] === '[' ? ']' : '}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const cleaned = rawText.substring(jsonStart, jsonEnd + 1)
          .replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, "");
        const aiResult = JSON.parse(cleaned);
        emailBody = aiResult?.choices?.[0]?.message?.content || fallback;
      }
    } catch (parseError) {
      console.warn("Failed to parse AI response, using fallback email:", parseError.message);
    }

    console.log(`Access confirmation sent to ${userEmail} for user ${pseudo}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Confirmation email prepared",
        recipientEmail: userEmail,
        emailBody 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
