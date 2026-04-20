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
import { courseDates, dashboardUsers, participantSnapshots, courseLeaderMessages, exams } from "../../drizzle/schema";
import type { DashboardUser } from "../../drizzle/schema";
import { parse as parseCookies } from "cookie";
import { getSessionUser } from "../dashboardAuth";
import { issueCertificateForParticipant } from "./certificatesRouter";
import { setGhlTag } from "../ghl";

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

// Per-course TTL cache for live booked seat counts (2-minute TTL)
const liveSeatsCache = new Map<number, { count: number; fetchedAt: number }>();
const LIVE_SEATS_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Fetch live booked seat counts from GHL for a list of course rows (with per-course TTL cache)
async function getLiveBookedSeats(
  rows: Array<{ id: number; ghlCalendarId: string; startDate: Date; endDate: Date }>
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  const now = Date.now();
  // Separate rows that need a fresh fetch from those that can use the cache
  const stale = rows.filter((row) => {
    const cached = liveSeatsCache.get(row.id);
    return !cached || now - cached.fetchedAt >= LIVE_SEATS_TTL_MS;
  });
  // Serve cached values immediately
  for (const row of rows) {
    const cached = liveSeatsCache.get(row.id);
    if (cached && now - cached.fetchedAt < LIVE_SEATS_TTL_MS) {
      result.set(row.id, cached.count);
    }
  }
  // Fetch stale rows in parallel
  await Promise.all(
    stale.map(async (row) => {
      try {
        const startMs = new Date(row.startDate).getTime() - 24 * 60 * 60 * 1000;
        const endMs = new Date(row.endDate).getTime() + 24 * 60 * 60 * 1000;
        const res = await fetch(
          `${GHL_BASE}/calendars/events?calendarId=${row.ghlCalendarId}&locationId=${LOCATION_ID}&startTime=${startMs}&endTime=${endMs}`,
          {
            headers: {
              Authorization: `Bearer ${API_KEY}`,
              Version: "2021-04-15",
              Accept: "application/json",
            },
          }
        );
        if (!res.ok) { result.set(row.id, 0); liveSeatsCache.set(row.id, { count: 0, fetchedAt: now }); return; }
        const data = await res.json() as { events?: Array<{ appointmentStatus?: string; status?: string }> };
        const events = data.events ?? [];
        const booked = events.filter((e) => {
          const s = (e.appointmentStatus ?? e.status ?? "").toLowerCase();
          return !["cancelled", "invalid", "no_show", "noshow"].includes(s);
        }).length;
        result.set(row.id, booked);
        liveSeatsCache.set(row.id, { count: booked, fetchedAt: now });
      } catch {
        result.set(row.id, 0);
        liveSeatsCache.set(row.id, { count: 0, fetchedAt: now });
      }
    })
  );
  return result;
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

      // Fetch live booked seats and max seats from GHL
      const calendars = await getGhlCalendars();
      const calMap = new Map(calendars.map((c) => [c.id, c]));
      const liveBooked = await getLiveBookedSeats(filtered);
      return filtered.map((row) => ({
        ...row,
        profilePhoto: row.ghlUserId ? (userMap.get(row.ghlUserId)?.profilePhoto ?? null) : null,
        profileUrl: profileUrlByName.get(row.courseLeaderName.toLowerCase()) ?? null,
        bookedSeats: liveBooked.get(row.id) ?? 0,
        maxSeats: calMap.get(row.ghlCalendarId)?.appoinmentPerSlot ?? 20,
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

    // Enrich all groups with live booked/max seats from GHL
    const allMine = Array.from(new Map([...upcoming, ...past, ...pending, ...cancelled].map((r) => [r.id, r])).values());
    const calendars = await getGhlCalendars();
    const calMap = new Map(calendars.map((c) => [c.id, c]));
    const liveBooked = await getLiveBookedSeats(allMine);
    const enrich = <T extends { id: number; ghlCalendarId: string }>(rows: T[]) =>
      rows.map((r) => ({
        ...r,
        bookedSeats: liveBooked.get(r.id) ?? 0,
        maxSeats: calMap.get(r.ghlCalendarId)?.appoinmentPerSlot ?? 20,
      }));

    return {
      upcoming: enrich(upcoming),
      past: enrich(past),
      pending: enrich(pending),
      cancelled: enrich(cancelled),
    };
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
    const calendars = await getGhlCalendars();
    const calMap = new Map(calendars.map((c) => [c.id, c]));
    const liveBooked = await getLiveBookedSeats(rows);

    return rows.map((row) => ({
      ...row,
      profilePhoto: row.ghlUserId ? (userMap.get(row.ghlUserId)?.profilePhoto ?? null) : null,
      bookedSeats: liveBooked.get(row.id) ?? 0,
      maxSeats: calMap.get(row.ghlCalendarId)?.appoinmentPerSlot ?? 20,
    }));
  }),

  // ─── Admin: force-clear live seats cache (manual refresh) ─────────────────
  refreshLiveSeats: adminProcedure
    .input(z.object({ ids: z.array(z.number()).optional() }))
    .mutation(({ input }) => {
      if (input.ids && input.ids.length > 0) {
        for (const id of input.ids) liveSeatsCache.delete(id);
      } else {
        liveSeatsCache.clear();
      }
      return { ok: true };
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
    // Only show statuses that require admin action:
    // - pending_approval: new registration awaiting review
    // - pending_cancellation: leader requested cancellation
    // - pending_reschedule: leader requested reschedule
    // - resubmitted: leader resubmitted after revision request
    // NOT needs_revision: that awaits the course leader, not admin
    const pendingStatuses = ["pending_approval", "pending_cancellation", "pending_reschedule", "resubmitted"];
    const pending = rows.filter((r) => pendingStatuses.includes(r.status));

    // Enrich with live booked/max seats from GHL
    const calendars = await getGhlCalendars();
    const calMap = new Map(calendars.map((c) => [c.id, c]));
    const liveBooked = await getLiveBookedSeats(pending);
    return pending.map((r) => ({
      ...r,
      bookedSeats: liveBooked.get(r.id) ?? 0,
      maxSeats: calMap.get(r.ghlCalendarId)?.appoinmentPerSlot ?? 20,
    }));
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
          details: input.adminMessage || "Approved by admin",
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
          details: input.adminMessage || "Cancellation approved",
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
          details: `Reschedule approved: ${course.rescheduleNewStart?.toISOString().slice(0, 10) ?? "?"}`,
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
        const actionLabel = course.status === "pending_cancellation" ? "cancellation" : course.status === "pending_reschedule" ? "reschedule" : "course registration";
        await notifyOwner({
          title: `${course.courseLeaderName}: Your ${actionLabel} has been approved`,
          content: `Admin has approved your ${actionLabel} for ${course.courseType} on ${course.startDate.toISOString().slice(0, 10)}.${input.adminMessage ? `\nMessage: ${input.adminMessage}` : ""}`,
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

  // ─── Course leader: get participants for a course date ─────────────────────
  getCourseParticipants: dashboardProcedure
    .input(z.object({ courseDateId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      // Fetch the course date
      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.courseDateId));
      const course = rows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      // Only admin or the owning course leader can see participants
      if (
        dashUser.role !== "admin" &&
        course.courseLeaderName.toLowerCase().trim() !== dashUser.name.toLowerCase().trim() &&
        course.submittedBy !== dashUser.id
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Fetch appointments from GHL for this calendar within the course date window
      // Use a ±1 day window around startDate to catch all bookings
      const startMs = new Date(course.startDate).getTime() - 24 * 60 * 60 * 1000;
      const endMs = new Date(course.endDate).getTime() + 24 * 60 * 60 * 1000;

      try {
        const res = await fetch(
          `${GHL_BASE}/calendars/events?calendarId=${course.ghlCalendarId}&locationId=${LOCATION_ID}&startTime=${startMs}&endTime=${endMs}`,
          {
            headers: {
              Authorization: `Bearer ${API_KEY}`,
              Version: "2021-04-15",
              Accept: "application/json",
            },
          }
        );
        if (!res.ok) {
          const body = await res.text();
          console.error("[getCourseParticipants] GHL error:", res.status, body);
          return { participants: [] };
        }
        const data = await res.json() as { events?: Array<{
          id: string;
          title?: string;
          contactId?: string;
          appointmentStatus?: string;
          status?: string;
          startTime?: string;
          contact?: { firstName?: string; lastName?: string; email?: string; phone?: string };
        }> };

        const events = data.events ?? [];
        // Exclude truly cancelled/invalid appointments
        const active = events.filter((e) => {
          const s = (e.appointmentStatus ?? e.status ?? "").toLowerCase();
          return !["cancelled", "invalid"].includes(s);
        });

        const isAdmin = dashUser.role === "admin";
        const participants = active.map((e) => {
          const firstName = e.contact?.firstName ?? "";
          const lastName = e.contact?.lastName ?? "";
          const name = [firstName, lastName].filter(Boolean).join(" ") || e.title || e.contactId || "Unknown";
          const status = (e.appointmentStatus ?? e.status ?? "").toLowerCase();
          return {
            appointmentId: e.id,
            contactId: e.contactId ?? "",
            name,
            // Email only visible to admins — course leaders see phone only (data privacy)
            email: isAdmin ? (e.contact?.email ?? "") : "",
            phone: e.contact?.phone ?? "",
            showed: status === "showed" || status === "show",
            noShow: status === "no_show" || status === "noshow",
            status,
          };
        });

        return { participants, courseType: course.courseType };
      } catch (err) {
        console.error("[getCourseParticipants] fetch error:", err);
        return { participants: [], courseType: course.courseType };
      }
    }),
  // ─── Course leader: mark a participant as showed / undo ────────────────────
  markParticipantShowed: dashboardProcedure
    .input(
      z.object({
        courseDateId: z.number().int(),
        appointmentId: z.string().min(1),
        showed: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      // Verify ownership
      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.courseDateId));
      const course = rows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      if (
        dashUser.role !== "admin" &&
        course.courseLeaderName.toLowerCase().trim() !== dashUser.name.toLowerCase().trim() &&
        course.submittedBy !== dashUser.id
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // First fetch appointment details (needed for required PUT fields + snapshot)
      const apptRes = await fetch(`${GHL_BASE}/calendars/events/appointments/${input.appointmentId}`, {
        headers: { Authorization: `Bearer ${API_KEY}`, Version: "2021-04-15", Accept: "application/json" },
      });
      if (!apptRes.ok) {
        console.error("[markParticipantShowed] Failed to fetch appointment:", apptRes.status);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch appointment details" });
      }
      const apptData = await apptRes.json();
      const appt = apptData?.appointment || apptData;

      // Update appointment status in GHL (must include calendarId, startTime, endTime)
      const newStatus = input.showed ? "showed" : "confirmed";
      const res = await fetch(`${GHL_BASE}/calendars/events/appointments/${input.appointmentId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Version: "2021-04-15",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          calendarId: appt.calendarId || course.ghlCalendarId,
          startTime: appt.startTime,
          endTime: appt.endTime,
          appointmentStatus: newStatus,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error("[markParticipantShowed] GHL error:", res.status, body);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `GHL update failed: ${res.status}`,
        });
      }

      // Snapshot participant data when marking as showed
      if (input.showed) {
        try {
          const contact = appt.contact || {};
          const meta = appt.appointmentMeta?.defaultFormDetails || {};
          const contactId = appt.contactId || contact.id || "";
          const firstName = contact.firstName || meta.firstName || "";
          const lastName = contact.lastName || meta.lastName || "";
          const name = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
          await db.insert(participantSnapshots).values({
            courseDateId: input.courseDateId,
            ghlAppointmentId: input.appointmentId,
            ghlContactId: contactId,
            participantName: name,
            participantPhone: contact.phone || meta.phone || null,
            participantEmail: contact.email || meta.email || null,
            status: "showed",
          });
        } catch (snapErr) {
          console.error("[markParticipantShowed] snapshot error (non-fatal):", snapErr);
        }
        // Auto-issue certificate for intro and vidare courses
        try {
          const contact = appt.contact || {};
          const meta = appt.appointmentMeta?.defaultFormDetails || {};
          const contactId = appt.contactId || contact.id || "";
          const firstName = contact.firstName || meta.firstName || "";
          const lastName = contact.lastName || meta.lastName || "";
          const name = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
          const email = contact.email || meta.email || null;
          // Use course type and language directly from the course record
          const courseTypeForCert = course.courseType as "intro" | "diplo" | "cert" | "vidare";
          const langForCert = (course.language as "sv" | "en" | undefined) ?? "sv";
          if ((courseTypeForCert === "intro" || courseTypeForCert === "vidare") && contactId) {
            // Intro/Vidare: issue certificate immediately on showed
            await issueCertificateForParticipant({
              ghlContactId: contactId,
              contactName: name,
              contactEmail: email,
              courseType: courseTypeForCert,
              language: langForCert,
              issuedBy: dashUser.id,
            });
          } else if ((courseTypeForCert === "diplo" || courseTypeForCert === "cert") && contactId) {
            // Diplo/Cert: only issue certificate if participant also has a passed exam
            const db2 = await getDb();
            if (db2) {
              const passedExam = await db2
                .select()
                .from(exams)
                .where(
                  and(
                    eq(exams.ghlContactId, contactId),
                    eq(exams.courseType, courseTypeForCert),
                    eq(exams.status, "passed")
                  )
                )
                .limit(1);
              if (passedExam.length > 0) {
                console.log(`[markParticipantShowed] ${name} has passed exam for ${courseTypeForCert} — issuing certificate`);
                await issueCertificateForParticipant({
                  ghlContactId: contactId,
                  contactName: name,
                  contactEmail: email,
                  courseType: courseTypeForCert,
                  language: langForCert,
                  issuedBy: dashUser.id,
                  examId: passedExam[0].id,
                });
              } else {
                console.log(`[markParticipantShowed] ${name} showed for ${courseTypeForCert} but no passed exam yet — certificate deferred`);
              }
            }
          }
        } catch (certErr) {
          console.error("[markParticipantShowed] certificate issue failed (non-fatal):", certErr);
        }
        // Add GHL pipeline completion tags (non-fatal)
        try {
          const contact = appt.contact || {};
          const meta = appt.appointmentMeta?.defaultFormDetails || {};
          const contactId = appt.contactId || contact.id || "";
          if (contactId) {
            const courseTypeForTag = course.courseType as string;
            // Map course type to the correct GHL pipeline completion tag
            const TAG_MAP: Record<string, string> = {
              intro: "Intro CF – Completed",
              diplo: "Diplo/Quali FS - Complete",
              cert: "Cert FS - Complete",
              vidare: "Vidare/advance FS - Complete",
            };
            const completionTag = TAG_MAP[courseTypeForTag];
            if (completionTag) {
              await setGhlTag(contactId, completionTag);
              console.log(`[markParticipantShowed] GHL tag set: '${completionTag}' on contact ${contactId}`);
            }
          }
        } catch (tagErr) {
          console.error("[markParticipantShowed] GHL tag update failed (non-fatal):", tagErr);
        }
      }
      return { success: true, appointmentId: input.appointmentId, showed: input.showed };;
    }),

  // ─── Course leader: mark a participant as no-show ────────────────────────
  markParticipantNoShow: dashboardProcedure
    .input(
      z.object({
        courseDateId: z.number().int(),
        appointmentId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      // Verify ownership
      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.courseDateId));
      const course = rows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      if (
        dashUser.role !== "admin" &&
        course.courseLeaderName.toLowerCase().trim() !== dashUser.name.toLowerCase().trim() &&
        course.submittedBy !== dashUser.id
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // First fetch appointment details (needed for required PUT fields + snapshot)
      const apptRes = await fetch(`${GHL_BASE}/calendars/events/appointments/${input.appointmentId}`, {
        headers: { Authorization: `Bearer ${API_KEY}`, Version: "2021-04-15", Accept: "application/json" },
      });
      if (!apptRes.ok) {
        console.error("[markParticipantNoShow] Failed to fetch appointment:", apptRes.status);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch appointment details" });
      }
      const apptData = await apptRes.json();
      const appt = apptData?.appointment || apptData;

      // Update appointment status in GHL to "noshow" (must include calendarId, startTime, endTime)
      const res = await fetch(`${GHL_BASE}/calendars/events/appointments/${input.appointmentId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Version: "2021-04-15",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          calendarId: appt.calendarId || course.ghlCalendarId,
          startTime: appt.startTime,
          endTime: appt.endTime,
          appointmentStatus: "noshow",
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error("[markParticipantNoShow] GHL error:", res.status, body);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `GHL update failed: ${res.status}`,
        });
      }

      // Snapshot participant data when marking as no-show
      try {
        const contact = appt.contact || {};
        const meta = appt.appointmentMeta?.defaultFormDetails || {};
        const contactId = appt.contactId || contact.id || "";
        const firstName = contact.firstName || meta.firstName || "";
        const lastName = contact.lastName || meta.lastName || "";
        const name = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
        await db.insert(participantSnapshots).values({
          courseDateId: input.courseDateId,
          ghlAppointmentId: input.appointmentId,
          ghlContactId: contactId,
          participantName: name,
          participantPhone: contact.phone || meta.phone || null,
          participantEmail: contact.email || meta.email || null,
          status: "noshow",
        });
      } catch (snapErr) {
        console.error("[markParticipantNoShow] snapshot error (non-fatal):", snapErr);
      }

      return { success: true, appointmentId: input.appointmentId };
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

  // ─── Course leader: create/update a message draft ─────────────────────────
  createMessageDraft: dashboardProcedure
    .input(
      z.object({
        courseDateId: z.number().int(),
        subject: z.string().min(1).max(500),
        body: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      // Verify ownership
      const rows = await db.select().from(courseDates).where(eq(courseDates.id, input.courseDateId));
      const course = rows[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (
        dashUser.role !== "admin" &&
        course.courseLeaderName.toLowerCase().trim() !== dashUser.name.toLowerCase().trim() &&
        course.submittedBy !== dashUser.id
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const result = await db.insert(courseLeaderMessages).values({
        courseDateId: input.courseDateId,
        authorId: dashUser.id,
        subject: input.subject,
        body: input.body,
        status: "draft",
      });

      return { success: true, messageId: Number(result[0].insertId) };
    }),

  // ─── Course leader: submit draft for admin approval ───────────────────────
  submitMessageForApproval: dashboardProcedure
    .input(z.object({ messageId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      const rows = await db.select().from(courseLeaderMessages).where(eq(courseLeaderMessages.id, input.messageId));
      const msg = rows[0];
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      if (msg.authorId !== dashUser.id && dashUser.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (msg.status !== "draft" && msg.status !== "rejected") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Message is not in draft/rejected status" });
      }

      await db.update(courseLeaderMessages)
        .set({ status: "pending_approval" })
        .where(eq(courseLeaderMessages.id, input.messageId));

      return { success: true };
    }),

  // ─── List messages for a course date ──────────────────────────────────────
  listMessages: dashboardProcedure
    .input(z.object({ courseDateId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;

      // Verify ownership
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

      return db.select().from(courseLeaderMessages)
        .where(eq(courseLeaderMessages.courseDateId, input.courseDateId))
        .orderBy(desc(courseLeaderMessages.createdAt));
    }),

  // ─── Admin: list all pending messages ──────────────────────────────────────
  listPendingMessages: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const messages = await db.select().from(courseLeaderMessages)
      .where(eq(courseLeaderMessages.status, "pending_approval"))
      .orderBy(asc(courseLeaderMessages.createdAt));
    // Enrich with course info and author name
    const enriched = [];
    for (const msg of messages) {
      const courseRows = await db.select().from(courseDates).where(eq(courseDates.id, msg.courseDateId));
      const authorRows = await db.select().from(dashboardUsers).where(eq(dashboardUsers.id, msg.authorId));
      enriched.push({
        ...msg,
        courseType: courseRows[0]?.courseType ?? "unknown",
        courseCity: courseRows[0]?.city ?? "",
        courseDate: courseRows[0]?.startDate ?? null,
        authorName: authorRows[0]?.name ?? "Unknown",
      });
    }
    return enriched;
  }),

  // ─── Admin: review message (approve/reject/edit) ──────────────────────────
  reviewMessage: dashboardProcedure
    .input(
      z.object({
        messageId: z.number().int(),
        action: z.enum(["approve", "reject"]),
        adminNote: z.string().optional(),
        editedSubject: z.string().optional(),
        editedBody: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashUser = (ctx as { dashUser: DashboardUser }).dashUser;
      if (dashUser.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

      const rows = await db.select().from(courseLeaderMessages).where(eq(courseLeaderMessages.id, input.messageId));
      const msg = rows[0];
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      if (msg.status !== "pending_approval") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Message is not pending approval" });
      }

      if (input.action === "reject") {
        await db.update(courseLeaderMessages)
          .set({
            status: "rejected",
            adminNote: input.adminNote || null,
            reviewedBy: dashUser.id,
            reviewedAt: new Date(),
          })
          .where(eq(courseLeaderMessages.id, input.messageId));
        return { success: true, action: "rejected" };
      }

      // Approve — optionally update subject/body if admin edited
      const updates: Record<string, unknown> = {
        status: "approved" as const,
        reviewedBy: dashUser.id,
        reviewedAt: new Date(),
        adminNote: input.adminNote || null,
      };
      if (input.editedSubject) updates.subject = input.editedSubject;
      if (input.editedBody) updates.body = input.editedBody;

      await db.update(courseLeaderMessages)
        .set(updates)
        .where(eq(courseLeaderMessages.id, input.messageId));

      // Send emails to all participants via GHL
      try {
        const finalMsg = { ...msg, ...updates };
        // Get participants from GHL
        const course = (await db.select().from(courseDates).where(eq(courseDates.id, msg.courseDateId)))[0];
        if (course) {
          const startStr = course.startDate.toISOString().split("T")[0];
          const endStr = course.endDate.toISOString().split("T")[0];
          const apptRes = await fetch(
            `${GHL_BASE}/calendars/appointments?calendarId=${course.ghlCalendarId}&startDate=${startStr}&endDate=${endStr}&status=confirmed,showed`,
            { headers: { Authorization: `Bearer ${API_KEY}`, Version: "2021-04-15", Accept: "application/json" } }
          );
          if (apptRes.ok) {
            const apptData = await apptRes.json();
            const appointments = apptData?.appointments || apptData?.data?.appointments || [];
            let sentCount = 0;
            for (const appt of appointments) {
              const email = appt?.contact?.email || appt?.email;
              if (!email) continue;
              // Send email via GHL Conversations API
              try {
                const contactId = appt?.contact?.id || appt?.contactId;
                if (contactId) {
                  await fetch(`${GHL_BASE}/conversations/messages`, {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${API_KEY}`,
                      Version: "2021-04-15",
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      type: "Email",
                      contactId,
                      subject: finalMsg.subject,
                      html: `<div>${String(finalMsg.body).replace(/\n/g, "<br>")}</div>`,
                      emailFrom: "info@fasciaacademy.com",
                    }),
                  });
                  sentCount++;
                }
              } catch (sendErr) {
                console.error("[reviewMessage] send email error:", sendErr);
              }
            }
            await db.update(courseLeaderMessages)
              .set({ sentAt: new Date(), recipientCount: sentCount })
              .where(eq(courseLeaderMessages.id, input.messageId));
          }
        }
      } catch (sendErr) {
        console.error("[reviewMessage] batch send error:", sendErr);
      }

      return { success: true, action: "approved" };
    }),

  // ─── Admin: remove a participant from a course (cancel appointment in GHL) ────────────────
  removeParticipant: adminProcedure
    .input(
      z.object({
        courseDateId: z.number().int(),
        appointmentId: z.string().min(1),
        contactName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Fetch appointment details first (need calendarId, startTime, endTime for PUT)
      const apptRes = await fetch(`${GHL_BASE}/calendars/events/appointments/${input.appointmentId}`, {
        headers: { Authorization: `Bearer ${API_KEY}`, Version: "2021-04-15", Accept: "application/json" },
      });
      if (!apptRes.ok) {
        const body = await apptRes.text();
        console.error("[removeParticipant] Failed to fetch appointment:", apptRes.status, body);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch appointment details" });
      }
      const apptData = await apptRes.json();
      const appt = apptData?.appointment || apptData;

      // Cancel the appointment in GHL by setting status to "cancelled"
      const res = await fetch(`${GHL_BASE}/calendars/events/appointments/${input.appointmentId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Version: "2021-04-15",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          calendarId: appt.calendarId,
          startTime: appt.startTime,
          endTime: appt.endTime,
          appointmentStatus: "cancelled",
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("[removeParticipant] GHL error:", res.status, body);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to cancel appointment in GHL: ${res.status}`,
        });
      }
      // Invalidate the live seats cache for this course
      liveSeatsCache.delete(input.courseDateId);
      return { success: true, appointmentId: input.appointmentId };
    }),
});
