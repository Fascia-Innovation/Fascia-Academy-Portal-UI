const API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const BASE = "https://services.leadconnectorhq.com";
const headers = {
  Authorization: `Bearer ${API_KEY}`,
  Version: "2021-04-15",
  Accept: "application/json",
};

// Get calendars
const calsRes = await fetch(`${BASE}/calendars/?locationId=${LOCATION_ID}`, { headers });
const calsData = await calsRes.json();
const cals = calsData.calendars ?? [];
console.log("Calendars:", cals.length);

const start = "2025-01-01T00:00:00.000Z";
const end = "2026-06-30T23:59:59.000Z";

// Only check first 10 calendars to avoid timeout
let totalFound = 0;
for (const cal of cals.slice(0, 10)) {
  const url = `${BASE}/calendars/events?calendarId=${cal.id}&locationId=${LOCATION_ID}&startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  const events = data.events ?? [];
  if (events.length > 0) {
    totalFound += events.length;
    const statuses = [...new Set(events.map(e => e.appointmentStatus))];
    console.log(`\n✓ ${cal.name.substring(0,50)} → ${events.length} events, statuses: ${statuses.join(", ")}`);
    if (totalFound === events.length) {
      // Print first event to understand structure
      console.log("Sample:", JSON.stringify(events[0]).substring(0, 500));
    }
  } else {
    console.log(`  ${cal.name.substring(0,50)} → 0`);
  }
}
console.log(`\nTotal events in first 10 calendars: ${totalFound}`);
