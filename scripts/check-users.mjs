import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

// Load env
const envFile = readFileSync('/home/ubuntu/fascia-dashboard/.env', 'utf8');
const envVars = {};
for (const line of envFile.split('\n')) {
  const [k, ...v] = line.split('=');
  if (k && v.length) envVars[k.trim()] = v.join('=').trim();
}

const conn = await mysql.createConnection(envVars.DATABASE_URL || process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id, email, role, name FROM dashboard_users LIMIT 10');
console.log(JSON.stringify(rows, null, 2));
await conn.end();
