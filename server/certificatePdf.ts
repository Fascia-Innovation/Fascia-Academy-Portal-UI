/**
 * Certificate PDF generator — placeholder design.
 * Generates a simple but professional PDF certificate and stores it in S3.
 * Returns the public S3 URL.
 *
 * Design: white background, Fascia Academy branding, participant name, course type,
 * date, and signature line for Ivar Bohlin.
 */
import PDFDocument from "pdfkit";
import { storagePut } from "./storage";

export type CertCourseType = "intro" | "diplo" | "cert" | "vidare";

const COURSE_LABELS: Record<CertCourseType, Record<"sv" | "en", string>> = {
  intro: {
    sv: "Introduktionskurs Fascia",
    en: "Introduction Course Fascia",
  },
  diplo: {
    sv: "Diplomerad Fasciaspecialist",
    en: "Qualified Fascia Specialist",
  },
  cert: {
    sv: "Certifierad Fasciaspecialist",
    en: "Certified Fascia Specialist",
  },
  vidare: {
    sv: "Vidareutbildning Fascia",
    en: "Advanced Fascia Training",
  },
};

const CERT_TITLES: Record<CertCourseType, Record<"sv" | "en", string>> = {
  intro: { sv: "Intyg", en: "Certificate of Completion" },
  diplo: { sv: "Diplombevis", en: "Diploma" },
  cert: { sv: "Certifiering", en: "Certification" },
  vidare: { sv: "Intyg", en: "Certificate of Completion" },
};

export interface GenerateCertOptions {
  contactName: string;
  courseType: CertCourseType;
  language: string;
  issuedAt: Date;
}

export async function generateCertificatePdf(opts: GenerateCertOptions): Promise<string> {
  const lang = (opts.language === "en" ? "en" : "sv") as "sv" | "en";
  const courseLabel = COURSE_LABELS[opts.courseType][lang];
  const certTitle = CERT_TITLES[opts.courseType][lang];
  const dateStr = opts.issuedAt.toLocaleDateString(lang === "sv" ? "sv-SE" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build PDF in memory
  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const H = doc.page.height;

    // ── Background ──────────────────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill("#FAFAF8");

    // ── Decorative border ───────────────────────────────────────────────────
    doc.rect(24, 24, W - 48, H - 48).lineWidth(1.5).stroke("#C8A96A");
    doc.rect(30, 30, W - 60, H - 60).lineWidth(0.5).stroke("#C8A96A");

    // ── Header: Fascia Academy ──────────────────────────────────────────────
    doc
      .fillColor("#1A1A2E")
      .fontSize(11)
      .font("Helvetica")
      .text("FASCIA ACADEMY", 0, 60, { align: "center", characterSpacing: 4 });

    // ── Divider ─────────────────────────────────────────────────────────────
    doc
      .moveTo(W / 2 - 80, 82)
      .lineTo(W / 2 + 80, 82)
      .lineWidth(0.8)
      .stroke("#C8A96A");

    // ── Certificate title ───────────────────────────────────────────────────
    doc
      .fillColor("#1A1A2E")
      .fontSize(32)
      .font("Helvetica-Bold")
      .text(certTitle.toUpperCase(), 0, 105, { align: "center", characterSpacing: 2 });

    // ── Body text ───────────────────────────────────────────────────────────
    const bodyText = lang === "sv"
      ? "Detta intygar att"
      : "This is to certify that";
    doc
      .fillColor("#555555")
      .fontSize(13)
      .font("Helvetica")
      .text(bodyText, 0, 165, { align: "center" });

    // ── Participant name ─────────────────────────────────────────────────────
    doc
      .fillColor("#1A1A2E")
      .fontSize(28)
      .font("Helvetica-Bold")
      .text(opts.contactName, 0, 188, { align: "center" });

    // ── Course completion text ───────────────────────────────────────────────
    const completionText = lang === "sv"
      ? `framgångsrikt har genomgått kursen`
      : `has successfully completed the course`;
    doc
      .fillColor("#555555")
      .fontSize(13)
      .font("Helvetica")
      .text(completionText, 0, 232, { align: "center" });

    // ── Course name ──────────────────────────────────────────────────────────
    doc
      .fillColor("#C8A96A")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text(courseLabel, 0, 256, { align: "center" });

    // ── Date ─────────────────────────────────────────────────────────────────
    doc
      .fillColor("#777777")
      .fontSize(11)
      .font("Helvetica")
      .text(dateStr, 0, 295, { align: "center" });

    // ── Divider ──────────────────────────────────────────────────────────────
    doc
      .moveTo(W / 2 - 80, 320)
      .lineTo(W / 2 + 80, 320)
      .lineWidth(0.8)
      .stroke("#C8A96A");

    // ── Signature block ──────────────────────────────────────────────────────
    doc
      .fillColor("#1A1A2E")
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("Ivar Bohlin", 0, 340, { align: "center" });
    doc
      .fillColor("#777777")
      .fontSize(10)
      .font("Helvetica")
      .text("Fascia Academy", 0, 358, { align: "center" });

    doc.end();
  });

  // ── Upload to S3 ──────────────────────────────────────────────────────────
  const safeName = opts.contactName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const key = `certificates/${opts.courseType}/${safeName}_${Date.now()}.pdf`;
  const { url } = await storagePut(key, pdfBuffer, "application/pdf");
  return url;
}
