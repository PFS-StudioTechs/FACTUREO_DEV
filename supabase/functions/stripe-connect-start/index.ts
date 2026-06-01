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
    const APP_BASE_URL = Deno.env.get("APP_BASE_URL");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");
    if (!APP_BASE_URL) throw new Error("APP_BASE_URL not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("stripe_account_id")
      .eq("id", company_id)
      .single();

    if (companyError || !company) throw new Error(`Company not found: ${companyError?.message}`);

    let stripeAccountId = (company as Record<string, unknown>).stripe_account_id as string | null;

    // Create Standard connected account if none exists
    if (!stripeAccountId) {
      const accountParams = new URLSearchParams();
      accountParams.append("type", "standard");
      accountParams.append("country", "FR");

      const accountRes = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: accountParams.toString(),
      });

      if (!accountRes.ok) {
        const errText = await accountRes.text();
        throw new Error(`Stripe account creation failed [${accountRes.status}]: ${errText}`);
      }

      const account = await accountRes.json();
      stripeAccountId = account.id;

      const { error: updateError } = await supabase
        .from("companies")
        .update({ stripe_account_id: stripeAccountId })
        .eq("id", company_id);

      if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
    }

    // Create Account Link for onboarding
    const linkParams = new URLSearchParams();
    linkParams.append("account", stripeAccountId!);
    linkParams.append("type", "account_onboarding");
    linkParams.append("refresh_url", `${APP_BASE_URL}/entreprises/${company_id}?stripe=refresh`);
    linkParams.append("return_url", `${APP_BASE_URL}/entreprises/${company_id}?stripe=done`);

    const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: linkParams.toString(),
    });

    if (!linkRes.ok) {
      const errText = await linkRes.text();
      throw new Error(`Stripe account_links failed [${linkRes.status}]: ${errText}`);
    }

    const link = await linkRes.json();

    return new Response(JSON.stringify({ url: link.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("stripe-connect-start error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
