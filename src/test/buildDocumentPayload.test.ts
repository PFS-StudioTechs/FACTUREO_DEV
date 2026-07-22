import { describe, it, expect } from "vitest";
import { buildExpenseScanDocument, buildKbisDocument, buildFacturxDocument } from "@/lib/documents/buildDocumentPayload";

describe("buildExpenseScanDocument", () => {
  it("mappe une note de frais vers un document justificatif indexant le Storage existant", () => {
    const doc = buildExpenseScanDocument({
      userId: "user-1", scanId: "scan-1", storagePath: "user-1/images/123.jpg",
      merchant: "Amazon", dateDocument: "2026-07-01",
    });
    expect(doc).toMatchObject({
      user_id: "user-1", type: "justificatif", titre: "Amazon",
      storage_bucket: "expense-scans", storage_path: "user-1/images/123.jpg",
      related_type: "expense_scan", related_id: "scan-1",
      date_document: "2026-07-01", date_conservation_min: "2036-07-01",
    });
  });

  it("retombe sur un titre générique sans marchand connu", () => {
    const doc = buildExpenseScanDocument({
      userId: "user-1", scanId: "scan-2", storagePath: "user-1/images/456.jpg",
      merchant: null, dateDocument: "2026-07-01",
    });
    expect(doc.titre).toBe("Note de frais");
  });
});

describe("buildKbisDocument", () => {
  it("mappe un Kbis vers un document type=autre lié au profil", () => {
    const doc = buildKbisDocument({ userId: "user-1", storagePath: "user-1/kbis/kbis.pdf", dateDocument: "2026-01-01" });
    expect(doc).toMatchObject({
      user_id: "user-1", company_id: null, type: "autre", titre: "Extrait Kbis",
      storage_bucket: "artisan-documents", storage_path: "user-1/kbis/kbis.pdf",
      related_type: "profile", related_id: "user-1",
    });
    // Pas de durée par défaut pour "autre" — repère non certifié absent, pas d'hallucination de date
    expect(doc.date_conservation_min).toBeNull();
  });
});

describe("buildFacturxDocument", () => {
  it("mappe un Factur-X généré vers un document lié à la facture et à l'entreprise", () => {
    const doc = buildFacturxDocument({
      userId: "user-1", companyId: "company-1", invoiceId: "inv-1",
      numeroFacture: "F-2026-001", storagePath: "user-1/inv-1-facturx.pdf", dateDocument: "2026-07-01",
    });
    expect(doc).toMatchObject({
      user_id: "user-1", company_id: "company-1", type: "facturx",
      titre: "Facture F-2026-001 (Factur-X)",
      storage_bucket: "invoices", storage_path: "user-1/inv-1-facturx.pdf",
      related_type: "invoice", related_id: "inv-1",
      date_conservation_min: "2036-07-01",
    });
  });
});
