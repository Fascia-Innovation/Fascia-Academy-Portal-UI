import { createConnection } from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(DATABASE_URL);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

const statements = [
  "ALTER TABLE `course_dates` ADD `status` enum('approved','pending_approval','pending_cancellation','pending_reschedule','needs_revision','cancelled') DEFAULT 'approved' NOT NULL",
  "ALTER TABLE `course_dates` ADD `submittedBy` int",
  "ALTER TABLE `course_dates` ADD `adminMessage` text",
  "ALTER TABLE `course_dates` ADD `leaderMessage` text",
  "ALTER TABLE `course_dates` ADD `changeLog` text",
  "ALTER TABLE `course_dates` ADD `rescheduleNewStart` timestamp",
  "ALTER TABLE `course_dates` ADD `rescheduleNewEnd` timestamp",
  "ALTER TABLE `course_dates` ADD `rescheduleNewAdditionalDays` text",
];

for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log('OK:', stmt.slice(0, 80) + '...');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('SKIP (already exists):', stmt.slice(0, 80) + '...');
    } else {
      console.error('ERROR:', e.message);
      console.error('Statement:', stmt);
    }
  }
}

// canExamineExams may already exist from earlier migration
try {
  await conn.execute("ALTER TABLE `dashboard_users` ADD `canExamineExams` boolean DEFAULT false NOT NULL");
  console.log('OK: Added canExamineExams to dashboard_users');
} catch (e) {
  if (e.code === 'ER_DUP_FIELDNAME') {
    console.log('SKIP (already exists): canExamineExams on dashboard_users');
  } else {
    console.error('ERROR:', e.message);
  }
}

await conn.end();
console.log('Migration complete!');
