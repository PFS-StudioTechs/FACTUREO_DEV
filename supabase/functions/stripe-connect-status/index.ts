import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id } = await req.json();
    if (!company_id) throw new Error("company_id required");

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("stripe_account_id, stripe_onboarding_done")
      .eq("id", company_id)
      .single();

    if (companyError || !company) throw new Error(`Company not found: ${companyError?.message}`);

    const stripeAccountId = (company as Record<string, unknown>).stripe_account_id as string | null;

    if (!stripeAccountId) {
      return new Response(JSON.stringify({ connected: false, charges_enabled: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountRes = await fetch(`https://api.stripe.com/v1/accounts/${stripeAccountId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
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

    return new Response(
      JSON.stringify({ connected: true, charges_enabled: chargesEnabled }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("stripe-connect-status error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
