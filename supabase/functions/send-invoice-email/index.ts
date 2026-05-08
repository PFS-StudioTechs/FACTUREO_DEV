import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, fileName, pdfBase64, emailBody, invoiceNumber } = await req.json();
    if (!recipientEmail || !pdfBase64) throw new Error("recipientEmail and pdfBase64 are required");

    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "facturation@factureo.fr";

    if (!SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY not configured");

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipientEmail }] }],
        from: { email: FROM_EMAIL },
        subject: `Facture N° ${invoiceNumber}`,
        content: [{ type: "text/plain", value: emailBody }],
        attachments: [{
          content: pdfBase64,
          type: "application/pdf",
          filename: fileName || `${invoiceNumber}.pdf`,
          disposition: "attachment",
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`SendGrid error: ${res.status} — ${err}`);
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
