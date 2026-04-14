import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { parse as parseCookies } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  loginUser,
  getSessionUser,
  deleteSession,
  createDashboardUser,
  getAllDashboardUsers,
  updateDashboardUser,
  hashNewPassword,
  createPasswordResetToken,
  resetPasswordWithToken,
  getUserByResetToken,
} from "./dashboardAuth";
import {
  getCalendars,
  getAllAppointments,
  getContact,
  getMonthRange,
  getPreviousMonths,
  detectCourseType,
  detectCurrency,
  extractCourseLeaderName,
  calculateBreakdown,
  getCourseCalendar,
  getCalendarGroups,
} from "./ghl";
import type { DashboardUser } from "../drizzle/schema";
import { courseDatesRouter } from "./routers/courseDates";
import { settlementsRouter } from "./routers/settlements";
import { examsRouter } from "./routers/exams";

// ─── Session cookie name for dashboard ───────────────────────────────────────
const DASH_SESSION = "fa_dash_session";

function getDashCookie(req: { headers: { cookie?: string } }): string | undefined {
  const cookies = parseCookies(req.headers.cookie ?? "");
  return cookies[DASH_SESSION];
}

// ─── Middleware: require dashboard session ────────────────────────────────────
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

// ─── Shared data fetcher ──────────────────────────────────────────────────────
async function fetchMonthData(year: number, month: number) {
  const { start, end } = getMonthRange(year, month);
  const [calendars, appointments] = await Promise.all([
    getCalendars(),
    getAllAppointments(start, end),
  ]);
  const calMap = new Map(calendars.map((c) => [c.id, c]));
  const showed = appointments.filter((a) => a.status === "showed");
  return { calendars, calMap, showed };
}

// ─── Payout calculation helper ────────────────────────────────────────────────
async function buildParticipantBreakdown(
  appt: { contactId: string; calendarId: string; customFields?: Array<{ id: string; value: string | number | string[] }> },
  calMap: Map<string, { id: string; name: string }>
) {
  const cal = calMap.get(appt.calendarId);
  if (!cal) return null;
  const currency = detectCurrency(cal.name);
  const courseType = detectCourseType(cal.name);
  const contact = await getContact(appt.contactId);
  const contactName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || "Unknown";

  // Check appointment-level customFields first (mock data), then contact-level
  const allFields = [...(appt.customFields ?? []), ...(contact?.customFields ?? [])];
  const paidField = allFields.find(
    (f) => f.id.toLowerCase().includes("paid_amount") || f.id.toLowerCase().includes("paidamount")
  );
  // 0 kr = intentional free booking (100% discount) — do NOT fall back to standard price
  // Only use standard price if the field is completely missing/null (unknown amount)
  const rawPaidValue = paidField?.value;
  const isMissingField = rawPaidValue === undefined || rawPaidValue === null || rawPaidValue === "";
  let paidAmount = isMissingField ? NaN : Number(rawPaidValue);
  if (isMissingField || isNaN(paidAmount)) {
    // Field missing — use standard price as fallback (data entry issue, not a free booking)
    if (courseType === "intro") paidAmount = currency === "SEK" ? 3500 : 350;
    else if (courseType === "diplo") paidAmount = currency === "SEK" ? 15000 : 1500;
    else if (courseType === "cert") paidAmount = currency === "SEK" ? 50000 : 5000;
    else paidAmount = currency === "SEK" ? 3500 : 350;
  }
  // If paidAmount is exactly 0 (free booking), keep it as 0 — FA margin still applies

  const affiliateField = allFields.find(
    (f) => f.id.toLowerCase().includes("affiliate_code") || f.id.toLowerCase().includes("affiliatecode")
  );
  const affiliateCode = affiliateField?.value ? String(affiliateField.value) : null;
  const b = calculateBreakdown(paidAmount, currency, courseType, affiliateCode);

  const { currency: _c, ...rest } = b;
  return { contactId: appt.contactId, contactName, affiliateCode, calendarName: cal.name, currency, courseType, ...rest };
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  // ── Manus OAuth (framework compatibility) ─────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Dashboard auth ─────────────────────────────────────────────────────────
  dashboard: router({
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const result = await loginUser(input.email, input.password);
        if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        ctx.res.cookie(DASH_SESSION, result.sessionId, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: "/",
        });
        return {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          affiliateCode: result.user.affiliateCode,
          ghlContactId: result.user.ghlContactId,
        };
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      const sessionId = getDashCookie(ctx.req);
      if (sessionId) await deleteSession(sessionId);
      ctx.res.clearCookie(DASH_SESSION, { path: "/" });
      return { success: true };
    }),

    me: publicProcedure.query(async ({ ctx }) => {
      const sessionId = getDashCookie(ctx.req);
      if (!sessionId) return null;
      const user = await getSessionUser(sessionId);
      if (!user) return null;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        affiliateCode: user.affiliateCode,
        ghlContactId: user.ghlContactId,
        isAffiliate: user.isAffiliate,
        canExamineExams: user.canExamineExams,
      };
    }),

    // Forgot password: creates a reset token and returns the reset URL
    // Admin is responsible for forwarding the link to the user
    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input, ctx }) => {
        const result = await createPasswordResetToken(input.email);
        // Always return success to avoid email enumeration
        if (!result) return { success: true };
        const origin = (ctx.req.headers.origin as string) || "https://fascidash-9qucsw5g.manus.space";
        const resetUrl = `${origin}/reset-password?token=${result.token}`;
        // Notify admin so they can forward the link
        try {
          const { notifyOwner } = await import("./_core/notification");
          await notifyOwner({
            title: `Password reset requested: ${result.userName}`,
            content: `${result.userName} requested a password reset.\n\nReset link (expires in 1 hour):\n${resetUrl}\n\nForward this link to the user.`,
          });
        } catch (_) { /* non-critical */ }
        return { success: true };
      }),

    // Verify a reset token is valid
    verifyResetToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const user = await getUserByResetToken(input.token);
        return { valid: !!user, name: user?.name ?? null };
      }),

    // Reset password using a valid token
    resetPassword: publicProcedure
      .input(z.object({ token: z.string(), newPassword: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const success = await resetPasswordWithToken(input.token, input.newPassword);
        if (!success) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset link" });
        return { success: true };
      }),
  }),

  // ── Admin procedures ───────────────────────────────────────────────────────
  admin: router({
    listUsers: adminProcedure.query(async () => getAllDashboardUsers()),

    createUser: adminProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
        role: z.enum(["admin", "course_leader", "affiliate"]),
        ghlContactId: z.string().optional(),
        affiliateCode: z.string().optional(),
        profileUrl: z.string().url().optional(),
        invoiceReference: z.string().optional(),
        isAffiliate: z.boolean().optional(),
        canExamineExams: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => createDashboardUser(input)),

    updateUser: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["admin", "course_leader", "affiliate"]).optional(),
        ghlContactId: z.string().optional(),
        affiliateCode: z.string().optional(),
        profileUrl: z.string().url().optional().nullable(),
        invoiceReference: z.string().optional().nullable(),
        isAffiliate: z.boolean().optional(),
        canExamineExams: z.boolean().optional(),
        active: z.boolean().optional(),
        password: z.string().min(6).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, password, ...updates } = input;
        const finalUpdates: Record<string, unknown> = { ...updates };
        if (password) finalUpdates.passwordHash = hashNewPassword(password);
        await updateDashboardUser(id, finalUpdates as Parameters<typeof updateDashboardUser>[1]);
        return { success: true };
      }),

    // Impersonate: create a short-lived session for another user and return the session ID
    impersonate: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const adminUser = (ctx as { dashUser: DashboardUser }).dashUser;
        // Store original admin session so we can restore it
        const originalSessionId = getDashCookie(ctx.req);
        // Create a new short-lived session (1 hour) for the target user
        const db = await import("./db").then((m) => m.getDb());
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { dashboardUsers: duTable } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const rows = await db.select().from(duTable).where(eqOp(duTable.id, input.userId)).limit(1);
        const targetUser = rows[0];
        if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        const { dashboardSessions: dsTable } = await import("../drizzle/schema");
        const { generateSessionId } = await import("./dashboardAuth");
        const sessionId = generateSessionId();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await db.insert(dsTable).values({ id: sessionId, userId: input.userId, expiresAt });
        // Set the impersonation cookie
        ctx.res.cookie(DASH_SESSION, sessionId, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 60 * 60 * 1000,
          path: "/",
        });
        // Also store original session in a separate cookie so admin can restore
        if (originalSessionId) {
          ctx.res.cookie("fa_dash_admin_session", originalSessionId, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 60 * 60 * 1000,
            path: "/",
          });
        }
        return {
          impersonating: { id: targetUser.id, name: targetUser.name, role: targetUser.role },
          adminName: adminUser.name,
        };
      }),

    // Check if currently impersonating (for frontend banner)
    checkImpersonation: publicProcedure.query(({ ctx }) => {
      const cookies = parseCookies(ctx.req.headers.cookie ?? "");
      const isImpersonating = !!cookies["fa_dash_admin_session"];
      return { isImpersonating };
    }),

    // Stop impersonating — restore the original admin session
    stopImpersonation: publicProcedure.mutation(async ({ ctx }) => {
      const cookies = parseCookies(ctx.req.headers.cookie ?? "");
      const adminSessionId = cookies["fa_dash_admin_session"];
      // Clear the impersonation session
      const impersonationSessionId = getDashCookie(ctx.req);
      if (impersonationSessionId) await deleteSession(impersonationSessionId);
      if (adminSessionId) {
        // Restore admin session
        ctx.res.cookie(DASH_SESSION, adminSessionId, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: "/",
        });
        ctx.res.clearCookie("fa_dash_admin_session", { path: "/" });
        return { restored: true };
      }
      ctx.res.clearCookie(DASH_SESSION, { path: "/" });
      return { restored: false };
    }),

    overview: adminProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(async ({ input }) => {
        const { showed, calMap } = await fetchMonthData(input.year, input.month);
        let totalRevSEK = 0, totalRevEUR = 0;
        let totalVATSEK = 0, totalVATEUR = 0;
        let totalTxSEK = 0, totalTxEUR = 0;
        let totalMarginSEK = 0, totalMarginEUR = 0;
        let totalAffSEK = 0, totalAffEUR = 0;
        let totalPaySEK = 0, totalPayEUR = 0;
        let count = 0;

        for (const appt of showed) {
          const b = await buildParticipantBreakdown(appt, calMap);
          if (!b) continue;
          count++;
          if (b.currency === "SEK") {
            totalRevSEK += b.paidAmountInclVAT;
            totalVATSEK += b.vatAmount;
            totalTxSEK += b.transactionFee;
            totalMarginSEK += b.faMargin;
            totalAffSEK += b.affiliateCommission;
            totalPaySEK += b.courseLeaderPayout;
          } else {
            totalRevEUR += b.paidAmountInclVAT;
            totalVATEUR += b.vatAmount;
            totalTxEUR += b.transactionFee;
            totalMarginEUR += b.faMargin;
            totalAffEUR += b.affiliateCommission;
            totalPayEUR += b.courseLeaderPayout;
          }
        }

        return {
          participantCount: count,
          revenue: { sek: totalRevSEK, eur: totalRevEUR },
          vat: { sek: totalVATSEK, eur: totalVATEUR },
          transactionFees: { sek: totalTxSEK, eur: totalTxEUR },
          faMargin: { sek: totalMarginSEK, eur: totalMarginEUR },
          affiliateCommissions: { sek: totalAffSEK, eur: totalAffEUR },
          courseLeaderPayouts: { sek: totalPaySEK, eur: totalPayEUR },
        };
      }),

    courseLeaderRanking: adminProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(async ({ input }) => {
        const { showed, calMap } = await fetchMonthData(input.year, input.month);
        const leaderMap = new Map<string, { name: string; participants: number; revSEK: number; revEUR: number; payoutSEK: number; payoutEUR: number }>();

        for (const appt of showed) {
          const b = await buildParticipantBreakdown(appt, calMap);
          if (!b) continue;
          const cal = calMap.get(appt.calendarId)!;
          const leaderName = extractCourseLeaderName(cal.name);
          if (!leaderMap.has(leaderName)) {
            leaderMap.set(leaderName, { name: leaderName, participants: 0, revSEK: 0, revEUR: 0, payoutSEK: 0, payoutEUR: 0 });
          }
          const e = leaderMap.get(leaderName)!;
          e.participants++;
          if (b.currency === "SEK") { e.revSEK += b.paidAmountInclVAT; e.payoutSEK += b.courseLeaderPayout; }
          else { e.revEUR += b.paidAmountInclVAT; e.payoutEUR += b.courseLeaderPayout; }
        }
        return Array.from(leaderMap.values()).sort((a, b) => b.participants - a.participants);
      }),

    affiliateRanking: adminProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(async ({ input }) => {
        const { showed, calMap } = await fetchMonthData(input.year, input.month);
        const affMap = new Map<string, { code: string; bookings: number; commSEK: number; commEUR: number }>();

        for (const appt of showed) {
          const b = await buildParticipantBreakdown(appt, calMap);
          if (!b || !b.affiliateCode) continue;
          const code = b.affiliateCode;
          if (!affMap.has(code)) affMap.set(code, { code, bookings: 0, commSEK: 0, commEUR: 0 });
          const e = affMap.get(code)!;
          e.bookings++;
          if (b.currency === "SEK") e.commSEK += b.affiliateCommission;
          else e.commEUR += b.affiliateCommission;
        }
        return Array.from(affMap.values()).sort((a, b) => b.bookings - a.bookings);
      }),

    monthlyHistory: adminProcedure
      .input(z.object({ months: z.number().min(1).max(24).default(12) }))
      .query(async ({ input }) => {
        const periods = getPreviousMonths(input.months);
        const results = [];
        for (const period of periods) {
          const { showed, calMap } = await fetchMonthData(period.year, period.month);
          let revSEK = 0, revEUR = 0, payoutSEK = 0, payoutEUR = 0, commSEK = 0, commEUR = 0, count = 0;
          for (const appt of showed) {
            const b = await buildParticipantBreakdown(appt, calMap);
            if (!b) continue;
            count++;
            if (b.currency === "SEK") { revSEK += b.paidAmountInclVAT; payoutSEK += b.courseLeaderPayout; commSEK += b.affiliateCommission; }
            else { revEUR += b.paidAmountInclVAT; payoutEUR += b.courseLeaderPayout; commEUR += b.affiliateCommission; }
          }
          results.push({ label: period.label, year: period.year, month: period.month, participants: count, revenueSEK: revSEK, revenueEUR: revEUR, payoutSEK, payoutEUR, commissionSEK: commSEK, commissionEUR: commEUR });
        }
        return results;
      }),

    upcomingCourses: adminProcedure.query(async () => {
      const now = new Date();
      const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const [calendars, appointments] = await Promise.all([
        getCalendars(),
        getAllAppointments(now.toISOString(), end.toISOString()),
      ]);
      const calMap = new Map(calendars.map((c) => [c.id, c]));
      const grouped = new Map<string, { calendarId: string; calendarName: string; courseLeader: string; courseType: string; currency: string; appointments: Array<{ id: string; startTime: string; status: string }> }>();

      // Exclude only hard-cancelled or no-show statuses; show confirmed, showed, booked, new etc.
      const EXCLUDE_STATUSES = new Set(["cancelled", "no_show", "noshow", "invalid"]);
      for (const appt of appointments) {
        const status = (appt.appointmentStatus ?? appt.status ?? "").toLowerCase();
        if (EXCLUDE_STATUSES.has(status)) continue;
        const cal = calMap.get(appt.calendarId);
        if (!cal) continue;
        if (!grouped.has(appt.calendarId)) {
          grouped.set(appt.calendarId, {
            calendarId: appt.calendarId,
            calendarName: cal.name,
            courseLeader: extractCourseLeaderName(cal.name),
            courseType: detectCourseType(cal.name),
            currency: detectCurrency(cal.name),
            appointments: [],
          });
        }
        grouped.get(appt.calendarId)!.appointments.push({ id: appt.id, startTime: appt.startTime, status: appt.status });
      }
      return Array.from(grouped.values()).sort((a, b) => (a.appointments[0]?.startTime ?? "").localeCompare(b.appointments[0]?.startTime ?? ""));
    }),

    courseCalendar: adminProcedure
      .input(z.object({
        startMs: z.number(),
        endMs: z.number(),
        courseType: z.string().optional(), // filter by course type
        groupId: z.string().optional(),    // filter by calendar group
      }))
      .query(async ({ input }) => {
        const [slots, groups] = await Promise.all([
          getCourseCalendar(input.startMs, input.endMs),
          getCalendarGroups(),
        ]);
        let filtered = slots;
        if (input.courseType) {
          filtered = filtered.filter(s => detectCourseType(s.calendarName) === input.courseType);
        }
        if (input.groupId) {
          // We need calendar groupId — enrich from calendars
          const cals = await getCalendars();
          const calGroupMap = new Map(cals.map(c => [c.id, c.groupId ?? ""]));
          filtered = filtered.filter(s => calGroupMap.get(s.calendarId) === input.groupId);
        }
        return { slots: filtered, groups };
      }),
  }),

  // ── Course Leader ──────────────────────────────────────────────────────────
  courseLeader: router({
    myData: dashboardProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(async ({ input, ctx }) => {
        const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
        if (dashUser.role !== "admin" && dashUser.role !== "course_leader") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const { showed, calMap } = await fetchMonthData(input.year, input.month);
        const myName = dashUser.name;

        // Match calendars by:
        // 1. Name extracted from calendar title ("Intro - Victor Forsell - Stockholm" → "Victor Forsell")
        // 2. Exact calendar name match (for multi-leader calendars like "Fascia Academy Sollentuna")
        //    stored as ghlContactId field (we repurpose it for calendar ID override)
        const calendarIdOverride = dashUser.ghlContactId; // admin can set this to a specific calendarId
        const myCals = Array.from(calMap.values()).filter((c) => {
          if (calendarIdOverride && c.id === calendarIdOverride) return true;
          return extractCourseLeaderName(c.name).toLowerCase().trim() === myName.toLowerCase().trim();
        });
        const myCalIds = new Set(myCals.map((c) => c.id));
        const myAppts = showed.filter((a) => myCalIds.has(a.calendarId));

        const courseMap = new Map<string, { calendarName: string; courseType: string; currency: "SEK" | "EUR"; participants: Array<{ contactId: string; contactName: string; paidAmountInclVAT: number; paidAmountExclVAT: number; vatAmount: number; transactionFee: number; faMargin: number; affiliateCommission: number; affiliateCode: string | null; courseLeaderPayout: number; currency: "SEK" | "EUR" }>; totalPayout: number }>();

        for (const appt of myAppts) {
          const b = await buildParticipantBreakdown(appt, calMap);
          if (!b) continue;
          if (!courseMap.has(appt.calendarId)) {
            courseMap.set(appt.calendarId, { calendarName: b.calendarName, courseType: b.courseType, currency: b.currency, participants: [], totalPayout: 0 });
          }
          const entry = courseMap.get(appt.calendarId)!;
          entry.participants.push({ contactId: b.contactId, contactName: b.contactName, paidAmountInclVAT: b.paidAmountInclVAT, paidAmountExclVAT: b.paidAmountExclVAT, vatAmount: b.vatAmount, transactionFee: b.transactionFee, faMargin: b.faMargin, affiliateCommission: b.affiliateCommission, affiliateCode: b.affiliateCode, courseLeaderPayout: b.courseLeaderPayout, currency: b.currency });
          entry.totalPayout += b.courseLeaderPayout;
        }

        return { courseLeaderName: myName, courses: Array.from(courseMap.values()) };
      }),
  }),

  // ── Affiliate ──────────────────────────────────────────────────────────────
  affiliate: router({
    myData: dashboardProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(async ({ input, ctx }) => {
        const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
        if (dashUser.role !== "admin" && dashUser.role !== "affiliate") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const myCode = dashUser.affiliateCode;
        if (!myCode) return { affiliateCode: null, bookings: [], totalSEK: 0, totalEUR: 0 };

        const { showed, calMap } = await fetchMonthData(input.year, input.month);
        const bookings = [];
        let totalSEK = 0, totalEUR = 0;

        for (const appt of showed) {
          const b = await buildParticipantBreakdown(appt, calMap);
          if (!b || b.affiliateCode !== myCode) continue;
          const cal = calMap.get(appt.calendarId)!;
          bookings.push({ contactId: b.contactId, contactName: b.contactName, courseName: cal.name, courseType: b.courseType, paidAmountInclVAT: b.paidAmountInclVAT, paidAmountExclVAT: b.paidAmountExclVAT, commission: b.affiliateCommission, currency: b.currency });
          if (b.currency === "SEK") totalSEK += b.affiliateCommission;
          else totalEUR += b.affiliateCommission;
        }

        return { affiliateCode: myCode, bookings, totalSEK, totalEUR };
      }),
  }),
  courseDates: courseDatesRouter,
  settlements: settlementsRouter,
  exams: examsRouter,
});

export type AppRouter = typeof appRouter;

