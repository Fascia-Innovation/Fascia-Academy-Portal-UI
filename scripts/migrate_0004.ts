import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const sql = `
ALTER TABLE \`course_dates\` ADD \`additionalDays\` text;
ALTER TABLE \`course_dates\` ADD \`bookingInfo\` text;
ALTER TABLE \`dashboard_users\` ADD \`profileUrl\` varchar(512);
`;

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  for (const stmt of sql.split(";").map(s => s.trim()).filter(Boolean)) {
    try {
      await conn.execute(stmt);
      console.log("✓", stmt.slice(0, 60));
    } catch (e: any) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log("⚠ Already exists, skipping:", stmt.slice(0, 60));
      } else {
        throw e;
      }
    }
  }
  await conn.end();
  console.log("Migration 0004 complete.");
}

main().catch(console.error);
