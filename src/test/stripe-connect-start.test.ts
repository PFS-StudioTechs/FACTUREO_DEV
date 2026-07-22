import { describe, it, expect, vi } from "vitest";

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: () => {} }));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient: () => ({}) }));

import { handle, type Deps } from "../../supabase/functions/stripe-connect-start/index";

const OWNER_ID = "owner-user-1";
const ATTACKER_ID = "attacker-user-2";

function makeDeps(overrides: Partial<Deps> & { callerId: string | null; fetchImpl?: typeof fetch }): Deps {
  const company = { id: "company-1", user_id: OWNER_ID, stripe_account_id: "acct_existing" };

  const serviceClient = {
    from(table: string) {
      if (table === "companies") {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: company, error: null }) }) }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  return {
    supabaseUrl: "https://x.supabase.co",
    supabaseAnonKey: "anon-key",
    supabaseServiceRoleKey: "service-key",
    stripeSecretKey: "sk_test_x",
    appBaseUrl: "https://factureo.app",
    createAnonClient: () => ({
      auth: {
        getUser: async () => overrides.callerId
          ? { data: { user: { id: overrides.callerId } }, error: null }
          : { data: { user: null }, error: { message: "invalid" } },
      },
    }),
    createServiceClient: () => serviceClient as any,
    fetchImpl: overrides.fetchImpl ?? vi.fn(),
    ...overrides,
  };
}

describe("stripe-connect-start — ownership", () => {
  it("refuse (403) une entreprise qui n'appartient pas à l'appelant", async () => {
    const fetchSpy = vi.fn();
    const deps = makeDeps({ callerId: ATTACKER_ID, fetchImpl: fetchSpy });
    const req = new Request("https://x/stripe-connect-start", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ company_id: "company-1" }),
    });

    const res = await handle(req, {}, deps);

    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled(); // ne doit jamais atteindre Stripe
  });

  it("laisse passer (200) le propriétaire légitime de l'entreprise", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ url: "https://connect.stripe.com/onboarding/x" }), { status: 200 }));
    const deps = makeDeps({ callerId: OWNER_ID, fetchImpl: fetchSpy });
    const req = new Request("https://x/stripe-connect-start", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ company_id: "company-1" }),
    });

    const res = await handle(req, {}, deps);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // account déjà existant → un seul appel (account_links)
  });
});
