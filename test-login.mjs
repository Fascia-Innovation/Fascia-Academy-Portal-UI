import { getDb } from "./server/db.ts";
import { dashboardUsers } from "./drizzle/schema.ts";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";

function hashPassword(password, salt) {
  return createHash("sha256").update(salt + password).digest("hex");
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return hashPassword(password, salt) === hash;
}

const db = await getDb();
if (!db) {
  console.error("Could not connect to database");
  process.exit(1);
}

// Try exact email from DB
const email = "Forsellvictor1@gmail.com";
const emailLower = email.toLowerCase();

console.log("Searching with exact email:", email);
const rows1 = await db
  .select()
  .from(dashboardUsers)
  .where(and(eq(dashboardUsers.email, email), eq(dashboardUsers.active, true)));
console.log("Found with exact:", rows1.length);

console.log("\nSearching with lowercase email:", emailLower);
const rows2 = await db
  .select()
  .from(dashboardUsers)
  .where(and(eq(dashboardUsers.email, emailLower), eq(dashboardUsers.active, true)));
console.log("Found with lowercase:", rows2.length);

if (rows2.length > 0) {
  const user = rows2[0];
  console.log("\nUser:", user.name, "role:", user.role, "active:", user.active);
  console.log("passwordHash:", user.passwordHash?.substring(0, 50) + "...");
  console.log("passwordHash length:", user.passwordHash?.length);
  console.log("Has colon separator:", user.passwordHash?.includes(":"));
  
  // Try to verify with a test password
  console.log("\nVerify with 'test123':", verifyPassword("test123", user.passwordHash));
  console.log("Verify with 'password':", verifyPassword("password", user.passwordHash));
} else if (rows1.length > 0) {
  const user = rows1[0];
  console.log("\nCase sensitivity issue! DB stores:", user.email);
  console.log("Login sends:", emailLower);
  console.log("These don't match in the database query.");
}

process.exit(0);
