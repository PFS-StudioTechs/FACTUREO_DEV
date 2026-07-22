import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { verifyStripeSignature } from "../_shared/stripeSignature.ts";
import { reconcilePayment } from "../_shared/reconcilePayment.ts";

export interface Deps {
  webhookSecret: string;
  createServiceClient: () => ReturnType<typeof createClient>;
}

function defaultDeps(): Deps {
  return {
    webhookSecret: Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    createServiceClient: () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
  };
}

/** Extrait invoice_id/user_id/montant depuis un event Stripe, quel que soit son type. */
function extractPaymentInfo(event: any): { invoiceId: string | null; userId: string | null; amountReceived: number | null } {
  const obj = event.data?.object ?? {};
  const metadata = obj.metadata ?? {};
  const invoiceId = metadata.invoice_id ?? null;
  const userId = metadata.user_id ?? null;

  if (event.type === "checkout.session.completed") {
    // amount_total est en centimes
    return { invoiceId, userId, amountReceived: typeof obj.amount_total === "number" ? obj.amount_total / 100 : null };
  }
  if (event.type === "payment_intent.succeeded") {
    return { invoiceId, userId, amountReceived: typeof obj.amount_received === "number" ? obj.amount_received / 100 : null };
  }
  return { invoiceId, userId, amountReceived: null };
}

export async function handle(req: Request, corsHeaders: Record<string, string>, deps: Deps): Promise<Response> {
  // 1. Lire le body BRUT en premier, AVANT tout JSON.parse
  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature");

  // 2. Vérifier la signature sur le body brut — seul garde-fou, pas de JWT ici
  const valid = await verifyStripeSignature(rawBody, sigHeader, deps.webhookSecret);
  if (!valid) {
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 400, headers: corsHeaders });
  }

  // 3. SEULEMENT MAINTENANT, parser le JSON
  const event = JSON.parse(rawBody);

  const handledTypes = ["checkout.session.completed", "payment_intent.succeeded"];
  if (!handledTypes.includes(event.type)) {
    return new Response(JSON.stringify({ received: true, ignored: event.type }), { status: 200, headers: corsHeaders });
  }

  const { invoiceId, userId, amountReceived } = extractPaymentInfo(event);

  // N'agit JAMAIS sans invoice_id valide dans le metadata
  if (!invoiceId) {
    console.error("Stripe webhook: événement sans invoice_id en metadata, ignoré", event.type);
    return new Response(JSON.stringify({ received: true, skipped: "no invoice_id" }), { status: 200, headers: corsHeaders });
  }

  const supabase = deps.createServiceClient();

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("id, user_id, montant_ttc")
    .eq("id", invoiceId)
    .single();

  if (fetchError || !invoice) {
    console.error("Stripe webhook: facture introuvable pour invoice_id", invoiceId, fetchError?.message);
    return new Response(JSON.stringify({ received: true, skipped: "invoice not found" }), { status: 200, headers: corsHeaders });
  }

  // Cohérence : le metadata.user_id (si présent) doit correspondre au propriétaire réel de la facture
  if (userId && (invoice as any).user_id !== userId) {
    console.error("Stripe webhook: incohérence user_id metadata vs facture", { invoiceId, metadataUserId: userId, invoiceUserId: (invoice as any).user_id });
    return new Response(JSON.stringify({ received: true, skipped: "user_id mismatch" }), { status: 200, headers: corsHeaders });
  }

  if (amountReceived == null) {
    console.error("Stripe webhook: montant introuvable sur l'event", event.type);
    return new Response(JSON.stringify({ received: true, skipped: "no amount" }), { status: 200, headers: corsHeaders });
  }

  const { statut_paiement, montant_paye } = reconcilePayment(Number((invoice as any).montant_ttc), amountReceived);

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      statut_paiement,
      montant_paye,
      paid_at: new Date().toISOString(),
      reminder_level: 0,
    })
    .eq("id", invoiceId);

  if (updateError) {
    console.error("Stripe webhook: DB update failed for invoice", invoiceId, updateError.message);
    return new Response(JSON.stringify({ error: "db error" }), { status: 500, headers: corsHeaders });
  }

  console.log("payment reconciled", { invoiceId, statut_paiement, montant_paye });
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return handle(req, corsHeaders, defaultDeps());
});
