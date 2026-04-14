import { readFileSync } from "fs";

try {
  const env = readFileSync("/home/ubuntu/fascia-dashboard/.env", "utf8");
  for (const line of env.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
} catch {}

const key = process.env.GHL_API_KEY;
const loc = process.env.GHL_LOCATION_ID || "krCLgbfFUDCiil9Hy5jV";
const headers = {
  "Authorization": `Bearer ${key}`,
  "Content-Type": "application/json",
  "Version": "2021-04-15"
};

// Get Fredrik's calendar
const cResp = await fetch(`https://services.leadconnectorhq.com/calendars/?locationId=${loc}`, { headers });
const cData = await cResp.json();
const fredrik = cData.calendars.find(c => c.name.includes("Fredrik"));
console.log("Fredrik calendar:", fredrik?.id, fredrik?.name);

// Try with Unix timestamps (milliseconds)
const startMs = new Date("2026-04-14").getTime();
const endMs = new Date("2026-06-30").getTime();

const avUrl = `https://services.leadconnectorhq.com/calendars/${fredrik?.id}/free-slots?startDate=${startMs}&endDate=${endMs}&timezone=Europe%2FStockholm`;
console.log("\nFetching:", avUrl.substring(0, 120) + "...");
const avResp = await fetch(avUrl, { headers });
console.log("Status:", avResp.status);
const avData = await avResp.json();
console.log("Keys:", Object.keys(avData));

if (avData._dates_) {
  const dates = Object.keys(avData._dates_);
  console.log(`\nDates with slots: ${dates.length}`);
  dates.slice(0, 3).forEach(d => {
    console.log(`  ${d}: ${avData._dates_[d].slots?.length || 0} slots`);
    if (avData._dates_[d].slots?.length) {
      console.log("    First slot:", JSON.stringify(avData._dates_[d].slots[0]));
    }
  });
} else {
  console.log("Response:", JSON.stringify(avData).substring(0, 600));
}

// Also try the calendar groups endpoint
console.log("\n--- Calendar Groups ---");
const grpResp = await fetch(`https://services.leadconnectorhq.com/calendars/groups?locationId=${loc}`, { headers });
console.log("Groups status:", grpResp.status);
const grpData = await grpResp.json();
console.log("Groups keys:", Object.keys(grpData));
if (grpData.groups) {
  console.log("Groups:", grpData.groups.map(g => `${g.name} (${g.id})`).join(", "));
}

// Check calendar max_attendees / seats
console.log("\n--- Calendar details (seats) ---");
const calResp = await fetch(`https://services.leadconnectorhq.com/calendars/${fredrik?.id}`, { headers });
const calData = await calResp.json();
console.log("Calendar detail keys:", Object.keys(calData.calendar || calData));
const cal = calData.calendar || calData;
console.log("Relevant fields:", JSON.stringify({
  id: cal.id,
  name: cal.name,
  maxAttendees: cal.maxAttendees,
  seats: cal.seats,
  totalSeats: cal.totalSeats,
  eventType: cal.eventType,
  calendarType: cal.calendarType,
}, null, 2));
