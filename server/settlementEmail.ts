/**
 * Settlement approval email sender — uses GHL Conversations API.
 * Called from the settlements router when admin approves a settlement.
 */

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY ?? "";

export interface SettlementEmailLine {
  participantName: string;
  courseDate: string | null;
  paidInclVat: number;
  transactionFee: number;
  faMargin: number;
  affiliateDeduction: number;
  payout: number;
  affiliateCode?: string | null;
}

export async function sendSettlementApprovalEmail(opts: {
  contactId: string;
  recipientEmail: string;
  recipientName: string;
  periodYear: number;
  periodMonth: number;
  currency: string;
  totalPayout: number;
  lines: SettlementEmailLine[];
  invoiceReference?: string | null;
  faCompany: { name: string; orgNr: string; address: string; email: string; paymentTerms: string };
}): Promise<void> {
  const {
    contactId, recipientEmail, recipientName,
    periodYear, periodMonth, currency, totalPayout,
    lines, invoiceReference, faCompany,
  } = opts;

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const period = `${monthNames[periodMonth - 1]} ${periodYear}`;
  const hasDiscount = lines.some((l) => l.affiliateDeduction > 0 || l.affiliateCode);
  const colSpan = hasDiscount ? 4 : 3;

  const participantRows = lines.map((l) => {
    const firstName = l.participantName.split(" ")[0] ?? l.participantName;
    const discountText = l.affiliateDeduction > 0
      ? `-${l.affiliateDeduction.toFixed(0)} ${currency}${l.affiliateCode ? ` (${l.affiliateCode})` : ""}`
      : "—";
    const discountColor = l.affiliateDeduction > 0 ? "#dc2626" : "#6b7280";
    const discountCell = hasDiscount
      ? `<td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:${discountColor};">${discountText}</td>`
      : "";
    return `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${firstName}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${l.courseDate ?? "—"}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${l.paidInclVat.toFixed(0)} ${currency}</td>
      ${discountCell}
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${l.payout.toFixed(0)} ${currency}</td>
    </tr>`;
  }).join("\n");

  const discountHeader = hasDiscount
    ? `<th style="padding:8px 12px;background:#f9fafb;text-align:right;font-weight:600;color:#374151;">Discount/Affiliate</th>`
    : "";

  const invoiceRefRow = invoiceReference
    ? `<p style="margin:10px 0 0;font-size:14px;"><strong>Reference:</strong> ${invoiceReference}</p>`
    : "";

  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#111827;">
  <div style="background:#1e2d4a;padding:24px 32px;border-radius:8px 8px 0 0;">
    <h1 style="color:#c9a84c;margin:0;font-size:22px;">Settlement Approved</h1>
    <p style="color:#94a3b8;margin:6px 0 0;">${period}</p>
  </div>
  <div style="background:#ffffff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;">
    <p>Hi ${recipientName},</p>
    <p>Your settlement for <strong>${period}</strong> has been approved. Please issue an invoice to Fascia Academy based on the details below.</p>
    <h3 style="color:#1e2d4a;margin:24px 0 12px;">Participant Overview</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151;">First Name</th>
        <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151;">Course Date</th>
        <th style="padding:8px 12px;text-align:right;font-weight:600;color:#374151;">Full Price</th>
        ${discountHeader}
        <th style="padding:8px 12px;text-align:right;font-weight:600;color:#374151;">Your Payout</th>
      </tr></thead>
      <tbody>${participantRows}</tbody>
      <tfoot><tr style="background:#f9fafb;">
        <td colspan="${colSpan}" style="padding:10px 12px;font-weight:700;text-align:right;color:#1e2d4a;">Total to Invoice:</td>
        <td style="padding:10px 12px;font-weight:700;text-align:right;font-size:16px;color:#1e2d4a;">${totalPayout.toFixed(0)} ${currency}</td>
      </tr></tfoot>
    </table>
    <div style="margin-top:28px;padding:16px 20px;background:#f8f9fa;border-radius:6px;border-left:4px solid #c9a84c;">
      <h4 style="margin:0 0 10px;color:#1e2d4a;">Invoice to:</h4>
      <p style="margin:0;line-height:1.8;font-size:14px;">
        <strong>${faCompany.name}</strong><br>
        Org.nr: ${faCompany.orgNr}<br>
        ${faCompany.address}<br>
        ${faCompany.email}
      </p>
      ${invoiceRefRow}
      <p style="margin:10px 0 0;font-size:14px;"><strong>Payment terms:</strong> ${faCompany.paymentTerms}</p>
    </div>
    <p style="margin-top:24px;font-size:13px;color:#6b7280;">
      You can view the full settlement details in the
      <a href="https://fascidash-9qucsw5g.manus.space/my-settlements" style="color:#c9a84c;">Fascia Academy Portal</a>.
    </p>
    <p style="margin-top:20px;">Best regards,<br><strong>Fascia Academy</strong></p>
  </div>
</div>`;

  const body: Record<string, unknown> = {
    type: "Email",
    contactId,
    emailTo: recipientEmail,
    emailFrom: "info@fasciaacademy.com",
    subject: `Settlement Approved — ${period} (${totalPayout.toFixed(0)} ${currency})`,
    html,
    status: "pending",
  };

  const url = `${GHL_BASE}/conversations/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Version: "2023-02-21",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL sendSettlementApprovalEmail error ${res.status}: ${text}`);
  }
}
