import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Check mock mode status
const [rows] = await db.execute("SELECT cache_key, cache_value FROM ghl_cache WHERE cache_key = 'mock:enabled'");
console.log("Mock mode rows:", JSON.stringify(rows));

// Disable mock mode
await db.execute("DELETE FROM ghl_cache WHERE cache_key = 'mock:enabled'");
console.log("Mock mode disabled.");

// Also check what mock data exists
const [mockRows] = await db.execute("SELECT cache_key FROM ghl_cache WHERE cache_key LIKE 'mock:%'");
console.log("Remaining mock cache keys:", mockRows.map(r => r.cache_key));

await db.end();
