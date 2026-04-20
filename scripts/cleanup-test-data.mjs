/**
 * Cleanup script: removes all test data before live testing
 * Tables: certificates, exams, participant_snapshots, users (victor.forsell@live.se)
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

try {
  // 1. Delete all certificates (already done but run again to confirm 0)
  const [certDel] = await conn.execute("DELETE FROM certificates");
  console.log(`Deleted ${certDel.affectedRows} certificates`);

  // 2. Delete all exam records (exam history)
  const [examDel] = await conn.execute("DELETE FROM exams");
  console.log(`Deleted ${examDel.affectedRows} exams`);

  // 3. Delete all participant_snapshots (course participants)
  const [snapDel] = await conn.execute("DELETE FROM participant_snapshots");
  console.log(`Deleted ${snapDel.affectedRows} participant_snapshots`);

  // 4. Delete the student/user record for victor.forsell@live.se
  const [userDel] = await conn.execute(
    "DELETE FROM users WHERE email = ?",
    ["victor.forsell@live.se"]
  );
  console.log(`Deleted ${userDel.affectedRows} user record for victor.forsell@live.se`);

  // 5. Clear ghl_cache (stale seat count cache)
  const [cacheDel] = await conn.execute("DELETE FROM ghl_cache");
  console.log(`Cleared ${cacheDel.affectedRows} ghl_cache entries`);

  // 6. Clear settlement data
  const [slDel] = await conn.execute("DELETE FROM settlement_lines");
  const [saDel] = await conn.execute("DELETE FROM settlement_adjustments");
  const [sDel] = await conn.execute("DELETE FROM settlements");
  console.log(`Cleared ${sDel.affectedRows} settlements, ${slDel.affectedRows} lines, ${saDel.affectedRows} adjustments`);

  console.log("\n✅ Cleanup complete!");
} catch (err) {
  console.error("Error during cleanup:", err.message);
} finally {
  await conn.end();
}
