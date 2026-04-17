import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const url = new URL(DATABASE_URL);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port || "3306"),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

const [rows] = await conn.execute(
  "SELECT id, email, name, role, active, passwordHash, ghlContactId FROM dashboard_users WHERE email = ?",
  ["forsellvictor1@gmail.com"]
);

console.log("User record:", JSON.stringify(rows, null, 2));

if (rows.length > 0) {
  const user = rows[0];
  console.log("\npasswordHash length:", user.passwordHash?.length);
  console.log("passwordHash starts with salt:", user.passwordHash?.includes(":"));
  console.log("active:", user.active);
  console.log("role:", user.role);
}

await conn.end();
