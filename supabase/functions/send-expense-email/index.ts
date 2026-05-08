import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

type ScanItem = {
  id: string;
  pdf_url: string;
  merchant: string | null;
  amount: number | null;
  expense_date: string | null;
  category: string | null;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scans }: { scans: ScanItem[] } = await req.json();
    if (!scans || scans.length === 0) throw new Error("No scans provided");

    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    const ACCOUNTANT_EMAIL = Deno.env.get("ACCOUNTANT_EMAIL");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "notes-de-frais@factureo.fr";

    if (!SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY not configured");
    if (!ACCOUNTANT_EMAIL) throw new Error("ACCOUNTANT_EMAIL not configured");

    // Build email body
    const scanLines = scans
      .map((s) => {
        const parts = [
          s.merchant ?? "Inconnu",
          s.amount != null ? `${s.amount.toFixed(2)} €` : null,
          s.expense_date
            ? new Date(s.expense_date).toLocaleDateString("fr-FR")
            : null,
          s.category ?? null,
        ].filter(Boolean);
        return `• ${parts.join(" — ")}`;
      })
      .join("\n");

    const totalAmount = scans.reduce((sum, s) => sum + (s.amount ?? 0), 0);

    const emailBody = `Bonjour,

Veuillez trouver ci-joint ${scans.length} note(s) de frais à traiter.

Récapitulatif :
${scanLines}

${totalAmount > 0 ? `Total : ${totalAmount.toFixed(2)} €` : ""}

Les pièces justificatives (PDF) sont accessibles via les liens joints.

Cordialement`;

    const linksSection =
      "\n\nLiens des justificatifs :\n" +
      scans.map((s, i) => `${i + 1}. ${s.pdf_url}`).join("\n");

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ACCOUNTANT_EMAIL }] }],
        from: { email: FROM_EMAIL },
        subject: `Notes de frais — ${scans.length} justificatif(s)`,
        content: [{ type: "text/plain", value: emailBody + linksSection }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`SendGrid error: ${res.status} — ${err}`);
    }

    return new Response(
      JSON.stringify({ success: true, sent: scans.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-expense-email error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
