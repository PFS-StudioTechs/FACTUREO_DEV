// Analyse OCR d'un scan de note de frais + transition de statut.
// Remplace l'ancien webhook n8n (mort) : plus d'automatisme externe,
// l'app appelle directement l'Edge Function et écrit le résultat.

export interface ExpenseOcrDeps {
  invoke: (name: string, opts: { body: unknown }) => Promise<{ data: any; error: unknown }>;
  updateStatus: (scanId: string, patch: Record<string, unknown>) => Promise<void>;
}

/**
 * Toujours fait sortir le scan du statut "traitement" vers "à revoir",
 * que l'OCR réussisse ou non — un scan ne doit jamais rester bloqué.
 */
export async function runExpenseOcr(
  scanId: string,
  imageBase64: string,
  mimeType: string,
  deps: ExpenseOcrDeps,
): Promise<void> {
  try {
    const { data, error } = await deps.invoke("process-expense-scan", { body: { imageBase64, mimeType } });
    if (error || data?.error) throw new Error((error as Error | undefined)?.message || data?.error);
    await deps.updateStatus(scanId, {
      status: "à revoir",
      expense_date: data?.date ?? null,
      notes: data?.description ?? null,
    });
  } catch (err) {
    console.error("OCR note de frais échouée:", err);
    await deps.updateStatus(scanId, { status: "à revoir" });
  }
}
