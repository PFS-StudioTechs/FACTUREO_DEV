const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "";

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const isAllowed = (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) || isLocalhost;

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : (ALLOWED_ORIGIN || "*"),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
