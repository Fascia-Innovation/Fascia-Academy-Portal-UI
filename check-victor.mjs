import { getDb } from "./server/db.ts";
import { dashboardUsers } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const db = await getDb();
if (!db) { console.error("No DB"); process.exit(1); }

const rows = await db.select().from(dashboardUsers).where(eq(dashboardUsers.id, 30002));
if (rows.length === 0) { console.log("Not found"); process.exit(0); }
const u = rows[0];
console.log("id:", u.id);
console.log("name:", u.name);
console.log("role:", u.role);
console.log("active:", u.active);
console.log("isAffiliate:", u.isAffiliate);
console.log("canExamineExams:", u.canExamineExams);
console.log("ghlContactId:", u.ghlContactId);
console.log("affiliateCode:", u.affiliateCode);
console.log("profileUrl:", u.profileUrl);
console.log("invoiceReference:", u.invoiceReference);
process.exit(0);
