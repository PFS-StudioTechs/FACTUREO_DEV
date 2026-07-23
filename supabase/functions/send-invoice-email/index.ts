import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmails, recipientEmail, fileName, pdfBase64, emailBody, invoiceNumber } = await req.json();
    const toEmails: string[] = recipientEmails?.length ? recipientEmails : recipientEmail ? [recipientEmail] : [];
    if (toEmails.length === 0 || !pdfBase64) throw new Error("recipientEmails and pdfBase64 are required");

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "facturation@factureo.fr";

    if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL },
        to: toEmails.map(email => ({ email })),
        subject: `Facture N° ${invoiceNumber}`,
        textContent: emailBody,
        attachment: [{
          content: pdfBase64,
          name: fileName || `${invoiceNumber}.pdf`,
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Brevo error: ${res.status} — ${err}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-invoice-email error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
