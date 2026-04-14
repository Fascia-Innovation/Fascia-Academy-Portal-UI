/**
 * GoHighLevel API service layer
 * Wraps all GHL v2 API calls used by the Fascia Academy Dashboard.
 * Supports mock data mode (reads from ghl_cache table when mock:enabled = "true").
 */
import { getDb } from "./db";

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY ?? "";
const LOCATION_ID = process.env.GHL_LOCATION_ID ?? "";

// ─── Financial constants ─────────────────────────────────────────────────────
export const TRANSACTION_FEE_RATE = 0.031; // 3.1% Klarna/Stripe
export const VAT_RATE = 0.25; // 25% Swedish VAT
export const FA_MARGIN: Record<string, { sek: number; eur: number }> = {
  intro: { sek: 500, eur: 50 },
  diplo: { sek: 4000, eur: 400 },
  cert: { sek: 0, eur: 0 },
  vidare: { sek: 0, eur: 0 },
};
export const AFFILIATE_COMMISSION_RATE = 0.30; // 30% of paid amount excl. VAT
export const AFFILIATE_DISCOUNT_RATE = 0.10; // 10% discount on course price

// ─── Course type detection ────────────────────────────────────────────────────
export function detectCourseType(calendarName: string): "intro" | "diplo" | "cert" | "vidare" {
  const n = calendarName.toLowerCase();
  if (n.includes("introduktionskurs") || n.includes("introduction course")) return "intro";
  if (n.includes("diplom") || n.includes("qualified")) return "diplo";
  if (n.includes("certif")) return "cert";
  return "vidare";
}

export function detectCurrency(calendarName: string): "SEK" | "EUR" {
  const n = calendarName.toLowerCase();
  if (n.includes("(en)") || n.includes("english") || n.includes("introduction course")) return "EUR";
  return "SEK";
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
async function ghlGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GHL_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Version: "2021-04-15",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL API error ${res.status} for ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─── Mock data helpers ────────────────────────────────────────────────────────
async function isMockEnabled(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    const rows = await db.execute(
      "SELECT cache_value FROM ghl_cache WHERE cache_key = 'mock:enabled' AND expires_at > NOW() LIMIT 1"
    ) as unknown as [Array<{ cache_value: string }>];
    return rows[0]?.[0]?.cache_value === "true";
  } catch {
    return false;
  }
}

async function getMockCache<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.execute(
      `SELECT cache_value FROM ghl_cache WHERE cache_key = '${key.replace(/'/g, "''")}' AND expires_at > NOW() LIMIT 1`
    ) as unknown as [Array<{ cache_value: string }>];
    const row = rows[0]?.[0];
    if (!row) return null;
    return JSON.parse(row.cache_value) as T;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GHLCalendar {
  id: string;
  name: string;
  description?: string;
  locationId: string;
}

export interface GHLAppointment {
  id: string;
  calendarId: string;
  contactId: string;
  title: string;
  status: string;
  appointmentStatus?: string;
  startTime: string;
  endTime: string;
  customFields?: Array<{ id: string; value: string | number | string[] }>;
  contact?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    customFields?: Array<{ id: string; value: string | number | string[] }>;
  };
}

export interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: Array<{ id: string; value: string | number | string[] }>;
}

// ─── Calendars ────────────────────────────────────────────────────────────────
export async function getCalendars(): Promise<GHLCalendar[]> {
  if (await isMockEnabled()) {
    const mock = await getMockCache<GHLCalendar[]>("mock:calendars");
    if (mock) return mock;
  }
  const data = await ghlGet<{ calendars: GHLCalendar[] }>("/calendars/", {
    locationId: LOCATION_ID,
  });
  return data.calendars ?? [];
}

// ─── Appointments ─────────────────────────────────────────────────────────────
export async function getAppointmentsByCalendar(
  calendarId: string,
  startDate: string,
  endDate: string
): Promise<GHLAppointment[]> {
  if (await isMockEnabled()) {
    const all = await getMockCache<GHLAppointment[]>("mock:appointments");
    if (all) {
      return all.filter((a) => {
        if (a.calendarId !== calendarId) return false;
        const t = new Date(a.startTime).getTime();
        return t >= new Date(startDate).getTime() && t <= new Date(endDate).getTime();
      });
    }
  }
  const data = await ghlGet<{ events: GHLAppointment[] }>(
    `/calendars/events`,
    { calendarId, locationId: LOCATION_ID, startTime: startDate, endTime: endDate }
  );
  return data.events ?? [];
}

export async function getAllAppointments(
  startDate: string,
  endDate: string
): Promise<GHLAppointment[]> {
  if (await isMockEnabled()) {
    const all = await getMockCache<GHLAppointment[]>("mock:appointments");
    if (all) {
      return all.filter((a) => {
        const t = new Date(a.startTime).getTime();
        return t >= new Date(startDate).getTime() && t <= new Date(endDate).getTime();
      });
    }
  }

  // Real GHL: must fetch per-calendar since the API requires calendarId
  const calendars = await getCalendars();
  const results: GHLAppointment[] = [];
  for (const cal of calendars) {
    try {
      const data = await ghlGet<{ events: GHLAppointment[] }>(
        `/calendars/events`,
        { calendarId: cal.id, locationId: LOCATION_ID, startTime: startDate, endTime: endDate }
      );
      results.push(...(data.events ?? []));
    } catch {
      // Skip calendars that fail
    }
  }
  return results;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────
export async function getContact(contactId: string): Promise<GHLContact | null> {
  if (await isMockEnabled()) {
    const contact = await getMockCache<GHLContact>(`mock:contact:${contactId}`);
    if (contact) return contact;
  }
  try {
    const data = await ghlGet<{ contact: GHLContact }>(`/contacts/${contactId}`);
    return data.contact ?? null;
  } catch {
    return null;
  }
}

export async function getContactsByTag(tag: string): Promise<GHLContact[]> {
  const results: GHLContact[] = [];
  let page = 1;
  while (true) {
    const data = await ghlGet<{ contacts: GHLContact[]; meta?: { total: number } }>(
      `/contacts/`,
      { locationId: LOCATION_ID, tags: tag, limit: "100", page: String(page) }
    );
    const contacts = data.contacts ?? [];
    results.push(...contacts);
    if (contacts.length < 100) break;
    page++;
  }
  return results;
}

// ─── Custom field helpers ─────────────────────────────────────────────────────
export function getCustomField(contact: GHLContact, fieldId: string): string | null {
  const field = contact.customFields?.find((f) => f.id === fieldId);
  if (!field) return null;
  if (Array.isArray(field.value)) return field.value[0] ?? null;
  return String(field.value ?? "");
}

export const FIELD_IDS = {
  paidAmountSEK: "settlement_paid_amount_sek",
  paidAmountEUR: "settlement_paid_amount_eur",
  affiliateCode: "settlement_affiliate_code",
  affiliateName: "settlement_affiliate_name",
  courseLeaderInvoiceEmail: "HhbY84XQnDmMbA8ozN8H",
};

// ─── Financial calculations ───────────────────────────────────────────────────
export interface ParticipantBreakdown {
  contactId: string;
  contactName: string;
  paidAmountInclVAT: number;
  paidAmountExclVAT: number;
  vatAmount: number;
  transactionFee: number;
  faMargin: number;
  affiliateCommission: number;
  affiliateCode: string | null;
  affiliateDiscount: number;
  courseLeaderPayout: number;
  currency: "SEK" | "EUR";
}

export function calculateBreakdown(
  paidAmountInclVAT: number,
  currency: "SEK" | "EUR",
  courseType: "intro" | "diplo" | "cert" | "vidare",
  affiliateCode: string | null
): Omit<ParticipantBreakdown, "contactId" | "contactName" | "affiliateCode"> {
  const paidAmountExclVAT = paidAmountInclVAT / (1 + VAT_RATE);
  const vatAmount = paidAmountInclVAT - paidAmountExclVAT;
  const transactionFee = paidAmountInclVAT * TRANSACTION_FEE_RATE;
  const margin = currency === "SEK" ? FA_MARGIN[courseType].sek : FA_MARGIN[courseType].eur;
  const affiliateCommission = affiliateCode ? paidAmountExclVAT * AFFILIATE_COMMISSION_RATE : 0;
  const affiliateDiscount = affiliateCode ? paidAmountInclVAT * AFFILIATE_DISCOUNT_RATE : 0;
  const courseLeaderPayout = paidAmountExclVAT - transactionFee - margin - affiliateCommission;

  return {
    paidAmountInclVAT,
    paidAmountExclVAT,
    vatAmount,
    transactionFee,
    faMargin: margin,
    affiliateCommission,
    affiliateDiscount,
    courseLeaderPayout: Math.max(0, courseLeaderPayout),
    currency,
  };
}

// ─── Course name extraction ───────────────────────────────────────────────────
export function extractCourseLeaderName(calendarName: string): string {
  // Pattern: "Introduktionskurs Fascia - Anna Lindgren - Stockholm"
  const parts = calendarName.split("-").map((p) => p.trim());
  if (parts.length >= 2) return parts[1];
  return calendarName;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function getPreviousMonths(count: number): Array<{ year: number; month: number; label: string }> {
  const result = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
    });
  }
  return result;
}
