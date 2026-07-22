import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveCallerId, checkOwnership, errorToResponse, jsonResponse, type CreateAnonClient } from "../_shared/ownership.ts";

export interface Deps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  stripeSecretKey: string | undefined;
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
    createAnonClient: (authHeader: string) =>
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      }),
    createServiceClient: (url, key) => createClient(url, key),
    fetchImpl: fetch,
  };
}

export async function handle(req: Request, corsHeaders: Record<string, string>, deps: Deps): Promise<Response> {
  const { company_id } = await req.json();
  if (!company_id) throw new Error("company_id required");

  if (!deps.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY not configured");

  const callerResult = await resolveCallerId(req, deps.supabaseUrl, deps.supabaseAnonKey, deps.createAnonClient);
  if ("error" in callerResult) return errorToResponse(callerResult.error, corsHeaders);
  const { userId } = callerResult;

  const supabase = deps.createServiceClient(deps.supabaseUrl, deps.supabaseServiceRoleKey);

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("user_id, stripe_account_id, stripe_onboarding_done")
    .eq("id", company_id)
    .single();

  if (companyError || !company) throw new Error(`Company not found: ${companyError?.message}`);

  const ownership = checkOwnership(company as { user_id: string }, userId);
  if (!ownership.ok) return errorToResponse(ownership.error, corsHeaders);

  const stripeAccountId = (company as Record<string, unknown>).stripe_account_id as string | null;

  if (!stripeAccountId) {
    return jsonResponse(200, { connected: false, charges_enabled: false }, corsHeaders);
  }

  const accountRes = await deps.fetchImpl(`https://api.stripe.com/v1/accounts/${stripeAccountId}`, {
    headers: { Authorization: `Bearer ${deps.stripeSecretKey}` },
  });

  if (!accountRes.ok) {
    const errText = await accountRes.text();
    throw new Error(`Stripe account fetch failed [${accountRes.status}]: ${errText}`);
  }

  const account = await accountRes.json();
  const chargesEnabled: boolean = account.charges_enabled === true;

  if (chargesEnabled) {
    await supabase
      .from("companies")
      .update({ stripe_onboarding_done: true })
      .eq("id", company_id);
  }

  return jsonResponse(200, { connected: true, charges_enabled: chargesEnabled }, corsHeaders);
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
    console.error("stripe-connect-status error:", message);
    return jsonResponse(500, { error: message }, corsHeaders);
  }
});
