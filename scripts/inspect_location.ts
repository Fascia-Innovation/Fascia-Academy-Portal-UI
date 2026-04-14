import * as dotenv from "dotenv";
dotenv.config();

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY ?? "";
const LOCATION_ID = process.env.GHL_LOCATION_ID ?? "";

async function main() {
  const url = `${GHL_BASE}/calendars/?locationId=${LOCATION_ID}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Version: "2021-04-15",
      Accept: "application/json",
    },
  });
  const data = await res.json() as any;
  const cals = data?.calendars ?? [];
  
  // Show first 8 calendars with their raw teamMembers meetingLocation
  cals.slice(0, 8).forEach((c: any) => {
    const members = c.teamMembers ?? [];
    console.log(`\n=== ${c.name} ===`);
    members.forEach((m: any) => {
      console.log(`  userId: ${m.userId}, isPrimary: ${m.isPrimary}, meetingLocation: ${JSON.stringify(m.meetingLocation)}`);
    });
  });
}

main().catch(console.error);
