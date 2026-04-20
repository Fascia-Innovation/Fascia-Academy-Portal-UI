import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const statements = [
  `ALTER TABLE \`certificates\` ADD COLUMN IF NOT EXISTS \`status\` enum('draft','sent') NOT NULL DEFAULT 'draft'`,
  `ALTER TABLE \`certificates\` ADD COLUMN IF NOT EXISTS \`sentAt\` timestamp NULL`,
  `ALTER TABLE \`certificates\` ADD COLUMN IF NOT EXISTS \`sentBy\` int NULL`,
  `ALTER TABLE \`certificates\` ADD COLUMN IF NOT EXISTS \`verificationCode\` varchar(20) NULL`,
  `ALTER TABLE \`certificates\` ADD COLUMN IF NOT EXISTS \`showedAt\` timestamp NULL`,
  `ALTER TABLE \`certificates\` ADD COLUMN IF NOT EXISTS \`examPassedAt\` timestamp NULL`,
];

// Add unique constraint separately (ignore if already exists)
const uniqueConstraint = `ALTER TABLE \`certificates\` ADD CONSTRAINT \`certificates_verificationCode_unique\` UNIQUE(\`verificationCode\`)`;

for (const sql of statements) {
  try {
    await conn.execute(sql);
    console.log("✓", sql.substring(0, 80));
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME" || err.message?.includes("Duplicate column")) {
      console.log("⚠ already exists, skipping:", sql.substring(0, 60));
    } else {
      console.error("✗ ERROR:", err.message, "\n  SQL:", sql);
    }
  }
}

try {
  await conn.execute(uniqueConstraint);
  console.log("✓ unique constraint added");
} catch (err) {
  if (err.code === "ER_DUP_KEYNAME" || err.message?.includes("Duplicate key")) {
    console.log("⚠ unique constraint already exists");
  } else {
    console.error("✗ unique constraint error:", err.message);
  }
}

// Backfill verificationCode for existing certificates that don't have one
const [rows] = await conn.execute("SELECT id, createdAt FROM `certificates` WHERE verificationCode IS NULL");
let counter = 1;

// Get the max existing code number to avoid conflicts
const [maxRows] = await conn.execute("SELECT MAX(CAST(SUBSTRING(verificationCode, 9) AS UNSIGNED)) as maxNum FROM `certificates` WHERE verificationCode IS NOT NULL AND verificationCode LIKE 'FA-%'");
const maxNum = maxRows[0]?.maxNum ?? 0;
counter = maxNum + 1;

for (const row of rows) {
  const year = new Date(row.createdAt).getFullYear();
  const code = `FA-${year}-${String(counter).padStart(5, "0")}`;
  await conn.execute("UPDATE `certificates` SET verificationCode = ? WHERE id = ?", [code, row.id]);
  console.log(`✓ backfilled cert #${row.id} → ${code}`);
  counter++;
}

// Mark existing certificates (those with emailSentAt) as 'sent'
await conn.execute("UPDATE `certificates` SET status = 'sent', sentAt = emailSentAt WHERE emailSentAt IS NOT NULL AND status = 'draft'");
console.log("✓ marked existing sent certificates");

await conn.end();
console.log("\n✅ Migration complete");
