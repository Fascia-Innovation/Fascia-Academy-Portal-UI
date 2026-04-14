/**
 * Exam queue and certificate procedures.
 *
 * Access rules:
 *   - admin: full access to all procedures
 *   - canExamineExams: can list/grade pending exams and view certificates
 *   - course_leader: no access
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { parse as parseCookies } from "cookie";
import { publicProcedure, router } from "../_core/trpc";
import { getSessionUser } from "../dashboardAuth";
import type { DashboardUser } from "../../drizzle/schema";
import { getDb } from "../db";
import { exams, certificates } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { generateCertificatePdf } from "../certificatePdf";
import { setGhlTag } from "../ghl";

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

export const examsRouter = router({
  // ── List pending exams (examiner queue) ──────────────────────────────────
  listPending: examinerProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(exams)
      .where(eq(exams.status, "pending"))
      .orderBy(exams.createdAt);
  }),

  // ── List all exams (admin/examiner overview) ──────────────────────────────
  listAll: examinerProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(exams)
        .orderBy(desc(exams.createdAt))
        .limit(input.limit);
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

      // Generate PDF certificate
      let pdfUrl: string | null = null;
      try {
        pdfUrl = await generateCertificatePdf({
          contactName: exam.contactName,
          courseType: exam.courseType as "diplo" | "cert",
          language: exam.language,
          issuedAt: new Date(),
        });
      } catch (e) {
        console.error("[exams] PDF generation failed:", e);
      }

      // Create certificate record
      const [cert] = await db.insert(certificates).values({
        ghlContactId: exam.ghlContactId,
        contactName: exam.contactName,
        contactEmail: exam.contactEmail ?? undefined,
        courseType: exam.courseType,
        language: exam.language,
        pdfUrl: pdfUrl ?? undefined,
        issuedBy: dashUser.id,
        examId: exam.id,
      }).$returningId();

      // Set GHL tag
      try {
        const tag = exam.courseType === "cert"
          ? "exam-passed-certified-fs"
          : "exam-passed-qualified-fs";
        await setGhlTag(exam.ghlContactId, tag);
      } catch (e) {
        console.error("[exams] GHL tag set failed:", e);
      }

      return { success: true, certificateId: cert.id, pdfUrl };
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

      return { success: true };
    }),

  // ── List certificates ─────────────────────────────────────────────────────
  listCertificates: examinerProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(certificates)
        .orderBy(desc(certificates.issuedAt))
        .limit(input.limit);
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
});
