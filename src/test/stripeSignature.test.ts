import { describe, it, expect } from "vitest";
import { verifyStripeSignature } from "../../supabase/functions/_shared/stripeSignature";

const SECRET = "whsec_test_secret";

async function signPayload(payload: string, timestamp: number, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  return Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

describe("verifyStripeSignature", () => {
  it("accepte une signature valide et récente", async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const v1 = await signPayload(payload, now, SECRET);
    const result = await verifyStripeSignature(payload, `t=${now},v1=${v1}`, SECRET, 300, now);
    expect(result).toBe(true);
  });

  it("rejette une signature invalide (mauvais secret)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const v1 = await signPayload(payload, now, "whsec_wrong_secret");
    const result = await verifyStripeSignature(payload, `t=${now},v1=${v1}`, SECRET, 300, now);
    expect(result).toBe(false);
  });

  it("rejette un payload altéré (signature calculée sur un autre contenu)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const originalPayload = JSON.stringify({ type: "checkout.session.completed", amount: 100 });
    const tamperedPayload = JSON.stringify({ type: "checkout.session.completed", amount: 999999 });
    const v1 = await signPayload(originalPayload, now, SECRET);
    const result = await verifyStripeSignature(tamperedPayload, `t=${now},v1=${v1}`, SECRET, 300, now);
    expect(result).toBe(false);
  });

  it("rejette un timestamp hors tolérance (replay)", async () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 1000; // 1000s dans le passé
    const now = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const v1 = await signPayload(payload, oldTimestamp, SECRET);
    const result = await verifyStripeSignature(payload, `t=${oldTimestamp},v1=${v1}`, SECRET, 300, now);
    expect(result).toBe(false);
  });

  it("rejette si l'en-tête stripe-signature est absent", async () => {
    const result = await verifyStripeSignature("{}", null, SECRET);
    expect(result).toBe(false);
  });

  it("rejette si STRIPE_WEBHOOK_SECRET est vide", async () => {
    const now = Math.floor(Date.now() / 1000);
    const result = await verifyStripeSignature("{}", `t=${now},v1=abc`, "");
    expect(result).toBe(false);
  });
});
