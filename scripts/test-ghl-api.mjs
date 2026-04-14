const API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const BASE = "https://services.leadconnectorhq.com";

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  Version: "2021-04-15",
  Accept: "application/json",
};

// 1. Get calendars
const calsRes = await fetch(`${BASE}/calendars/?locationId=${LOCATION_ID}`, { headers });
const calsData = await calsRes.json();
const cals = calsData.calendars ?? [];
console.log("Total calendars:", cals.length);
cals.slice(0, 5).forEach(c => console.log(" -", c.id, c.name));

// 2. Try events per calendar with wide date range
const start = "2024-01-01T00:00:00.000Z";
const end = "2026-12-31T23:59:59.000Z";

let foundEvents = false;
for (const cal of cals) {
  const url = `${BASE}/calendars/events?calendarId=${cal.id}&locationId=${LOCATION_ID}&startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  const events = data.events ?? data.appointments ?? [];
  if (events.length > 0) {
    console.log("\nFOUND events in calendar:", cal.name, "count:", events.length);
    console.log("First event keys:", Object.keys(events[0]));
    console.log("First event:", JSON.stringify(events[0]).substring(0, 600));
    foundEvents = true;
    break;
  }
}
if (!foundEvents) {
  console.log("\nNo events found via /calendars/events. Trying /contacts/ search...");
  
  // Try contacts with appointments
  const contactsRes = await fetch(`${BASE}/contacts/?locationId=${LOCATION_ID}&limit=5`, { headers });
  const contactsData = await contactsRes.json();
  console.log("Contacts sample:", JSON.stringify(contactsData).substring(0, 400));
}

// 3. Try the newer appointments endpoint
console.log("\n--- Testing /appointments/ endpoint ---");
const apptRes = await fetch(`${BASE}/appointments/?locationId=${LOCATION_ID}`, { headers });
console.log("Status:", apptRes.status);
const apptText = await apptRes.text();
console.log("Response:", apptText.substring(0, 400));

// 4. Check what the 422 error says exactly
console.log("\n--- Testing /calendars/events without calendarId ---");
const evRes = await fetch(`${BASE}/calendars/events?locationId=${LOCATION_ID}&startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}`, { headers });
console.log("Status:", evRes.status);
const evText = await evRes.text();
console.log("Response:", evText.substring(0, 400));
