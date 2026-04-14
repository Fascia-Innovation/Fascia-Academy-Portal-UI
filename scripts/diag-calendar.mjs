import { readFileSync } from 'fs';
import { createRequire } from 'module';

try {
  const env = readFileSync('/home/ubuntu/fascia-dashboard/.env', 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
} catch {}

const key = process.env.GHL_API_KEY;
const loc = 'krCLgbfFUDCiil9Hy5jV';
const headers = { 'Authorization': 'Bearer ' + key, 'Version': '2021-04-15' };

const r = await fetch('https://services.leadconnectorhq.com/calendars/?locationId=' + loc, { headers });
const d = await r.json();
const cals = d.calendars.filter(c => c.isActive !== false);
console.log('Total active calendars:', cals.length);

const now = Date.now();
const end = now + 30 * 24 * 60 * 60 * 1000;
let totalSlots = 0;

for (const cal of cals) {
  const url = `https://services.leadconnectorhq.com/calendars/${cal.id}/free-slots?startDate=${now}&endDate=${end}&timezone=Europe%2FStockholm`;
  const sr = await fetch(url, { headers });
  const sd = await sr.json();
  const dateKeys = Object.keys(sd).filter(k => k !== 'traceId');
  if (dateKeys.length > 0) {
    console.log('SLOTS:', cal.name, '->', dateKeys);
    totalSlots += dateKeys.length;
  }
}
console.log('\nTotal calendars with slots:', totalSlots);
