import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  console.log("Connected to DB");

  const statements = [
    "ALTER TABLE `course_dates` ADD COLUMN IF NOT EXISTS `venueName` varchar(255)",
    "ALTER TABLE `course_dates` ADD COLUMN IF NOT EXISTS `address` varchar(512)",
    "ALTER TABLE `course_dates` ADD COLUMN IF NOT EXISTS `courseLeaderPhone` varchar(32)",
    "ALTER TABLE `dashboard_users` ADD COLUMN IF NOT EXISTS `phone` varchar(32)",
  ];

  for (const sql of statements) {
    try {
      await conn.execute(sql);
      console.log("✓", sql.slice(0, 60));
    } catch (e: any) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log("⚠ Column already exists, skipping:", sql.slice(0, 60));
      } else {
        throw e;
      }
    }
  }

  await conn.end();
  console.log("Migration complete");
}

main().catch(console.error);
