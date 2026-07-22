import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveCallerId, checkOwnership, errorToResponse, jsonResponse, type CreateAnonClient } from "../_shared/ownership.ts";

export interface Deps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  stripeSecretKey: string | undefined;
  appBaseUrl: string | undefined;
  createAnonClient: CreateAnonClient;
  createServiceClient: (url: string, key: string) => ReturnType<typeof createClient>;
  fetchImpl: typeof fetch;
}

function defaultDeps(): Deps {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL")!,
    supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
    supabaseServiceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    stripeSecretKey: Deno.env.get("STRIPE_SECRET_KEY"),
    appBaseUrl: Deno.env.get("APP_BASE_URL"),
    createAnonClient: (authHeader: string) =>
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      }),
    createServiceClient: (url, key) => createClient(url, key),
    fetchImpl: fetch,
  };
}

export async function handle(req: Request, corsHeaders: Record<string, string>, deps: Deps): Promise<Response> {
  const { invoice_id } = await req.json();
  if (!invoice_id) throw new Error("invoice_id required");

  if (!deps.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY not configured");
  if (!deps.appBaseUrl) throw new Error("APP_BASE_URL not configured");

  const callerResult = await resolveCallerId(req, deps.supabaseUrl, deps.supabaseAnonKey, deps.createAnonClient);
  if ("error" in callerResult) return errorToResponse(callerResult.error, corsHeaders);
  const { userId } = callerResult;

  const supabase = deps.createServiceClient(deps.supabaseUrl, deps.supabaseServiceRoleKey);

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("id, user_id, numero_facture, montant_ttc, client_id, company_id, clients(email, nom)")
    .eq("id", invoice_id)
    .single();

  if (fetchError || !invoice) throw new Error(`Invoice not found: ${fetchError?.message}`);

  const ownership = checkOwnership(invoice as { user_id: string }, userId);
  if (!ownership.ok) return errorToResponse(ownership.error, corsHeaders);

  // Load company to get stripe_account_id
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("stripe_account_id")
    .eq("id", invoice.company_id)
    .single();

  if (companyError || !company) throw new Error(`Company not found: ${companyError?.message}`);

  const stripeAccountId = (company as Record<string, unknown>).stripe_account_id as string | null;
  if (!stripeAccountId) {
    return jsonResponse(400, { error: "STRIPE_NOT_CONNECTED" }, corsHeaders);
  }

  const montantCentimes = Math.round(Number(invoice.montant_ttc) * 100);
  if (montantCentimes <= 0) throw new Error("montant_ttc must be positive");

  const clientEmail = (invoice.clients as { email?: string; nom?: string } | null)?.email;

  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("currency", "eur");
  params.append("line_items[0][price_data][currency]", "eur");
  params.append("line_items[0][price_data][unit_amount]", String(montantCentimes));
  params.append("line_items[0][price_data][product_data][name]", `Facture ${invoice.numero_facture}`);
  params.append("line_items[0][quantity]", "1");
  params.append("metadata[invoice_id]", invoice_id);
  params.append("metadata[user_id]", invoice.user_id);
  params.append("success_url", `${deps.appBaseUrl}/invoices?payment=success&invoice_id=${invoice_id}`);
  params.append("cancel_url", `${deps.appBaseUrl}/invoices?payment=cancelled&invoice_id=${invoice_id}`);
  if (clientEmail) params.append("customer_email", clientEmail);

  const stripeRes = await deps.fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${deps.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Account": stripeAccountId,
    },
    body: params.toString(),
  });

  if (!stripeRes.ok) {
    const errText = await stripeRes.text();
    throw new Error(`Stripe error [${stripeRes.status}]: ${errText}`);
  }

  const session = await stripeRes.json();

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      stripe_payment_link: session.url,
      stripe_session_id: session.id,
      statut_paiement: "en_cours",
    })
    .eq("id", invoice_id);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

  return jsonResponse(200, { url: session.url }, corsHeaders);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    return await handle(req, corsHeaders, defaultDeps());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("create-payment-link error:", message);
    return jsonResponse(500, { error: message }, corsHeaders);
  }
});
