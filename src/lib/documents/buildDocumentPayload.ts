import { computeDateConservationMin, type DocumentInsertPayload } from "./conservation";

export function buildExpenseScanDocument(params: {
  userId: string;
  scanId: string;
  storagePath: string;
  merchant?: string | null;
  dateDocument: string;
}): DocumentInsertPayload {
  return {
    user_id: params.userId,
    company_id: null,
    type: "justificatif",
    titre: params.merchant ? params.merchant : "Note de frais",
    storage_bucket: "expense-scans",
    storage_path: params.storagePath,
    related_type: "expense_scan",
    related_id: params.scanId,
    date_document: params.dateDocument,
    date_conservation_min: computeDateConservationMin(params.dateDocument, "justificatif"),
  };
}

export function buildKbisDocument(params: {
  userId: string;
  storagePath: string;
  dateDocument: string;
}): DocumentInsertPayload {
  return {
    user_id: params.userId,
    company_id: null,
    type: "autre",
    titre: "Extrait Kbis",
    storage_bucket: "artisan-documents",
    storage_path: params.storagePath,
    related_type: "profile",
    related_id: params.userId,
    date_document: params.dateDocument,
    date_conservation_min: computeDateConservationMin(params.dateDocument, "autre"),
  };
}

export function buildFacturxDocument(params: {
  userId: string;
  companyId: string | null;
  invoiceId: string;
  numeroFacture: string;
  storagePath: string;
  dateDocument: string;
}): DocumentInsertPayload {
  return {
    user_id: params.userId,
    company_id: params.companyId,
    type: "facturx",
    titre: `Facture ${params.numeroFacture} (Factur-X)`,
    storage_bucket: "invoices",
    storage_path: params.storagePath,
    related_type: "invoice",
    related_id: params.invoiceId,
    date_document: params.dateDocument,
    date_conservation_min: computeDateConservationMin(params.dateDocument, "facturx"),
  };
}
