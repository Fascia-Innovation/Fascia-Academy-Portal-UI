/**
 * Course Leader Messages Router
 *
 * Allows course leaders to compose and submit messages to their course participants.
 * Messages go through an admin approval queue before being sent via GHL email.
 *
 * Flow:
 *   Course leader: compose (draft) → submit (pending_approval)
 *   Admin: review → approve (and optionally edit) → send  |  reject (with note)
 *   Course leader: can resubmit rejected messages after editing
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { courseLeaderMessages, courseDates, courseParticipantSnapshots, dashboardUsers } from "../../drizzle/schema";
import type { DashboardUser } from "../../drizzle/schema";
import { parse as parseCookies } from "cookie";
import { getSessionUser } from "../dashboardAuth";
import { notifyOwner } from "../_core/notification";

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

// GHL API helpers
const GHL_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY ?? "";
const LOCATION_ID = process.env.GHL_LOCATION_ID ?? "";

/**
 * Send an email to a GHL contact via the GHL Conversations API.
 * Returns true on success, false on failure.
 */
async function sendGhlEmail(contactId: string, subject: string, body: string): Promise<boolean> {
  try {
    const res = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Version: "2023-02-21",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        type: "Email",
        contactId,
        emailFrom: "info@fasciaacademy.com",
        subject,
        html: body.replace(/\n/g, "<br>"),
        message: body,
        status: "pending",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[sendGhlEmail] GHL error ${res.status}: ${text}`);
    }
    return res.ok;
  } catch (err) {
    console.error(`[sendGhlEmail] Error:`, err);
    return false;
  }
}

export const courseMessagesRouter = router({
  // ─── Course leader: list messages for a course date ────────────────────────
  listForCourse: dashboardProcedure
    .input(z.object({ courseDateId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      // Verify access: admin or owning course leader
      const courseRows = await db.select().from(courseDates).where(eq(courseDates.id, input.courseDateId));
      const course = courseRows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (
        dashUser.role !== "admin" &&
        course.courseLeaderName.toLowerCase().trim() !== dashUser.name.toLowerCase().trim() &&
        course.submittedBy !== dashUser.id
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const messages = await db
        .select()
        .from(courseLeaderMessages)
        .where(eq(courseLeaderMessages.courseDateId, input.courseDateId))
        .orderBy(desc(courseLeaderMessages.createdAt));

      return { messages };
    }),

  // ─── Admin: list all pending messages for approval queue ──────────────────
  listPending: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const messages = await db
      .select()
      .from(courseLeaderMessages)
      .where(eq(courseLeaderMessages.status, "pending_approval"))
      .orderBy(desc(courseLeaderMessages.createdAt));

    // Enrich with course date info
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const courseRows = await db.select().from(courseDates).where(eq(courseDates.id, msg.courseDateId));
        const course = courseRows[0];
        const authorRows = await db.select().from(dashboardUsers).where(eq(dashboardUsers.id, msg.authorId));
        const author = authorRows[0];
        return {
          ...msg,
          courseLeaderName: course?.courseLeaderName ?? "Unknown",
          courseType: course?.courseType ?? "unknown",
          courseCity: course?.city ?? "",
          courseStartDate: course?.startDate?.toISOString() ?? null,
          authorName: author?.name ?? "Unknown",
        };
      })
    );

    return { messages: enriched };
  }),

  // ─── Course leader: get participant count for a course (for compose UI) ───
  getRecipientCount: dashboardProcedure
    .input(z.object({ courseDateId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const courseRows = await db.select().from(courseDates).where(eq(courseDates.id, input.courseDateId));
      const course = courseRows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (
        dashUser.role !== "admin" &&
        course.courseLeaderName.toLowerCase().trim() !== dashUser.name.toLowerCase().trim() &&
        course.submittedBy !== dashUser.id
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Use snapshot if available, otherwise return 0 (will be fetched live at send time)
      const snapshotRows = await db
        .select({ id: courseParticipantSnapshots.id, email: courseParticipantSnapshots.email })
        .from(courseParticipantSnapshots)
        .where(eq(courseParticipantSnapshots.courseDateId, input.courseDateId));

      return {
        recipientCount: snapshotRows.length,
        hasSnapshot: snapshotRows.length > 0,
        emailCount: snapshotRows.filter((r) => r.email).length,
      };
    }),

  // ─── Course leader: save draft or submit for approval ─────────────────────
  saveOrSubmit: dashboardProcedure
    .input(
      z.object({
        courseDateId: z.number().int(),
        subject: z.string().min(1).max(500),
        body: z.string().min(1),
        action: z.enum(["draft", "submit"]),
        messageId: z.number().int().optional(), // if editing existing
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const courseRows = await db.select().from(courseDates).where(eq(courseDates.id, input.courseDateId));
      const course = courseRows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (
        dashUser.role !== "admin" &&
        course.courseLeaderName.toLowerCase().trim() !== dashUser.name.toLowerCase().trim() &&
        course.submittedBy !== dashUser.id
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const newStatus = input.action === "submit" ? "pending_approval" : "draft";

      if (input.messageId) {
        // Update existing message (only if draft or rejected)
        const existing = await db
          .select()
          .from(courseLeaderMessages)
          .where(eq(courseLeaderMessages.id, input.messageId));
        const msg = existing[0];
        if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
        if (msg.authorId !== dashUser.id && dashUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (!["draft", "rejected"].includes(msg.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit a message that is pending or sent" });
        }
        await db
          .update(courseLeaderMessages)
          .set({ subject: input.subject, body: input.body, status: newStatus, adminNote: null })
          .where(eq(courseLeaderMessages.id, input.messageId));

        if (input.action === "submit") {
          await notifyOwner({
            title: "Message submitted for approval",
            content: `${dashUser.name} submitted a message for course ${course.courseLeaderName} — ${course.city} (${new Date(course.startDate).toLocaleDateString()}). Subject: "${input.subject}"`,
          });
        }
        return { messageId: input.messageId, status: newStatus };
      }

      // Create new message
      const [result] = await db.insert(courseLeaderMessages).values({
        courseDateId: input.courseDateId,
        authorId: dashUser.id,
        subject: input.subject,
        body: input.body,
        status: newStatus,
      });

      const newId = (result as any).insertId as number;

      if (input.action === "submit") {
        await notifyOwner({
          title: "Message submitted for approval",
          content: `${dashUser.name} submitted a message for course ${course.courseLeaderName} — ${course.city} (${new Date(course.startDate).toLocaleDateString()}). Subject: "${input.subject}"`,
        });
      }

      return { messageId: newId, status: newStatus };
    }),

  // ─── Admin: approve (optionally edit) and send ────────────────────────────
  approveAndSend: adminProcedure
    .input(
      z.object({
        messageId: z.number().int(),
        subject: z.string().min(1).max(500).optional(), // admin may edit
        body: z.string().min(1).optional(),             // admin may edit
        adminNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const existing = await db
        .select()
        .from(courseLeaderMessages)
        .where(eq(courseLeaderMessages.id, input.messageId));
      const msg = existing[0];
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      if (msg.status !== "pending_approval") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Message is not pending approval" });
      }

      const finalSubject = input.subject ?? msg.subject;
      const finalBody = input.body ?? msg.body;

      // Get participants from snapshot
      const snapshotRows = await db
        .select()
        .from(courseParticipantSnapshots)
        .where(eq(courseParticipantSnapshots.courseDateId, msg.courseDateId));

      const recipients = snapshotRows.filter((r) => r.email && r.ghlContactId);

      // Send emails via GHL
      let sentCount = 0;
      const errors: string[] = [];
      for (const r of recipients) {
        if (!r.email || !r.ghlContactId) continue;
        const ok = await sendGhlEmail(r.ghlContactId, finalSubject, finalBody);
        if (ok) sentCount++;
        else errors.push(r.email);
      }

      // Update message record
      await db
        .update(courseLeaderMessages)
        .set({
          subject: finalSubject,
          body: finalBody,
          status: "approved",
          adminNote: input.adminNote ?? null,
          reviewedBy: dashUser.id,
          reviewedAt: new Date(),
          sentAt: new Date(),
          recipientCount: sentCount,
        })
        .where(eq(courseLeaderMessages.id, input.messageId));

      return { sentCount, errors, total: recipients.length };
    }),

  // ─── Admin: reject with note ───────────────────────────────────────────────
  reject: adminProcedure
    .input(
      z.object({
        messageId: z.number().int(),
        adminNote: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const existing = await db
        .select()
        .from(courseLeaderMessages)
        .where(eq(courseLeaderMessages.id, input.messageId));
      const msg = existing[0];
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      if (msg.status !== "pending_approval") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Message is not pending approval" });
      }

      await db
        .update(courseLeaderMessages)
        .set({
          status: "rejected",
          adminNote: input.adminNote,
          reviewedBy: dashUser.id,
          reviewedAt: new Date(),
        })
        .where(eq(courseLeaderMessages.id, input.messageId));

      return { success: true };
    }),
});
