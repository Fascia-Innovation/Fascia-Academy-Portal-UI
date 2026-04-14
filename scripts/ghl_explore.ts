/**
 * GHL API exploration script
 * Run with: pnpm tsx scripts/ghl_explore.ts
 */

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY ?? "";
const LOCATION_ID = process.env.GHL_LOCATION_ID ?? "krCLgbfFUDCiil9Hy5jV";

console.log("Key present:", !!API_KEY, "| Location:", LOCATION_ID);

async function ghlGet(path: string) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Version: "2021-07-28",
      Accept: "application/json",
    },
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

async function main() {
  const output: string[] = [];
  const log = (...args: any[]) => { const s = args.join(' '); console.log(s); output.push(s); };
  // 1. Fetch location users (team members with profile photos)
  console.log("\n=== Location Users (team members) ===");
  const users = await ghlGet(`/locations/${LOCATION_ID}/users`);
  console.log("Status:", users.status);
  if ((users.data as any)?.users) {
    for (const u of (users.data as any).users) {
      console.log(`  [${u.id}] ${u.name} | ${u.email} | photo: ${u.profilePhoto || "none"}`);
    }
  } else {
    console.log(JSON.stringify(users.data, null, 2).slice(0, 800));
  }

  // 2. Fetch calendar groups
  console.log("\n=== Calendar Groups ===");
  const groups = await ghlGet(`/calendars/groups?locationId=${LOCATION_ID}`);
  console.log("Status:", groups.status);
  if ((groups.data as any)?.groups) {
    for (const g of (groups.data as any).groups) {
      console.log(`  [${g.id}] ${g.name} | slug: ${g.slug}`);
    }
  } else {
    console.log(JSON.stringify(groups.data, null, 2).slice(0, 800));
  }

  // 3. Fetch calendars list
  console.log("\n=== Calendars (all) ===");
  const cals = await ghlGet(`/calendars/?locationId=${LOCATION_ID}`);
  console.log("Status:", cals.status);
  if ((cals.data as any)?.calendars) {
    for (const c of (cals.data as any).calendars) {
      const members = (c.teamMembers || []).map((m: any) => m.userId);
      console.log(`  [${c.id}] ${c.name}`);
      console.log(`    slug: ${c.slug} | groupId: ${c.groupId || "none"} | members: ${JSON.stringify(members)}`);
    }
  } else {
    console.log(JSON.stringify(cals.data, null, 2).slice(0, 800));
  }

  // 4. Test GHL booking widget URL format
  console.log("\n=== GHL Booking Widget URL format ===");
  console.log("Standard: https://api.leadconnectorhq.com/widget/booking/{calendar-slug}");
  console.log("With date: https://api.leadconnectorhq.com/widget/booking/{calendar-slug}?date=2025-06-15");
  console.log("Embed:     https://link.msgsndr.com/widget/booking/{calendar-slug}");
}

main().catch(console.error);
