const API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const BASE = "https://services.leadconnectorhq.com";

// Try different API versions
const versions = ["2021-04-15", "2021-07-28"];

for (const version of versions) {
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    Version: version,
    Accept: "application/json",
  };

  console.log(`\n=== Version: ${version} ===`);
  
  // Try calendars
  const calsRes = await fetch(`${BASE}/calendars/?locationId=${LOCATION_ID}`, { headers });
  const calsData = await calsRes.json();
  const cals = calsData.calendars ?? [];
  console.log("Calendars:", cals.length);
  
  if (cals.length > 0) {
    const calId = cals[3].id; // Use Fascia Academy's own calendar
    console.log("Testing calendar:", cals[3].name);
    
    // Try different date param names
    const tests = [
      `?calendarId=${calId}&locationId=${LOCATION_ID}&startTime=2025-01-01T00:00:00.000Z&endTime=2026-12-31T23:59:59.000Z`,
      `?calendarId=${calId}&locationId=${LOCATION_ID}&startDate=2025-01-01&endDate=2026-12-31`,
      `?calendarId=${calId}&locationId=${LOCATION_ID}`,
    ];
    
    for (const q of tests) {
      const res = await fetch(`${BASE}/calendars/events${q}`, { headers });
      const data = await res.json();
      const events = data.events ?? data.appointments ?? [];
      console.log(`  Query: ${q.substring(0,80)} → status:${res.status} events:${events.length}`);
    }
  }
}

// Try the old REST API format
console.log("\n=== Trying old API format ===");
const oldHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};
const oldRes = await fetch(`https://rest.gohighlevel.com/v1/appointments/?locationId=${LOCATION_ID}`, { headers: oldHeaders });
console.log("Old API status:", oldRes.status);
const oldText = await oldRes.text();
console.log("Old API response:", oldText.substring(0, 300));
