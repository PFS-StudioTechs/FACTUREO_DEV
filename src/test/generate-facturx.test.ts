import { describe, it, expect, vi } from "vitest";

// Ces Edge Functions sont écrites pour Deno (imports distants) — on stub les
// deux modules réseau pour pouvoir importer le fichier sous Node/Vitest.
vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: () => {} }));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient: () => ({}) }));

import { handle, type Deps } from "../../supabase/functions/generate-facturx/index";

const OWNER_ID = "owner-user-1";
const ATTACKER_ID = "attacker-user-2";

function makeDeps(overrides: Partial<Deps> & { callerId: string | null; fetchImpl?: typeof fetch }): Deps {
  const invoice = {
    id: "invoice-1", user_id: OWNER_ID, company_id: "company-1", client_id: "client-1",
    numero_facture: "F-001", montant_ht: 100, montant_tva: 20, montant_ttc: 120, taux_tva: 20,
  };
  const company = { id: "company-1", denomination: "ACME" };
  const client = { id: "client-1", nom: "Client SARL" };

  const serviceClient = {
    from(table: string) {
      if (table === "invoices") {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: invoice, error: null }) }) }) };
      }
      if (table === "companies") {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: company, error: null }) }) }) };
      }
      if (table === "clients") {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: client, error: null }) }) }) };
      }
      if (table === "invoice_lines") {
        return { select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  return {
    supabaseUrl: "https://x.supabase.co",
    supabaseAnonKey: "anon-key",
    supabaseServiceRoleKey: "service-key",
    facturxApiKey: "facturx-key",
    facturxApiUrl: "http://facturx.local",
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

describe("generate-facturx — ownership", () => {
  it("refuse (403) une facture qui n'appartient pas à l'appelant", async () => {
    const fetchSpy = vi.fn();
    const deps = makeDeps({ callerId: ATTACKER_ID, fetchImpl: fetchSpy });
    const req = new Request("https://x/generate-facturx", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ invoice_id: "invoice-1" }),
    });

    const res = await handle(req, {}, deps);

    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled(); // ne doit jamais atteindre le microservice Factur-X
  });

  it("laisse passer (200) le propriétaire légitime de la facture", async () => {
    const fetchSpy = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 }));
    const deps = makeDeps({ callerId: OWNER_ID, fetchImpl: fetchSpy });
    const req = new Request("https://x/generate-facturx", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ invoice_id: "invoice-1" }),
    });

    const res = await handle(req, {}, deps);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
