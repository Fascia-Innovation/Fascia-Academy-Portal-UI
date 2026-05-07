/**
 * Dashboard authentication helpers — email + password, separate from Manus OAuth.
 */
import { eq, and, gt } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { getDb } from "./db";
import { dashboardUsers, dashboardSessions, passwordResetTokens, type DashboardUser } from "../drizzle/schema";

const BCRYPT_ROUNDS = 12;

// ─── Password hashing (bcrypt, with legacy SHA-256 fallback for migration) ────
function legacyHashPassword(password: string, salt: string): string {
  return createHash("sha256").update(salt + password).digest("hex");
}

function isLegacyHash(stored: string): boolean {
  // Legacy format: "<32-char-hex-salt>:<64-char-hex-hash>"
  const parts = stored.split(":");
  return parts.length === 2 && parts[0].length === 32 && parts[1].length === 64;
}

export function hashNewPassword(password: string): string {
  // Synchronous bcrypt hash for new passwords
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, stored: string): boolean {
  if (isLegacyHash(stored)) {
    // Legacy SHA-256 verification (will be re-hashed on next successful login)
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    return legacyHashPassword(password, salt) === hash;
  }
  // bcrypt verification
  return bcrypt.compareSync(password, stored);
}

/**
 * Re-hash a password with bcrypt if it's still using the legacy SHA-256 format.
 * Call this after a successful login to transparently migrate users.
 */
export async function upgradeHashIfNeeded(userId: number, password: string, currentHash: string): Promise<void> {
  if (!isLegacyHash(currentHash)) return; // already bcrypt
  const db = await getDb();
  if (!db) return;
  const newHash = hashNewPassword(password);
  await db.update(dashboardUsers).set({ passwordHash: newHash }).where(eq(dashboardUsers.id, userId));
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
  // Transparently upgrade legacy SHA-256 hash to bcrypt on successful login
  await upgradeHashIfNeeded(user.id, password, user.passwordHash);
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
  invoiceReference?: string;
  isAffiliate?: boolean;
  canExamineExams?: boolean;
  ghlUserId?: string;
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
    invoiceReference: params.invoiceReference ?? null,
    isAffiliate: params.isAffiliate ?? false,
    canExamineExams: params.canExamineExams ?? false,
    ghlUserId: params.ghlUserId ?? null,
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
  updates: Partial<Pick<DashboardUser, "name" | "email" | "role" | "ghlContactId" | "affiliateCode" | "active" | "profileUrl" | "invoiceReference" | "isAffiliate" | "canExamineExams" | "ghlUserId">>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(dashboardUsers).set(updates).where(eq(dashboardUsers.id, id));
}

export async function deleteDashboardUser(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Delete sessions and reset tokens first, then the user record
  await db.delete(dashboardSessions).where(eq(dashboardSessions.userId, id));
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, id));
  await db.delete(dashboardUsers).where(eq(dashboardUsers.id, id));
}

// ─── Password reset ───────────────────────────────────────────────────────────
export async function createPasswordResetToken(email: string): Promise<{ token: string; userName: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(dashboardUsers)
    .where(and(eq(dashboardUsers.email, email.toLowerCase()), eq(dashboardUsers.active, true)))
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  // Invalidate any existing tokens for this user
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });
  return { token, userName: user.name };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const now = new Date();
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.token, token), gt(passwordResetTokens.expiresAt, now)))
    .limit(1);
  const resetToken = rows[0];
  if (!resetToken) return false;
  const passwordHash = hashNewPassword(newPassword);
  await db.update(dashboardUsers).set({ passwordHash }).where(eq(dashboardUsers.id, resetToken.userId));
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetToken.id));
  return true;
}

export async function getUserByResetToken(token: string): Promise<DashboardUser | null> {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const rows = await db
    .select({ user: dashboardUsers })
    .from(passwordResetTokens)
    .innerJoin(dashboardUsers, eq(passwordResetTokens.userId, dashboardUsers.id))
    .where(and(eq(passwordResetTokens.token, token), gt(passwordResetTokens.expiresAt, now)))
    .limit(1);
  return rows[0]?.user ?? null;
}
