// Helpers de vérification d'ownership pour les Edge Functions qui agissent
// sur une ressource utilisateur (facture, entreprise) via le service-role.
// Le service-role bypass RLS : c'est à ce code de faire respecter l'isolation
// par utilisateur que RLS ferait normalement.

export interface AuthClientLike {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
}

export type CreateAnonClient = (authHeader: string) => AuthClientLike;

export interface ErrorResult {
  status: number;
  body: { error: string };
}

/** Résout l'utilisateur appelant depuis son JWT — jamais depuis un ID fourni par le client. */
export async function resolveCallerId(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
  createAnonClient: CreateAnonClient,
): Promise<{ userId: string } | { error: ErrorResult }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: { status: 401, body: { error: "Unauthorized" } } };
  }
  const userClient = createAnonClient(authHeader);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return { error: { status: 401, body: { error: "Unauthorized" } } };
  }
  return { userId: data.user.id };
}

/** Compare le user_id propriétaire de la ressource au caller — 404 si absente, 403 si pas propriétaire. */
export function checkOwnership(
  resource: { user_id: string } | null | undefined,
  callerId: string,
): { ok: true } | { ok: false; error: ErrorResult } {
  if (!resource) {
    return { ok: false, error: { status: 404, body: { error: "Not found" } } };
  }
  if (resource.user_id !== callerId) {
    return { ok: false, error: { status: 403, body: { error: "Forbidden" } } };
  }
  return { ok: true };
}

export function errorToResponse(err: ErrorResult, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(err.body), {
    status: err.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonResponse(status: number, body: unknown, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
