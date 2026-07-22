// Vérification de signature webhook Stripe (HMAC-SHA256, Web Crypto API).
// Portable Deno/Node — aucune dépendance runtime-spécifique, testable tel quel.

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

export async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
  now: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!sigHeader || !secret) return false;
  const parts = sigHeader.split(",");
  let timestamp = "";
  let v1 = "";
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") v1 = value;
  }
  if (!timestamp || !v1) return false;
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
