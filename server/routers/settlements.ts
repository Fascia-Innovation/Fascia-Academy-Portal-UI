/**
 * Settlements router — generate, list, approve, adjust, and amend settlements
 * for course leaders and affiliates.
 *
 * Uses the same calculation logic as the existing MyCourses payout view
 * (buildParticipantBreakdown in routers.ts / calculateBreakdown in ghl.ts).
 *
 * Key rule: 0 kr paid = intentional free booking → payout = -FA_MARGIN
 *           null/empty paid = missing data → flagged, treated as 0
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, sql } from "drizzle-orm";
import { router, publicProcedure } from "../_core/trpc";
import { parse as parseCookies } from "cookie";
import { getSessionUser, getAllDashboardUsers } from "../dashboardAuth";
import { getDb } from "../db";
import {
  settlements,
  settlementLines,
  settlementAdjustments,
  dashboardUsers,
  type DashboardUser,
} from "../../drizzle/schema";
import {
  getAllAppointments,
  getCalendars,
  getContact,
  getMonthRange,
  detectCourseType,
  detectCurrency,
  extractCourseLeaderName,
  calculateBreakdown,
  FA_MARGIN,
  AFFILIATE_COMMISSION_RATE,
  VAT_RATE,
} from "../ghl";
import { notifyOwner } from "../_core/notification";

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const DASH_SESSION = "fa_dash_session";

function getDashCookie(req: { headers: { cookie?: string } }): string | undefined {
  const cookies = parseCookies(req.headers.cookie ?? "");
  return cookies[DASH_SESSION];
}

async function requireDashUser(ctx: { req: { headers: { cookie?: string } } }): Promise<DashboardUser> {
  const sessionId = getDashCookie(ctx.req);
  if (!sessionId) throw new TRPCError({ code: "UNAUTHORIZED" });
  const user = await getSessionUser(sessionId);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return user as DashboardUser;
}

async function requireAdmin(ctx: { req: { headers: { cookie?: string } } }): Promise<DashboardUser> {
  const user = await requireDashUser(ctx);
  if (user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return user;
}

// ─── FA company details shown on settlements ──────────────────────────────────
export const FA_COMPANY = {
  name:         "Fascia Innovation Sweden AB",
  orgNr:        "5565838918",
  address:      "Bokvägen 17, 19141 Sollentuna, Sverige",
  email:        "info@fasciaacademy.com",
  paymentTerms: "20 days",
};

// ─── Participant data builder (reuses ghl.ts logic) ───────────────────────────
interface LineData {
  participantName:    string;
  participantEmail:   string;
  calendarName:       string;
  courseType:         "intro" | "diplo" | "cert" | "vidare";
  courseDate:         string;
  affiliateCode:      string;
  paidInclVat:        number;
  netExclVat:         number;
  transactionFee:     number;
  faMargin:           number;
  affiliateDeduction: number;
  payout:             number;
  missingAmount:      boolean;
}

async function buildLine(
  appt: {
    contactId: string;
    calendarId: string;
    startTime?: string;
    customFields?: Array<{ id: string; value: string | number | string[] }>;
  },
  calMap: Map<string, { id: string; name: string }>
): Promise<LineData | null> {
  const cal = calMap.get(appt.calendarId);
  if (!cal) return null;

  const currency   = detectCurrency(cal.name);
  const courseType = detectCourseType(cal.name);
  const courseDate = appt.startTime ? appt.startTime.slice(0, 10) : "";

  let contact = null;
  try { contact = await getContact(appt.contactId); } catch { /* skip */ }

  const contactName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || appt.contactId;

  const allFields = [...(appt.customFields ?? []), ...(contact?.customFields ?? [])];
  const paidField = allFields.find(
    (f) => f.id.toLowerCase().includes("paid_amount") || f.id.toLowerCase().includes("paidamount")
  );
  const affiliateField = allFields.find(
    (f) => f.id.toLowerCase().includes("affiliate_code") || f.id.toLowerCase().includes("affiliatecode")
  );

  const rawPaid      = paidField?.value;
  const missingAmount = rawPaid === undefined || rawPaid === null || rawPaid === "";
  // 0 kr is intentional (free booking) — do NOT fall back to standard price
  const paidInclVat = missingAmount ? 0 : Math.max(0, Number(rawPaid) || 0);

  const affiliateCode = affiliateField?.value ? String(affiliateField.value).trim() : "";

  // Use ghl.ts calculateBreakdown — but override the fallback for 0 kr bookings
  const b = calculateBreakdown(paidInclVat, currency, courseType, affiliateCode || null);

  // For free bookings (paidInclVat = 0): payout should be -FA_MARGIN (not 0)
  // calculateBreakdown already does Math.max(0, ...) so we override
  let payout = b.courseLeaderPayout;
  if (paidInclVat === 0) {
    const margin = currency === "SEK" ? FA_MARGIN[courseType].sek : FA_MARGIN[courseType].eur;
    payout = -margin; // course leader "pays" the FA margin for free bookings
  }

  return {
    participantName:    contactName,
    participantEmail:   contact?.email ?? "",
    calendarName:       cal.name,
    courseType,
    courseDate,
    affiliateCode,
    paidInclVat,
    netExclVat:         b.paidAmountExclVAT,
    transactionFee:     b.transactionFee,
    faMargin:           b.faMargin,
    affiliateDeduction: b.affiliateCommission,
    payout,
    missingAmount,
  };
}

// ─── Course leader settlement generation ─────────────────────────────────────
async function generateForCourseLeader(
  user: DashboardUser,
  year: number,
  month: number
): Promise<number | null> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  const { start, end } = getMonthRange(year, month);
  const [calendars, appointments] = await Promise.all([
    getCalendars(),
    getAllAppointments(start, end),
  ]);

  const calMap = new Map(calendars.map((c) => [c.id, c]));
  const showed = appointments.filter((a) => {
    const status = (a.status ?? "").toLowerCase();
    if (!["showed", "show"].includes(status)) return false;
    const cal = calMap.get(a.calendarId);
    if (!cal) return false;
    const leaderName = extractCourseLeaderName(cal.name);
    if (user.ghlContactId) {
      return a.contactId === user.ghlContactId || leaderName.toLowerCase() === user.name.toLowerCase();
    }
    return leaderName.toLowerCase() === user.name.toLowerCase();
  });

  if (showed.length === 0) return null;

  const lines: LineData[] = [];
  const seenContacts = new Set<string>();
  for (const appt of showed) {
    if (!appt.contactId || seenContacts.has(appt.contactId)) continue;
    seenContacts.add(appt.contactId);
    const line = await buildLine(appt, calMap);
    if (line) lines.push(line);
  }
  if (lines.length === 0) return null;

  // Determine currency from first line
  const currency = detectCurrency(lines[0].calendarName);

  // Aggregate totals
  const totals = lines.reduce(
    (acc, l) => ({
      totalPaidInclVat:        acc.totalPaidInclVat + l.paidInclVat,
      totalNetExclVat:         acc.totalNetExclVat + l.netExclVat,
      totalTransactionFee:     acc.totalTransactionFee + l.transactionFee,
      totalFaMargin:           acc.totalFaMargin + l.faMargin,
      totalAffiliateDeduction: acc.totalAffiliateDeduction + l.affiliateDeduction,
      totalPayout:             acc.totalPayout + l.payout,
    }),
    { totalPaidInclVat: 0, totalNetExclVat: 0, totalTransactionFee: 0, totalFaMargin: 0, totalAffiliateDeduction: 0, totalPayout: 0 }
  );

  // Insert settlement
  const result = await db.insert(settlements).values({
    userId:                  user.id,
    userType:                "course_leader",
    periodYear:              year,
    periodMonth:             month,
    currency,
    status:                  "pending",
    totalPaidInclVat:        totals.totalPaidInclVat.toFixed(2),
    totalNetExclVat:         totals.totalNetExclVat.toFixed(2),
    totalTransactionFee:     totals.totalTransactionFee.toFixed(2),
    totalFaMargin:           totals.totalFaMargin.toFixed(2),
    totalAffiliateDeduction: totals.totalAffiliateDeduction.toFixed(2),
    totalAdjustments:        "0",
    totalPayout:             totals.totalPayout.toFixed(2),
    participantCount:        lines.length,
  });

  const settlementId = (result as unknown as { insertId: number }).insertId;

  // Insert lines
  for (const line of lines) {
    await db.insert(settlementLines).values({
      settlementId,
      participantName:    line.participantName,
      participantEmail:   line.participantEmail,
      calendarName:       line.calendarName,
      courseType:         line.courseType,
      courseDate:         line.courseDate,
      affiliateCode:      line.affiliateCode,
      paidInclVat:        line.paidInclVat.toFixed(2),
      netExclVat:         line.netExclVat.toFixed(2),
      transactionFee:     line.transactionFee.toFixed(2),
      faMargin:           line.faMargin.toFixed(2),
      affiliateDeduction: line.affiliateDeduction.toFixed(2),
      payout:             line.payout.toFixed(2),
      missingAmount:      line.missingAmount,
    });
  }

  return settlementId;
}

// ─── Affiliate settlement generation ─────────────────────────────────────────
async function generateForAffiliate(
  user: DashboardUser,
  year: number,
  month: number
): Promise<number | null> {
  if (!user.affiliateCode) return null;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  const { start, end } = getMonthRange(year, month);
  const [calendars, appointments] = await Promise.all([
    getCalendars(),
    getAllAppointments(start, end),
  ]);
  const calMap = new Map(calendars.map((c) => [c.id, c]));
  const showed = appointments.filter((a) => ["showed", "show"].includes((a.status ?? "").toLowerCase()));

  const lines: LineData[] = [];
  const seenContacts = new Set<string>();
  for (const appt of showed) {
    if (!appt.contactId || seenContacts.has(appt.contactId)) continue;
    const cal = calMap.get(appt.calendarId);
    if (!cal) continue;
    if (detectCourseType(cal.name) !== "intro") continue;

    let contact = null;
    try { contact = await getContact(appt.contactId); } catch { /* skip */ }
    const allFields = [...(appt.customFields ?? []), ...(contact?.customFields ?? [])];
    const affiliateField = allFields.find(
      (f) => f.id.toLowerCase().includes("affiliate_code") || f.id.toLowerCase().includes("affiliatecode")
    );
    const contactAffCode = affiliateField?.value ? String(affiliateField.value).trim() : "";
    if (contactAffCode.toLowerCase() !== user.affiliateCode!.toLowerCase()) continue;
    seenContacts.add(appt.contactId);

    const paidField = allFields.find(
      (f) => f.id.toLowerCase().includes("paid_amount") || f.id.toLowerCase().includes("paidamount")
    );
    const rawPaid = paidField?.value;
    const missingAmount = rawPaid === undefined || rawPaid === null || rawPaid === "";
    const paidInclVat = missingAmount ? 0 : Math.max(0, Number(rawPaid) || 0);
    const currency = detectCurrency(cal.name);
    const courseDate = appt.startTime ? appt.startTime.slice(0, 10) : "";
    const netExclVat = paidInclVat / (1 + VAT_RATE);
    const commission = netExclVat * AFFILIATE_COMMISSION_RATE;
    const contactName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || appt.contactId;

    lines.push({
      participantName:    contactName,
      participantEmail:   contact?.email ?? "",
      calendarName:       cal.name,
      courseType:         "intro",
      courseDate,
      affiliateCode:      contactAffCode,
      paidInclVat,
      netExclVat,
      transactionFee:     0,
      faMargin:           0,
      affiliateDeduction: 0,
      payout:             commission,
      missingAmount,
    });
  }

  if (lines.length === 0) return null;

  const currency = lines[0] ? detectCurrency(lines[0].calendarName) : "SEK";
  const totalPayout = lines.reduce((s, l) => s + l.payout, 0);
  const totalPaidInclVat = lines.reduce((s, l) => s + l.paidInclVat, 0);
  const totalNetExclVat  = lines.reduce((s, l) => s + l.netExclVat, 0);

  const result = await db.insert(settlements).values({
    userId:                  user.id,
    userType:                "affiliate",
    periodYear:              year,
    periodMonth:             month,
    currency,
    status:                  "pending",
    totalPaidInclVat:        totalPaidInclVat.toFixed(2),
    totalNetExclVat:         totalNetExclVat.toFixed(2),
    totalTransactionFee:     "0",
    totalFaMargin:           "0",
    totalAffiliateDeduction: "0",
    totalAdjustments:        "0",
    totalPayout:             totalPayout.toFixed(2),
    participantCount:        lines.length,
  });

  const settlementId = (result as unknown as { insertId: number }).insertId;

  for (const line of lines) {
    await db.insert(settlementLines).values({
      settlementId,
      participantName:    line.participantName,
      participantEmail:   line.participantEmail,
      calendarName:       line.calendarName,
      courseType:         line.courseType,
      courseDate:         line.courseDate,
      affiliateCode:      line.affiliateCode,
      paidInclVat:        line.paidInclVat.toFixed(2),
      netExclVat:         line.netExclVat.toFixed(2),
      transactionFee:     "0",
      faMargin:           "0",
      affiliateDeduction: "0",
      payout:             line.payout.toFixed(2),
      missingAmount:      line.missingAmount,
    });
  }

  return settlementId;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const settlementsRouter = router({
  /**
   * Admin: generate settlements for all active course leaders + affiliates for a given month.
   * Skips users who already have a non-amended settlement for that period.
   */
  generate: publicProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .mutation(async ({ input, ctx }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const users = await getAllDashboardUsers();
      const results: Array<{ userId: number; name: string; status: string; settlementId?: number }> = [];

      for (const user of users) {
        if (!user.active) continue;
        if (user.role !== "course_leader" && user.role !== "affiliate") continue;

        // Check if already generated (non-amended)
        const existing = await db
          .select({ id: settlements.id })
          .from(settlements)
          .where(
            and(
              eq(settlements.userId, user.id),
              eq(settlements.periodYear, input.year),
              eq(settlements.periodMonth, input.month),
              sql`${settlements.status} != 'amended'`
            )
          )
          .limit(1);

        if (existing.length > 0) {
          results.push({ userId: user.id, name: user.name, status: "skipped_already_exists" });
          continue;
        }

        try {
          let settlementId: number | null = null;
          if (user.role === "course_leader") {
            settlementId = await generateForCourseLeader(user as DashboardUser, input.year, input.month);
          } else if (user.role === "affiliate") {
            settlementId = await generateForAffiliate(user as DashboardUser, input.year, input.month);
          }
          if (settlementId !== null) {
            results.push({ userId: user.id, name: user.name, status: "generated", settlementId });
          } else {
            results.push({ userId: user.id, name: user.name, status: "skipped_no_data" });
          }
        } catch (err) {
          results.push({ userId: user.id, name: user.name, status: `error: ${(err as Error).message}` });
        }
      }

      const generated = results.filter((r) => r.status === "generated");
      if (generated.length > 0) {
        await notifyOwner({
          title: `Settlements generated for ${input.year}-${String(input.month).padStart(2, "0")}`,
          content: `${generated.length} settlement(s) generated and pending review.\n${generated.map((r) => `- ${r.name}`).join("\n")}`,
        }).catch(() => {});
      }

      return { results };
    }),

  /**
   * List settlements. Admin sees all; others see only their own approved settlements.
   */
  list: publicProcedure
    .input(z.object({
      year:   z.number().optional(),
      month:  z.number().optional(),
      status: z.enum(["pending", "approved", "amended"]).optional(),
      userId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const user = await requireDashUser(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [];

      if (user.role !== "admin") {
        conditions.push(eq(settlements.userId, user.id));
        conditions.push(eq(settlements.status, "approved"));
      } else {
        if (input.userId) conditions.push(eq(settlements.userId, input.userId));
        if (input.status) conditions.push(eq(settlements.status, input.status));
      }
      if (input.year)  conditions.push(eq(settlements.periodYear, input.year));
      if (input.month) conditions.push(eq(settlements.periodMonth, input.month));

      const rows = await db
        .select({
          settlement: settlements,
          userName:         dashboardUsers.name,
          userEmail:        dashboardUsers.email,
          invoiceReference: dashboardUsers.invoiceReference,
        })
        .from(settlements)
        .innerJoin(dashboardUsers, eq(settlements.userId, dashboardUsers.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sql`${settlements.periodYear} DESC, ${settlements.periodMonth} DESC, ${settlements.generatedAt} DESC`);

      return rows.map((r) => ({ ...r.settlement, userName: r.userName, userEmail: r.userEmail, invoiceReference: r.invoiceReference }));
    }),

  /**
   * Get a single settlement with lines and adjustments.
   */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const user = await requireDashUser(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({
          settlement:       settlements,
          userName:         dashboardUsers.name,
          userEmail:        dashboardUsers.email,
          invoiceReference: dashboardUsers.invoiceReference,
          userPhone:        dashboardUsers.phone,
        })
        .from(settlements)
        .innerJoin(dashboardUsers, eq(settlements.userId, dashboardUsers.id))
        .where(eq(settlements.id, input.id))
        .limit(1);

      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      // Access control
      if (user.role !== "admin") {
        if (row.settlement.userId !== user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (row.settlement.status !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      }

      const lines = await db
        .select()
        .from(settlementLines)
        .where(eq(settlementLines.settlementId, input.id))
        .orderBy(settlementLines.courseDate, settlementLines.participantName);

      const adjustmentsRows = await db
        .select({
          adjustment:    settlementAdjustments,
          createdByName: dashboardUsers.name,
        })
        .from(settlementAdjustments)
        .innerJoin(dashboardUsers, eq(settlementAdjustments.createdBy, dashboardUsers.id))
        .where(eq(settlementAdjustments.settlementId, input.id))
        .orderBy(settlementAdjustments.createdAt);

      return {
        settlement:  { ...row.settlement, userName: row.userName, userEmail: row.userEmail, invoiceReference: row.invoiceReference, userPhone: row.userPhone },
        lines,
        adjustments: adjustmentsRows.map((r) => ({ ...r.adjustment, createdByName: r.createdByName })),
        faCompany:   FA_COMPANY,
      };
    }),

  /**
   * Admin: approve a settlement and send notification.
   */
  approve: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({ settlement: settlements, userName: dashboardUsers.name, userEmail: dashboardUsers.email })
        .from(settlements)
        .innerJoin(dashboardUsers, eq(settlements.userId, dashboardUsers.id))
        .where(eq(settlements.id, input.id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (row.settlement.status === "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Already approved" });
      if (row.settlement.status === "amended")  throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot approve an amended settlement" });

      await db
        .update(settlements)
        .set({ status: "approved", approvedAt: new Date(), approvedBy: admin.id })
        .where(eq(settlements.id, input.id));

      const period = `${row.settlement.periodYear}-${String(row.settlement.periodMonth).padStart(2, "0")}`;
      await notifyOwner({
        title: `Settlement approved: ${row.userName} (${period})`,
        content: `Settlement for ${row.userName} for ${period} has been approved.\nTotal payout: ${Number(row.settlement.totalPayout).toFixed(2)} ${row.settlement.currency}`,
      }).catch(() => {});

      return { success: true };
    }),

  /**
   * Admin: add a manual adjustment row. Recalculates totalAdjustments and totalPayout.
   */
  addAdjustment: publicProcedure
    .input(z.object({
      settlementId: z.number(),
      amount:       z.number(),
      currency:     z.enum(["SEK", "EUR"]),
      comment:      z.string().min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      const admin = await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db
        .select()
        .from(settlements)
        .where(eq(settlements.id, input.settlementId))
        .limit(1);
      const s = existing[0];
      if (!s) throw new TRPCError({ code: "NOT_FOUND" });
      if (s.status === "amended") throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot adjust an amended settlement" });

      await db.insert(settlementAdjustments).values({
        settlementId: input.settlementId,
        amount:       input.amount.toFixed(2),
        currency:     input.currency,
        comment:      input.comment,
        createdBy:    admin.id,
      });

      // Recalculate totals
      const allAdj = await db
        .select({ amount: settlementAdjustments.amount })
        .from(settlementAdjustments)
        .where(eq(settlementAdjustments.settlementId, input.settlementId));
      const totalAdj = allAdj.reduce((sum, a) => sum + Number(a.amount), 0);

      const baseNet  = Number(s.totalNetExclVat ?? 0);
      const baseFees = Number(s.totalTransactionFee ?? 0) + Number(s.totalFaMargin ?? 0) + Number(s.totalAffiliateDeduction ?? 0);
      const newPayout = baseNet - baseFees + totalAdj;

      await db
        .update(settlements)
        .set({ totalAdjustments: totalAdj.toFixed(2), totalPayout: newPayout.toFixed(2) })
        .where(eq(settlements.id, input.settlementId));

      return { success: true, newTotalPayout: newPayout };
    }),

  /**
   * Admin: amend an approved settlement.
   * Marks the old one as 'amended' and generates a fresh one from GHL data.
   */
  amend: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({ settlement: settlements, userRole: dashboardUsers.role })
        .from(settlements)
        .innerJoin(dashboardUsers, eq(settlements.userId, dashboardUsers.id))
        .where(eq(settlements.id, input.id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (row.settlement.status === "amended") throw new TRPCError({ code: "BAD_REQUEST", message: "Already amended" });

      // Mark old as amended
      await db.update(settlements).set({ status: "amended" }).where(eq(settlements.id, input.id));

      // Get user
      const userRows = await db
        .select()
        .from(dashboardUsers)
        .where(eq(dashboardUsers.id, row.settlement.userId))
        .limit(1);
      const user = userRows[0] as DashboardUser | undefined;
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      let newSettlementId: number | null = null;
      if (user.role === "course_leader") {
        newSettlementId = await generateForCourseLeader(user, Number(row.settlement.periodYear), Number(row.settlement.periodMonth));
      } else if (user.role === "affiliate") {
        newSettlementId = await generateForAffiliate(user, Number(row.settlement.periodYear), Number(row.settlement.periodMonth));
      }

      if (newSettlementId !== null) {
        await db.update(settlements).set({ amendedFromId: input.id }).where(eq(settlements.id, newSettlementId));
      }

      return { success: true, newSettlementId };
    }),

  /**
   * Admin: recalculate a pending settlement from fresh GHL data.
   * Deletes and regenerates. Use amend for approved settlements.
   */
  recalculate: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({ settlement: settlements })
        .from(settlements)
        .where(eq(settlements.id, input.id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (row.settlement.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending settlements can be recalculated. Use amend for approved ones." });
      }

      // Delete old data
      await db.delete(settlementLines).where(eq(settlementLines.settlementId, input.id));
      await db.delete(settlementAdjustments).where(eq(settlementAdjustments.settlementId, input.id));
      await db.delete(settlements).where(eq(settlements.id, input.id));

      const userRows = await db
        .select()
        .from(dashboardUsers)
        .where(eq(dashboardUsers.id, row.settlement.userId))
        .limit(1);
      const user = userRows[0] as DashboardUser | undefined;
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      let newSettlementId: number | null = null;
      if (user.role === "course_leader") {
        newSettlementId = await generateForCourseLeader(user, Number(row.settlement.periodYear), Number(row.settlement.periodMonth));
      } else if (user.role === "affiliate") {
        newSettlementId = await generateForAffiliate(user, Number(row.settlement.periodYear), Number(row.settlement.periodMonth));
      }

      return { success: true, newSettlementId };
    }),
});
