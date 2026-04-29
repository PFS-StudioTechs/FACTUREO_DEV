import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ScanItem = {
  id: string;
  pdf_url: string;
  merchant: string | null;
  amount: number | null;
  expense_date: string | null;
  category: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scans }: { scans: ScanItem[] } = await req.json();
    if (!scans || scans.length === 0) throw new Error("No scans provided");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const ACCOUNTANT_EMAIL = Deno.env.get("ACCOUNTANT_EMAIL");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "notes-de-frais@factureo.fr";

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
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

    // Build attachments list as links in the body (Resend free tier doesn't support attachments via URL)
    const linksSection =
      "\n\nLiens des justificatifs :\n" +
      scans.map((s, i) => `${i + 1}. ${s.pdf_url}`).join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ACCOUNTANT_EMAIL],
        subject: `Notes de frais — ${scans.length} justificatif(s)`,
        text: emailBody + linksSection,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${res.status} — ${err}`);
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
