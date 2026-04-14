import { createHash, randomBytes } from "crypto";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

function hashPassword(password, salt) {
  return createHash("sha256").update(salt + password).digest("hex");
}
function hashNewPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  return `${salt}:${hash}`;
}

const conn = await mysql.createConnection(DATABASE_URL);

// Check if admin already exists
const [rows] = await conn.execute("SELECT id FROM dashboard_users WHERE email = ?", ["admin@fasciaacademy.com"]);
if (rows.length > 0) {
  console.log("Admin user already exists.");
  await conn.end();
  process.exit(0);
}

const passwordHash = hashNewPassword("FasciaAdmin2024!");
await conn.execute(
  "INSERT INTO dashboard_users (email, passwordHash, name, role, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
  ["admin@fasciaacademy.com", passwordHash, "Fascia Admin", "admin", 1]
);

console.log("✅ Admin user created:");
console.log("   Email:    admin@fasciaacademy.com");
console.log("   Password: FasciaAdmin2024!");
console.log("   Please change the password after first login via User Management.");

await conn.end();
