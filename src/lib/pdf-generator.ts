import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;
type Company = Tables<"companies">;
type Client = Tables<"clients">;

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function buildInvoiceDoc(invoice: Invoice, company: Company, client: Client): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  // ====== HEADER: Company name + legal info centered ======
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(company.denomination, pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (company.forme_juridique) {
    doc.text(company.forme_juridique, pageWidth / 2, y, { align: "center" });
    y += 4;
  }
  if (company.capital) {
    doc.text(`au capital de ${company.capital} euros`, pageWidth / 2, y, { align: "center" });
    y += 4;
  }
  doc.text("Siège social", pageWidth / 2, y, { align: "center" });
  y += 4;
  if (company.adresse) {
    doc.text(`${company.adresse}`, pageWidth / 2, y, { align: "center" });
    y += 4;
  }
  doc.text(`${company.code_postal} ${company.ville}`, pageWidth / 2, y, { align: "center" });
  y += 8;

  // ====== FACTURE N° (right aligned) ======
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(`Facture N° : ${invoice.numero_facture}`, pageWidth - margin, y, { align: "right" });
  y += 10;

  // ====== TWO COLUMNS: Company box (left) + Client box (right) ======
  const boxStartY = y;
  const leftBoxWidth = contentWidth * 0.52;
  const rightStartX = margin + leftBoxWidth + 6;
  const rightBoxWidth = contentWidth - leftBoxWidth - 6;

  // --- LEFT BOX: Company details ---
  const leftBoxContentLines: string[] = [];
  leftBoxContentLines.push(`Dénomination : ${company.denomination}`);
  leftBoxContentLines.push("");
  leftBoxContentLines.push(`Adresse : ${company.adresse}`);
  if (company.ville) leftBoxContentLines.push(`    ${company.ville}`);
  leftBoxContentLines.push("");
  leftBoxContentLines.push(`Code postal : ${company.code_postal}`);
  if (company.telephone) leftBoxContentLines.push(`Téléphone : ${company.telephone}`);
  if (company.mail) leftBoxContentLines.push(`Mail : ${company.mail}`);
  leftBoxContentLines.push(`Siret : ${company.siret}`);
  leftBoxContentLines.push(`RCS / RM (ville) : ${company.rcs_rm_ville}`);
  leftBoxContentLines.push(`Code NAF : ${company.code_naf}`);
  if (company.tva_intracommunautaire) {
    leftBoxContentLines.push(`N° de TVA Intracommunautaire : ${company.tva_intracommunautaire}`);
  }

  // Bank section
  const bankLines: string[] = [];
  bankLines.push(""); // spacer
  bankLines.push("Coordonnées Bancaires"); // bold + underline
  bankLines.push("");
  bankLines.push(`Titulaire: ${company.banque_titulaire}`);
  bankLines.push(`Nom Banque: ${company.banque_nom}`);
  bankLines.push(`Adresse Banque: ${company.banque_adresse}`);
  bankLines.push("");
  bankLines.push(`BIC/SWIFT: ${company.bic_swift}`);
  bankLines.push(`Code IBAN: ${company.code_iban}`);

  const allLeftLines = [...leftBoxContentLines, ...bankLines];
  const leftBoxHeight = 4 + allLeftLines.length * 4.2 + 4;

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, boxStartY, leftBoxWidth, leftBoxHeight);

  let ly = boxStartY + 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  for (const line of leftBoxContentLines) {
    if (line === "") { ly += 1; continue; }
    doc.text(line, margin + 3, ly);
    ly += 4.2;
  }

  // Bank section with bold underlined title
  for (let i = 0; i < bankLines.length; i++) {
    const line = bankLines[i];
    if (line === "") { ly += 1; continue; }
    if (line === "Coordonnées Bancaires") {
      doc.setFont("helvetica", "bold");
      doc.text(line, margin + 3, ly);
      // underline
      const tw = doc.getTextWidth(line);
      doc.line(margin + 3, ly + 0.5, margin + 3 + tw, ly + 0.5);
      doc.setFont("helvetica", "normal");
      ly += 4.2;
      continue;
    }
    doc.text(line, margin + 3, ly);
    ly += 4.2;
  }

  // --- RIGHT SIDE: Client box ---
  const clientBoxHeight = 32;
  doc.rect(rightStartX, boxStartY, rightBoxWidth, clientBoxHeight);

  let ry = boxStartY + 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENT", rightStartX + 3, ry);
  // underline CLIENT
  const clientTw = doc.getTextWidth("CLIENT");
  doc.line(rightStartX + 3, ry + 0.5, rightStartX + 3 + clientTw, ry + 0.5);
  ry += 5;

  doc.setFontSize(8);
  const clientData = [
    { label: "Nom", value: client.nom },
    { label: "Adresse", value: client.adresse },
    { label: "Ville", value: client.ville },
    { label: "Code postal", value: client.code_postal },
    { label: "Bon de commande N°", value: invoice.numero_bon_commande },
  ];

  for (const item of clientData) {
    doc.setFont("helvetica", "normal");
    doc.text(`${item.label}`, rightStartX + 3, ry);
    doc.setFont("helvetica", "bold");
    doc.text(`: ${item.value}`, rightStartX + 32, ry);
    ry += 4.5;
  }

  // --- Dates (right side, below client box) ---
  ry = boxStartY + clientBoxHeight + 12;
  const dateFactStr = new Date(invoice.date_facturation).toLocaleDateString("fr-FR");
  const dateLimStr = new Date(invoice.date_limite_paiement).toLocaleDateString("fr-FR");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Date de facturation : `, rightStartX + 3, ry);
  doc.setFont("helvetica", "normal");
  doc.text(dateFactStr, rightStartX + 3 + doc.getTextWidth("Date de facturation : "), ry);
  ry += 6;

  doc.setFont("helvetica", "bold");
  doc.text(`Date limite de paiement : `, rightStartX + 3, ry);
  doc.setFont("helvetica", "normal");
  doc.text(dateLimStr, rightStartX + 3 + doc.getTextWidth("Date limite de paiement : "), ry);
  ry += 12;

  // Payment conditions
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Conditions de paiement`, rightStartX + 3, ry);
  doc.text(`${invoice.conditions_paiement} Jours nets`, rightStartX + rightBoxWidth - 3, ry, { align: "right" });
  ry += 5;
  doc.text(`Mode de paiement`, rightStartX + 3, ry);
  doc.text(`${invoice.mode_paiement}`, rightStartX + rightBoxWidth - 3, ry, { align: "right" });

  // ====== ARTICLE TABLE ======
  y = boxStartY + leftBoxHeight + 10;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Article", "Désignation", "Qté", "Unité", "Prix unitaire", "TVA", "Montant"]],
    body: [
      [
        `Prestation de service -\n${company.denomination}`,
        `Prestation de M.\n${invoice.designation || company.nom_contact}`,
        String(invoice.nombre_jours),
        "Jour",
        fmt(invoice.tjm),
        "TVA",
        fmt(invoice.montant_ht),
      ],
    ],
    styles: { fontSize: 8, cellPadding: 4, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineWidth: 0.3,
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 32 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 15, halign: "center" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 18, halign: "center" },
      6: { cellWidth: 30, halign: "right" },
    },
    theme: "plain",
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ====== TOTALS (right aligned) ======
  const totalsRightEdge = pageWidth - margin;
  const totalsLabelX = totalsRightEdge - 55;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Total EUR HT", totalsLabelX, y);
  doc.text(fmt(invoice.montant_ht), totalsRightEdge, y, { align: "right" });
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("TVA 20%", totalsLabelX + 10, y);
  doc.text(fmt(invoice.montant_tva), totalsRightEdge, y, { align: "right" });
  y += 2;
  doc.line(totalsLabelX, y, totalsRightEdge, y);
  y += 6;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Total EUR TTC", totalsLabelX, y);
  doc.text(fmt(invoice.montant_ttc), totalsRightEdge, y, { align: "right" });
  y += 12;

  // ====== TVA DETAIL TABLE ======
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Détail montant TVA", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Id TVA", "% TVA", "Montant", "Base TVA", "Montant TVA"]],
    body: [
      ["TVA", "20", fmt(invoice.montant_ht), fmt(invoice.montant_ht), fmt(invoice.montant_tva)],
    ],
    foot: [["Total", "", fmt(invoice.montant_ht), fmt(invoice.montant_ht), fmt(invoice.montant_tva)]],
    styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineWidth: 0.3,
      lineColor: [0, 0, 0],
    },
    bodyStyles: { lineWidth: 0.1, lineColor: [200, 200, 200] },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineWidth: 0.3,
      lineColor: [0, 0, 0],
    },
    theme: "plain",
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ====== MISSION DESCRIPTION BOX ======
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);

  const missionTitle = "Description de la mission :";
  const missionText = invoice.descriptif_mission || "";
  const missionWrapped = doc.splitTextToSize(missionText, contentWidth - 8);
  const missionBoxHeight = 8 + missionWrapped.length * 3.8 + 4;

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, missionBoxHeight);

  doc.text(missionTitle, margin + 3, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(missionWrapped, margin + 3, y + 10);

  y += missionBoxHeight + 8;

  // ====== LEGAL FOOTER ======
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  const legalText =
    "Pas d'escompte pour paiement anticipé, passée la date d'échéance. Tout paiement différé entraîne l'application d'une pénalité calculée en fonction du taux d'intérêt légal en vigueur (Loi 2008-776 du 04/08/2008) ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 EUR (Décret 2012-1115 du 02/10/2012).";
  const legalLines = doc.splitTextToSize(legalText, contentWidth);
  doc.text(legalLines, margin, y);

  return doc;
}

export function generateInvoicePDF(invoice: Invoice, company: Company, client: Client) {
  const doc = buildInvoiceDoc(invoice, company, client);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoice.numero_facture}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function generateInvoicePDFBase64(invoice: Invoice, company: Company, client: Client): string {
  return buildInvoiceDoc(invoice, company, client).output("base64");
}
