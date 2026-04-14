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

// Get Fredrik's calendar full details
const cResp = await fetch(`https://services.leadconnectorhq.com/calendars/?locationId=${loc}`, { headers });
const cData = await cResp.json();
const fredrik = cData.calendars.find(c => c.name.includes("Fredrik"));
console.log("Full calendar object for Fredrik:");
console.log(JSON.stringify(fredrik, null, 2));

// Try free-slots with max 31 days
const now = Date.now();
const in30 = now + 30 * 24 * 60 * 60 * 1000;
const avUrl = `https://services.leadconnectorhq.com/calendars/${fredrik?.id}/free-slots?startDate=${now}&endDate=${in30}&timezone=Europe%2FStockholm`;
console.log("\n--- Free slots (30 days) ---");
const avResp = await fetch(avUrl, { headers });
console.log("Status:", avResp.status);
const avData = await avResp.json();

if (avData._dates_) {
  const dates = Object.keys(avData._dates_);
  console.log(`Dates with slots: ${dates.length}`);
  dates.forEach(d => {
    const slots = avData._dates_[d].slots || [];
    console.log(`  ${d}: ${slots.length} slots`);
    slots.slice(0, 2).forEach(s => console.log("    ", JSON.stringify(s)));
  });
} else {
  console.log("Response:", JSON.stringify(avData).substring(0, 500));
}

// Try the class booking specific endpoint - get events for this calendar
console.log("\n--- Calendar events (all statuses, past 30 days + next 30 days) ---");
const past30 = now - 30 * 24 * 60 * 60 * 1000;
const evUrl = `https://services.leadconnectorhq.com/calendars/events?locationId=${loc}&calendarId=${fredrik?.id}&startTime=${past30}&endTime=${in30}`;
const evResp = await fetch(evUrl, { headers });
console.log("Events status:", evResp.status);
const evData = await evResp.json();
const events = evData.events || [];
console.log("Events count:", events.length);
events.forEach(e => {
  console.log(`  ${e.startTime} | status: ${e.appointmentStatus} | contactId: ${e.contactId}`);
});

// Check appoinmentPerSlot field
console.log("\n--- appoinmentPerSlot (max seats per slot) ---");
const calDetailResp = await fetch(`https://services.leadconnectorhq.com/calendars/${fredrik?.id}`, { headers });
const calDetail = await calDetailResp.json();
console.log("appoinmentPerSlot:", calDetail.appoinmentPerSlot);
console.log("appoinmentPerDay:", calDetail.appoinmentPerDay);
console.log("calendarType:", calDetail.calendarType);
console.log("availabilities:", JSON.stringify(calDetail.availabilities?.slice(0, 2), null, 2));
