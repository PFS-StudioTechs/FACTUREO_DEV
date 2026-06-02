import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// --- Vérification de signature Stripe (Deno / Web Crypto API, sans SDK) ---
const encoder = new TextEncoder();

function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!sigHeader) return false;
  const parts = sigHeader.split(",");
  let timestamp = "";
  let v1 = "";
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") v1 = value;
  }
  if (!timestamp || !v1) return false;
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts) || Math.abs(now - ts) > toleranceSeconds) return false;
  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  return constantTimeEqual(toHex(sigBuffer), v1);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 1. Lire le body BRUT en premier, AVANT tout JSON.parse
  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

  // 2. Vérifier la signature sur le body brut
  const valid = await verifyStripeSignature(rawBody, sigHeader, secret);
  if (!valid) {
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 400 });
  }

  // 3. SEULEMENT MAINTENANT, parser le JSON
  const event = JSON.parse(rawBody);

  // 4. Traiter l'event
  if (event.type === "checkout.session.completed") {
    const invoiceId = event.data?.object?.metadata?.invoice_id;
    const connectedAccount = event.account ?? null;

    if (invoiceId) {
      const { error } = await supabase
        .from("invoices")
        .update({
          statut_paiement: "paye",
          paid_at: new Date().toISOString(),
          reminder_level: 0,
        })
        .eq("id", invoiceId);

      if (error) {
        console.error("DB update failed for invoice", invoiceId, error.message);
        return new Response(JSON.stringify({ error: "db error" }), { status: 500 });
      }
    }

    console.log("paid", { invoiceId, connectedAccount });
  } else {
    console.log("ignored event", event.type);
  }

  // 5. Répondre 200
  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
