/**
 * GoHighLevel API service layer
 * Wraps all GHL v2 API calls used by the Fascia Academy Dashboard.
 */

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
  startTime: string;
  endTime: string;
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
  const data = await ghlGet<{ calendars: GHLCalendar[] }>("/calendars/", {
    locationId: LOCATION_ID,
  });
  return data.calendars ?? [];
}

// ─── Appointments ─────────────────────────────────────────────────────────────
export async function getAppointmentsByCalendar(
  calendarId: string,
  startDate: string, // ISO date string
  endDate: string
): Promise<GHLAppointment[]> {
  const data = await ghlGet<{ appointments: GHLAppointment[] }>(
    `/calendars/events`,
    {
      calendarId,
      locationId: LOCATION_ID,
      startTime: startDate,
      endTime: endDate,
    }
  );
  return data.appointments ?? [];
}

export async function getAllAppointments(
  startDate: string,
  endDate: string
): Promise<GHLAppointment[]> {
  const data = await ghlGet<{ events: GHLAppointment[] }>(
    `/calendars/events`,
    {
      locationId: LOCATION_ID,
      startTime: startDate,
      endTime: endDate,
    }
  );
  return data.events ?? [];
}

// ─── Contacts ─────────────────────────────────────────────────────────────────
export async function getContact(contactId: string): Promise<GHLContact | null> {
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
      {
        locationId: LOCATION_ID,
        tags: tag,
        limit: "100",
        page: String(page),
      }
    );
    const contacts = data.contacts ?? [];
    results.push(...contacts);
    if (contacts.length < 100) break;
    page++;
  }
  return results;
}

// ─── Custom field helpers ─────────────────────────────────────────────────────
export function getCustomField(
  contact: GHLContact,
  fieldId: string
): string | null {
  const field = contact.customFields?.find((f) => f.id === fieldId);
  if (!field) return null;
  if (Array.isArray(field.value)) return field.value[0] ?? null;
  return String(field.value ?? "");
}

// Known custom field IDs
export const FIELD_IDS = {
  paidAmountSEK: "settlement_paid_amount_sek",   // will be resolved dynamically
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
  const affiliateCommission = affiliateCode
    ? paidAmountExclVAT * AFFILIATE_COMMISSION_RATE
    : 0;
  const affiliateDiscount = affiliateCode
    ? paidAmountInclVAT * AFFILIATE_DISCOUNT_RATE
    : 0;
  const courseLeaderPayout =
    paidAmountExclVAT - transactionFee - margin - affiliateCommission;

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
  // Pattern: "Introduktionskurs Fascia – Anna Lindgren – Stockholm"
  const parts = calendarName.split("–").map((p) => p.trim());
  if (parts.length >= 2) return parts[1];
  return calendarName;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
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
