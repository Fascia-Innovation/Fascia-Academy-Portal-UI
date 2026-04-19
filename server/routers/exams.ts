/**
 * Exam queue and certificate procedures.
 *
 * Access rules:
 *   - admin: full access to all procedures
 *   - canExamineExams: can list/grade pending exams and view certificates
 *   - course_leader: no access
 */
import { randomUUID } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { parse as parseCookies } from "cookie";
import { publicProcedure, router } from "../_core/trpc";
import { getSessionUser } from "../dashboardAuth";
import type { DashboardUser } from "../../drizzle/schema";
import { getDb } from "../db";
import { exams, certificates, participantSnapshots, courseDates } from "../../drizzle/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { dashboardUsers } from "../../drizzle/schema";
import { generateCertificatePdf } from "../certificatePdf";
import { setGhlTag, sendExamResultEmail, searchContactByEmail } from "../ghl";
import { issueCertificateForParticipant } from "./certificatesRouter";

const DASH_SESSION = "fa_dash_session";

function getDashCookie(req: { headers: { cookie?: string } }): string | undefined {
  const cookies = parseCookies(req.headers.cookie ?? "");
  return cookies[DASH_SESSION];
}

/** Middleware: require dashboard session */
const dashboardProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const sessionId = getDashCookie(ctx.req);
  if (!sessionId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not logged in" });
  const user = await getSessionUser(sessionId);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired" });
  return next({ ctx: { ...ctx, dashUser: user as DashboardUser } });
});

/** Middleware: require admin OR canExamineExams */
const examinerProcedure = dashboardProcedure.use(({ ctx, next }) => {
  const u = (ctx as { dashUser: DashboardUser & { canExamineExams?: boolean } }).dashUser;
  if (u.role !== "admin" && !u.canExamineExams) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

/** Middleware: admin only */
const adminProcedure = dashboardProcedure.use(({ ctx, next }) => {
  if ((ctx as { dashUser: DashboardUser }).dashUser.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

/**
 * Look up whether a contact has a 'showed' snapshot for any diplo/cert course.
 * Returns the most recent showed snapshot's courseDateId (or null).
 */
async function getShowedStatusForContact(
  db: Awaited<ReturnType<typeof getDb>>,
  ghlContactId: string,
  courseType: "diplo" | "cert"
): Promise<{ showed: boolean; courseDateId: number | null }> {
  if (!db) return { showed: false, courseDateId: null };
  // Find participantSnapshots with status='showed' for this contact,
  // joined with course_dates to filter by courseType
  const rows = await db
    .select({
      snapshotId: participantSnapshots.id,
      courseDateId: participantSnapshots.courseDateId,
      courseType: courseDates.courseType,
    })
    .from(participantSnapshots)
    .innerJoin(courseDates, eq(participantSnapshots.courseDateId, courseDates.id))
    .where(
      and(
        eq(participantSnapshots.ghlContactId, ghlContactId),
        eq(participantSnapshots.status, "showed"),
        eq(courseDates.courseType, courseType)
      )
    )
    .limit(1);
  if (rows.length > 0) {
    return { showed: true, courseDateId: rows[0].courseDateId };
  }
  return { showed: false, courseDateId: null };
}

// Helper: enrich exam rows with examiner display names
async function enrichWithExaminerNames(
  db: Awaited<ReturnType<typeof getDb>>,
  rows: (typeof exams.$inferSelect)[]
) {
  if (!db || rows.length === 0) return rows.map(r => ({ ...r, examinedByName: null as string | null }));
  const examinerIds = Array.from(new Set(rows.map(r => r.examinedBy).filter((id): id is number => id != null)));
  const nameMap: Record<number, string> = {};
  if (examinerIds.length > 0) {
    const users = await db
      .select({ id: dashboardUsers.id, name: dashboardUsers.name })
      .from(dashboardUsers)
      .where(inArray(dashboardUsers.id, examinerIds));
    for (const u of users) nameMap[u.id] = u.name;
  }
  return rows.map(r => ({
    ...r,
    examinedByName: r.examinedBy != null ? (nameMap[r.examinedBy] ?? null) : null,
  }));
}

export const examsRouter = router({
  // ── List pending exams (examiner queue) ──────────────────────────────────
  listPending: examinerProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(exams)
      .where(eq(exams.status, "pending"))
      .orderBy(exams.createdAt);
    const enriched = await enrichWithExaminerNames(db, rows);
    // Enrich with showed status
    const withShowed = await Promise.all(
      enriched.map(async (exam) => {
        const { showed } = await getShowedStatusForContact(db, exam.ghlContactId, exam.courseType as "diplo" | "cert");
        return { ...exam, isShowed: showed };
      })
    );
    return withShowed;
  }),

  // ── List all exams (admin/examiner overview) ──────────────────────────────
  listAll: examinerProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(exams)
        .orderBy(desc(exams.createdAt))
        .limit(input.limit);
      const enriched = await enrichWithExaminerNames(db, rows);
      // Enrich with showed status for pending exams only (performance)
      const withShowed = await Promise.all(
        enriched.map(async (exam) => {
          if (exam.status !== "pending") return { ...exam, isShowed: null as boolean | null };
          const { showed } = await getShowedStatusForContact(db, exam.ghlContactId, exam.courseType as "diplo" | "cert");
          return { ...exam, isShowed: showed };
        })
      );
      return withShowed;
    }),

  // ── Delete exam (admin only) ──────────────────────────────────────────────
  deleteExam: adminProcedure
    .input(z.object({ examId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(exams).where(eq(exams.id, input.examId));
      return { success: true };
    }),

  // ── Mark exam as passed ───────────────────────────────────────────────────
  markPassed: examinerProcedure
    .input(z.object({
      examId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [exam] = await db.select().from(exams).where(eq(exams.id, input.examId));
      if (!exam) throw new TRPCError({ code: "NOT_FOUND", message: "Exam not found" });
      if (exam.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Exam already graded" });

      // Update exam status
      await db.update(exams)
        .set({
          status: "passed",
          examinedBy: dashUser.id,
          examinedAt: new Date(),
          notes: input.notes ?? null,
        })
        .where(eq(exams.id, input.examId));

      // Check if participant has been showed — required for diplo/cert certificate
      const { showed: isShowed } = await getShowedStatusForContact(db, exam.ghlContactId, exam.courseType as "diplo" | "cert");

      let certId: number | null = null;
      let pdfUrl: string | null = null;

      if (isShowed) {
        // Both conditions met — issue certificate now
        try {
          const certResult = await issueCertificateForParticipant({
            ghlContactId: exam.ghlContactId,
            contactName: exam.contactName,
            contactEmail: exam.contactEmail,
            courseType: exam.courseType as "diplo" | "cert",
            language: exam.language,
            issuedBy: dashUser.id,
            examId: exam.id,
          });
          certId = certResult.id;
          console.log(`[exams] Certificate issued for ${exam.contactName} (showed + passed)`);
        } catch (e) {
          console.error("[exams] Certificate issuance failed:", e);
        }
      } else {
        console.log(`[exams] Exam passed for ${exam.contactName} but not showed yet — certificate deferred`);
      }

      // Legacy: keep a stub certificate record for backward compat if needed
      const [cert] = certId ? [{ id: certId }] : await db.insert(certificates).values({
        uuid: randomUUID().replace(/-/g, ""),
        ghlContactId: exam.ghlContactId,
        contactName: exam.contactName,
        contactEmail: exam.contactEmail ?? undefined,
        courseType: exam.courseType,
        language: exam.language,
        pdfUrl: pdfUrl ?? undefined,
        issuedBy: dashUser.id,
        examId: exam.id,
      }).$returningId();

      // Resolve real GHL contact ID if stored as email fallback
      let resolvedContactId = exam.ghlContactId;
      if (resolvedContactId.startsWith("email:") && exam.contactEmail) {
        try {
          const contact = await searchContactByEmail(exam.contactEmail);
          if (contact) {
            resolvedContactId = contact.id;
            // Update the stored contact ID for future use
            await db.update(exams).set({ ghlContactId: contact.id }).where(eq(exams.id, exam.id));
            console.log(`[exams] Resolved GHL contact ID for ${exam.contactEmail}: ${contact.id}`);
          }
        } catch (e) {
          console.error("[exams] Contact ID re-lookup failed:", e);
        }
      }

      // Set GHL tag — specific per courseType + language for certificate automation
      // Tags: exam-passed-diplomerad-fs-se, exam-passed-qualified-fs-en,
      //        exam-passed-certifierad-fs-se, exam-passed-certified-fs-en
      try {
        const langRaw = (exam.language ?? "en").toLowerCase();
        const isSv = langRaw === "sv" || langRaw === "svenska" || langRaw === "se";
        let tag: string;
        if (exam.courseType === "cert") {
          tag = isSv ? "exam-passed-certifierad-fs-se" : "exam-passed-certified-fs-en";
        } else {
          tag = isSv ? "exam-passed-diplomerad-fs-se" : "exam-passed-qualified-fs-en";
        }
        await setGhlTag(resolvedContactId, tag);
        console.log(`[exams] GHL tag set: ${tag} for contact ${resolvedContactId}`);
      } catch (e) {
        console.error("[exams] GHL tag set failed:", e);
      }

      // Send result email to student
      if (exam.contactEmail) {
        try {
          await sendExamResultEmail({
            contactId: resolvedContactId,
            contactEmail: exam.contactEmail,
            contactName: exam.contactName,
            courseType: exam.courseType as "diplo" | "cert",
            language: exam.language,
            result: "passed",
            feedback: input.notes ?? null,
          });
        } catch (e) {
          console.error("[exams] Result email (passed) failed:", e);
        }
      }

      return { success: true, certificateId: cert.id, pdfUrl, certificateIssued: isShowed };
    }),

  // ── Mark exam as failed ───────────────────────────────────────────────────
  markFailed: examinerProcedure
    .input(z.object({
      examId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [exam] = await db.select().from(exams).where(eq(exams.id, input.examId));
      if (!exam) throw new TRPCError({ code: "NOT_FOUND", message: "Exam not found" });
      if (exam.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Exam already graded" });

      await db.update(exams)
        .set({
          status: "failed",
          examinedBy: dashUser.id,
          examinedAt: new Date(),
          notes: input.notes ?? null,
        })
        .where(eq(exams.id, input.examId));

      // Resolve real GHL contact ID if stored as email fallback
      let resolvedContactId = exam.ghlContactId;
      if (resolvedContactId.startsWith("email:") && exam.contactEmail) {
        try {
          const contact = await searchContactByEmail(exam.contactEmail);
          if (contact) {
            resolvedContactId = contact.id;
            await db.update(exams).set({ ghlContactId: contact.id }).where(eq(exams.id, exam.id));
          }
        } catch (e) {
          console.error("[exams] Contact ID re-lookup failed:", e);
        }
      }

      // Send result email to student
      if (exam.contactEmail) {
        try {
          await sendExamResultEmail({
            contactId: resolvedContactId,
            contactEmail: exam.contactEmail,
            contactName: exam.contactName,
            courseType: exam.courseType as "diplo" | "cert",
            language: exam.language,
            result: "failed",
            feedback: input.notes ?? null,
          });
        } catch (e) {
          console.error("[exams] Result email (failed) failed:", e);
        }
      }

      return { success: true };
    }),

  // ── List certificates ─────────────────────────────────────────────────────
  listCertificates: examinerProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: certificates.id,
          ghlContactId: certificates.ghlContactId,
          contactName: certificates.contactName,
          contactEmail: certificates.contactEmail,
          courseType: certificates.courseType,
          language: certificates.language,
          pdfUrl: certificates.pdfUrl,
          issuedAt: certificates.issuedAt,
          issuedBy: certificates.issuedBy,
          issuerName: dashboardUsers.name,
        })
        .from(certificates)
        .leftJoin(dashboardUsers, eq(certificates.issuedBy, dashboardUsers.id))
        .orderBy(desc(certificates.issuedAt))
        .limit(input.limit);
      return rows;
    }),

  // ── Regenerate PDF for a certificate ─────────────────────────────────────
  regeneratePdf: adminProcedure
    .input(z.object({ certificateId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [cert] = await db.select().from(certificates).where(eq(certificates.id, input.certificateId));
      if (!cert) throw new TRPCError({ code: "NOT_FOUND" });

      const pdfUrl = await generateCertificatePdf({
        contactName: cert.contactName,
        courseType: cert.courseType as "intro" | "diplo" | "cert" | "vidare",
        language: cert.language,
        issuedAt: cert.issuedAt,
      });

      await db.update(certificates)
        .set({ pdfUrl })
        .where(eq(certificates.id, input.certificateId));

      return { pdfUrl };
    }),

  // ── Get exam status for a list of contacts (for participant overview) ─────────────
  getExamStatusByContacts: examinerProcedure
    .input(z.object({
      contactIds: z.array(z.string()),
      courseType: z.enum(["diplo", "cert"]),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return {} as Record<string, { examId: number; status: string }>;
      if (input.contactIds.length === 0) return {} as Record<string, { examId: number; status: string }>;
      const rows = await db
        .select({
          id: exams.id,
          ghlContactId: exams.ghlContactId,
          status: exams.status,
        })
        .from(exams)
        .where(
          and(
            eq(exams.courseType, input.courseType),
            inArray(exams.ghlContactId, input.contactIds)
          )
        );
      // Return map: contactId -> { examId, status } (prefer latest by id)
      const result: Record<string, { examId: number; status: string }> = {};
      for (const row of rows) {
        if (!result[row.ghlContactId] || row.id > result[row.ghlContactId].examId) {
          result[row.ghlContactId] = { examId: row.id, status: row.status };
        }
      }
      return result;
    }),
});
