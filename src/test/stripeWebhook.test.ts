import { describe, it, expect, vi } from "vitest";

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: () => {} }));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient: () => ({}) }));

import { handle, type Deps } from "../../supabase/functions/stripe-webhook/index";

const SECRET = "whsec_test_secret";

async function sign(payload: string, timestamp: number, secret = SECRET): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  return Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function makeDeps(invoice: { id: string; user_id: string; montant_ttc: number } | null, updateSpy: (payload: any) => void): Deps {
  return {
    webhookSecret: SECRET,
    createServiceClient: () => ({
      from(table: string) {
        if (table !== "invoices") throw new Error(`unexpected table ${table}`);
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: invoice, error: invoice ? null : { message: "not found" } }) }) }),
          update: (payload: any) => ({ eq: async () => { updateSpy(payload); return { error: null }; } }),
        };
      },
    }) as any,
  };
}

async function makeSignedRequest(bodyObj: unknown, timestamp = Math.floor(Date.now() / 1000)): Promise<Request> {
  const body = JSON.stringify(bodyObj);
  const v1 = await sign(body, timestamp);
  return new Request("https://x/stripe-webhook", {
    method: "POST",
    headers: { "stripe-signature": `t=${timestamp},v1=${v1}` },
    body,
  });
}

describe("stripe-webhook — réconciliation", () => {
  it("signature invalide → rejet (400), aucune écriture DB", async () => {
    const updateSpy = vi.fn();
    const deps = makeDeps({ id: "invoice-1", user_id: "user-1", montant_ttc: 120 }, updateSpy);
    const req = new Request("https://x/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=deadbeef" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });

    const res = await handle(req, {}, deps);

    expect(res.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("metadata valide (invoice_id + user_id cohérents) → facture soldée", async () => {
    const updateSpy = vi.fn();
    const deps = makeDeps({ id: "invoice-1", user_id: "user-1", montant_ttc: 120 }, updateSpy);
    const req = await makeSignedRequest({
      type: "checkout.session.completed",
      data: { object: { metadata: { invoice_id: "invoice-1", user_id: "user-1" }, amount_total: 12000 } },
    });

    const res = await handle(req, {}, deps);

    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ statut_paiement: "paye", montant_paye: 120 }));
  });

  it("paiement partiel (montant reçu < montant facture) → statut partiel", async () => {
    const updateSpy = vi.fn();
    const deps = makeDeps({ id: "invoice-1", user_id: "user-1", montant_ttc: 120 }, updateSpy);
    const req = await makeSignedRequest({
      type: "payment_intent.succeeded",
      data: { object: { metadata: { invoice_id: "invoice-1", user_id: "user-1" }, amount_received: 5000 } },
    });

    const res = await handle(req, {}, deps);

    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ statut_paiement: "partiel", montant_paye: 50 }));
  });

  it("aucun invoice_id en metadata → ignoré, aucune écriture", async () => {
    const updateSpy = vi.fn();
    const deps = makeDeps({ id: "invoice-1", user_id: "user-1", montant_ttc: 120 }, updateSpy);
    const req = await makeSignedRequest({
      type: "checkout.session.completed",
      data: { object: { metadata: {}, amount_total: 12000 } },
    });

    const res = await handle(req, {}, deps);

    expect(res.status).toBe(200);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("incohérence user_id metadata vs facture → ignoré, aucune écriture (jamais confiance dans un ID client seul)", async () => {
    const updateSpy = vi.fn();
    const deps = makeDeps({ id: "invoice-1", user_id: "user-1", montant_ttc: 120 }, updateSpy);
    const req = await makeSignedRequest({
      type: "checkout.session.completed",
      data: { object: { metadata: { invoice_id: "invoice-1", user_id: "attacker-2" }, amount_total: 12000 } },
    });

    const res = await handle(req, {}, deps);

    expect(res.status).toBe(200);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("type d'event non géré → ignoré proprement", async () => {
    const updateSpy = vi.fn();
    const deps = makeDeps({ id: "invoice-1", user_id: "user-1", montant_ttc: 120 }, updateSpy);
    const req = await makeSignedRequest({ type: "customer.created", data: { object: {} } });

    const res = await handle(req, {}, deps);

    expect(res.status).toBe(200);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
