/**
 * Seed test users and mock appointment data for Fascia Academy Dashboard.
 * Run: node scripts/seed-test-data.mjs
 */
import { createHash, randomBytes } from "crypto";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

function hashPassword(password, salt) {
  return createHash("sha256").update(salt + password).digest("hex");
}
function hashNewPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${hashPassword(password, salt)}`;
}

const conn = await mysql.createConnection(DATABASE_URL);

// ─── 1. Create test users ─────────────────────────────────────────────────────
const users = [
  {
    email: "victor.forsell@test.com",
    password: "Victor2024!",
    name: "Victor Forsell",
    role: "course_leader",
    ghlContactId: null,
    affiliateCode: null,
  },
  {
    email: "victor.affiliate@test.com",
    password: "Victor2024!",
    name: "Victor Forsell",
    role: "affiliate",
    ghlContactId: null,
    affiliateCode: "VICTOR",
  },
  {
    email: "fredrik.kjellberg@test.com",
    password: "Fredrik2024!",
    name: "Fredrik Kjellberg",
    role: "course_leader",
    ghlContactId: null,
    affiliateCode: null,
  },
  {
    email: "ivar.bohlin@test.com",
    password: "Ivar2024!",
    name: "Ivar Bohlin",
    role: "course_leader",
    ghlContactId: null,
    affiliateCode: null,
  },
];

for (const u of users) {
  const [existing] = await conn.execute("SELECT id FROM dashboard_users WHERE email = ?", [u.email]);
  if (existing.length > 0) {
    console.log(`User already exists: ${u.email}`);
    continue;
  }
  const passwordHash = hashNewPassword(u.password);
  await conn.execute(
    "INSERT INTO dashboard_users (email, passwordHash, name, role, ghlContactId, affiliateCode, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())",
    [u.email, passwordHash, u.name, u.role, u.ghlContactId, u.affiliateCode]
  );
  console.log(`✅ Created user: ${u.email} (${u.role})`);
}

// ─── 2. Seed mock GHL data into ghl_cache ─────────────────────────────────────
// We'll store mock data as JSON in the ghl_cache table so the dashboard can
// serve it without hitting the real GHL API.

// Check if ghl_cache table exists
const [tables] = await conn.execute("SHOW TABLES LIKE 'ghl_cache'");
if (tables.length === 0) {
  console.log("Creating ghl_cache table...");
  await conn.execute(`
    CREATE TABLE ghl_cache (
      cache_key VARCHAR(255) PRIMARY KEY,
      cache_value LONGTEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Mock calendars
const mockCalendars = [
  { id: "cal_victor_intro", name: "Introduktionskurs Fascia - Victor Forsell - Test", locationId: "krCLgbfFUDCiil9Hy5jV", groupId: null },
  { id: "cal_fredrik_intro", name: "Introduktionskurs Fascia - Fredrik Kjellberg - Helsingborg", locationId: "krCLgbfFUDCiil9Hy5jV", groupId: null },
  { id: "cal_fredrik_diplo", name: "Diplomerad Fasciaspecialist - Fredrik Kjellberg - Helsingborg", locationId: "krCLgbfFUDCiil9Hy5jV", groupId: null },
  { id: "cal_fa_intro", name: "Introduktionskurs Fascia - Fascia Academy - Sollentuna", locationId: "krCLgbfFUDCiil9Hy5jV", groupId: null },
  { id: "cal_fa_cert", name: "Certifierad Fasciaspecialist - Fascia Academy - Sollentuna", locationId: "krCLgbfFUDCiil9Hy5jV", groupId: null },
];

// Mock contacts (participants)
const mockContacts = [
  { id: "contact_001", firstName: "Anna", lastName: "Lindqvist", email: "anna@test.com", customFields: [] },
  { id: "contact_002", firstName: "Erik", lastName: "Svensson", email: "erik@test.com", customFields: [] },
  { id: "contact_003", firstName: "Maria", lastName: "Johansson", email: "maria@test.com", customFields: [] },
  { id: "contact_004", firstName: "Lars", lastName: "Petersson", email: "lars@test.com", customFields: [] },
  { id: "contact_005", firstName: "Sofia", lastName: "Nilsson", email: "sofia@test.com", customFields: [] },
  { id: "contact_006", firstName: "Johan", lastName: "Karlsson", email: "johan@test.com", customFields: [] },
  { id: "contact_007", firstName: "Emma", lastName: "Andersson", email: "emma@test.com", customFields: [] },
  { id: "contact_008", firstName: "Mikael", lastName: "Berg", email: "mikael@test.com", customFields: [{ id: "settlement_affiliate_code", value: "VICTOR" }] },
  { id: "contact_009", firstName: "Sara", lastName: "Lindgren", email: "sara@test.com", customFields: [{ id: "settlement_affiliate_code", value: "VICTOR" }] },
  { id: "contact_010", firstName: "David", lastName: "Holm", email: "david@test.com", customFields: [] },
  { id: "contact_011", firstName: "Karin", lastName: "Strand", email: "karin@test.com", customFields: [] },
  { id: "contact_012", firstName: "Peter", lastName: "Lund", email: "peter@test.com", customFields: [] },
];

// Helper to make appointments
function makeAppt(id, calendarId, contactId, startTime, status = "showed", paidSEK = 2500) {
  return {
    id,
    calendarId,
    contactId,
    title: "Course Booking",
    status,
    appointmentStatus: status,
    startTime,
    endTime: startTime,
    customFields: [
      { id: "settlement_paid_amount_sek", value: String(paidSEK) },
    ],
  };
}

// March 2025 appointments
const march2025 = "2025-03-15T09:00:00.000Z";
const march2025b = "2025-03-22T09:00:00.000Z";

// April 2025 appointments
const april2025 = "2025-04-12T09:00:00.000Z";
const april2025b = "2025-04-19T09:00:00.000Z";

// Current month (April 2026)
const apr2026 = "2026-04-05T09:00:00.000Z";
const apr2026b = "2026-04-12T09:00:00.000Z";

const mockAppointments = [
  // Victor Intro - March 2025 (4 participants, 2 with affiliate code VICTOR)
  makeAppt("appt_001", "cal_victor_intro", "contact_001", march2025, "showed", 2500),
  makeAppt("appt_002", "cal_victor_intro", "contact_002", march2025, "showed", 2500),
  makeAppt("appt_003", "cal_victor_intro", "contact_008", march2025, "showed", 2250), // affiliate discount
  makeAppt("appt_004", "cal_victor_intro", "contact_009", march2025, "showed", 2250), // affiliate discount

  // Fredrik Intro - March 2025 (3 participants)
  makeAppt("appt_005", "cal_fredrik_intro", "contact_003", march2025b, "showed", 2500),
  makeAppt("appt_006", "cal_fredrik_intro", "contact_004", march2025b, "showed", 2500),
  makeAppt("appt_007", "cal_fredrik_intro", "contact_005", march2025b, "showed", 2500),

  // Fredrik Diplo - March 2025 (2 participants)
  makeAppt("appt_008", "cal_fredrik_diplo", "contact_006", march2025b, "showed", 9500),
  makeAppt("appt_009", "cal_fredrik_diplo", "contact_007", march2025b, "showed", 9500),

  // FA Sollentuna Intro - April 2025 (3 participants)
  makeAppt("appt_010", "cal_fa_intro", "contact_010", april2025, "showed", 2500),
  makeAppt("appt_011", "cal_fa_intro", "contact_011", april2025, "showed", 2500),
  makeAppt("appt_012", "cal_fa_intro", "contact_012", april2025, "showed", 2500),

  // FA Sollentuna Cert - April 2025 (2 participants)
  makeAppt("appt_013", "cal_fa_cert", "contact_003", april2025b, "showed", 14500),
  makeAppt("appt_014", "cal_fa_cert", "contact_004", april2025b, "showed", 14500),

  // Victor Intro - April 2026 (current month, 3 participants)
  makeAppt("appt_015", "cal_victor_intro", "contact_001", apr2026, "showed", 2500),
  makeAppt("appt_016", "cal_victor_intro", "contact_005", apr2026, "showed", 2500),
  makeAppt("appt_017", "cal_victor_intro", "contact_008", apr2026, "showed", 2250), // affiliate

  // Fredrik Intro - April 2026 (2 participants)
  makeAppt("appt_018", "cal_fredrik_intro", "contact_006", apr2026b, "showed", 2500),
  makeAppt("appt_019", "cal_fredrik_intro", "contact_009", apr2026b, "showed", 2250), // affiliate
];

// Store mock data in ghl_cache
const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

await conn.execute(
  "REPLACE INTO ghl_cache (cache_key, cache_value, expires_at) VALUES (?, ?, ?)",
  ["mock:calendars", JSON.stringify(mockCalendars), expires]
);
console.log("✅ Stored mock calendars:", mockCalendars.length);

await conn.execute(
  "REPLACE INTO ghl_cache (cache_key, cache_value, expires_at) VALUES (?, ?, ?)",
  ["mock:appointments", JSON.stringify(mockAppointments), expires]
);
console.log("✅ Stored mock appointments:", mockAppointments.length);

// Store contacts individually
for (const contact of mockContacts) {
  await conn.execute(
    "REPLACE INTO ghl_cache (cache_key, cache_value, expires_at) VALUES (?, ?, ?)",
    [`mock:contact:${contact.id}`, JSON.stringify(contact), expires]
  );
}
console.log("✅ Stored mock contacts:", mockContacts.length);

await conn.execute(
  "REPLACE INTO ghl_cache (cache_key, cache_value, expires_at) VALUES (?, ?, ?)",
  ["mock:enabled", "true", expires]
);
console.log("✅ Mock mode enabled");

console.log("\n📋 Test login credentials:");
console.log("  Admin:            admin@fasciaacademy.com / FasciaAdmin2024!");
console.log("  Victor (leader):  victor.forsell@test.com / Victor2024!");
console.log("  Victor (affiliate): victor.affiliate@test.com / Victor2024!");
console.log("  Fredrik:          fredrik.kjellberg@test.com / Fredrik2024!");
console.log("  Ivar:             ivar.bohlin@test.com / Ivar2024!");

await conn.end();
