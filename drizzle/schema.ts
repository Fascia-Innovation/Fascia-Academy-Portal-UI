import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Local dashboard users — email+password login, separate from Manus OAuth.
 * role: admin | course_leader | affiliate
 * ghlContactId: links to a GHL contact record for scoped data access
 * affiliateCode: the affiliate's code (e.g. VICTOR10) for affiliates
 */
export const dashboardUsers = mysqlTable("dashboard_users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "course_leader", "affiliate"]).notNull(),
  ghlContactId: varchar("ghlContactId", { length: 64 }),
  affiliateCode: varchar("affiliateCode", { length: 64 }),
  phone: varchar("phone", { length: 32 }), // course leader phone for booking info
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DashboardUser = typeof dashboardUsers.$inferSelect;
export type InsertDashboardUser = typeof dashboardUsers.$inferInsert;

/**
 * Dashboard sessions — server-side session store for email+password auth.
 */
export const dashboardSessions = mysqlTable("dashboard_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DashboardSession = typeof dashboardSessions.$inferSelect;

/**
 * Course dates — manually registered course instances for the public booking page.
 * Each row = one specific course date taught by a specific course leader at a specific location.
 * ghlCalendarId: links to the GHL calendar for this course leader + course type combination
 * courseType: intro | diplo | cert | vidare
 * language: sv | en
 * bookingUrl: GHL booking widget URL (constructed from calendar ID)
 */
export const courseDates = mysqlTable("course_dates", {
  id: int("id").autoincrement().primaryKey(),
  ghlCalendarId: varchar("ghlCalendarId", { length: 64 }).notNull(),
  courseLeaderName: varchar("courseLeaderName", { length: 255 }).notNull(),
  ghlUserId: varchar("ghlUserId", { length: 64 }), // GHL user ID for profile photo lookup
  courseType: mysqlEnum("courseType", ["intro", "diplo", "cert", "vidare"]).notNull(),
  language: mysqlEnum("language", ["sv", "en"]).notNull().default("sv"),
  city: varchar("city", { length: 255 }).notNull(),
  country: varchar("country", { length: 64 }).notNull().default("Sweden"),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  maxSeats: int("maxSeats").notNull().default(12),
  venueName: varchar("venueName", { length: 255 }), // e.g. "Fasciaklinikerna Helsingborg"
  address: varchar("address", { length: 512 }), // full street address
  courseLeaderPhone: varchar("courseLeaderPhone", { length: 32 }), // auto-filled from GHL or overridden
  notes: text("notes"), // optional internal notes
  published: boolean("published").default(true).notNull(), // false = hidden from public page
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CourseDate = typeof courseDates.$inferSelect;
export type InsertCourseDate = typeof courseDates.$inferInsert;