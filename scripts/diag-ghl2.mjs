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
console.log("Total calendars:", cals.length);

// Try a very wide date range
const start = "2020-01-01T00:00:00.000Z";
const end = "2027-12-31T23:59:59.000Z";

// Check ALL calendars
let totalFound = 0;
for (const cal of cals) {
  const url = `${BASE}/calendars/events?calendarId=${cal.id}&locationId=${LOCATION_ID}&startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.log(`  ERROR ${res.status} for ${cal.name.substring(0,40)}`);
    continue;
  }
  const data = await res.json();
  const events = data.events ?? [];
  if (events.length > 0) {
    totalFound += events.length;
    console.log(`✓ ${cal.name.substring(0,55)} → ${events.length} events`);
    if (totalFound <= events.length) {
      console.log("  Sample event:", JSON.stringify(events[0]).substring(0, 400));
    }
  }
}
console.log(`\nTotal events across ALL calendars: ${totalFound}`);

// Also try fetching a contact's appointments directly
console.log("\n--- Testing contact appointments ---");
const contactsRes = await fetch(`${BASE}/contacts/?locationId=${LOCATION_ID}&limit=3`, { headers });
const contactsData = await contactsRes.json();
const contacts = contactsData.contacts ?? [];
console.log("Sample contacts:", contacts.length);

if (contacts.length > 0) {
  const contactId = contacts[0].id;
  const apptRes = await fetch(`${BASE}/contacts/${contactId}/appointments`, { headers });
  console.log("Contact appointments status:", apptRes.status);
  const apptText = await apptRes.text();
  console.log("Response:", apptText.substring(0, 400));
}
