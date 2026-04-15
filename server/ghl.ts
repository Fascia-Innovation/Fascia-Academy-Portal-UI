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
  groupId?: string;
  appoinmentPerSlot?: number; // max seats per slot (note: GHL typo)
  calendarType?: string;
  teamMembers?: Array<{ userId: string; meetingLocation?: string; isPrimary?: boolean }>;
  widgetSlug?: string;
}

export interface GHLCalendarGroup {
  id: string;
  name: string;
  locationId: string;
  isActive?: boolean;
}

export interface GHLFreeSlot {
  date: string;        // YYYY-MM-DD
  slotTime: string;   // ISO datetime string
  calendarId: string;
  calendarName: string;
  courseLeader: string;
  location: string;
  maxSeats: number;
  bookedSeats: number;
  availableSeats: number;
  participants: Array<{ id: string; name: string; email: string; status: string }>;
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
export async function getCalendarGroups(): Promise<GHLCalendarGroup[]> {
  const data = await ghlGet<{ groups: GHLCalendarGroup[] }>("/calendars/groups", {
    locationId: LOCATION_ID,
  });
  return (data.groups ?? []).filter(g => !g.name.startsWith("."));
}

export async function getCalendarDetail(calendarId: string): Promise<GHLCalendar | null> {
  try {
    const data = await ghlGet<GHLCalendar>(`/calendars/${calendarId}`);
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch free slots for a calendar within a date range.
 * GHL limits the range to 31 days per request.
 * Returns a map of date -> array of ISO slot strings.
 */
export async function getCalendarFreeSlots(
  calendarId: string,
  startMs: number,
  endMs: number
): Promise<Record<string, string[]>> {
  // Clamp to 31 days max
  const maxRange = 30 * 24 * 60 * 60 * 1000;
  const clampedEnd = Math.min(endMs, startMs + maxRange);
  try {
    const data = await ghlGet<Record<string, { slots: string[] } | string>>(
      `/calendars/${calendarId}/free-slots`,
      {
        startDate: String(startMs),
        endDate: String(clampedEnd),
        timezone: "Europe/Stockholm",
      }
    );
    const result: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === "traceId") continue;
      if (typeof v === "object" && v !== null && "slots" in v) {
        result[k] = (v as { slots: string[] }).slots;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Build the full course calendar: for each calendar, fetch free slots and
 * the booked appointments for those slots, then return enriched slot objects.
 */
export async function getCourseCalendar(
  startMs: number,
  endMs: number
): Promise<GHLFreeSlot[]> {
  const calendars = await getCalendars();
  const activeCals = calendars.filter(c => !c.name.startsWith("Template"));

  // Process calendars in parallel batches of 8 to avoid timeouts
  const BATCH_SIZE = 8;
  const allResults: GHLFreeSlot[] = [];

  for (let i = 0; i < activeCals.length; i += BATCH_SIZE) {
    const batch = activeCals.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(async (cal) => {
      const slotResults: GHLFreeSlot[] = [];

      // Fetch free slots
      const slotsByDate = await getCalendarFreeSlots(cal.id, startMs, endMs);
      const allSlotTimes = Object.values(slotsByDate).flat();
      if (allSlotTimes.length === 0) return slotResults;

      // Fetch booked appointments for this calendar in the range
      const startMs2 = String(startMs);
      const endMs2 = String(Math.min(endMs, startMs + 30 * 24 * 60 * 60 * 1000));
      let bookedAppts: GHLAppointment[] = [];
      try {
        const evData = await ghlGet<{ events: GHLAppointment[] }>(
          `/calendars/events`,
          { calendarId: cal.id, locationId: LOCATION_ID, startTime: startMs2, endTime: endMs2 }
        );
        bookedAppts = (evData.events ?? []).filter(e => {
          const s = (e.appointmentStatus ?? e.status ?? "").toLowerCase();
          return !["cancelled", "no_show", "noshow", "invalid"].includes(s);
        });
      } catch { /* skip */ }

      // Determine location from team member
      const primaryMember = cal.teamMembers?.find(m => m.isPrimary) ?? cal.teamMembers?.[0];
      const rawLocation = primaryMember?.meetingLocation ?? "";
      const locationParts = rawLocation.split(/\t|,/).map((s: string) => s.trim()).filter(Boolean);
      const location = locationParts[locationParts.length - 1] ?? rawLocation;

      const maxSeats = cal.appoinmentPerSlot ?? 14;
      const courseLeader = extractCourseLeaderName(cal.name);

      for (const [date, slots] of Object.entries(slotsByDate)) {
        for (const slotTime of slots) {
          const slotHour = new Date(slotTime).getTime();
          const slotParticipants = bookedAppts
            .filter(a => {
              const aTime = new Date(a.startTime).getTime();
              return Math.abs(aTime - slotHour) < 60 * 60 * 1000;
            })
            .map(a => ({
              id: a.contactId,
              name: a.title ?? a.contactId,
              email: a.contact?.email ?? "",
              status: a.appointmentStatus ?? a.status ?? "",
            }));

          slotResults.push({
            date,
            slotTime,
            calendarId: cal.id,
            calendarName: cal.name,
            courseLeader,
            location,
            maxSeats,
            bookedSeats: slotParticipants.length,
            availableSeats: Math.max(0, maxSeats - slotParticipants.length),
            participants: slotParticipants,
          });
        }
      }
      return slotResults;
    }));
    allResults.push(...batchResults.flat());
  }

  // Sort by date then time
  return allResults.sort((a, b) => a.slotTime.localeCompare(b.slotTime));
}

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
  // GHL API requires timestamps in milliseconds
  const startMs = String(new Date(startDate).getTime());
  const endMs = String(new Date(endDate).getTime());
  const data = await ghlGet<{ events: GHLAppointment[] }>(
    `/calendars/events`,
    { calendarId, locationId: LOCATION_ID, startTime: startMs, endTime: endMs }
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
  // Use parallel fetching with concurrency limit to avoid timeouts
  const calendars = await getCalendars();
  const startMs = String(new Date(startDate).getTime());
  const endMs = String(new Date(endDate).getTime());
  const CONCURRENCY = 8;
  const results: GHLAppointment[] = [];
  for (let i = 0; i < calendars.length; i += CONCURRENCY) {
    const batch = calendars.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((cal) =>
        ghlGet<{ events: GHLAppointment[] }>(
          `/calendars/events`,
          { calendarId: cal.id, locationId: LOCATION_ID, startTime: startMs, endTime: endMs }
        ).then((d) => d.events ?? [])
      )
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(...r.value);
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

// ─── Contact search helpers ─────────────────────────────────────────────────
/**
 * Search for a GHL contact by email address.
 * Returns the first matching contact or null if not found.
 */
export async function searchContactByEmail(email: string): Promise<GHLContact | null> {
  // GHL v2 /contacts/search/duplicate returns { contact: {...} } (singular)
  try {
    const data = await ghlGet<{ contact?: GHLContact; contacts?: GHLContact[] }>(
      `/contacts/search/duplicate`,
      { locationId: LOCATION_ID, email }
    );
    // Handle both singular and plural response formats
    if (data.contact) return data.contact;
    if (data.contacts?.[0]) return data.contacts[0];
  } catch (e) {
    console.warn("[searchContactByEmail] duplicate search failed:", e);
  }
  // Fallback: /contacts/ with query
  try {
    const data = await ghlGet<{ contacts: GHLContact[] }>(
      `/contacts/`,
      { locationId: LOCATION_ID, query: email, limit: "1" }
    );
    if (data.contacts?.[0]) return data.contacts[0];
  } catch (e) {
    console.warn("[searchContactByEmail] contacts list search failed:", e);
  }
  return null;
}

// ─── Contact mutation helpers ───────────────────────────────────────────────
/**
 * Add a tag to a GHL contact.
 * Uses the GHL v2 contacts API PUT /contacts/{contactId}/tags
 */
export async function setGhlTag(contactId: string, tag: string): Promise<void> {
  const url = `${GHL_BASE}/contacts/${contactId}/tags`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ tags: [tag] }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL setGhlTag error ${res.status}: ${body}`);
  }
}

// ─── Email helpers ───────────────────────────────────────────────────────────

/**
 * Send an exam result email to a student via GHL Conversations API.
 * Uses the GHL /conversations/messages endpoint with type: Email.
 *
 * @param contactId  - GHL contact ID of the student
 * @param contactEmail - Student's email address (used as emailTo)
 * @param contactName  - Student's full name (for personalisation)
 * @param courseType   - 'diplo' | 'cert'
 * @param language     - 'sv' | 'en'
 * @param result       - 'passed' | 'failed'
 * @param feedback     - Optional examiner feedback/comment to include in the email
 */
export async function sendExamResultEmail(opts: {
  contactId: string;
  contactEmail: string;
  contactName: string;
  courseType: "diplo" | "cert";
  language: string;
  result: "passed" | "failed";
  feedback?: string | null;
}): Promise<void> {
  const { contactId, contactEmail, contactName, courseType, language, result, feedback } = opts;

  const isSv = language !== "en";
  const courseName = courseType === "cert"
    ? (isSv ? "Certifierad Fasciaspecialist" : "Certified Fascia Specialist")
    : (isSv ? "Diplomerad Fasciaspecialist" : "Qualified Fascia Specialist");

  let subject: string;
  let html: string;

  if (result === "passed") {
    subject = isSv
      ? `Grattis! Ditt prov för ${courseName} är godkänt`
      : `Congratulations! Your exam for ${courseName} has been approved`;

    const feedbackBlock = feedback
      ? (isSv
          ? `<p><strong>Kommentar från provrättaren:</strong><br>${feedback.replace(/\n/g, "<br>")}</p>`
          : `<p><strong>Examiner's comment:</strong><br>${feedback.replace(/\n/g, "<br>")}</p>`)
      : "";

    const certNotice = isSv
      ? `<p>Ditt intyg skickas till dig inom kort via ett separat e-postmeddelande.</p>`
      : `<p>Your certificate will be sent to you shortly in a separate email.</p>`;

    html = isSv
      ? `<p>Hej ${contactName},</p>
<p>Vi är glada att meddela att ditt prov för <strong>${courseName}</strong> har blivit <strong>godkänt</strong>!</p>
${feedbackBlock}
${certNotice}
<p>Välkommen att kontakta oss på <a href="mailto:info@fasciaacademy.com">info@fasciaacademy.com</a> om du har några frågor.</p>
<p>Med vänliga hälsningar,<br>Fascia Academy</p>`
      : `<p>Hi ${contactName},</p>
<p>We are pleased to inform you that your exam for <strong>${courseName}</strong> has been <strong>approved</strong>!</p>
${feedbackBlock}
${certNotice}
<p>Please feel free to contact us at <a href="mailto:info@fasciaacademy.com">info@fasciaacademy.com</a> if you have any questions.</p>
<p>Best regards,<br>Fascia Academy</p>`;
  } else {
    subject = isSv
      ? `Ditt prov för ${courseName} – komplettering krävs`
      : `Your exam for ${courseName} – supplementation required`;

    const feedbackBlock = feedback
      ? (isSv
          ? `<p><strong>Återkoppling från provrättaren:</strong><br>${feedback.replace(/\n/g, "<br>")}</p>`
          : `<p><strong>Examiner's feedback:</strong><br>${feedback.replace(/\n/g, "<br>")}</p>`)
      : "";

    html = isSv
      ? `<p>Hej ${contactName},</p>
<p>Vi har granskat ditt prov för <strong>${courseName}</strong> och behöver tyvärr meddela att det <strong>inte är godkänt</strong> i nuläget.</p>
${feedbackBlock}
<p>Du är välkommen att komplettera och skicka in ditt prov på nytt. Kontakta oss gärna på <a href="mailto:info@fasciaacademy.com">info@fasciaacademy.com</a> om du har frågor.</p>
<p>Med vänliga hälsningar,<br>Fascia Academy</p>`
      : `<p>Hi ${contactName},</p>
<p>We have reviewed your exam for <strong>${courseName}</strong> and unfortunately need to inform you that it has <strong>not been approved</strong> at this time.</p>
${feedbackBlock}
<p>You are welcome to supplement and resubmit your exam. Please contact us at <a href="mailto:info@fasciaacademy.com">info@fasciaacademy.com</a> if you have any questions.</p>
<p>Best regards,<br>Fascia Academy</p>`;
  }

  const body: Record<string, unknown> = {
    type: "Email",
    contactId,
    emailTo: contactEmail,
    emailFrom: "info@fasciaacademy.com",
    subject,
    html,
    status: "pending",
  };

  const url = `${GHL_BASE}/conversations/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Version: "2021-04-15",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL sendExamResultEmail error ${res.status}: ${text}`);
  }
}

/**
 * Send an admin notification email to info@fasciaacademy.com when a new exam is submitted.
 */
export async function sendAdminExamNotification(opts: {
  contactName: string;
  contactEmail: string;
  courseType: "diplo" | "cert";
  language: string;
}): Promise<void> {
  const { contactName, contactEmail, courseType, language } = opts;
  const ADMIN_CONTACT_ID = "DE7AomgMw1EEbM3SIVj0";
  const ADMIN_EMAIL = "info@fasciaacademy.com";

  const courseName = courseType === "cert"
    ? (language === "en" ? "Certified Fascia Specialist" : "Certifierad Fasciaspecialist")
    : (language === "en" ? "Qualified Fascia Specialist" : "Diplomerad Fasciaspecialist");

  const subject = `New exam submitted: ${contactName} – ${courseName}`;
  const html = `<p>A new exam has been submitted and is waiting for review in the Exam Queue.</p>
<ul>
  <li><strong>Student:</strong> ${contactName}</li>
  <li><strong>Email:</strong> ${contactEmail}</li>
  <li><strong>Course:</strong> ${courseName}</li>
  <li><strong>Language:</strong> ${language === "en" ? "English" : "Swedish"}</li>
</ul>
<p><a href="https://fascidash-9qucsw5g.manus.space/exam-queue">Open Exam Queue →</a></p>`;

  const body: Record<string, unknown> = {
    type: "Email",
    contactId: ADMIN_CONTACT_ID,
    emailTo: ADMIN_EMAIL,
    emailFrom: "info@fasciaacademy.com",
    subject,
    html,
    status: "pending",
  };

  const url = `${GHL_BASE}/conversations/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Version: "2021-04-15",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[sendAdminExamNotification] GHL error ${res.status}: ${text}`);
    // Don't throw — admin notification failure should not block the exam submission
  } else {
    console.log(`[sendAdminExamNotification] Admin notified for ${contactName} (${courseType}/${language})`);
  }
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
