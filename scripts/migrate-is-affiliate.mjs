import { createConnection } from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await createConnection(DB_URL);

const sql = `ALTER TABLE \`dashboard_users\` ADD COLUMN IF NOT EXISTS \`isAffiliate\` boolean DEFAULT false NOT NULL`;

try {
  console.log("Executing:", sql.substring(0, 80) + "...");
  await conn.execute(sql);
  console.log("  ✓ OK");
} catch (e) {
  if (e.code === "ER_DUP_FIELDNAME") {
    console.log("  ✓ Column already exists, skipping");
  } else {
    console.error("  ✗ Error:", e.message);
    process.exit(1);
  }
}

await conn.end();
console.log("Migration complete.");
