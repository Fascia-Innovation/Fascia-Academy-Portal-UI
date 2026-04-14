/**
 * Migration: create course_dates table
 * Run with: pnpm tsx scripts/migrate_course_dates.ts
 */
import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  
  await conn.execute(`CREATE TABLE IF NOT EXISTS \`course_dates\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`ghlCalendarId\` varchar(64) NOT NULL,
    \`courseLeaderName\` varchar(255) NOT NULL,
    \`ghlUserId\` varchar(64),
    \`courseType\` enum('intro','diplo','cert','vidare') NOT NULL,
    \`language\` enum('sv','en') NOT NULL DEFAULT 'sv',
    \`city\` varchar(255) NOT NULL,
    \`country\` varchar(64) NOT NULL DEFAULT 'Sweden',
    \`startDate\` timestamp NOT NULL,
    \`endDate\` timestamp NOT NULL,
    \`maxSeats\` int NOT NULL DEFAULT 12,
    \`notes\` text,
    \`published\` boolean NOT NULL DEFAULT true,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`course_dates_id\` PRIMARY KEY(\`id\`)
  )`);
  
  console.log("✓ course_dates table created (or already exists)");
  await conn.end();
}

main().catch(console.error);
