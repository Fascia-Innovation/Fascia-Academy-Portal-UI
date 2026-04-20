/**
 * Certificates router — portal-owned certificate system.
 *
 * Features:
 *   - Admin: manage certificate templates (CRUD), list/resend issued certificates
 *   - Public: view a certificate by UUID (no auth required)
 *   - Auto-issue: called from markParticipantShowed when course is intro/vidare
 *   - Exam-issue: called from exams.markPassed for diplo/cert
 */
import { randomUUID } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { parse as parseCookies } from "cookie";
import { publicProcedure, router } from "../_core/trpc";
import { getSessionUser } from "../dashboardAuth";
import type { DashboardUser } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  certificates,
  certificateTemplates,
  dashboardUsers,
} from "../../drizzle/schema";
import { eq, desc, and, max, sql, inArray } from "drizzle-orm";
import { sendCertificateEmail } from "../ghl";

const DASH_SESSION = "fa_dash_session";

function getDashCookie(req: { headers: { cookie?: string } }): string | undefined {
  const cookies = parseCookies(req.headers.cookie ?? "");
  return cookies[DASH_SESSION];
}

const dashboardProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const sessionId = getDashCookie(ctx.req);
  if (!sessionId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not logged in" });
  const user = await getSessionUser(sessionId);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired" });
  return next({ ctx: { ...ctx, dashUser: user as DashboardUser } });
});

const adminProcedure = dashboardProcedure.use(({ ctx, next }) => {
  if ((ctx as { dashUser: DashboardUser }).dashUser.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

// Default templates for each course type + language
const DEFAULT_TEMPLATES: Array<{
  courseType: "intro" | "diplo" | "cert" | "vidare";
  language: "sv" | "en";
  title: string;
  courseLabel: string;
  bodyText: string;
  bulletPoints: string[];
  emailSubject: string;
  emailBody: string;
}> = [
  {
    courseType: "intro",
    language: "sv",
    title: "INTYG",
    courseLabel: "Introduktionskurs Fascia",
    bodyText: "Yrkesutbildningen har genomförts med goda vitsord i enlighet med de krav som Fascia Academy ställer för ett kompetent utförande av fasciabehandling.",
    bulletPoints: [
      "Har grundläggande kunskap om människans anatomi, fysiologi, rörelseapparat, fasciasystemet samt kroppen som helhet",
      "Har förståelse för orsaker till spänningar och obalanser samt när behandling inte bör genomföras",
      "Kan observera hållning, balans, rörlighet och asymmetrier samt identifiera spänningar",
      "Kan anpassa och genomföra behandling säkert och professionellt för ökad rörlighet och avslappning",
    ],
    emailSubject: "Ditt intyg från Fascia Academy",
    emailBody: `<p>Hej {{participant_name}}!</p>
<p>Grattis till att du har genomfört <strong>Introduktionskurs i Fascia</strong> med Fascia Academy!</p>
<p>Du kan visa och ladda ner ditt intyg via länken nedan:</p>
<p><a href="{{certificate_url}}" style="background:#C8A96A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Visa ditt intyg</a></p>
<p>Med vänliga hälsningar,<br><strong>Fascia Academy</strong></p>`,
  },
  {
    courseType: "intro",
    language: "en",
    title: "CERTIFICATE",
    courseLabel: "Introduction Course Fascia",
    bodyText: "This training has been completed with merit in accordance with the standards of Fascia Academy.",
    bulletPoints: [
      "Has foundational knowledge of human anatomy, physiology, and the musculoskeletal system, including the fascial system and the body as an integrated whole",
      "Understands causes of tension and imbalance and recognizes when treatment should not be performed",
      "Can observe posture, balance, mobility, and asymmetries, and identify areas of tension",
      "Can adapt and perform treatment safely and professionally to improve mobility, reduce tension, and promote relaxation",
    ],
    emailSubject: "Your certificate from Fascia Academy",
    emailBody: `<p>Hi {{participant_name}}!</p>
<p>Congratulations on completing the <strong>Introduction Course in Fascia</strong> with Fascia Academy!</p>
<p>You can view and download your certificate using the link below:</p>
<p><a href="{{certificate_url}}" style="background:#C8A96A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">View your certificate</a></p>
<p>Best regards,<br><strong>Fascia Academy</strong></p>`,
  },
  {
    courseType: "diplo",
    language: "sv",
    title: "DIPLOM",
    courseLabel: "Diplomerad Fasciaspecialist",
    bodyText: "Yrkesutbildningen har genomförts med goda vitsord i enlighet med de krav som Fascia Academy ställer för ett kompetent utförande av fasciabehandling.",
    bulletPoints: [
      "Har grundläggande kunskap om människans anatomi, fysiologi, rörelseapparat, fasciasystemet samt kroppen som helhet",
      "Har förståelse för orsaker till spänningar och obalanser samt när behandling inte bör genomföras",
      "Kan observera hållning, balans, rörlighet och asymmetrier samt identifiera spänningar",
      "Kan anpassa och genomföra behandling säkert och professionellt för ökad rörlighet och avslappning",
    ],
    emailSubject: "Ditt diplom från Fascia Academy",
    emailBody: `<p>Hej {{participant_name}}!</p>
<p>Grattis till att du har blivit <strong>Diplomerad Fasciaspecialist</strong> hos Fascia Academy!</p>
<p>Du kan visa och ladda ner ditt diplom via länken nedan:</p>
<p><a href="{{certificate_url}}" style="background:#C8A96A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Visa ditt diplom</a></p>
<p>Med vänliga hälsningar,<br><strong>Fascia Academy</strong></p>`,
  },
  {
    courseType: "diplo",
    language: "en",
    title: "DIPLOMA",
    courseLabel: "Qualified Fascia Specialist",
    bodyText: "This training has been completed with merit in accordance with the standards of Fascia Academy.",
    bulletPoints: [
      "Has foundational knowledge of human anatomy, physiology, and the musculoskeletal system, including the fascial system and the body as an integrated whole",
      "Understands causes of tension and imbalance and recognizes when treatment should not be performed",
      "Can observe posture, balance, mobility, and asymmetries, and identify areas of tension",
      "Can adapt and perform treatment safely and professionally to improve mobility, reduce tension, and promote relaxation",
    ],
    emailSubject: "Your diploma from Fascia Academy",
    emailBody: `<p>Hi {{participant_name}}!</p>
<p>Congratulations on becoming a <strong>Qualified Fascia Specialist</strong> with Fascia Academy!</p>
<p>You can view and download your diploma using the link below:</p>
<p><a href="{{certificate_url}}" style="background:#C8A96A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">View your diploma</a></p>
<p>Best regards,<br><strong>Fascia Academy</strong></p>`,
  },
  {
    courseType: "cert",
    language: "sv",
    title: "CERTIFIERING",
    courseLabel: "Certifierad Fasciaspecialist",
    bodyText: "Yrkesutbildningen har genomförts med goda vitsord i enlighet med de krav som Fascia Academy ställer för ett kompetent utförande av fasciabehandling.",
    bulletPoints: [
      "Har avancerad kunskap om fasciasystemet och dess kliniska tillämpningar",
      "Kan genomföra avancerade fasciabehandlingar med hög precision och säkerhet",
      "Har förmåga att analysera och behandla komplexa muskuloskeletala tillstånd",
      "Kan utbilda och handleda andra inom fasciabehandling",
    ],
    emailSubject: "Din certifiering från Fascia Academy",
    emailBody: `<p>Hej {{participant_name}}!</p>
<p>Grattis till att du har blivit <strong>Certifierad Fasciaspecialist</strong> hos Fascia Academy!</p>
<p>Du kan visa och ladda ner ditt certifikat via länken nedan:</p>
<p><a href="{{certificate_url}}" style="background:#C8A96A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Visa ditt certifikat</a></p>
<p>Med vänliga hälsningar,<br><strong>Fascia Academy</strong></p>`,
  },
  {
    courseType: "cert",
    language: "en",
    title: "CERTIFICATION",
    courseLabel: "Certified Fascia Specialist",
    bodyText: "This training has been completed with merit in accordance with the standards of Fascia Academy.",
    bulletPoints: [
      "Has advanced knowledge of the fascial system and its clinical applications",
      "Can perform advanced fascia treatments with high precision and safety",
      "Has the ability to analyze and treat complex musculoskeletal conditions",
      "Can educate and mentor others in fascia treatment",
    ],
    emailSubject: "Your certification from Fascia Academy",
    emailBody: `<p>Hi {{participant_name}}!</p>
<p>Congratulations on becoming a <strong>Certified Fascia Specialist</strong> with Fascia Academy!</p>
<p>You can view and download your certification using the link below:</p>
<p><a href="{{certificate_url}}" style="background:#C8A96A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">View your certification</a></p>
<p>Best regards,<br><strong>Fascia Academy</strong></p>`,
  },
  {
    courseType: "vidare",
    language: "sv",
    title: "INTYG",
    courseLabel: "Vidareutbildning Fascia",
    bodyText: "Vidareutbildningen har genomförts med goda vitsord i enlighet med de krav som Fascia Academy ställer.",
    bulletPoints: [
      "Har fördjupad kunskap om fasciasystemet och avancerade behandlingsmetoder",
      "Kan tillämpa avancerade tekniker för att behandla komplexa tillstånd",
    ],
    emailSubject: "Ditt intyg från Fascia Academy",
    emailBody: `<p>Hej {{participant_name}}!</p>
<p>Grattis till att du har genomfört <strong>Vidareutbildning i Fascia</strong> med Fascia Academy!</p>
<p>Du kan visa och ladda ner ditt intyg via länken nedan:</p>
<p><a href="{{certificate_url}}" style="background:#C8A96A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Visa ditt intyg</a></p>
<p>Med vänliga hälsningar,<br><strong>Fascia Academy</strong></p>`,
  },
  {
    courseType: "vidare",
    language: "en",
    title: "CERTIFICATE",
    courseLabel: "Advanced Fascia Training",
    bodyText: "This advanced training has been completed with merit in accordance with the standards of Fascia Academy.",
    bulletPoints: [
      "Has in-depth knowledge of the fascial system and advanced treatment methods",
      "Can apply advanced techniques to treat complex conditions",
    ],
    emailSubject: "Your certificate from Fascia Academy",
    emailBody: `<p>Hi {{participant_name}}!</p>
<p>Congratulations on completing <strong>Advanced Fascia Training</strong> with Fascia Academy!</p>
<p>You can view and download your certificate using the link below:</p>
<p><a href="{{certificate_url}}" style="background:#C8A96A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">View your certificate</a></p>
<p>Best regards,<br><strong>Fascia Academy</strong></p>`,
  },
];

const FA_LOGO = "/manus-storage/fa-logo_9f3873fa.png";
const ATLAS_LOGO = "/manus-storage/atlasbalans-logo_3f37aa31.png";

// ─── Verification code generator ─────────────────────────────────────────────
async function generateVerificationCode(db: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  if (!db) throw new Error("DB not available");
  const year = new Date().getFullYear();
  const prefix = `FA-${year}-`;
  // Get the highest existing number for this year
  const [row] = await db
    .select({ maxCode: max(certificates.verificationCode) })
    .from(certificates)
    .where(sql`${certificates.verificationCode} LIKE ${prefix + "%"}`);
  const maxCode = row?.maxCode;
  let nextNum = 1;
  if (maxCode) {
    const parts = maxCode.split("-");
    const num = parseInt(parts[2] ?? "0", 10);
    if (!isNaN(num)) nextNum = num + 1;
  }
  return `${prefix}${String(nextNum).padStart(5, "0")}`;
}

/**
 * Standalone helper — issue a certificate as DRAFT (no email sent).
 * Called from markParticipantShowed (intro/vidare) and exams.markPassed (diplo/cert).
 * Admin must explicitly send via sendCertificates mutation.
 */
export async function issueCertificateForParticipant(opts: {
  ghlContactId: string;
  contactName: string;
  contactEmail?: string | null;
  courseType: "intro" | "diplo" | "cert" | "vidare";
  language: "sv" | "en";
  issuedBy?: number;
  examId?: number;
  showedAt?: Date;
  examPassedAt?: Date;
  origin?: string;
}): Promise<{ uuid: string; certUrl: string; id: number; verificationCode: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const tmplRows = await db
    .select()
    .from(certificateTemplates)
    .where(
      and(
        eq(certificateTemplates.courseType, opts.courseType),
        eq(certificateTemplates.language, opts.language)
      )
    )
    .limit(1);
  const template = tmplRows[0] ?? null;

  const uuid = randomUUID().replace(/-/g, "");
  const verificationCode = await generateVerificationCode(db);

  // For diplo/cert: issuedAt = max(showedAt, examPassedAt); for intro/vidare: showedAt or now
  let issuedAt: Date;
  if ((opts.courseType === "diplo" || opts.courseType === "cert") && opts.showedAt && opts.examPassedAt) {
    issuedAt = opts.showedAt > opts.examPassedAt ? opts.showedAt : opts.examPassedAt;
  } else {
    issuedAt = opts.showedAt ?? new Date();
  }

  const [inserted] = await db.insert(certificates).values({
    uuid,
    ghlContactId: opts.ghlContactId,
    contactName: opts.contactName,
    contactEmail: opts.contactEmail ?? null,
    courseType: opts.courseType,
    language: opts.language,
    issuedBy: opts.issuedBy ?? null,
    examId: opts.examId ?? null,
    templateId: template?.id ?? null,
    verificationCode,
    status: "draft",
    issuedAt,
    showedAt: opts.showedAt ?? null,
    examPassedAt: opts.examPassedAt ?? null,
  }).$returningId();

  const origin = opts.origin ?? process.env.VITE_OAUTH_PORTAL_URL?.replace("/login", "") ?? "https://fascidash-9qucsw5g.manus.space";
  const certUrl = `${origin}/certificate/${uuid}`;

  return { uuid, certUrl, id: inserted.id, verificationCode };
}

export const certificatesRouter = router({
  // ── Public: view certificate by UUID ────────────────────────────────────
  getByUuid: publicProcedure
    .input(z.object({ uuid: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select()
        .from(certificates)
        .where(eq(certificates.uuid, input.uuid))
        .limit(1);
      const cert = rows[0];
      if (!cert) throw new TRPCError({ code: "NOT_FOUND" });
      // Get template for rendering
      const tmplRows = await db
        .select()
        .from(certificateTemplates)
        .where(
          and(
            eq(certificateTemplates.courseType, cert.courseType),
            eq(certificateTemplates.language, cert.language)
          )
        )
        .limit(1);
      const template = tmplRows[0] ?? null;
      return { cert, template };
    }),

  // ── Admin: list all issued certificates ─────────────────────────────────
  listAll: dashboardProcedure
    .input(z.object({ limit: z.number().int().max(500).default(200) }))
    .query(async ({ ctx }) => {
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
      if (dashUser.role !== "admin" && !dashUser.canExamineExams) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(certificates)
        .orderBy(desc(certificates.createdAt))
        .limit(200);
      return rows;
    }),

  // ── Admin: send / resend certificate email ─────────────────────────────
  // Works for both draft→sent (first send) and re-send of already sent certs.
  resendEmail: adminProcedure
    .input(z.object({ certificateId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
      const rows = await db
        .select()
        .from(certificates)
        .where(eq(certificates.id, input.certificateId))
        .limit(1);
      const cert = rows[0];
      if (!cert) throw new TRPCError({ code: "NOT_FOUND" });
      if (!cert.contactEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "No email on file" });

      const tmplRows = await db
        .select()
        .from(certificateTemplates)
        .where(
          and(
            eq(certificateTemplates.courseType, cert.courseType),
            eq(certificateTemplates.language, cert.language)
          )
        )
        .limit(1);
      const template = tmplRows[0];
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "No template found" });

      const origin = process.env.VITE_OAUTH_PORTAL_URL?.replace("/login", "") ?? "https://fascidash-9qucsw5g.manus.space";
      const certUrl = `${origin}/certificate/${cert.uuid}`;
      await sendCertificateEmail({
        toEmail: cert.contactEmail,
        toName: cert.contactName,
        subject: template.emailSubject,
        htmlBody: template.emailBody
          .replace(/\{\{participant_name\}\}/g, cert.contactName)
          .replace(/\{\{certificate_url\}\}/g, certUrl),
      });
      const now = new Date();
      await db.update(certificates)
        .set({ emailSentAt: now, status: "sent", sentAt: now, sentBy: dashUser.id })
        .where(eq(certificates.id, cert.id));
      return { success: true };
    }),

  // ── Admin: bulk send certificates (draft → sent) ─────────────────────────
  // Pass certificateIds = [] to send ALL pending drafts.
  sendCertificates: adminProcedure
    .input(z.object({
      certificateIds: z.array(z.number().int()),  // empty = send all drafts
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
      const origin = process.env.VITE_OAUTH_PORTAL_URL?.replace("/login", "") ?? "https://fascidash-9qucsw5g.manus.space";

      // Fetch target certs
      let certs;
      if (input.certificateIds.length > 0) {
        certs = await db.select().from(certificates)
          .where(inArray(certificates.id, input.certificateIds));
      } else {
        // All drafts with an email address
        certs = await db.select().from(certificates)
          .where(and(eq(certificates.status, "draft")))
          .orderBy(desc(certificates.createdAt));
      }

      const results: { id: number; success: boolean; error?: string }[] = [];

      for (const cert of certs) {
        if (!cert.contactEmail) {
          results.push({ id: cert.id, success: false, error: "No email on file" });
          continue;
        }
        try {
          const tmplRows = await db.select().from(certificateTemplates)
            .where(and(
              eq(certificateTemplates.courseType, cert.courseType),
              eq(certificateTemplates.language, cert.language)
            )).limit(1);
          const template = tmplRows[0];
          if (!template) {
            results.push({ id: cert.id, success: false, error: "No template" });
            continue;
          }
          const certUrl = `${origin}/certificate/${cert.uuid}`;
          await sendCertificateEmail({
            toEmail: cert.contactEmail,
            toName: cert.contactName,
            subject: template.emailSubject,
            htmlBody: template.emailBody
              .replace(/\{\{participant_name\}\}/g, cert.contactName)
              .replace(/\{\{certificate_url\}\}/g, certUrl),
          });
          const now = new Date();
          await db.update(certificates)
            .set({ emailSentAt: now, status: "sent", sentAt: now, sentBy: dashUser.id })
            .where(eq(certificates.id, cert.id));
          results.push({ id: cert.id, success: true });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          results.push({ id: cert.id, success: false, error: msg });
        }
      }

      const sent = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      return { sent, failed, results };
    }),

  // ── Admin: list templates ────────────────────────────────────────────────
  listTemplates: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(certificateTemplates).orderBy(certificateTemplates.courseType, certificateTemplates.language);
  }),

  // ── Admin: seed default templates (if none exist) ────────────────────────
  seedTemplates: adminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
    const existing = await db.select({ id: certificateTemplates.id }).from(certificateTemplates);
    if (existing.length > 0) return { seeded: 0, message: "Templates already exist" };
    for (const t of DEFAULT_TEMPLATES) {
      await db.insert(certificateTemplates).values({
        courseType: t.courseType,
        language: t.language,
        title: t.title,
        courseLabel: t.courseLabel,
        bodyText: t.bodyText,
        bulletPoints: JSON.stringify(t.bulletPoints),
        instructorName: "Ivar Bohlin",
        instructorTitle: "Ansvarig lärare Ivar Bohlin",
        faLogoUrl: FA_LOGO,
        atlasLogoUrl: ATLAS_LOGO,
        emailSubject: t.emailSubject,
        emailBody: t.emailBody,
        updatedBy: dashUser.id,
      });
    }
    return { seeded: DEFAULT_TEMPLATES.length, message: `Seeded ${DEFAULT_TEMPLATES.length} templates` };
  }),

  // ── Admin: update a template ─────────────────────────────────────────────
  updateTemplate: adminProcedure
    .input(z.object({
      id: z.number().int(),
      title: z.string().min(1).max(255),
      courseLabel: z.string().min(1).max(255),
      bodyText: z.string().min(1),
      bulletPoints: z.array(z.string()).optional(),
      instructorName: z.string().min(1).max(255),
      instructorTitle: z.string().min(1).max(255),
      faLogoUrl: z.string().max(1024).optional(),
      atlasLogoUrl: z.string().max(1024).optional(),
      emailSubject: z.string().min(1).max(500),
      emailBody: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
      await db.update(certificateTemplates)
        .set({
          title: input.title,
          courseLabel: input.courseLabel,
          bodyText: input.bodyText,
          bulletPoints: input.bulletPoints ? JSON.stringify(input.bulletPoints) : undefined,
          instructorName: input.instructorName,
          instructorTitle: input.instructorTitle,
          faLogoUrl: input.faLogoUrl,
          atlasLogoUrl: input.atlasLogoUrl,
          emailSubject: input.emailSubject,
          emailBody: input.emailBody,
          updatedBy: dashUser.id,
        })
        .where(eq(certificateTemplates.id, input.id));
      return { success: true };
    }),

  // ── Admin: delete a single certificate ──────────────────────────────────────────────────
  deleteCertificate: adminProcedure
    .input(z.object({ certificateId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(certificates).where(eq(certificates.id, input.certificateId));
      return { success: true };
    }),

  // ── Admin: bulk delete certificates ────────────────────────────────────────────────
  deleteCertificates: adminProcedure
    .input(z.object({ certificateIds: z.array(z.number().int()).min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(certificates).where(inArray(certificates.id, input.certificateIds));
      return { success: true, deleted: input.certificateIds.length };
    }),

  // ── Internal: issue a certificate as draft (called from courseDates router) ───
  issueCertificate: dashboardProcedure
    .input(z.object({
      ghlContactId: z.string(),
      contactName: z.string(),
      contactEmail: z.string().email().optional(),
      courseType: z.enum(["intro", "diplo", "cert", "vidare"]),
      language: z.enum(["sv", "en"]),
      issuedBy: z.number().int().optional(),
      examId: z.number().int().optional(),
      showedAt: z.date().optional(),
      examPassedAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
      const result = await issueCertificateForParticipant({
        ...input,
        issuedBy: input.issuedBy ?? dashUser.id,
      });
      return { success: true, ...result };
    }),
});
