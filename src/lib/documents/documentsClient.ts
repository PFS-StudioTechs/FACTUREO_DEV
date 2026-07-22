import type { DocumentInsertPayload } from "./conservation";

export interface DocumentRow extends DocumentInsertPayload {
  id: string;
  created_at: string;
}

// Minimal shape of the Supabase JS client surface this module touches —
// keeps fetchUserDocuments/getSignedDocumentUrl testable without a live Supabase instance.
export interface SupabaseLike {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        order(column: string, opts: { ascending: boolean }): Promise<{ data: DocumentRow[] | null; error: { message: string } | null }>;
      };
    };
  };
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    };
  };
}

/**
 * Toujours filtré explicitement par user_id, même si la RLS l'impose déjà côté serveur
 * (défense en profondeur, cohérent avec le pattern utilisé sur echeances/expense_scans).
 */
export async function fetchUserDocuments(supabase: SupabaseLike, userId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase.from("documents").select("*").eq("user_id", userId).order("date_document", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSignedDocumentUrl(supabase: SupabaseLike, doc: Pick<DocumentRow, "storage_bucket" | "storage_path">, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await supabase.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path, expiresInSeconds);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Impossible de générer l'URL signée");
  return data.signedUrl;
}
