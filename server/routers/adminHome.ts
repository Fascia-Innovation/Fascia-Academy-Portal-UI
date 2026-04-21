/**
 * Admin Home router — aggregated data for the admin home dashboard.
 * Returns pending task counts, upcoming courses (7 days), monthly stats,
 * and a recent activity log.
 */

import { TRPCError } from "@trpc/server";
import { eq, and, gte, lte, sql, desc, or } from "drizzle-orm";
import { router, publicProcedure } from "../_core/trpc";
import { parse as parseCookies } from "cookie";
import { getSessionUser } from "../dashboardAuth";
import { getDb } from "../db";
import {
  courseDates,
  settlements,
  courseLeaderMessages,
  dashboardUsers,
  courseParticipantSnapshots,
  type DashboardUser,
} from "../../drizzle/schema";

const DASH_SESSION = "fa_dash_session";

function getDashCookie(req: { headers: { cookie?: string } }): string | undefined {
  const cookies = parseCookies(req.headers.cookie ?? "");
  return cookies[DASH_SESSION];
}

async function requireAdmin(ctx: { req: { headers: { cookie?: string } } }): Promise<DashboardUser> {
  const sessionId = getDashCookie(ctx.req);
  if (!sessionId) throw new TRPCError({ code: "UNAUTHORIZED" });
  const user = await getSessionUser(sessionId);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
  if ((user as DashboardUser).role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return user as DashboardUser;
}

export const adminHomeRouter = router({
  /**
   * Returns all data needed for the admin home page in a single query.
   */
  summary: publicProcedure.query(async ({ ctx }) => {
    await requireAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const now = new Date();
    const nowMs = now.getTime();

    // ── 1. Pending task counts ────────────────────────────────────────────────
    const pendingCourseStatuses = ["pending_approval", "pending_cancellation", "pending_reschedule", "resubmitted"];
    const [pendingCoursesRows, pendingSettlementsRows, pendingMessagesRows] = await Promise.all([
      db
        .select({ id: courseDates.id })
        .from(courseDates)
        .where(
          or(
            eq(courseDates.status, "pending_approval"),
            eq(courseDates.status, "pending_cancellation"),
            eq(courseDates.status, "pending_reschedule"),
          )
        ),
      db
        .select({ id: settlements.id })
        .from(settlements)
        .where(eq(settlements.status, "pending")),
      db
        .select({ id: courseLeaderMessages.id })
        .from(courseLeaderMessages)
        .where(eq(courseLeaderMessages.status, "pending_approval")),
    ]);

    // ── 1b. Courses starting within 24h that have no snapshot ─────────────────
    const in24h = new Date(nowMs + 24 * 60 * 60 * 1000);
    const approvedStartingSoon = await db
      .select({ id: courseDates.id })
      .from(courseDates)
      .where(
        and(
          eq(courseDates.status, "approved"),
          gte(courseDates.startDate, now),
          lte(courseDates.startDate, in24h),
        )
      );
    let missingSnapshotCount = 0;
    if (approvedStartingSoon.length > 0) {
      const soonIds = approvedStartingSoon.map((r) => r.id);
      const snapshotted = await db
        .selectDistinct({ courseDateId: courseParticipantSnapshots.courseDateId })
        .from(courseParticipantSnapshots)
        .where(sql`${courseParticipantSnapshots.courseDateId} IN (${sql.join(soonIds.map((id) => sql`${id}`), sql`, `)})`);
      const snapshotIds = new Set(snapshotted.map((s) => s.courseDateId));
      missingSnapshotCount = soonIds.filter((id) => !snapshotIds.has(id)).length;
    }
    const pendingTasks = {
      courseSubmissions: pendingCoursesRows.length,
      settlements: pendingSettlementsRows.length,
      messages: pendingMessagesRows.length,
      missingSnapshots: missingSnapshotCount,
      total: pendingCoursesRows.length + pendingSettlementsRows.length + pendingMessagesRows.length + missingSnapshotCount,
    };

    // ── 2. Upcoming courses (next 7 days) ─────────────────────────────────────
    const sevenDaysLater = new Date(nowMs + 7 * 24 * 60 * 60 * 1000);
    const upcomingRows = await db
      .select({
        id: courseDates.id,
        courseLeaderName: courseDates.courseLeaderName,
        courseType: courseDates.courseType,
        language: courseDates.language,
        city: courseDates.city,
        startDate: courseDates.startDate,
        endDate: courseDates.endDate,
        maxSeats: courseDates.maxSeats,
        bookedSeats: courseDates.bookedSeats,
        venueName: courseDates.venueName,
        status: courseDates.status,
        published: courseDates.published,
      })
      .from(courseDates)
      .where(
        and(
          gte(courseDates.startDate, now),
          lte(courseDates.startDate, sevenDaysLater),
          eq(courseDates.published, true),
        )
      )
      .orderBy(courseDates.startDate)
      .limit(20);

    // ── 3. Monthly overview (current calendar month) ──────────────────────────
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [monthlySettlementsRows, approvedThisMonthRows, activeLeadersRows] = await Promise.all([
      // Settlements generated this month (pending + approved)
      db
        .select({
          id: settlements.id,
          status: settlements.status,
          totalPayout: settlements.totalPayout,
          currency: settlements.currency,
          participantCount: settlements.participantCount,
          userType: settlements.userType,
        })
        .from(settlements)
        .where(
          and(
            eq(settlements.periodYear, now.getFullYear()),
            eq(settlements.periodMonth, now.getMonth() + 1),
            sql`${settlements.status} != 'amended'`
          )
        ),
      // Courses approved/active this month
      db
        .select({ id: courseDates.id, courseLeaderName: courseDates.courseLeaderName })
        .from(courseDates)
        .where(
          and(
            gte(courseDates.startDate, monthStart),
            lte(courseDates.startDate, monthEnd),
            eq(courseDates.status, "approved"),
          )
        ),
      // Active course leaders (have at least one published course this month)
      db
        .select({ courseLeaderName: courseDates.courseLeaderName })
        .from(courseDates)
        .where(
          and(
            gte(courseDates.startDate, monthStart),
            lte(courseDates.startDate, monthEnd),
            eq(courseDates.published, true),
          )
        )
        .groupBy(courseDates.courseLeaderName),
    ]);

    const totalPayoutSEK = monthlySettlementsRows
      .filter((r) => r.currency === "SEK")
      .reduce((s, r) => s + parseFloat(r.totalPayout ?? "0"), 0);
    const totalPayoutEUR = monthlySettlementsRows
      .filter((r) => r.currency === "EUR")
      .reduce((s, r) => s + parseFloat(r.totalPayout ?? "0"), 0);
    const totalParticipants = monthlySettlementsRows.reduce((s, r) => s + (r.participantCount ?? 0), 0);

    const monthlyOverview = {
      coursesThisMonth: approvedThisMonthRows.length,
      activeLeaders: activeLeadersRows.length,
      settlementsGenerated: monthlySettlementsRows.length,
      settlementsApproved: monthlySettlementsRows.filter((r) => r.status === "approved").length,
      totalParticipants,
      totalPayoutSEK: Math.round(totalPayoutSEK),
      totalPayoutEUR: Math.round(totalPayoutEUR * 100) / 100,
    };

    // ── 4. Activity log (last 15 events across all tables) ────────────────────
    // Gather recent course date changes
    const recentCourses = await db
      .select({
        id: courseDates.id,
        courseLeaderName: courseDates.courseLeaderName,
        courseType: courseDates.courseType,
        city: courseDates.city,
        status: courseDates.status,
        startDate: courseDates.startDate,
        updatedAt: courseDates.updatedAt,
        createdAt: courseDates.createdAt,
      })
      .from(courseDates)
      .orderBy(desc(courseDates.updatedAt))
      .limit(10);

    const recentSettlements = await db
      .select({
        id: settlements.id,
        userId: settlements.userId,
        userType: settlements.userType,
        status: settlements.status,
        periodYear: settlements.periodYear,
        periodMonth: settlements.periodMonth,
        totalPayout: settlements.totalPayout,
        currency: settlements.currency,
        generatedAt: settlements.generatedAt,
        approvedAt: settlements.approvedAt,
      })
      .from(settlements)
      .orderBy(desc(settlements.generatedAt))
      .limit(10);

    // Enrich settlements with user names
    const userIds = Array.from(new Set(recentSettlements.map((s) => s.userId)));
    let userMap: Record<number, string> = {};
    if (userIds.length > 0) {
      const users = await db
        .select({ id: dashboardUsers.id, name: dashboardUsers.name })
        .from(dashboardUsers)
        .where(sql`${dashboardUsers.id} IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`);
      userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
    }

    const recentMessages = await db
      .select({
        id: courseLeaderMessages.id,
        authorId: courseLeaderMessages.authorId,
        subject: courseLeaderMessages.subject,
        status: courseLeaderMessages.status,
        updatedAt: courseLeaderMessages.updatedAt,
        createdAt: courseLeaderMessages.createdAt,
      })
      .from(courseLeaderMessages)
      .orderBy(desc(courseLeaderMessages.updatedAt))
      .limit(5);

    // Enrich messages with author names
    const msgAuthorIds = Array.from(new Set(recentMessages.map((m) => m.authorId)));
    let msgAuthorMap: Record<number, string> = {};
    if (msgAuthorIds.length > 0) {
      const authors = await db
        .select({ id: dashboardUsers.id, name: dashboardUsers.name })
        .from(dashboardUsers)
        .where(sql`${dashboardUsers.id} IN (${sql.join(msgAuthorIds.map((id) => sql`${id}`), sql`, `)})`);
      msgAuthorMap = Object.fromEntries(authors.map((u) => [u.id, u.name]));
    }

    // Build unified activity log entries
    type ActivityEntry = {
      id: string;
      type: "course_submitted" | "course_approved" | "course_cancelled" | "course_pending_cancel" | "course_needs_revision" | "settlement_generated" | "settlement_approved" | "message_submitted" | "message_approved" | "message_rejected";
      title: string;
      subtitle: string;
      href: string;
      timestamp: Date;
    };

    const activities: ActivityEntry[] = [];

    for (const c of recentCourses) {
      const courseLabel = `${c.courseType.charAt(0).toUpperCase() + c.courseType.slice(1)} — ${c.city}`;
      const ts = c.updatedAt ?? c.createdAt;
      if (c.status === "pending_approval") {
        activities.push({ id: `cd-${c.id}`, type: "course_submitted", title: `Course submission: ${c.courseLeaderName}`, subtitle: courseLabel, href: "/pending-actions", timestamp: ts });
      } else if (c.status === "approved") {
        activities.push({ id: `cd-${c.id}`, type: "course_approved", title: `Course approved: ${c.courseLeaderName}`, subtitle: courseLabel, href: "/course-dates", timestamp: ts });
      } else if (c.status === "cancelled") {
        activities.push({ id: `cd-${c.id}`, type: "course_cancelled", title: `Course cancelled: ${c.courseLeaderName}`, subtitle: courseLabel, href: "/course-dates", timestamp: ts });
      } else if (c.status === "pending_cancellation") {
        activities.push({ id: `cd-${c.id}`, type: "course_pending_cancel", title: `Cancellation request: ${c.courseLeaderName}`, subtitle: courseLabel, href: "/pending-actions", timestamp: ts });
      } else if (c.status === "needs_revision") {
        activities.push({ id: `cd-${c.id}`, type: "course_needs_revision", title: `Revision requested: ${c.courseLeaderName}`, subtitle: courseLabel, href: "/pending-actions", timestamp: ts });
      }
    }

    for (const s of recentSettlements) {
      const userName = userMap[s.userId] ?? `User #${s.userId}`;
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const period = `${monthNames[(s.periodMonth ?? 1) - 1]} ${s.periodYear}`;
      if (s.status === "approved" && s.approvedAt) {
        activities.push({ id: `st-${s.id}`, type: "settlement_approved", title: `Settlement approved: ${userName}`, subtitle: `${period} · ${Math.round(parseFloat(s.totalPayout ?? "0")).toLocaleString("sv-SE")} ${s.currency}`, href: "/settlements", timestamp: s.approvedAt });
      } else if (s.status === "pending" && s.generatedAt) {
        activities.push({ id: `st-${s.id}`, type: "settlement_generated", title: `Settlement generated: ${userName}`, subtitle: `${period} · ${Math.round(parseFloat(s.totalPayout ?? "0")).toLocaleString("sv-SE")} ${s.currency}`, href: "/settlements", timestamp: s.generatedAt });
      }
    }

    for (const m of recentMessages) {
      const authorName = msgAuthorMap[m.authorId] ?? `User #${m.authorId}`;
      const ts = m.updatedAt ?? m.createdAt;
      if (m.status === "pending_approval") {
        activities.push({ id: `msg-${m.id}`, type: "message_submitted", title: `Message for approval: ${authorName}`, subtitle: m.subject, href: "/pending-actions", timestamp: ts });
      } else if (m.status === "approved") {
        activities.push({ id: `msg-${m.id}`, type: "message_approved", title: `Message approved: ${authorName}`, subtitle: m.subject, href: "/pending-actions", timestamp: ts });
      } else if (m.status === "rejected") {
        activities.push({ id: `msg-${m.id}`, type: "message_rejected", title: `Message rejected: ${authorName}`, subtitle: m.subject, href: "/pending-actions", timestamp: ts });
      }
    }

    // Sort by timestamp desc, take top 15
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const activityLog = activities.slice(0, 15);

    return {
      pendingTasks,
      upcomingCourses: upcomingRows,
      monthlyOverview,
      activityLog,
      currentMonth: now.getMonth() + 1,
      currentYear: now.getFullYear(),
    };
  }),
});
