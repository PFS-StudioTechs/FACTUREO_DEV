import { describe, it, expect } from "vitest";
import { resolveCallerId, checkOwnership } from "../../supabase/functions/_shared/ownership";

describe("resolveCallerId", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const req = new Request("https://example.com", { method: "POST" });
    const result = await resolveCallerId(req, "url", "anon-key", () => ({
      auth: { getUser: async () => ({ data: { user: null }, error: null } as any) },
    }));
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error.status).toBe(401);
  });

  it("returns 401 when the JWT is invalid", async () => {
    const req = new Request("https://example.com", { method: "POST", headers: { Authorization: "Bearer bad" } });
    const result = await resolveCallerId(req, "url", "anon-key", () => ({
      auth: { getUser: async () => ({ data: { user: null }, error: { message: "invalid" } } as any) },
    }));
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error.status).toBe(401);
  });

  it("returns the caller's userId when the JWT is valid", async () => {
    const req = new Request("https://example.com", { method: "POST", headers: { Authorization: "Bearer good" } });
    const result = await resolveCallerId(req, "url", "anon-key", () => ({
      auth: { getUser: async () => ({ data: { user: { id: "user-123" } }, error: null } as any) },
    }));
    expect("userId" in result).toBe(true);
    if ("userId" in result) expect(result.userId).toBe("user-123");
  });
});

describe("checkOwnership", () => {
  it("returns 404 when the resource does not exist", () => {
    const result = checkOwnership(null, "user-123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(404);
  });

  it("returns 403 when the resource belongs to someone else", () => {
    const result = checkOwnership({ user_id: "owner-1" }, "attacker-2");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(403);
  });

  it("returns ok when the caller owns the resource", () => {
    const result = checkOwnership({ user_id: "owner-1" }, "owner-1");
    expect(result.ok).toBe(true);
  });
});
