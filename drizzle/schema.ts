import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal } from "drizzle-orm/mysql-core";

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
  profileUrl: varchar("profileUrl", { length: 512 }), // link to course leader's profile page
  invoiceReference: varchar("invoiceReference", { length: 128 }), // unique payment reference for invoices (e.g. FK-001)
  isAffiliate: boolean("isAffiliate").default(false).notNull(), // true = also acts as affiliate (dual-role)
  canExamineExams: boolean("canExamineExams").default(false).notNull(), // true = can grade exams in exam queue
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
  bookedSeats: int("bookedSeats").notNull().default(0), // updated by admin or webhook
  venueName: varchar("venueName", { length: 255 }), // e.g. "Fasciaklinikerna Helsingborg"
  address: varchar("address", { length: 512 }), // full street address
  courseLeaderPhone: varchar("courseLeaderPhone", { length: 32 }), // auto-filled from GHL or overridden
  additionalDays: text("additionalDays"), // JSON array: [{date, startTime, endTime}] for multi-day courses
  bookingInfo: text("bookingInfo"), // optional: vägbeskrivning, parking, extra info shown on booking page
  notes: text("notes"), // optional internal notes (admin only, not shown publicly)
  published: boolean("published").default(true).notNull(), // false = hidden from public page
  // ── Self-service fields ──
  status: mysqlEnum("status", ["approved", "pending_approval", "pending_cancellation", "pending_reschedule", "needs_revision", "cancelled"]).default("approved").notNull(),
  submittedBy: int("submittedBy"), // dashboard_users.id of the course leader who submitted
  adminMessage: text("adminMessage"), // message from admin (e.g. completion request reason)
  leaderMessage: text("leaderMessage"), // message from course leader to admin
  changeLog: text("changeLog"), // JSON array: [{action, by, at, details}]
  // ── Reschedule fields ──
  rescheduleNewStart: timestamp("rescheduleNewStart"), // proposed new start date for reschedule
  rescheduleNewEnd: timestamp("rescheduleNewEnd"), // proposed new end date (first day)
  rescheduleNewAdditionalDays: text("rescheduleNewAdditionalDays"), // proposed new additional days JSON
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CourseDate = typeof courseDates.$inferSelect;
export type InsertCourseDate = typeof courseDates.$inferInsert;

/**
 * Settlements — one row per course leader/affiliate per month.
 * status: pending (awaiting admin review) | approved (finalised) | amended (superseded by a newer version)
 * userType: course_leader | affiliate
 * amendedFromId: if this is an amendment, points to the original settlement it replaces
 */
export const settlements = mysqlTable("settlements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),           // references dashboard_users.id
  userType: mysqlEnum("userType", ["course_leader", "affiliate"]).notNull(),
  periodYear: int("periodYear").notNull(),   // e.g. 2026
  periodMonth: int("periodMonth").notNull(), // 1-12
  currency: mysqlEnum("currency", ["SEK", "EUR"]).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "amended"]).notNull().default("pending"),
  totalPaidInclVat: decimal("totalPaidInclVat", { precision: 12, scale: 2 }).notNull().default("0"),
  totalNetExclVat: decimal("totalNetExclVat", { precision: 12, scale: 2 }).notNull().default("0"),
  totalTransactionFee: decimal("totalTransactionFee", { precision: 12, scale: 2 }).notNull().default("0"),
  totalFaMargin: decimal("totalFaMargin", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAffiliateDeduction: decimal("totalAffiliateDeduction", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAdjustments: decimal("totalAdjustments", { precision: 12, scale: 2 }).notNull().default("0"),
  totalPayout: decimal("totalPayout", { precision: 12, scale: 2 }).notNull().default("0"),
  participantCount: int("participantCount").notNull().default(0),
  amendedFromId: int("amendedFromId"),       // null unless this is an amendment
  approvedAt: timestamp("approvedAt"),
  approvedBy: int("approvedBy"),             // admin userId who approved
  notificationSentAt: timestamp("notificationSentAt"), // when email was sent to user
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Settlement = typeof settlements.$inferSelect;
export type InsertSettlement = typeof settlements.$inferInsert;

/**
 * Settlement lines — one row per participant in a settlement.
 * Stores the full breakdown so the settlement is self-contained (not re-fetched from GHL).
 */
export const settlementLines = mysqlTable("settlement_lines", {
  id: int("id").autoincrement().primaryKey(),
  settlementId: int("settlementId").notNull(),
  participantName: varchar("participantName", { length: 255 }).notNull(),
  participantEmail: varchar("participantEmail", { length: 320 }),
  calendarName: varchar("calendarName", { length: 255 }).notNull(),
  courseType: mysqlEnum("courseType", ["intro", "diplo", "cert", "vidare"]).notNull(),
  courseDate: varchar("courseDate", { length: 10 }), // YYYY-MM-DD
  affiliateCode: varchar("affiliateCode", { length: 64 }),
  paidInclVat: decimal("paidInclVat", { precision: 12, scale: 2 }).notNull().default("0"),
  netExclVat: decimal("netExclVat", { precision: 12, scale: 2 }).notNull().default("0"),
  transactionFee: decimal("transactionFee", { precision: 12, scale: 2 }).notNull().default("0"),
  faMargin: decimal("faMargin", { precision: 12, scale: 2 }).notNull().default("0"),
  affiliateDeduction: decimal("affiliateDeduction", { precision: 12, scale: 2 }).notNull().default("0"),
  payout: decimal("payout", { precision: 12, scale: 2 }).notNull().default("0"),
  missingAmount: boolean("missingAmount").default(false).notNull(), // true if paidAmount was missing in GHL
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SettlementLine = typeof settlementLines.$inferSelect;
export type InsertSettlementLine = typeof settlementLines.$inferInsert;

/**
 * Settlement adjustments — manual +/- rows added by admin.
 * These are included in the totalPayout calculation.
 */
export const settlementAdjustments = mysqlTable("settlement_adjustments", {
  id: int("id").autoincrement().primaryKey(),
  settlementId: int("settlementId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // positive = add, negative = deduct
  currency: mysqlEnum("currency", ["SEK", "EUR"]).notNull(),
  comment: text("comment").notNull(),
  createdBy: int("createdBy").notNull(),     // admin userId
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SettlementAdjustment = typeof settlementAdjustments.$inferSelect;
export type InsertSettlementAdjustment = typeof settlementAdjustments.$inferInsert;

/**
 * Password reset tokens — one-time tokens for resetting dashboard user passwords.
 * Expires after 1 hour. Deleted after use.
 */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

/**
 * Exams — one row per participant who needs their exam graded (Diplo & Cert only).
 * Created automatically when GHL webhook fires with shown status for diplo/cert.
 * status: pending (awaiting grading) | passed | failed
 */
export const exams = mysqlTable("exams", {
  id: int("id").autoincrement().primaryKey(),
  ghlContactId: varchar("ghlContactId", { length: 64 }).notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  courseType: mysqlEnum("courseType", ["diplo", "cert"]).notNull(),
  language: mysqlEnum("language", ["sv", "en"]).notNull().default("sv"),
  status: mysqlEnum("status", ["pending", "passed", "failed"]).notNull().default("pending"),
  examinedBy: int("examinedBy"),   // dashboard_users.id of the examiner
  examinedAt: timestamp("examinedAt"),
  notes: text("notes"),             // examiner notes / reason for fail
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Exam = typeof exams.$inferSelect;
export type InsertExam = typeof exams.$inferInsert;

/**
 * Certificates — one row per issued certificate/diploma/intyg.
 * Created automatically when:
 *   - Intro/Vidare: GHL webhook fires with shown status
 *   - Diplo/Cert: exam is marked as passed
 */
export const certificates = mysqlTable("certificates", {
  id: int("id").autoincrement().primaryKey(),
  ghlContactId: varchar("ghlContactId", { length: 64 }).notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  courseType: mysqlEnum("courseType", ["intro", "diplo", "cert", "vidare"]).notNull(),
  language: mysqlEnum("language", ["sv", "en"]).notNull().default("sv"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  pdfUrl: varchar("pdfUrl", { length: 1024 }), // S3 URL, null until generated
  issuedBy: int("issuedBy"),        // dashboard_users.id who triggered issuance (null = auto)
  examId: int("examId"),            // references exams.id for diplo/cert
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = typeof certificates.$inferInsert;