import { describe, it, expect, vi } from "vitest";
import { fetchUserDocuments, getSignedDocumentUrl, type SupabaseLike, type DocumentRow } from "@/lib/documents/documentsClient";

const ROW: DocumentRow = {
  id: "doc-1", user_id: "user-1", company_id: null, type: "justificatif", titre: "Note",
  storage_bucket: "expense-scans", storage_path: "user-1/images/1.jpg",
  related_type: "expense_scan", related_id: "scan-1",
  date_document: "2026-07-01", date_conservation_min: "2036-07-01", created_at: "2026-07-01T00:00:00Z",
};

function makeFakeClient(rows: DocumentRow[], expectedUserId: string) {
  const eqSpy = vi.fn((column: string, value: string) => {
    expect(column).toBe("user_id");
    expect(value).toBe(expectedUserId);
    return { order: vi.fn(async () => ({ data: rows.filter(r => r.user_id === value), error: null })) };
  });
  return {
    from: vi.fn((table: string) => {
      expect(table).toBe("documents");
      return { select: vi.fn(() => ({ eq: eqSpy })) };
    }),
    storage: { from: vi.fn() },
  } as unknown as SupabaseLike & { from: ReturnType<typeof vi.fn> };
}

describe("fetchUserDocuments", () => {
  it("filtre toujours explicitement par user_id (défense en profondeur, même si RLS l'impose déjà)", async () => {
    const client = makeFakeClient([ROW, { ...ROW, id: "doc-2", user_id: "attacker-2" }], "user-1");
    const docs = await fetchUserDocuments(client, "user-1");
    expect(docs).toHaveLength(1);
    expect(docs[0].user_id).toBe("user-1");
  });

  it("un autre utilisateur ne récupère que ses propres documents", async () => {
    const client = makeFakeClient([ROW, { ...ROW, id: "doc-2", user_id: "attacker-2" }], "attacker-2");
    const docs = await fetchUserDocuments(client, "attacker-2");
    expect(docs.every(d => d.user_id === "attacker-2")).toBe(true);
  });

  it("propage l'erreur Supabase au lieu de l'avaler", async () => {
    const client: SupabaseLike = {
      from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { message: "boom" } }) }) }) }),
      storage: { from: vi.fn() },
    };
    await expect(fetchUserDocuments(client, "user-1")).rejects.toThrow("boom");
  });
});

describe("getSignedDocumentUrl", () => {
  it("demande une URL signée sur le bucket privé du document, jamais une URL publique", async () => {
    const createSignedUrl = vi.fn(async (path: string, expiresIn: number) => {
      expect(path).toBe(ROW.storage_path);
      expect(expiresIn).toBe(300);
      return { data: { signedUrl: `https://signed.example/${path}` }, error: null };
    });
    const client: SupabaseLike = {
      from: vi.fn() as any,
      storage: { from: vi.fn((bucket: string) => { expect(bucket).toBe(ROW.storage_bucket); return { createSignedUrl }; }) },
    };
    const url = await getSignedDocumentUrl(client, ROW);
    expect(url).toBe(`https://signed.example/${ROW.storage_path}`);
  });

  it("lève une erreur si Supabase ne renvoie pas d'URL signée", async () => {
    const client: SupabaseLike = {
      from: vi.fn() as any,
      storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: "not found" } }) }) },
    };
    await expect(getSignedDocumentUrl(client, ROW)).rejects.toThrow("not found");
  });
});
