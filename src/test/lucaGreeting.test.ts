import { describe, it, expect, vi } from "vitest";

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: () => {} }));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient: () => ({}) }));

import { handle, type Deps } from "../../supabase/functions/luca-greeting/index";

const VALID_CONTEXT = {
  userName: "Karl",
  toutAuVert: false,
  nbTotal: 1,
  signauxCles: [{ categorie: "paiement", severite: "critique", count: 1, actionLabel: "Voir la facture", actionRoute: "/factures" }],
};

function makeDeps(overrides: Partial<Deps> & { callerId: string | null }): Deps {
  return {
    supabaseUrl: "https://x.supabase.co",
    supabaseAnonKey: "anon-key",
    anthropicApiKey: "anthropic-key",
    createAnonClient: () => ({
      auth: {
        getUser: async () => overrides.callerId
          ? { data: { user: { id: overrides.callerId } }, error: null }
          : { data: { user: null }, error: { message: "invalid" } },
      },
    }),
    fetchImpl: vi.fn(),
    ...overrides,
  };
}

function makeRequest(body: unknown, withAuth = true): Request {
  return new Request("https://x/luca-greeting", {
    method: "POST",
    headers: withAuth ? { Authorization: "Bearer token" } : {},
    body: JSON.stringify(body),
  });
}

describe("luca-greeting — auth", () => {
  it("refuse (401) sans JWT", async () => {
    const deps = makeDeps({ callerId: null });
    const res = await handle(makeRequest({ context: VALID_CONTEXT }, false), {}, deps);
    expect(res.status).toBe(401);
  });

  it("refuse (401) avec un JWT invalide", async () => {
    const deps = makeDeps({ callerId: null });
    const res = await handle(makeRequest({ context: VALID_CONTEXT }), {}, deps);
    expect(res.status).toBe(401);
  });

  it("refuse (400) un context malformé même avec un JWT valide", async () => {
    const deps = makeDeps({ callerId: "user-1" });
    const res = await handle(makeRequest({ context: { userName: "Karl" } }), {}, deps);
    expect(res.status).toBe(400);
  });
});

describe("luca-greeting — génération IA", () => {
  it("appelle Anthropic avec le résumé structuré et renvoie sa réponse", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ content: [{ text: "Salut Karl, une facture t'attend !" }] }), { status: 200 }));
    const deps = makeDeps({ callerId: "user-1", fetchImpl: fetchSpy });
    const res = await handle(makeRequest({ context: VALID_CONTEXT }), {}, deps);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("ia");
    expect(body.message).toBe("Salut Karl, une facture t'attend !");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.messages[0].content).toContain("paiement"); // le résumé structuré transite tel quel
    expect(sentBody.system).toContain("Karl");
  });

  it("bascule sur le repli déterministe si l'appel IA échoue (jamais d'erreur 500)", async () => {
    const fetchSpy = vi.fn(async () => new Response("boom", { status: 500 }));
    const deps = makeDeps({ callerId: "user-1", fetchImpl: fetchSpy });
    const res = await handle(makeRequest({ context: VALID_CONTEXT }), {}, deps);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("fallback");
    expect(body.message).toContain("Karl");
  });

  it("bascule sur le repli déterministe si ANTHROPIC_API_KEY est absente", async () => {
    const fetchSpy = vi.fn();
    const deps = makeDeps({ callerId: "user-1", anthropicApiKey: undefined, fetchImpl: fetchSpy });
    const res = await handle(makeRequest({ context: VALID_CONTEXT }), {}, deps);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("fallback");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("repli déterministe aussi pour l'état tout au vert", async () => {
    const deps = makeDeps({ callerId: "user-1", anthropicApiKey: undefined, fetchImpl: vi.fn() });
    const vertContext = { userName: "Karl", toutAuVert: true, nbTotal: 0, signauxCles: [] };
    const res = await handle(makeRequest({ context: vertContext }), {}, deps);
    const body = await res.json();

    expect(body.message).toContain("vert");
  });
});
