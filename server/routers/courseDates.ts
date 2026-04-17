/**
 * Course Dates Router
 * Handles CRUD for manually registered course dates (public booking page).
 * Also provides GHL team member data (names + profile photos) for the booking page.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, gte, lte, and, asc, desc } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { courseDates, dashboardUsers } from "../../drizzle/schema";
import type { DashboardUser } from "../../drizzle/schema";
import { parse as parseCookies } from "cookie";
import { getSessionUser } from "../dashboardAuth";

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

async function ghlGet(path: string) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Version: "2021-07-28",
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// Cache GHL users in memory (refresh every 10 min)
let ghlUsersCache: { users: GhlUser[]; fetchedAt: number } | null = null;

interface GhlUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  profilePhoto?: string;
}

async function getGhlUsers(): Promise<GhlUser[]> {
  const now = Date.now();
  if (ghlUsersCache && now - ghlUsersCache.fetchedAt < 10 * 60 * 1000) {
    return ghlUsersCache.users;
  }
  const data = await ghlGet(`/users/?locationId=${LOCATION_ID}`);
  const users: GhlUser[] = (data?.users ?? []).map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || undefined,
    profilePhoto: u.profilePhoto || undefined,
  }));
  ghlUsersCache = { users, fetchedAt: now };
  return users;
}

// Cache GHL calendars in memory (refresh every 10 min)
let ghlCalendarsCache: { calendars: GhlCalendar[]; fetchedAt: number } | null = null;

interface GhlCalendar {
  id: string;
  name: string;
  groupId?: string;
  appoinmentPerSlot?: number; // max seats per slot (GHL typo in field name)
  teamMembers?: Array<{ userId: string; meetingLocation?: string; isPrimary?: boolean }>;
}

async function getGhlCalendars(): Promise<GhlCalendar[]> {
  const now = Date.now();
  if (ghlCalendarsCache && now - ghlCalendarsCache.fetchedAt < 10 * 60 * 1000) {
    return ghlCalendarsCache.calendars;
  }
  const data = await ghlGet(`/calendars/?locationId=${LOCATION_ID}`);
  const calendars: GhlCalendar[] = (data?.calendars ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    groupId: c.groupId,
    appoinmentPerSlot: c.appoinmentPerSlot ?? c.appointmentPerSlot ?? undefined,
    teamMembers: c.teamMembers,
  }));
  ghlCalendarsCache = { calendars, fetchedAt: now };
  return calendars;
}

// ─── Calendar groups (course types) ──────────────────────────────────────────
// Hardcoded from GHL exploration — these are stable IDs
const CALENDAR_GROUPS = {
  "46cG78e38f7Z7kPrnTec": { type: "intro" as const, language: "sv" as const, name: "Introduktionskurs Fascia" },
  "eeW0XNhBeuJQanBBgTxi": { type: "diplo" as const, language: "sv" as const, name: "Diplomerad Fasciaspecialist" },
  "kP2Dx9Wt8nrer8kFRLVC": { type: "cert" as const, language: "sv" as const, name: "Certifierad Fasciaspecialist" },
  "GFR78Xvz2O28vg1ceVRr": { type: "vidare" as const, language: "sv" as const, name: "Vidareutbildning Fasciaspecialist" },
  "c9KlEXWR3V0JMlFL1s5S": { type: "intro" as const, language: "en" as const, name: "Introduction Course Fascia" },
  "4vFsc5tGg4sydbnCZoVf": { type: "diplo" as const, language: "en" as const, name: "Qualified Fascia Specialist" },
  "ybtZMbKdpCLgSOVGIt2D": { type: "cert" as const, language: "en" as const, name: "Certified Fascia Specialist" },
  "RlGySl3y2vxUGEpE2xPo": { type: "vidare" as const, language: "en" as const, name: "Advanced Fascia Specialist" },
};

export const courseDatesRouter = router({
  // ─── Public: list published course dates (for public booking page) ──────────
  listPublic: publicProcedure
    .input(
      z.object({
        language: z.enum(["sv", "en"]).optional(),
        courseType: z.enum(["intro", "diplo", "cert", "vidare"]).optional(),
        courseLeaderName: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const now = new Date();
      const rows = await db
        .select()
        .from(courseDates)
        .where(
          and(
            eq(courseDates.published, true),
            gte(courseDates.startDate, now)
          )
        )
        .orderBy(asc(courseDates.startDate));

      // Apply filters
      let filtered = rows;
      if (input?.language) filtered = filtered.filter((r) => r.language === input.language);
      if (input?.courseType) filtered = filtered.filter((r) => r.courseType === input.courseType);
      if (input?.courseLeaderName) filtered = filtered.filter((r) => r.courseLeaderName === input.courseLeaderName);

      // Enrich with GHL profile photos
      const ghlUsers = await getGhlUsers();
      const userMap = new Map(ghlUsers.map((u) => [u.id, u]));

      // Enrich with profileUrl from dashboard_users (matched by courseLeaderName)
      const dashUsers = await db.select().from(dashboardUsers);
      const profileUrlByName = new Map<string, string | null>(
        dashUsers.map((u) => [u.name.toLowerCase(), u.profileUrl ?? null])
      );

      return filtered.map((row) => ({
        ...row,
        profilePhoto: row.ghlUserId ? (userMap.get(row.ghlUserId)?.profilePhoto ?? null) : null,
        profileUrl: profileUrlByName.get(row.courseLeaderName.toLowerCase()) ?? null,
        bookedSeats: row.bookedSeats ?? 0,
      }));
    }),

  // ─── Course leader: get own upcoming + past course dates ──────────────────
  myCourseSchedule: dashboardProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
    const myName = dashUser.name.toLowerCase();
    const now = new Date();

    // Fetch ALL courses for this leader (not just published)
    const allRows = await db
      .select()
      .from(courseDates)
      .orderBy(asc(courseDates.startDate));

    // Match on both courseLeaderName (string) AND submittedBy (user ID)
    const mine = allRows.filter(
      (r) =>
        r.courseLeaderName.toLowerCase().trim() === myName.trim() ||
        r.submittedBy === dashUser.id
    );

    // Pending/needs_revision courses (any status that needs attention)
    const pendingStatuses = ["pending_approval", "pending_cancellation", "pending_reschedule", "needs_revision"];
    const pending = mine.filter((r) => pendingStatuses.includes(r.status));

    // Upcoming = future start date AND approved (published flag not required — admin may approve before publishing)
    const upcoming = mine.filter((r) => r.startDate >= now && r.status === "approved");

    // Past = past start date AND not cancelled
    const past = mine
      .filter((r) => r.startDate < now && r.status !== "cancelled")
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .slice(0, 20);

    // Cancelled (recent, for reference)
    const cancelled = mine
      .filter((r) => r.status === "cancelled")
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .slice(0, 5);

    return { upcoming, past, pending, cancelled };
  }),

  // ─── Public: get GHL team members with profile photos ───────────────────────
  getTeamMembers: publicProcedure.query(async () => {
    return getGhlUsers();
  }),

  // ─── Dashboard: get GHL calendars (admin sees all, course leader sees own) ──
  getCalendars: dashboardProcedure.query(async ({ ctx }) => {
    const [calendars, users] = await Promise.all([getGhlCalendars(), getGhlUsers()]);
    const userMap = new Map(users.map((u) => [u.id, u]));

    const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
    const isAdmin = dashUser.role === "admin";

    // Filter out template calendars and enrich with course type + user info
    let filtered = calendars.filter((c) => !c.name.startsWith("Template"));

    // Course leaders only see their own calendars
    // Match priority: 1) ghlUserId on dashUser (exact), 2) name fallback
    if (!isAdmin) {
      const myGhlUserId = dashUser.ghlUserId?.trim() ?? null;
      const myName = dashUser.name.toLowerCase().trim();
      filtered = filtered.filter((c) => {
        const primaryMember = c.teamMembers?.find((m) => m.isPrimary) ?? c.teamMembers?.[0];
        if (!primaryMember) return false;
        // Priority 1: match by GHL user ID (set by admin in User Management)
        if (myGhlUserId && primaryMember.userId === myGhlUserId) return true;
        // Priority 2: name fallback (only if ghlUserId not set)
        if (!myGhlUserId) {
          const user = userMap.get(primaryMember.userId);
          return user?.name?.toLowerCase().trim() === myName;
        }
        return false;
      });
    }

    return filtered
      .map((c) => {
        const groupInfo = c.groupId ? CALENDAR_GROUPS[c.groupId as keyof typeof CALENDAR_GROUPS] : null;
        const primaryMember = c.teamMembers?.find((m) => m.isPrimary) ?? c.teamMembers?.[0];
        const user = primaryMember ? userMap.get(primaryMember.userId) : null;
        // Parse meetingLocation for address/city auto-fill
        // GHL format: "Street\tPostalCode\tCity" (tab-separated, 3 parts)
        const rawLocation = primaryMember?.meetingLocation ?? "";
        const parts = rawLocation.split(/\t/).map((s: string) => s.trim()).filter(Boolean);
        let autoVenueName: string | null = null;
        let autoAddress: string | null = null;
        let autoCity: string | null = null;
        if (parts.length >= 3) {
          // "Berga allé 1\t25452\tHelsingborg" → street, zip, city
          const street = parts[0];
          const zip = parts[1];
          const city = parts[2];
          autoCity = city;
          // Format zip nicely: "25452" → "254 52" if 5 digits
          const formattedZip = /^\d{5}$/.test(zip) ? `${zip.slice(0, 3)} ${zip.slice(3)}` : zip;
          autoAddress = `${street}, ${formattedZip} ${city}`;
          autoVenueName = null; // Venue Name is always manual
        } else if (parts.length === 2) {
          // "Street\tCity"
          autoAddress = `${parts[0]}, ${parts[1]}`;
          autoCity = parts[1];
        } else if (parts.length === 1 && parts[0] && !parts[0].includes("ÄNDRA") && !parts[0].includes("Varies")) {
          autoAddress = parts[0];
          // Try to extract city from last comma-separated part
          const addrParts = parts[0].split(",").map((s: string) => s.trim());
          autoCity = addrParts[addrParts.length - 1] ?? null;
        }
        return {
          id: c.id,
          name: c.name,
          groupId: c.groupId,
          courseType: groupInfo?.type ?? null,
          language: groupInfo?.language ?? null,
          groupName: groupInfo?.name ?? null,
          primaryUserId: user?.id ?? null,
          primaryUserName: user?.name ?? null,
          primaryUserPhone: user?.phone ?? null,
          profilePhoto: user?.profilePhoto ?? null,
          maxSeats: c.appoinmentPerSlot ?? 12,
          autoVenueName,
          autoAddress,
          autoCity,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "sv"));
  }),

  // ─── Admin: list all course dates (including unpublished) ───────────────────
  listAdmin: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const rows = await db
      .select()
      .from(courseDates)
      .orderBy(asc(courseDates.startDate));

    const ghlUsers = await getGhlUsers();
    const userMap = new Map(ghlUsers.map((u) => [u.id, u]));

    return rows.map((row) => ({
      ...row,
      profilePhoto: row.ghlUserId ? (userMap.get(row.ghlUserId)?.profilePhoto ?? null) : null,
    }));
  }),

  // ─── Admin: create a course date ────────────────────────────────────────────
  create: adminProcedure
    .input(
      z.object({
        ghlCalendarId: z.string().min(1),
        courseLeaderName: z.string().min(1),
        ghlUserId: z.string().optional(),
        courseType: z.enum(["intro", "diplo", "cert", "vidare"]),
        language: z.enum(["sv", "en"]),
        city: z.string().min(1),
        country: z.string().default("Sweden"),
        venueName: z.string().optional(),
        address: z.string().optional(),
        courseLeaderPhone: z.string().optional(),
        startDate: z.string(), // ISO string
        endDate: z.string(),   // ISO string
        maxSeats: z.number().int().min(1).max(500).default(12),
        notes: z.string().optional(),
        published: z.boolean().default(true),
        additionalDays: z.string().optional(), // JSON string of [{date, startTime, endTime}]
        bookingInfo: z.string().optional(), // Extra booking info (directions, parking, etc.)
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.insert(courseDates).values({
        ghlCalendarId: input.ghlCalendarId,
        courseLeaderName: input.courseLeaderName,
        ghlUserId: input.ghlUserId ?? null,
        courseType: input.courseType,
        language: input.language,
        city: input.city,
        country: input.country,
        venueName: input.venueName ?? null,
        address: input.address ?? null,
        courseLeaderPhone: input.courseLeaderPhone ?? null,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        maxSeats: input.maxSeats,
        notes: input.notes ?? null,
        published: input.published,
        additionalDays: input.additionalDays ?? null,
        bookingInfo: input.bookingInfo ?? null,
      });

      return { success: true };
    }),

  // ─── Admin: update a course date ────────────────────────────────────────────
  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        ghlCalendarId: z.string().min(1).optional(),
        courseLeaderName: z.string().min(1).optional(),
        ghlUserId: z.string().optional().nullable(),
        courseType: z.enum(["intro", "diplo", "cert", "vidare"]).optional(),
        language: z.enum(["sv", "en"]).optional(),
        city: z.string().min(1).optional(),
        country: z.string().optional(),
        venueName: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        courseLeaderPhone: z.string().optional().nullable(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        maxSeats: z.number().int().min(1).max(500).optional(),
        bookedSeats: z.number().int().min(0).optional(),
        notes: z.string().optional().nullable(),
        published: z.boolean().optional(),
        additionalDays: z.string().optional().nullable(),
        bookingInfo: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, startDate, endDate, ...rest } = input;
      const updateData: Record<string, unknown> = { ...rest };
      if (startDate) updateData.startDate = new Date(startDate);
      if (endDate) updateData.endDate = new Date(endDate);

      await db.update(courseDates).set(updateData).where(eq(courseDates.id, id));
      return { success: true };
    }),

  // ─── Admin: delete a course date ────────────────────────────────────────────
  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(courseDates).where(eq(courseDates.id, input.id));
      return { success: true };
    }),

  // ─── Admin: duplicate a course date (as draft) ──────────────────────────────
  duplicate: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.id));
      const src = rows[0];
      if (!src) throw new TRPCError({ code: "NOT_FOUND", message: "Course date not found" });

      const { id: _id, createdAt: _ca, ...rest } = src as any;
      await db.insert(courseDates).values({
        ...rest,
        published: false, // always start as draft
      });
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // COURSE LEADER SELF-SERVICE
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Course leader: register a new course date ─────────────────────────────
  leaderRegister: dashboardProcedure
    .input(
      z.object({
        ghlCalendarId: z.string().min(1),
        startDate: z.string(), // ISO string
        endDate: z.string(),   // ISO string
        venueName: z.string().min(1),
        additionalDays: z.string().optional(), // JSON string of [{date, startTime, endTime}]
        bookingInfo: z.string().optional(),
        leaderMessage: z.string().optional(), // "Meddelande till Admin"
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      // Fetch calendar details to auto-fill fields
      const calendars = await getGhlCalendars();
      const cal = calendars.find((c) => c.id === input.ghlCalendarId);
      if (!cal) throw new TRPCError({ code: "NOT_FOUND", message: "Calendar not found" });

      // Verify course leader owns this calendar
      const users = await getGhlUsers();
      const userMap = new Map(users.map((u) => [u.id, u]));
      const primaryMember = cal.teamMembers?.find((m) => m.isPrimary) ?? cal.teamMembers?.[0];
      const ghlUser = primaryMember ? userMap.get(primaryMember.userId) : null;

      if (dashUser.role !== "admin") {
        const myName = dashUser.name.toLowerCase().trim();
        if (!ghlUser || ghlUser.name.toLowerCase().trim() !== myName) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This calendar does not belong to you" });
        }
      }

      // Extract auto-fill data from calendar
      const groupInfo = cal.groupId ? CALENDAR_GROUPS[cal.groupId as keyof typeof CALENDAR_GROUPS] : null;
      const courseType = groupInfo?.type ?? "intro";
      const language = groupInfo?.language ?? "sv";

      // Parse address/city from meetingLocation
      const rawLocation = primaryMember?.meetingLocation ?? "";
      const parts = rawLocation.split(/\t/).map((s: string) => s.trim()).filter(Boolean);
      let autoAddress: string | null = null;
      let autoCity = "";
      if (parts.length >= 3) {
        const street = parts[0];
        const zip = parts[1];
        const city = parts[2];
        autoCity = city;
        const formattedZip = /^\d{5}$/.test(zip) ? `${zip.slice(0, 3)} ${zip.slice(3)}` : zip;
        autoAddress = `${street}, ${formattedZip} ${city}`;
      } else if (parts.length === 2) {
        autoAddress = `${parts[0]}, ${parts[1]}`;
        autoCity = parts[1];
      } else if (parts.length === 1 && parts[0]) {
        autoAddress = parts[0];
        const addrParts = parts[0].split(",").map((s: string) => s.trim());
        autoCity = addrParts[addrParts.length - 1] ?? "";
      }

      const maxSeats = cal.appoinmentPerSlot ?? 12;

      // Validate day count based on course type
      const additionalDaysArr = input.additionalDays ? JSON.parse(input.additionalDays) : [];
      const totalDays = 1 + additionalDaysArr.length;
      const MIN_DAYS: Record<string, number> = { intro: 1, diplo: 4, cert: 6, vidare: 2 };
      const minRequired = MIN_DAYS[courseType] ?? 1;
      if (courseType === "intro" && totalDays !== 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Introduktionskurs måste vara exakt 1 dag" });
      }
      if (totalDays < minRequired) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Denna kurstyp kräver minst ${minRequired} dagar (du har angett ${totalDays})` });
      }

      const changeLogEntry = [{
        action: "created",
        by: dashUser.name,
        byId: dashUser.id,
        at: new Date().toISOString(),
        details: "Kurs registrerad av kursledare",
      }];

      await db.insert(courseDates).values({
        ghlCalendarId: input.ghlCalendarId,
        courseLeaderName: ghlUser?.name ?? dashUser.name,
        ghlUserId: ghlUser?.id ?? null,
        courseType,
        language,
        city: autoCity,
        country: "Sweden",
        venueName: input.venueName,
        address: autoAddress,
        courseLeaderPhone: ghlUser?.phone ?? dashUser.phone ?? null,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        maxSeats,
        bookedSeats: 0,
        additionalDays: input.additionalDays ?? null,
        bookingInfo: input.bookingInfo ?? null,
        notes: null,
        published: false, // Not published until admin approves
        status: "pending_approval",
        submittedBy: dashUser.id,
        leaderMessage: input.leaderMessage ?? null,
        adminMessage: null,
        changeLog: JSON.stringify(changeLogEntry),
      });

      // Notify admin
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `Ny kurs att godkänna: ${groupInfo?.name ?? courseType}`,
          content: `${dashUser.name} har registrerat ett nytt kurstillfälle.\nKurstyp: ${groupInfo?.name ?? courseType}\nDatum: ${input.startDate}\nPlats: ${input.venueName}, ${autoCity}\n\nLogga in i portalen för att granska och godkänna.`,
        });
      } catch { /* non-blocking */ }

      return { success: true };
    }),

  // ─── Course leader: request cancellation ────────────────────────────────────
  leaderCancel: dashboardProcedure
    .input(
      z.object({
        id: z.number().int(),
        leaderMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.id));
      const course = rows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify ownership
      if (dashUser.role !== "admin" && course.courseLeaderName.toLowerCase().trim() !== dashUser.name.toLowerCase().trim()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Du kan bara avboka dina egna kurser" });
      }

      if (course.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kursen är redan avbokad" });
      }

      const existingLog = course.changeLog ? JSON.parse(course.changeLog) : [];
      existingLog.push({
        action: "cancellation_requested",
        by: dashUser.name,
        byId: dashUser.id,
        at: new Date().toISOString(),
        details: input.leaderMessage || "Avbokning begärd",
        hasBookedCustomers: (course.bookedSeats ?? 0) > 0,
      });

      await db.update(courseDates).set({
        status: "pending_cancellation",
        leaderMessage: input.leaderMessage ?? null,
        changeLog: JSON.stringify(existingLog),
      }).where(eq(courseDates.id, input.id));

      // Notify admin
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `Avbokning begärd: ${course.courseLeaderName}`,
          content: `${dashUser.name} vill avboka ${course.courseType} den ${course.startDate.toISOString().slice(0, 10)} i ${course.city}.\nBokade deltagare: ${course.bookedSeats ?? 0}\n${input.leaderMessage ? `Meddelande: ${input.leaderMessage}` : ""}`,
        });
      } catch { /* non-blocking */ }

      return { success: true };
    }),

  // ─── Course leader: request reschedule ──────────────────────────────────────
  leaderReschedule: dashboardProcedure
    .input(
      z.object({
        id: z.number().int(),
        newStartDate: z.string(),
        newEndDate: z.string(),
        newAdditionalDays: z.string().optional(),
        leaderMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.id));
      const course = rows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify ownership
      if (dashUser.role !== "admin" && course.courseLeaderName.toLowerCase().trim() !== dashUser.name.toLowerCase().trim()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Du kan bara omboka dina egna kurser" });
      }

      if (course.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kan inte omboka en avbokad kurs" });
      }

      // Validate day count for new schedule
      const newAdditionalArr = input.newAdditionalDays ? JSON.parse(input.newAdditionalDays) : [];
      const totalDays = 1 + newAdditionalArr.length;
      const MIN_DAYS: Record<string, number> = { intro: 1, diplo: 4, cert: 6, vidare: 2 };
      const minRequired = MIN_DAYS[course.courseType] ?? 1;
      if (course.courseType === "intro" && totalDays !== 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Introduktionskurs måste vara exakt 1 dag" });
      }
      if (totalDays < minRequired) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Denna kurstyp kräver minst ${minRequired} dagar` });
      }

      const existingLog = course.changeLog ? JSON.parse(course.changeLog) : [];
      existingLog.push({
        action: "reschedule_requested",
        by: dashUser.name,
        byId: dashUser.id,
        at: new Date().toISOString(),
        details: `Ombokning begärd: ${input.newStartDate}`,
        oldStart: course.startDate.toISOString(),
        newStart: input.newStartDate,
      });

      await db.update(courseDates).set({
        status: "pending_reschedule",
        rescheduleNewStart: new Date(input.newStartDate),
        rescheduleNewEnd: new Date(input.newEndDate),
        rescheduleNewAdditionalDays: input.newAdditionalDays ?? null,
        leaderMessage: input.leaderMessage ?? null,
        changeLog: JSON.stringify(existingLog),
      }).where(eq(courseDates.id, input.id));

      // Notify admin
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `Ombokning begärd: ${course.courseLeaderName}`,
          content: `${dashUser.name} vill omboka ${course.courseType} från ${course.startDate.toISOString().slice(0, 10)} till ${input.newStartDate}.\nBokade deltagare: ${course.bookedSeats ?? 0}\n${input.leaderMessage ? `Meddelande: ${input.leaderMessage}` : ""}`,
        });
      } catch { /* non-blocking */ }

      return { success: true };
    }),

  // ─── Course leader: copy a course date (creates new pending) ───────────────
  leaderCopy: dashboardProcedure
    .input(
      z.object({
        id: z.number().int(),
        newStartDate: z.string(),
        newEndDate: z.string(),
        newAdditionalDays: z.string().optional(),
        venueName: z.string().min(1),
        bookingInfo: z.string().optional(),
        leaderMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.id));
      const src = rows[0];
      if (!src) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify ownership
      if (dashUser.role !== "admin" && src.courseLeaderName.toLowerCase().trim() !== dashUser.name.toLowerCase().trim()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Du kan bara kopiera dina egna kurser" });
      }

      // Validate day count
      const newAdditionalArr = input.newAdditionalDays ? JSON.parse(input.newAdditionalDays) : [];
      const totalDays = 1 + newAdditionalArr.length;
      const MIN_DAYS: Record<string, number> = { intro: 1, diplo: 4, cert: 6, vidare: 2 };
      const minRequired = MIN_DAYS[src.courseType] ?? 1;
      if (src.courseType === "intro" && totalDays !== 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Introduktionskurs måste vara exakt 1 dag" });
      }
      if (totalDays < minRequired) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Denna kurstyp kräver minst ${minRequired} dagar` });
      }

      const changeLogEntry = [{
        action: "created",
        by: dashUser.name,
        byId: dashUser.id,
        at: new Date().toISOString(),
        details: `Kopierad från kurs #${src.id}`,
      }];

      await db.insert(courseDates).values({
        ghlCalendarId: src.ghlCalendarId,
        courseLeaderName: src.courseLeaderName,
        ghlUserId: src.ghlUserId,
        courseType: src.courseType,
        language: src.language,
        city: src.city,
        country: src.country,
        venueName: input.venueName,
        address: src.address,
        courseLeaderPhone: src.courseLeaderPhone,
        startDate: new Date(input.newStartDate),
        endDate: new Date(input.newEndDate),
        maxSeats: src.maxSeats,
        bookedSeats: 0,
        additionalDays: input.newAdditionalDays ?? null,
        bookingInfo: input.bookingInfo ?? src.bookingInfo ?? null,
        notes: null,
        published: false,
        status: "pending_approval",
        submittedBy: dashUser.id,
        leaderMessage: input.leaderMessage ?? null,
        adminMessage: null,
        changeLog: JSON.stringify(changeLogEntry),
      });

      // Notify admin
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `Ny kurs att godkänna (kopierad): ${src.courseLeaderName}`,
          content: `${dashUser.name} har kopierat ett kurstillfälle.\nKurstyp: ${src.courseType}\nNytt datum: ${input.newStartDate}\nPlats: ${input.venueName}, ${src.city}`,
        });
      } catch { /* non-blocking */ }

      return { success: true };
    }),

  // ─── Course leader: batch register multiple dates ──────────────────────────
  leaderBatchRegister: dashboardProcedure
    .input(
      z.object({
        ghlCalendarId: z.string().min(1),
        venueName: z.string().min(1),
        bookingInfo: z.string().optional(),
        leaderMessage: z.string().optional(),
        dates: z.array(
          z.object({
            startDate: z.string(),
            endDate: z.string(),
            additionalDays: z.string().optional(),
          })
        ).min(1).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      // Fetch and verify calendar ownership
      const calendars = await getGhlCalendars();
      const cal = calendars.find((c) => c.id === input.ghlCalendarId);
      if (!cal) throw new TRPCError({ code: "NOT_FOUND", message: "Calendar not found" });

      const users = await getGhlUsers();
      const userMap = new Map(users.map((u) => [u.id, u]));
      const primaryMember = cal.teamMembers?.find((m) => m.isPrimary) ?? cal.teamMembers?.[0];
      const ghlUser = primaryMember ? userMap.get(primaryMember.userId) : null;

      if (dashUser.role !== "admin") {
        const myName = dashUser.name.toLowerCase().trim();
        if (!ghlUser || ghlUser.name.toLowerCase().trim() !== myName) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This calendar does not belong to you" });
        }
      }

      const groupInfo = cal.groupId ? CALENDAR_GROUPS[cal.groupId as keyof typeof CALENDAR_GROUPS] : null;
      const courseType = groupInfo?.type ?? "intro";
      const language = groupInfo?.language ?? "sv";
      const maxSeats = cal.appoinmentPerSlot ?? 12;

      // Parse address/city from meetingLocation
      const rawLocation = primaryMember?.meetingLocation ?? "";
      const locParts = rawLocation.split(/\t/).map((s: string) => s.trim()).filter(Boolean);
      let autoAddress: string | null = null;
      let autoCity = "";
      if (locParts.length >= 3) {
        const formattedZip = /^\d{5}$/.test(locParts[1]) ? `${locParts[1].slice(0, 3)} ${locParts[1].slice(3)}` : locParts[1];
        autoAddress = `${locParts[0]}, ${formattedZip} ${locParts[2]}`;
        autoCity = locParts[2];
      } else if (locParts.length === 2) {
        autoAddress = `${locParts[0]}, ${locParts[1]}`;
        autoCity = locParts[1];
      }

      // Validate each date entry
      const MIN_DAYS: Record<string, number> = { intro: 1, diplo: 4, cert: 6, vidare: 2 };
      const minRequired = MIN_DAYS[courseType] ?? 1;
      for (const d of input.dates) {
        const addDays = d.additionalDays ? JSON.parse(d.additionalDays) : [];
        const totalDays = 1 + addDays.length;
        if (courseType === "intro" && totalDays !== 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Introduktionskurs måste vara exakt 1 dag" });
        }
        if (totalDays < minRequired) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Kurstyp ${courseType} kräver minst ${minRequired} dagar` });
        }
      }

      const batchLog = [{
        action: "batch_created",
        by: dashUser.name,
        byId: dashUser.id,
        at: new Date().toISOString(),
        details: `Batch-registrering: ${input.dates.length} kurstillfällen`,
      }];

      for (const d of input.dates) {
        await db.insert(courseDates).values({
          ghlCalendarId: input.ghlCalendarId,
          courseLeaderName: ghlUser?.name ?? dashUser.name,
          ghlUserId: ghlUser?.id ?? null,
          courseType,
          language,
          city: autoCity,
          country: "Sweden",
          venueName: input.venueName,
          address: autoAddress,
          courseLeaderPhone: ghlUser?.phone ?? dashUser.phone ?? null,
          startDate: new Date(d.startDate),
          endDate: new Date(d.endDate),
          maxSeats,
          bookedSeats: 0,
          additionalDays: d.additionalDays ?? null,
          bookingInfo: input.bookingInfo ?? null,
          notes: null,
          published: false,
          status: "pending_approval",
          submittedBy: dashUser.id,
          leaderMessage: input.leaderMessage ?? null,
          adminMessage: null,
          changeLog: JSON.stringify(batchLog),
        });
      }

      // Notify admin
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `Batch-registrering: ${input.dates.length} kurser att godkänna`,
          content: `${dashUser.name} har registrerat ${input.dates.length} kurstillfällen (${groupInfo?.name ?? courseType}).\nPlats: ${input.venueName}, ${autoCity}\nDatum: ${input.dates.map((d) => d.startDate.slice(0, 10)).join(", ")}`,
        });
      } catch { /* non-blocking */ }

      return { success: true, count: input.dates.length };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN APPROVAL / ACTION FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Admin: list pending actions ───────────────────────────────────────────
  listPending: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const rows = await db
      .select()
      .from(courseDates)
      .where(
        and(
          // Any non-approved, non-cancelled status
          // We check for specific pending statuses
        )
      )
      .orderBy(asc(courseDates.startDate));

    // Filter to pending statuses in JS since drizzle doesn't have easy OR for enums
    const pendingStatuses = ["pending_approval", "pending_cancellation", "pending_reschedule", "needs_revision"];
    return rows.filter((r) => pendingStatuses.includes(r.status));
  }),

  // ─── Admin: approve a course date ──────────────────────────────────────────
  adminApprove: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        adminMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.id));
      const course = rows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      const existingLog = course.changeLog ? JSON.parse(course.changeLog) : [];

      if (course.status === "pending_approval") {
        // Approve new course → publish it
        existingLog.push({
          action: "approved",
          by: dashUser.name,
          byId: dashUser.id,
          at: new Date().toISOString(),
          details: input.adminMessage || "Godkänd av admin",
        });

        await db.update(courseDates).set({
          status: "approved",
          published: true,
          adminMessage: input.adminMessage ?? null,
          changeLog: JSON.stringify(existingLog),
        }).where(eq(courseDates.id, input.id));

      } else if (course.status === "pending_cancellation") {
        // Approve cancellation
        existingLog.push({
          action: "cancellation_approved",
          by: dashUser.name,
          byId: dashUser.id,
          at: new Date().toISOString(),
          details: input.adminMessage || "Avbokning godkänd",
        });

        await db.update(courseDates).set({
          status: "cancelled",
          published: false,
          adminMessage: input.adminMessage ?? null,
          changeLog: JSON.stringify(existingLog),
        }).where(eq(courseDates.id, input.id));

      } else if (course.status === "pending_reschedule") {
        // Approve reschedule → apply new dates
        existingLog.push({
          action: "reschedule_approved",
          by: dashUser.name,
          byId: dashUser.id,
          at: new Date().toISOString(),
          details: `Ombokning godkänd: ${course.rescheduleNewStart?.toISOString().slice(0, 10) ?? "?"}`,
          oldStart: course.startDate.toISOString(),
          newStart: course.rescheduleNewStart?.toISOString() ?? null,
        });

        await db.update(courseDates).set({
          status: "approved",
          startDate: course.rescheduleNewStart ?? course.startDate,
          endDate: course.rescheduleNewEnd ?? course.endDate,
          additionalDays: course.rescheduleNewAdditionalDays ?? course.additionalDays,
          rescheduleNewStart: null,
          rescheduleNewEnd: null,
          rescheduleNewAdditionalDays: null,
          adminMessage: input.adminMessage ?? null,
          changeLog: JSON.stringify(existingLog),
        }).where(eq(courseDates.id, input.id));
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot approve course with status: ${course.status}` });
      }

      // Notify course leader via owner notification
      try {
        const { notifyOwner } = await import("../_core/notification");
        const actionLabel = course.status === "pending_cancellation" ? "avbokning" : course.status === "pending_reschedule" ? "ombokning" : "kursregistrering";
        await notifyOwner({
          title: `${course.courseLeaderName}: Din ${actionLabel} har godkänts`,
          content: `Admin har godkänt din ${actionLabel} för ${course.courseType} den ${course.startDate.toISOString().slice(0, 10)}.${input.adminMessage ? `\nMeddelande: ${input.adminMessage}` : ""}`,
        });
      } catch { /* non-blocking */ }

      return { success: true };
    }),

  // ─── Admin: request revision (needs_revision) ──────────────────────────────
  adminRequestRevision: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        adminMessage: z.string().min(1, "Please provide a reason for the revision request"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.id));
      const course = rows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      const existingLog = course.changeLog ? JSON.parse(course.changeLog) : [];
      existingLog.push({
        action: "revision_requested",
        by: dashUser.name,
        byId: dashUser.id,
        at: new Date().toISOString(),
        details: input.adminMessage,
      });

      await db.update(courseDates).set({
        status: "needs_revision",
        adminMessage: input.adminMessage,
        changeLog: JSON.stringify(existingLog),
      }).where(eq(courseDates.id, input.id));

      // Send email notification to course leader about revision needed
      try {
        // Look up course leader's email from dashboard_users
        const leaderRows = await db.select().from(dashboardUsers);
        const leader = leaderRows.find(
          (u) => u.name.toLowerCase().trim() === course.courseLeaderName.toLowerCase().trim()
        );
        if (leader?.email) {
          // Use GHL to send email if we can find the contact
          const { searchContactByEmail } = await import("../ghl");
          const contact = await searchContactByEmail(leader.email);
          if (contact) {
            const GHL_BASE_URL = "https://services.leadconnectorhq.com";
            const apiKey = process.env.GHL_API_KEY ?? "";
            await fetch(`${GHL_BASE_URL}/conversations/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                Version: "2021-04-15",
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                type: "Email",
                contactId: contact.id,
                emailTo: leader.email,
                emailFrom: "info@fasciaacademy.com",
                subject: "Your course registration requires revision",
                html: `<p>Hi ${course.courseLeaderName},</p><p>Your course registration requires some revisions. Please log in to the Portal to view the admin's notes and resubmit.</p><p>Kind regards,<br>Fascia Academy</p>`,
                status: "pending",
              }),
            }).catch(() => {});
          }
        }
      } catch { /* non-blocking */ }

      // Also notify via owner notification
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `Revision requested: ${course.courseLeaderName}`,
          content: `Admin has requested a revision for ${course.courseType} on ${course.startDate.toISOString().slice(0, 10)}.\nReason: ${input.adminMessage}`,
        });
      } catch { /* non-blocking */ }

      return { success: true };
    }),

  // ─── Admin: reject (deny) a pending action ─────────────────────────────────
  adminReject: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        adminMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.id));
      const course = rows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      const existingLog = course.changeLog ? JSON.parse(course.changeLog) : [];

      if (course.status === "pending_approval") {
        // Reject new course registration
        existingLog.push({
          action: "rejected",
          by: dashUser.name,
          byId: dashUser.id,
          at: new Date().toISOString(),
          details: input.adminMessage || "Avvisad av admin",
        });
        await db.update(courseDates).set({
          status: "cancelled",
          adminMessage: input.adminMessage ?? null,
          changeLog: JSON.stringify(existingLog),
        }).where(eq(courseDates.id, input.id));

      } else if (course.status === "pending_cancellation") {
        // Deny cancellation → restore to approved
        existingLog.push({
          action: "cancellation_denied",
          by: dashUser.name,
          byId: dashUser.id,
          at: new Date().toISOString(),
          details: input.adminMessage || "Avbokning nekad",
        });
        await db.update(courseDates).set({
          status: "approved",
          adminMessage: input.adminMessage ?? null,
          changeLog: JSON.stringify(existingLog),
        }).where(eq(courseDates.id, input.id));

      } else if (course.status === "pending_reschedule") {
        // Deny reschedule → restore to approved, clear proposed dates
        existingLog.push({
          action: "reschedule_denied",
          by: dashUser.name,
          byId: dashUser.id,
          at: new Date().toISOString(),
          details: input.adminMessage || "Ombokning nekad",
        });
        await db.update(courseDates).set({
          status: "approved",
          rescheduleNewStart: null,
          rescheduleNewEnd: null,
          rescheduleNewAdditionalDays: null,
          adminMessage: input.adminMessage ?? null,
          changeLog: JSON.stringify(existingLog),
        }).where(eq(courseDates.id, input.id));
      }

      return { success: true };
    }),

  // ─── Course leader: resubmit after revision request ────────────────────────
  leaderResubmit: dashboardProcedure
    .input(
      z.object({
        id: z.number().int(),
        venueName: z.string().min(1).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        additionalDays: z.string().optional(),
        bookingInfo: z.string().optional(),
        leaderMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.id));
      const course = rows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify ownership
      if (dashUser.role !== "admin" && course.courseLeaderName.toLowerCase().trim() !== dashUser.name.toLowerCase().trim()) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (course.status !== "needs_revision") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This course does not require revision" });
      }

      const existingLog = course.changeLog ? JSON.parse(course.changeLog) : [];
      existingLog.push({
        action: "resubmitted",
        by: dashUser.name,
        byId: dashUser.id,
        at: new Date().toISOString(),
        details: input.leaderMessage || "Revision submitted",
      });

      const updateData: Record<string, unknown> = {
        status: "pending_approval",
        leaderMessage: input.leaderMessage ?? null,
        adminMessage: null,
        changeLog: JSON.stringify(existingLog),
      };
      if (input.venueName) updateData.venueName = input.venueName;
      if (input.startDate) updateData.startDate = new Date(input.startDate);
      if (input.endDate) updateData.endDate = new Date(input.endDate);
      if (input.additionalDays !== undefined) updateData.additionalDays = input.additionalDays;
      if (input.bookingInfo !== undefined) updateData.bookingInfo = input.bookingInfo;

      await db.update(courseDates).set(updateData).where(eq(courseDates.id, input.id));

      // Notify admin
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `Revision submitted: ${course.courseLeaderName}`,
          content: `${dashUser.name} has resubmitted their course registration for ${course.courseType}.\n${input.leaderMessage ? `Message: ${input.leaderMessage}` : ""}`,
        });
      } catch { /* non-blocking */ }

      return { success: true };
    }),

  // ─── Get change log for a course date ──────────────────────────────────────
  getChangeLog: dashboardProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.id));
      const course = rows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      // Course leaders can only see their own course logs
      if (dashUser.role !== "admin" && course.courseLeaderName.toLowerCase().trim() !== dashUser.name.toLowerCase().trim()) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return {
        log: course.changeLog ? JSON.parse(course.changeLog) : [],
        adminMessage: course.adminMessage,
        leaderMessage: course.leaderMessage,
      };
    }),
});
