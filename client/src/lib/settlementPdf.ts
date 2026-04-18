/**
 * Settlement PDF export — generates a professional PDF from settlement data.
 * Data protection: only participant first+last name shown, never email addresses.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SettlementPdfData {
  settlement: {
    id: number;
    userName: string;
    userEmail?: string;
    userType: string;
    periodYear: number;
    periodMonth: number;
    currency: string;
    status: string;
    totalPaidInclVat: string;
    totalNetExclVat: string;
    totalTransactionFee: string;
    totalFaMargin: string;
    totalAffiliateDeduction: string;
    totalAdjustments: string;
    totalPayout: string;
    participantCount: number;
    invoiceReference?: string | null;
    approvedAt?: string | null;
  };
  lines: Array<{
    participantName: string;
    calendarName: string;
    courseType: string;
    courseDate: string;
    affiliateCode: string;
    paidInclVat: string;
    netExclVat: string;
    transactionFee: string;
    faMargin: string;
    affiliateDeduction: string;
    payout: string;
    missingAmount: boolean;
  }>;
  adjustments: Array<{
    amount: string;
    currency: string;
    comment: string;
    createdByName: string;
    createdAt: Date | string;
  }>;
  faCompany: {
    name: string;
    orgNr: string;
    address: string;
    email: string;
    paymentTerms: string;
  };
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmt(val: string | number): string {
  return Number(val).toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function generateSettlementPdf(data: SettlementPdfData): void {
  const { settlement: s, lines, adjustments, faCompany } = data;
  const period = `${MONTHS[s.periodMonth - 1]} ${s.periodYear}`;
  const cur = s.currency;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // ─── Header ──────────────────────────────────────────────────────────────
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Settlement Statement", margin, y + 7);
  y += 12;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`${s.status.toUpperCase()} · ${s.userType === "course_leader" ? "Course Leader" : "Affiliate"}`, margin, y);
  if (s.invoiceReference) {
    doc.text(`Ref: ${s.invoiceReference}`, pageWidth - margin, y, { align: "right" });
  }
  y += 6;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ─── Parties ─────────────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE TO", margin, y);
  doc.text("SETTLEMENT FOR", pageWidth / 2 + 5, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(faCompany.name, margin, y);
  doc.text(s.userName, pageWidth / 2 + 5, y);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Org.nr: ${faCompany.orgNr}`, margin, y);
  doc.text(`Period: ${period}`, pageWidth / 2 + 5, y);
  y += 4;
  doc.text(faCompany.address, margin, y);
  doc.text(`Payment terms: ${faCompany.paymentTerms}`, pageWidth / 2 + 5, y);
  y += 4;
  doc.text(faCompany.email, margin, y);
  if (s.approvedAt) {
    doc.text(`Approved: ${new Date(s.approvedAt).toLocaleDateString("sv-SE")}`, pageWidth / 2 + 5, y);
  }
  y += 8;

  // ─── Financial summary ───────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("FINANCIAL SUMMARY", margin, y);
  y += 4;

  const summaryRows = [
    ["Total paid incl. VAT", `${fmt(s.totalPaidInclVat)} ${cur}`],
    ["Net excl. VAT (25%)", `${fmt(s.totalNetExclVat)} ${cur}`],
    ["Transaction fee (3.1%)", `−${fmt(s.totalTransactionFee)} ${cur}`],
    ["FA margin", `−${fmt(s.totalFaMargin)} ${cur}`],
    ["Affiliate deduction", `−${fmt(s.totalAffiliateDeduction)} ${cur}`],
    ["Manual adjustments", `${Number(s.totalAdjustments) >= 0 ? "+" : ""}${fmt(s.totalAdjustments)} ${cur}`],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: summaryRows,
    theme: "plain",
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: "normal", textColor: [80, 80, 80] },
      1: { halign: "right", fontStyle: "normal" },
    },
    didDrawPage: () => {},
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

  // Total payout box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 10, 2, 2, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Total Payout", margin + 4, y + 7);
  const payoutColor = Number(s.totalPayout) < 0 ? [200, 0, 0] : [0, 120, 0];
  doc.setTextColor(payoutColor[0], payoutColor[1], payoutColor[2]);
  doc.text(`${fmt(s.totalPayout)} ${cur}`, pageWidth - margin - 4, y + 7, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 16;

  // ─── Participant lines ───────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`PARTICIPANTS (${lines.length})`, margin, y);
  y += 3;

  // Data protection: only show participant name, never email
  const tableBody = lines.map((l) => [
    l.participantName,
    l.courseType.charAt(0).toUpperCase() + l.courseType.slice(1),
    l.courseDate,
    l.affiliateCode || "—",
    `${fmt(l.paidInclVat)}`,
    `${fmt(l.payout)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Name", "Course", "Date", "Affiliate", `Paid (${cur})`, `Payout (${cur})`]],
    body: tableBody,
    theme: "striped",
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 40 },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ─── Adjustments ─────────────────────────────────────────────────────────
  if (adjustments.length > 0) {
    if (y > 260) { doc.addPage(); y = margin; }
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("MANUAL ADJUSTMENTS", margin, y);
    y += 3;

    const adjBody = adjustments.map((a) => [
      a.comment,
      a.createdByName,
      new Date(a.createdAt).toLocaleDateString("sv-SE"),
      `${Number(a.amount) > 0 ? "+" : ""}${fmt(a.amount)} ${a.currency}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Comment", "By", "Date", "Amount"]],
      body: adjBody,
      theme: "striped",
      margin: { left: margin, right: margin },
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
      columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
    });
  }

  // ─── Footer ──────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${faCompany.name} · ${faCompany.email} · Generated ${new Date().toLocaleDateString("sv-SE")}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
    doc.text(`Page ${i}/${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  // Download
  const filename = `settlement_${s.userName.replace(/\s+/g, "_")}_${s.periodYear}-${String(s.periodMonth).padStart(2, "0")}.pdf`;
  doc.save(filename);
}
