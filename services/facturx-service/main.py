"""
Factur-X BASIC generation service.
Receives invoice data from Supabase Edge Function, returns a Factur-X PDF/A-3.
"""

from datetime import datetime
from html import escape as _he
from io import BytesIO
from typing import Optional
import os

from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import Response
from pydantic import BaseModel
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import re as _re
import pikepdf
from facturx import generate_from_binary

# ── Font registration ─────────────────────────────────────────────────────────

pdfmetrics.registerFont(TTFont(
    'LiberationSans',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
))
pdfmetrics.registerFont(TTFont(
    'LiberationSans-Bold',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
))
pdfmetrics.registerFontFamily(
    'LiberationSans',
    normal='LiberationSans',
    bold='LiberationSans-Bold',
)

# ── sRGB output intent ────────────────────────────────────────────────────────

_SRGB_ICC_PATH: str | None = None
for _p in [
    '/usr/share/color/icc/colord/sRGB.icc',
    '/usr/share/color/icc/sRGB.icc',
    '/app/sRGB.icc',
]:
    if os.path.exists(_p):
        _SRGB_ICC_PATH = _p
        break


def _fix_font_references(pdf: pikepdf.Pdf) -> None:
    for page in pdf.pages:
        resources = page.get('/Resources')
        if resources is None:
            continue
        fonts = resources.get('/Font')
        if fonts is None or fonts.get('/F1') is None:
            continue
        ls_name_bytes = None
        for key, fref in fonts.items():
            try:
                fo = pdf.get_object(fref.objgen)
                base = str(fo.get('/BaseFont', ''))
                subtype = str(fo.get('/Subtype', ''))
                if 'TrueType' in subtype and 'LiberationSans' in base and 'Bold' not in base:
                    ls_name_bytes = str(key).lstrip('/').encode()
                    break
            except Exception:
                continue
        if ls_name_bytes is None:
            continue
        contents = page.get('/Contents')
        if contents is None:
            continue
        def _rewrite(s: pikepdf.Stream) -> None:
            data = s.read_bytes()
            new_data = _re.sub(
                rb'/F1(\s+[\d.]+\s+Tf)',
                lambda m: b'/' + ls_name_bytes + m.group(1),
                data,
            )
            if new_data != data:
                s.write(new_data)
        if hasattr(contents, 'objgen'):
            _rewrite(pdf.get_object(contents.objgen))
        else:
            for c in contents:
                _rewrite(pdf.get_object(c.objgen))
        del fonts['/F1']


def _add_output_intent(pdf_bytes: bytes) -> bytes:
    if not _SRGB_ICC_PATH:
        return pdf_bytes
    with pikepdf.open(BytesIO(pdf_bytes)) as pdf:
        _fix_font_references(pdf)
        with open(_SRGB_ICC_PATH, 'rb') as f:
            icc_data = f.read()
        icc_stream = pikepdf.Stream(pdf, icc_data)
        icc_stream['/N'] = 3
        icc_stream['/Alternate'] = pikepdf.Name('/DeviceRGB')
        oi = pikepdf.Dictionary(
            Type=pikepdf.Name('/OutputIntent'),
            S=pikepdf.Name('/GTS_PDFA1'),
            OutputConditionIdentifier='sRGB IEC61966-2.1',
            RegistryName='http://www.color.org',
            Info='sRGB IEC61966-2.1',
            DestOutputProfile=icc_stream,
        )
        if '/OutputIntents' not in pdf.Root:
            pdf.Root['/OutputIntents'] = pikepdf.Array()
        pdf.Root['/OutputIntents'].append(oi)
        out = BytesIO()
        pdf.save(out, linearize=False)
        return out.getvalue()


app = FastAPI(title="Factur-X Service", version="2.0.0")

API_KEY = os.environ.get("FACTURX_API_KEY")
if not API_KEY:
    raise RuntimeError("FACTURX_API_KEY environment variable is required")


# ── Pydantic models ───────────────────────────────────────────────────────────

class Emetteur(BaseModel):
    denomination: str
    adresse: str
    code_postal: str
    ville: str
    pays: str = "FR"
    siret: str
    tva_intracommunautaire: str
    code_iban: str
    bic_swift: str
    mail: str = ""
    telephone: str = ""

class Client(BaseModel):
    nom: str
    adresse: str
    code_postal: str
    ville: str
    pays: str = "FR"
    siret: str = ""
    tva_intracommunautaire: str = ""
    email: str = ""

class InvoiceLine(BaseModel):
    designation: str
    quantite: float
    unite: str = "Jour"
    prix_unitaire_ht: float
    remise: float = 0
    taux_tva: float = 20
    motif_exoneration: str = ""
    montant_ht: float
    montant_tva: float
    montant_ttc: float

class InvoiceData(BaseModel):
    invoice_id: str
    user_id: str
    numero_facture: str
    date_facturation: str
    date_limite_paiement: str
    emetteur: Emetteur
    client: Client
    # Legacy single-line fields (None when lines present)
    designation: Optional[str] = None
    descriptif_mission: Optional[str] = None
    nombre_jours: Optional[float] = None
    tjm: Optional[float] = None
    # Totals
    montant_ht: float
    taux_tva: Optional[float] = 20
    montant_tva: float
    montant_ttc: float
    # Paiement
    mode_paiement: str = "VIREMENT"
    conditions_paiement: int = 30
    numero_bon_commande: str = ""
    # Multi-line
    lines: Optional[list[InvoiceLine]] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

UNIT_CODES: dict[str, str] = {
    'Jour': 'DAY', 'Heure': 'HUR', 'Unité': 'C62', 'Forfait': 'C62',
    'kg': 'KGM', 'm': 'MTR', 'm²': 'MTK', 'm³': 'MTQ', 'l': 'LTR',
}

def fmt_date(iso: str) -> str:
    return datetime.strptime(iso, "%Y-%m-%d").strftime("%d/%m/%Y")

def fmt_amount(v: float) -> str:
    return f"{v:,.2f} €".replace(",", " ")

def _unit_code(unite: str) -> str:
    return UNIT_CODES.get(unite, 'C62')

def _tva_category(rate: float) -> str:
    return 'S' if rate > 0 else 'E'


# ── XML CII (Factur-X BASIC) ──────────────────────────────────────────────────

def build_facturx_xml(d: InvoiceData) -> bytes:
    e = d.emetteur
    c = d.client

    date_fac = datetime.strptime(d.date_facturation, "%Y-%m-%d").strftime("%Y%m%d")
    date_lim = datetime.strptime(d.date_limite_paiement, "%Y-%m-%d").strftime("%Y%m%d")

    buyer_id  = f"\n        <ram:ID schemeID='0002'>{_he(c.siret)}</ram:ID>" if c.siret else ""
    buyer_vat = f"\n        <ram:SpecifiedTaxRegistration><ram:ID schemeID='VA'>{_he(c.tva_intracommunautaire)}</ram:ID></ram:SpecifiedTaxRegistration>" if c.tva_intracommunautaire else ""
    order_ref = f"\n      <ram:BuyerOrderReferencedDocument><ram:IssuerAssignedID>{_he(d.numero_bon_commande)}</ram:IssuerAssignedID></ram:BuyerOrderReferencedDocument>" if d.numero_bon_commande else ""

    if d.lines:
        line_items_xml = _build_line_items_xml(d.lines)
        tva_xml = _build_tva_xml_from_lines(d.lines)
    else:
        tva_rate = d.taux_tva or 20
        line_items_xml = f"""
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>1</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>{_he(d.designation or '')}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>{d.tjm or 0:.2f}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="DAY">{d.nombre_jours or 0:.2f}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>{tva_rate:.2f}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>{d.montant_ht:.2f}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>"""
        tva_xml = f"""
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>{d.montant_tva:.2f}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>{d.montant_ht:.2f}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>{tva_rate:.2f}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>"""

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>{_he(d.numero_facture)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">{date_fac}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
{line_items_xml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:ID schemeID="0002">{_he(e.siret)}</ram:ID>
        <ram:Name>{_he(e.denomination)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>{_he(e.code_postal)}</ram:PostcodeCode>
          <ram:LineOne>{_he(e.adresse)}</ram:LineOne>
          <ram:CityName>{_he(e.ville)}</ram:CityName>
          <ram:CountryID>{_he(e.pays)}</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">{_he(e.tva_intracommunautaire)}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>{buyer_id}
        <ram:Name>{_he(c.nom)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>{_he(c.code_postal)}</ram:PostcodeCode>
          <ram:LineOne>{_he(c.adresse)}</ram:LineOne>
          <ram:CityName>{_he(c.ville)}</ram:CityName>
          <ram:CountryID>{_he(c.pays)}</ram:CountryID>
        </ram:PostalTradeAddress>{buyer_vat}
      </ram:BuyerTradeParty>{order_ref}
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery/>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>30</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>{_he(e.code_iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>
{tva_xml}
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">{date_lim}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>{d.montant_ht:.2f}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>{d.montant_ht:.2f}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">{d.montant_tva:.2f}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>{d.montant_ttc:.2f}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>{d.montant_ttc:.2f}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>

  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>"""

    return xml.strip().encode("utf-8")


def _build_line_items_xml(lines: list[InvoiceLine]) -> str:
    result = ""
    for i, l in enumerate(lines, 1):
        cat = _tva_category(l.taux_tva)
        exo = f"\n          <ram:ExemptionReason>{_he(l.motif_exoneration)}</ram:ExemptionReason>" if l.motif_exoneration else ""
        net_price = l.prix_unitaire_ht * (1 - l.remise / 100)
        result += f"""
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>{i}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>{_he(l.designation)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>{net_price:.2f}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="{_unit_code(l.unite)}">{l.quantite:.3f}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>{cat}</ram:CategoryCode>
          <ram:RateApplicablePercent>{l.taux_tva:.2f}</ram:RateApplicablePercent>{exo}
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>{l.montant_ht:.2f}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>"""
    return result


def _build_tva_xml_from_lines(lines: list[InvoiceLine]) -> str:
    groups: dict[float, list[float]] = {}
    for l in lines:
        if l.taux_tva not in groups:
            groups[l.taux_tva] = [0.0, 0.0]
        groups[l.taux_tva][0] += l.montant_ht
        groups[l.taux_tva][1] += l.montant_tva
    result = ""
    for rate in sorted(groups):
        basis, tva_amt = groups[rate]
        cat = _tva_category(rate)
        result += f"""
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>{tva_amt:.2f}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>{basis:.2f}</ram:BasisAmount>
        <ram:CategoryCode>{cat}</ram:CategoryCode>
        <ram:RateApplicablePercent>{rate:.2f}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>"""
    return result


# ── PDF visuel (ReportLab) ────────────────────────────────────────────────────

def build_pdf(d: InvoiceData) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    normal = styles["Normal"]
    normal.fontName = "LiberationSans"
    normal.fontSize = 9

    title_style  = ParagraphStyle("title",  fontName="LiberationSans-Bold", fontSize=18, textColor=colors.HexColor("#1a1a2e"))
    label_style  = ParagraphStyle("label",  fontName="LiberationSans-Bold", fontSize=8,  textColor=colors.HexColor("#666666"))
    value_style  = ParagraphStyle("value",  fontName="LiberationSans",      fontSize=9)
    right_style  = ParagraphStyle("right",  fontName="LiberationSans",      fontSize=9,  alignment=TA_RIGHT)
    right_bold   = ParagraphStyle("right_bold", fontName="LiberationSans-Bold", fontSize=10, alignment=TA_RIGHT)

    e = d.emetteur
    c = d.client
    story = []

    # ── En-tête ──
    header_data = [
        [
            Paragraph(f"<b>{e.denomination}</b>", title_style),
            Paragraph("FACTURE", ParagraphStyle("fac", fontName="LiberationSans-Bold", fontSize=22, alignment=TA_RIGHT, textColor=colors.HexColor("#1a1a2e"))),
        ],
        [
            Paragraph(f"{e.adresse}<br/>{e.code_postal} {e.ville}<br/>{e.telephone}<br/>{e.mail}", value_style),
            Paragraph(f"N° {d.numero_facture}", ParagraphStyle("num", fontName="LiberationSans", fontSize=11, alignment=TA_RIGHT)),
        ],
    ]
    header_table = Table(header_data, colWidths=[95 * mm, 80 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e0e0e0")))
    story.append(Spacer(1, 6 * mm))

    # ── Émetteur / Client / Dates ──
    parties_data = [
        [
            Paragraph("<b>ÉMETTEUR</b>", label_style),
            Paragraph("<b>CLIENT</b>", label_style),
            Paragraph("<b>DATES</b>", label_style),
        ],
        [
            Paragraph(f"{e.denomination}<br/>{e.adresse}<br/>{e.code_postal} {e.ville}<br/>SIRET : {e.siret}<br/>TVA : {e.tva_intracommunautaire}", value_style),
            Paragraph(f"{c.nom}<br/>{c.adresse}<br/>{c.code_postal} {c.ville}" + (f"<br/>TVA : {c.tva_intracommunautaire}" if c.tva_intracommunautaire else ""), value_style),
            Paragraph(
                f"<b>Date :</b> {fmt_date(d.date_facturation)}<br/>"
                f"<b>Échéance :</b> {fmt_date(d.date_limite_paiement)}<br/>"
                + (f"<b>Bon commande :</b> {d.numero_bon_commande}" if d.numero_bon_commande else ""),
                value_style
            ),
        ],
    ]
    parties_table = Table(parties_data, colWidths=[58 * mm, 65 * mm, 52 * mm])
    parties_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#cccccc")),
        ("TOPPADDING", (0, 1), (-1, 1), 5),
    ]))
    story.append(parties_table)
    story.append(Spacer(1, 8 * mm))

    # ── Lignes ──
    if d.lines:
        _append_multiline_table(story, d.lines, value_style)
    else:
        _append_legacy_table(story, d, value_style)

    story.append(Spacer(1, 6 * mm))

    # ── Totaux ──
    if d.lines:
        tva_rows = _compute_tva_rows(d.lines)
        totals = [["Sous-total HT", fmt_amount(d.montant_ht)]]
        for rate, tva_amt in tva_rows:
            totals.append([f"TVA ({rate:.4g}%)", fmt_amount(tva_amt)])
        totals.append(["TOTAL TTC", fmt_amount(d.montant_ttc)])
    else:
        tva_rate = d.taux_tva or 20
        totals = [
            ["Sous-total HT", fmt_amount(d.montant_ht)],
            [f"TVA ({tva_rate:.4g}%)", fmt_amount(d.montant_tva)],
            ["TOTAL TTC", fmt_amount(d.montant_ttc)],
        ]

    ttc_row = len(totals) - 1
    totals_table = Table(totals, colWidths=[120 * mm, 55 * mm])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -1), "LiberationSans"),
        ("FONTNAME", (0, ttc_row), (-1, ttc_row), "LiberationSans-Bold"),
        ("FONTSIZE", (0, ttc_row), (-1, ttc_row), 11),
        ("BACKGROUND", (0, ttc_row), (-1, ttc_row), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, ttc_row), (-1, ttc_row), colors.white),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEABOVE", (0, 1), (-1, 1), 0.5, colors.HexColor("#cccccc")),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 10 * mm))

    # ── Paiement ──
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e0e0e0")))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("<b>Modalités de règlement</b>", label_style))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"Mode : {d.mode_paiement} — Délai : {d.conditions_paiement} jours<br/>"
        f"IBAN : {e.code_iban} — BIC : {e.bic_swift}",
        value_style
    ))
    story.append(Spacer(1, 6 * mm))

    # ── Mentions légales ──
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e0e0e0")))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        f"SIRET : {e.siret} — TVA : {e.tva_intracommunautaire} — "
        "En cas de retard de paiement, des pénalités de retard seront appliquées au taux légal en vigueur.",
        ParagraphStyle("legal", fontName="LiberationSans", fontSize=7, textColor=colors.HexColor("#888888"))
    ))

    doc.build(story)
    return buf.getvalue()


def _append_legacy_table(story: list, d: InvoiceData, value_style: ParagraphStyle) -> None:
    rows = [
        ["Description", "Qté (j)", "TJM (€/j)", "Total HT"],
        [
            Paragraph(f"<b>{d.designation or ''}</b><br/><font size='8' color='#555555'>{d.descriptif_mission or ''}</font>", value_style),
            f"{d.nombre_jours or 0:.2f}",
            fmt_amount(d.tjm or 0),
            fmt_amount(d.montant_ht),
        ],
    ]
    t = Table(rows, colWidths=[90 * mm, 22 * mm, 30 * mm, 33 * mm])
    t.setStyle(_line_table_style())
    story.append(t)


def _append_multiline_table(story: list, lines: list[InvoiceLine], value_style: ParagraphStyle) -> None:
    has_remise = any(l.remise > 0 for l in lines)
    if has_remise:
        headers = ["Description", "Qté", "Unité", "PU HT", "Rem%", "TVA%", "Total HT"]
        col_w   = [70*mm, 13*mm, 15*mm, 22*mm, 12*mm, 13*mm, 25*mm]
    else:
        headers = ["Description", "Qté", "Unité", "PU HT", "TVA%", "Total HT"]
        col_w   = [76*mm, 14*mm, 17*mm, 24*mm, 14*mm, 25*mm]

    rows = [headers]
    for l in lines:
        row = [
            Paragraph(l.designation + (f"<br/><font size='7' color='#777777'>{l.motif_exoneration}</font>" if l.motif_exoneration else ""), value_style),
            f"{l.quantite:g}",
            l.unite,
            fmt_amount(l.prix_unitaire_ht),
        ]
        if has_remise:
            row.append(f"{l.remise:g}%" if l.remise else "—")
        row.append(f"{l.taux_tva:g}%")
        row.append(fmt_amount(l.montant_ht))
        rows.append(row)

    t = Table(rows, colWidths=col_w)
    t.setStyle(_line_table_style())
    story.append(t)


def _line_table_style() -> TableStyle:
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "LiberationSans"),
        ("FONTNAME", (0, 0), (-1, 0), "LiberationSans-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f8f8")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#dddddd")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ])


def _compute_tva_rows(lines: list[InvoiceLine]) -> list[tuple[float, float]]:
    groups: dict[float, float] = {}
    for l in lines:
        groups[l.taux_tva] = groups.get(l.taux_tva, 0.0) + l.montant_tva
    return sorted(groups.items())


# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.post("/generate", response_class=Response)
async def generate_facturx(
    data: InvoiceData,
    x_api_key: Optional[str] = Header(default=None),
):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        pdf_bytes = build_pdf(data)
        xml_bytes = build_facturx_xml(data)

        facturx_pdf = generate_from_binary(
            pdf_bytes,
            xml_bytes,
            flavor="factur-x",
            level="basic",
            check_xsd=False,
            check_schematron=False,
            xmp_compression=False,
        )

        if hasattr(facturx_pdf, "getvalue"):
            content = facturx_pdf.getvalue()
        elif isinstance(facturx_pdf, bytes):
            content = facturx_pdf
        else:
            content = bytes(facturx_pdf)

        content = _add_output_intent(content)

        return Response(
            content=content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{data.numero_facture}.pdf"',
                "X-Invoice-Id": data.invoice_id,
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}
