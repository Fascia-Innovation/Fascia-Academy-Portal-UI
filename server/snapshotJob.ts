/**
 * Participant Snapshot Job
 *
 * Runs every hour. For each published course_date whose startDate is within
 * the past 2 hours (i.e. the course just started), and for which no snapshot
 * exists yet, fetches all registered appointments from GHL and stores them in
 * course_participant_snapshots.
 *
 * This gives us a frozen copy of the participant list at course-start time,
 * independent of future GHL changes. Used as primary data source for past
 * course participant lists (fallback: live GHL fetch if no snapshot exists).
 */

import { eq, and, gte, lte } from "drizzle-orm";
import { getDb } from "./db";
import { courseDates, courseParticipantSnapshots } from "../drizzle/schema";

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY ?? "";
const LOCATION_ID = process.env.GHL_LOCATION_ID ?? "";

export async function takeSnapshotForCourse(courseDateId: number): Promise<{ count: number; skipped: boolean }> {
  const db = await getDb();
  if (!db) return { count: 0, skipped: true };

  // Fetch course date
  const rows = await db.select().from(courseDates).where(eq(courseDates.id, courseDateId));
  const course = rows[0];
  if (!course) return { count: 0, skipped: true };

  // Check if snapshot already exists
  const existing = await db
    .select({ id: courseParticipantSnapshots.id })
    .from(courseParticipantSnapshots)
    .where(eq(courseParticipantSnapshots.courseDateId, courseDateId))
    .limit(1);
  if (existing.length > 0) {
    return { count: existing.length, skipped: true };
  }

  // Fetch appointments from GHL for this calendar within the course date window
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
      console.error(`[snapshotJob] GHL error for course ${courseDateId}:`, res.status);
      return { count: 0, skipped: false };
    }
    const data = await res.json() as {
      events?: Array<{
        id: string;
        contactId?: string;
        appointmentStatus?: string;
        status?: string;
        contact?: { firstName?: string; lastName?: string; email?: string; phone?: string };
      }>;
    };
    const events = data.events ?? [];
    // Include all non-cancelled appointments (regardless of showed/noshow)
    const toSnapshot = events.filter((e) => {
      const s = (e.appointmentStatus ?? e.status ?? "").toLowerCase();
      return !["cancelled", "invalid"].includes(s);
    });

    if (toSnapshot.length === 0) {
      console.log(`[snapshotJob] No participants to snapshot for course ${courseDateId}`);
      return { count: 0, skipped: false };
    }

    // Insert snapshot rows
    const rows = toSnapshot.map((e) => ({
      courseDateId,
      ghlAppointmentId: e.id,
      ghlContactId: e.contactId ?? "",
      firstName: e.contact?.firstName ?? "",
      lastName: e.contact?.lastName ?? "",
      phone: e.contact?.phone ?? null,
      email: e.contact?.email ?? null,
      appointmentStatus: (e.appointmentStatus ?? e.status ?? "confirmed").toLowerCase(),
    }));

    await db.insert(courseParticipantSnapshots).values(rows);
    console.log(`[snapshotJob] Snapshotted ${rows.length} participants for course ${courseDateId}`);
    return { count: rows.length, skipped: false };
  } catch (err) {
    console.error(`[snapshotJob] Error snapshotting course ${courseDateId}:`, err);
    return { count: 0, skipped: false };
  }
}

/**
 * Refresh snapshot for a course — deletes existing snapshot rows and re-fetches from GHL.
 * Used by admin "Refresh snapshot" button.
 */
export async function refreshSnapshotForCourse(courseDateId: number): Promise<{ count: number }> {
  const db = await getDb();
  if (!db) return { count: 0 };

  // Delete existing snapshot rows
  await db.delete(courseParticipantSnapshots).where(eq(courseParticipantSnapshots.courseDateId, courseDateId));

  // Re-take snapshot
  const result = await takeSnapshotForCourse(courseDateId);
  return { count: result.count };
}

/**
 * Hourly background job — checks for courses that started in the last 2 hours
 * and takes a snapshot if none exists yet.
 */
export async function runSnapshotJob(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  // Find published courses that started within the last 2 hours
  const recentCourses = await db
    .select({ id: courseDates.id, startDate: courseDates.startDate })
    .from(courseDates)
    .where(
      and(
        eq(courseDates.published, true),
        gte(courseDates.startDate, twoHoursAgo),
        lte(courseDates.startDate, now)
      )
    );

  if (recentCourses.length === 0) return;

  console.log(`[snapshotJob] Found ${recentCourses.length} courses to potentially snapshot`);
  for (const course of recentCourses) {
    await takeSnapshotForCourse(course.id);
  }
}

/**
 * Start the hourly snapshot job. Called from server startup.
 */
export function startSnapshotJob(): void {
  // Run once at startup (catch any missed snapshots from recent courses)
  runSnapshotJob().catch((err) => console.error("[snapshotJob] startup run error:", err));
  // Then run every hour
  setInterval(() => {
    runSnapshotJob().catch((err) => console.error("[snapshotJob] interval run error:", err));
  }, 60 * 60 * 1000);
  console.log("[snapshotJob] Started — runs every hour");
}
