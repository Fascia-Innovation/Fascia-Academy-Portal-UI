// Use tsx to run with TypeScript path resolution
import { getDb } from "./server/db.ts";
import { dashboardUsers } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const db = await getDb();
if (!db) {
  console.error("Could not connect to database");
  process.exit(1);
}

const rows = await db
  .select()
  .from(dashboardUsers)
  .where(eq(dashboardUsers.email, "forsellvictor1@gmail.com"));

if (rows.length === 0) {
  console.log("No user found with email forsellvictor1@gmail.com");
} else {
  const user = rows[0];
  console.log("User found:");
  console.log("  id:", user.id);
  console.log("  email:", user.email);
  console.log("  name:", user.name);
  console.log("  role:", user.role);
  console.log("  active:", user.active);
  console.log("  passwordHash length:", user.passwordHash?.length);
  console.log("  passwordHash has salt separator:", user.passwordHash?.includes(":"));
  console.log("  passwordHash preview:", user.passwordHash?.substring(0, 40) + "...");
}

process.exit(0);
