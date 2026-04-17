import { getDb } from "./server/db.ts";
import { dashboardUsers } from "./drizzle/schema.ts";
import { eq, sql } from "drizzle-orm";

const db = await getDb();
if (!db) {
  console.error("Could not connect to database");
  process.exit(1);
}

// Get all users
const rows = await db.select({ id: dashboardUsers.id, email: dashboardUsers.email }).from(dashboardUsers);

let fixed = 0;
for (const row of rows) {
  const lower = row.email.toLowerCase();
  if (row.email !== lower) {
    console.log(`Fixing: ${row.email} -> ${lower}`);
    await db.update(dashboardUsers).set({ email: lower }).where(eq(dashboardUsers.id, row.id));
    fixed++;
  }
}

console.log(`\nFixed ${fixed} email(s). Total users: ${rows.length}`);

// Verify
const verify = await db.select({ id: dashboardUsers.id, email: dashboardUsers.email }).from(dashboardUsers);
for (const row of verify) {
  console.log(`  id=${row.id} email=${row.email}`);
}

process.exit(0);
