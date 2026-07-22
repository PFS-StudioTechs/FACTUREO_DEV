import { describe, it, expect, vi } from "vitest";
import { runExpenseOcr } from "@/lib/expenseOcr";

describe("runExpenseOcr — transition de statut (régression n8n)", () => {
  it("passe le scan de 'traitement' à 'à revoir' avec les champs extraits quand l'OCR réussit", async () => {
    const invoke = vi.fn(async () => ({ data: { date: "2026-07-20", description: "Carrefour - 45,20€" }, error: null }));
    const updateStatus = vi.fn(async () => {});

    await runExpenseOcr("scan-1", "base64data", "image/jpeg", { invoke, updateStatus });

    expect(invoke).toHaveBeenCalledWith("process-expense-scan", { body: { imageBase64: "base64data", mimeType: "image/jpeg" } });
    expect(updateStatus).toHaveBeenCalledWith("scan-1", {
      status: "à revoir",
      expense_date: "2026-07-20",
      notes: "Carrefour - 45,20€",
    });
  });

  it("passe quand même à 'à revoir' (sans préremplissage) si l'OCR échoue — le scan ne reste jamais bloqué en 'traitement'", async () => {
    const invoke = vi.fn(async () => ({ data: null, error: { message: "OpenAI down" } }));
    const updateStatus = vi.fn(async () => {});

    await runExpenseOcr("scan-2", "base64data", "image/jpeg", { invoke, updateStatus });

    expect(updateStatus).toHaveBeenCalledWith("scan-2", { status: "à revoir" });
    expect(updateStatus).not.toHaveBeenCalledWith("scan-2", expect.objectContaining({ expense_date: expect.anything() }));
  });
});
