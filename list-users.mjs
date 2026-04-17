import { getDb } from "./server/db.ts";
import { dashboardUsers } from "./drizzle/schema.ts";

const db = await getDb();
if (!db) {
  console.error("Could not connect to database");
  process.exit(1);
}

const rows = await db.select({
  id: dashboardUsers.id,
  email: dashboardUsers.email,
  name: dashboardUsers.name,
  role: dashboardUsers.role,
  active: dashboardUsers.active,
}).from(dashboardUsers);

console.log("All dashboard users:");
for (const row of rows) {
  console.log(`  id=${row.id} email=${row.email} name=${row.name} role=${row.role} active=${row.active}`);
}

process.exit(0);
