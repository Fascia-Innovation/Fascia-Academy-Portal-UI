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

    const allRows = await db
      .select()
      .from(courseDates)
      .where(eq(courseDates.published, true))
      .orderBy(asc(courseDates.startDate));

    const mine = allRows.filter(
      (r) => r.courseLeaderName.toLowerCase().trim() === myName.trim()
    );

    const upcoming = mine.filter((r) => r.startDate >= now);
    const past = mine
      .filter((r) => r.startDate < now)
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .slice(0, 20); // last 20

    return { upcoming, past };
  }),

  // ─── Public: get GHL team members with profile photos ───────────────────────
  getTeamMembers: publicProcedure.query(async () => {
    return getGhlUsers();
  }),

  // ─── Public: get GHL calendars (for admin dropdown) ─────────────────────────
  getCalendars: adminProcedure.query(async () => {
    const [calendars, users] = await Promise.all([getGhlCalendars(), getGhlUsers()]);
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Filter out template calendars and enrich with course type + user info
    return calendars
      .filter((c) => !c.name.startsWith("Template"))
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
          profilePhoto: user?.profilePhoto ?? null,
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
});
