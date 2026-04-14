/**
 * Dashboard authentication helpers — email + password, separate from Manus OAuth.
 */
import { eq, and, gt } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { getDb } from "./db";
import { dashboardUsers, dashboardSessions, type DashboardUser } from "../drizzle/schema";

// ─── Password hashing (SHA-256 + salt, no bcrypt to avoid native deps) ────────
function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(salt + password).digest("hex");
}

function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

export function hashNewPassword(password: string): string {
  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return hashPassword(password, salt) === hash;
}

// ─── Session management ───────────────────────────────────────────────────────
export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const id = generateSessionId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await db.insert(dashboardSessions).values({ id, userId, expiresAt });
  return id;
}

export async function getSessionUser(sessionId: string): Promise<DashboardUser | null> {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const rows = await db
    .select({ user: dashboardUsers })
    .from(dashboardSessions)
    .innerJoin(dashboardUsers, eq(dashboardSessions.userId, dashboardUsers.id))
    .where(and(eq(dashboardSessions.id, sessionId), gt(dashboardSessions.expiresAt, now)))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(dashboardSessions).where(eq(dashboardSessions.id, sessionId));
}

// ─── User management ──────────────────────────────────────────────────────────
export async function loginUser(
  email: string,
  password: string
): Promise<{ sessionId: string; user: DashboardUser } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(dashboardUsers)
    .where(and(eq(dashboardUsers.email, email.toLowerCase()), eq(dashboardUsers.active, true)))
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  const sessionId = await createSession(user.id);
  return { sessionId, user };
}

export async function createDashboardUser(params: {
  email: string;
  password: string;
  name: string;
  role: "admin" | "course_leader" | "affiliate";
  ghlContactId?: string;
  affiliateCode?: string;
  profileUrl?: string;
}): Promise<DashboardUser> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const passwordHash = hashNewPassword(params.password);
  await db.insert(dashboardUsers).values({
    email: params.email.toLowerCase(),
    passwordHash,
    name: params.name,
    role: params.role,
    ghlContactId: params.ghlContactId ?? null,
    affiliateCode: params.affiliateCode ?? null,
    profileUrl: params.profileUrl ?? null,
  });
  const rows = await db
    .select()
    .from(dashboardUsers)
    .where(eq(dashboardUsers.email, params.email.toLowerCase()))
    .limit(1);
  return rows[0]!;
}

export async function getAllDashboardUsers(): Promise<DashboardUser[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dashboardUsers);
}

export async function updateDashboardUser(
  id: number,
  updates: Partial<Pick<DashboardUser, "name" | "email" | "role" | "ghlContactId" | "affiliateCode" | "active" | "profileUrl">>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(dashboardUsers).set(updates).where(eq(dashboardUsers.id, id));
}
