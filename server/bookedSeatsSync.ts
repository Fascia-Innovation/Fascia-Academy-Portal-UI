/**
 * Background job: Syncs bookedSeats from GHL into course_dates table every 5 minutes.
 * This eliminates live GHL API calls from the public booking page (listPublic).
 * 
 * Flow:
 * 1. Fetch all published future course_dates from DB
 * 2. For each, call GHL /calendars/events to count non-cancelled appointments
 * 3. Update bookedSeats column in DB
 * 
 * Rate-limit aware: processes courses sequentially with a small delay between calls.
 */
import { getDb } from "./db";
import { courseDates } from "../drizzle/schema";
import { eq, and, gte } from "drizzle-orm";

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY ?? "";
const LOCATION_ID = process.env.GHL_LOCATION_ID ?? "";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DELAY_BETWEEN_CALLS_MS = 500; // 500ms between GHL calls to stay under rate limit

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBookedCount(calendarId: string, startDate: Date, endDate: Date): Promise<number> {
  const startMs = new Date(startDate).getTime() - 24 * 60 * 60 * 1000;
  const endMs = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;
  try {
    const res = await fetch(
      `${GHL_BASE}/calendars/events?calendarId=${calendarId}&locationId=${LOCATION_ID}&startTime=${startMs}&endTime=${endMs}`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Version: "2023-02-21",
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) return -1; // Signal error, keep existing value
    const data = await res.json() as { events?: Array<{ appointmentStatus?: string; status?: string }> };
    const events = data.events ?? [];
    return events.filter((e) => {
      const s = (e.appointmentStatus ?? e.status ?? "").toLowerCase();
      return !["cancelled", "invalid", "no_show", "noshow"].includes(s);
    }).length;
  } catch {
    return -1;
  }
}

export async function syncBookedSeats(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  // Only sync future courses that are published
  const futureCourses = await db
    .select({
      id: courseDates.id,
      ghlCalendarId: courseDates.ghlCalendarId,
      startDate: courseDates.startDate,
      endDate: courseDates.endDate,
    })
    .from(courseDates)
    .where(
      and(
        eq(courseDates.published, true),
        gte(courseDates.startDate, now)
      )
    );

  if (futureCourses.length === 0) return;

  let updated = 0;
  for (const course of futureCourses) {
    const count = await fetchBookedCount(course.ghlCalendarId, course.startDate, course.endDate);
    if (count >= 0) {
      await db
        .update(courseDates)
        .set({ bookedSeats: count })
        .where(eq(courseDates.id, course.id));
      updated++;
    }
    // Rate-limit: wait between GHL calls
    await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  if (updated > 0) {
    console.log(`[bookedSeatsSync] Updated ${updated}/${futureCourses.length} courses`);
  }
}

/**
 * Start the background sync job. Called from server startup.
 */
export function startBookedSeatsSync(): void {
  // Run once at startup
  syncBookedSeats().catch((err) => console.error("[bookedSeatsSync] startup error:", err));
  // Then every 5 minutes
  setInterval(() => {
    syncBookedSeats().catch((err) => console.error("[bookedSeatsSync] interval error:", err));
  }, SYNC_INTERVAL_MS);
  console.log("[bookedSeatsSync] Started — syncs every 5 minutes");
}
