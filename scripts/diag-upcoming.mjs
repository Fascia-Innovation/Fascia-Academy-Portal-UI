import { readFileSync } from "fs";

// Load .env manually
try {
  const env = readFileSync("/home/ubuntu/fascia-dashboard/.env", "utf8");
  for (const line of env.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
} catch {}

const key = process.env.GHL_API_KEY || "pit-e6c29d45-b3d1-46ca-8b43-3f6930c3cad0";
const loc = process.env.GHL_LOCATION_ID || "krCLgbfFUDCiil9Hy5jV";

const headers = {
  "Authorization": `Bearer ${key}`,
  "Content-Type": "application/json",
  "Version": "2021-04-15"
};

const headersV2 = {
  "Authorization": `Bearer ${key}`,
  "Content-Type": "application/json",
  "Version": "2021-07-28"
};

console.log("=== GHL Upcoming Events Diagnostic ===\n");
console.log("API Key (first 20):", key.substring(0, 20) + "...");
console.log("Location ID:", loc);

// 1. Get all calendars
const cResp = await fetch(`https://services.leadconnectorhq.com/calendars/?locationId=${loc}`, { headers });
const cData = await cResp.json();
const allCals = cData.calendars || [];
const cals = allCals.filter(c => !c.name.startsWith("Template"));
console.log(`\nCalendars: ${cals.length} active (${allCals.length} total)\n`);

// 2. Check upcoming events for ALL calendars
const now = Date.now();
const in90 = now + 90 * 24 * 60 * 60 * 1000;
const in180 = now + 180 * 24 * 60 * 60 * 1000;

let totalFound = 0;

for (const cal of cals) {
  // Try 90 days
  const url = `https://services.leadconnectorhq.com/calendars/events?locationId=${loc}&calendarId=${cal.id}&startTime=${now}&endTime=${in90}`;
  const r = await fetch(url, { headers });
  const d = await r.json();
  const events = d.events || [];
  
  if (events.length > 0) {
    totalFound += events.length;
    const statuses = [...new Set(events.map(e => e.appointmentStatus || "unknown"))];
    console.log(`[FOUND] ${cal.name}`);
    console.log(`  Events: ${events.length}, Statuses: ${statuses.join(", ")}`);
    console.log(`  First: ${events[0].startTime} (${events[0].appointmentStatus})`);
    if (events.length > 1) console.log(`  Last:  ${events[events.length-1].startTime}`);
    console.log();
  }
}

if (totalFound === 0) {
  console.log("No events found in next 90 days. Trying 180 days...\n");
  
  for (const cal of cals) {
    const url = `https://services.leadconnectorhq.com/calendars/events?locationId=${loc}&calendarId=${cal.id}&startTime=${now}&endTime=${in180}`;
    const r = await fetch(url, { headers });
    const d = await r.json();
    const events = d.events || [];
    
    if (events.length > 0) {
      totalFound += events.length;
      const statuses = [...new Set(events.map(e => e.appointmentStatus || "unknown"))];
      console.log(`[FOUND 180d] ${cal.name}`);
      console.log(`  Events: ${events.length}, Statuses: ${statuses.join(", ")}`);
      console.log(`  First: ${events[0].startTime}`);
      console.log();
    }
  }
}

if (totalFound === 0) {
  console.log("Still nothing. Trying the appointments endpoint instead...\n");
  
  // Try the /appointments/ endpoint
  const apptUrl = `https://services.leadconnectorhq.com/appointments/?locationId=${loc}&startDate=${new Date(now).toISOString().split("T")[0]}&endDate=${new Date(in180).toISOString().split("T")[0]}`;
  const apptResp = await fetch(apptUrl, { headers: headersV2 });
  console.log("Appointments endpoint status:", apptResp.status);
  const apptData = await apptResp.json();
  console.log("Appointments response keys:", Object.keys(apptData));
  if (apptData.appointments) {
    console.log("Appointments count:", apptData.appointments.length);
    if (apptData.appointments.length > 0) {
      console.log("First appointment:", JSON.stringify(apptData.appointments[0], null, 2));
    }
  } else {
    console.log("Full response:", JSON.stringify(apptData, null, 2).substring(0, 500));
  }
}

console.log(`\n=== Total events found: ${totalFound} ===`);
