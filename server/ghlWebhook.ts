/**
 * GHL Webhook handler for course completion events.
 *
 * GHL sends a POST to /api/webhooks/ghl-shown when a contact's appointment
 * status changes to "showed". We use this to:
 *   - For Intro/Vidare: generate a certificate immediately
 *   - For Diplo/Cert: create a pending exam record for the examiner queue
 *
 * Webhook URL to configure in GHL workflow:
 *   POST https://<your-domain>/api/webhooks/ghl-shown
 *
 * Expected payload (GHL sends contact + appointment data):
 * {
 *   "type": "AppointmentStatusUpdate",
 *   "contactId": "...",
 *   "contactName": "...",
 *   "email": "...",
 *   "calendarId": "...",
 *   "appointmentStatus": "showed",
 *   "language": "sv" | "en"   // optional custom field
 * }
 */
import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import { exams, certificates } from "../drizzle/schema";
import { detectCourseType, getCalendars, searchContactByEmail, sendAdminExamNotification } from "./ghl";
import { generateCertificatePdf } from "./certificatePdf";

export function registerGhlWebhookRoutes(app: Express): void {
  // DEBUG endpoint — logs raw body so we can see exactly what GHL sends
  app.post("/api/webhooks/debug-payload", (req: Request, res: Response) => {
    const raw = req.body;
    console.log("[DEBUG] Raw body:", JSON.stringify(raw, null, 2));
    console.log("[DEBUG] Keys:", Object.keys(raw));
    return res.json({ received: raw, keys: Object.keys(raw) });
  });

  app.post("/api/webhooks/ghl-shown", async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        type?: string;
        contactId?: string;
        contactName?: string;
        email?: string;
        calendarId?: string;
        appointmentStatus?: string;
        language?: string;
      };

      // Validate payload
      const status = (body.appointmentStatus ?? "").toLowerCase();
      if (status !== "showed" && status !== "show") {
        return res.json({ ok: true, skipped: "not a shown event" });
      }

      const contactId = body.contactId;
      const contactName = body.contactName ?? "Unknown";
      const email = body.email ?? null;
      const calendarId = body.calendarId;
      const language = body.language ?? "sv";

      if (!contactId || !calendarId) {
        return res.status(400).json({ error: "Missing contactId or calendarId" });
      }

      // Detect course type from calendar name
      const calendars = await getCalendars();
      const cal = calendars.find((c) => c.id === calendarId);
      const courseType = cal ? detectCourseType(cal.name) : "intro";

      const db = await getDb();
      if (!db) {
        console.error("[ghlWebhook] DB unavailable");
        return res.status(500).json({ error: "DB unavailable" });
      }

      if (courseType === "intro" || courseType === "vidare") {
        // Auto-generate certificate — no exam needed
        let pdfUrl: string | undefined;
        try {
          pdfUrl = await generateCertificatePdf({
            contactName,
            courseType,
            language,
            issuedAt: new Date(),
          });
        } catch (e) {
          console.error("[ghlWebhook] PDF generation failed:", e);
        }

        await db.insert(certificates).values({
          ghlContactId: contactId,
          contactName,
          contactEmail: email ?? undefined,
          courseType: courseType as "intro" | "vidare",
          language: (language === "en" ? "en" : "sv") as "sv" | "en",
          pdfUrl,
          issuedBy: null,
          examId: null,
        });

        console.log(`[ghlWebhook] Certificate created for ${contactName} (${courseType})`);
        return res.json({ ok: true, action: "certificate_created" });
      } else {
        // Diplo or Cert — create pending exam record
        await db.insert(exams).values({
          ghlContactId: contactId,
          contactName,
          contactEmail: email ?? undefined,
          courseType: courseType as "diplo" | "cert",
          language: (language === "en" ? "en" : "sv") as "sv" | "en",
          status: "pending",
        });

        console.log(`[ghlWebhook] Exam created for ${contactName} (${courseType})`);
        return res.json({ ok: true, action: "exam_created" });
      }
    } catch (err) {
      console.error("[ghlWebhook] Error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/webhooks/exam-submitted
   *
   * Called by GHL Workflow when a student submits an exam survey/form.
   * Creates a pending exam record in the Exam Queue.
   *
   * Expected payload:
   * {
   *   "email": "student@example.com",
   *   "contactName": "Anna Svensson",
   *   "courseType": "diplo" | "cert",
   *   "language": "sv" | "en"
   * }
   */
  app.post("/api/webhooks/exam-submitted", async (req: Request, res: Response) => {
    try {
      // GHL Custom Data sends keys as "fieldName / Value:" — normalize to plain keys
      const rawBody = req.body as Record<string, unknown>;
      const normalized: Record<string, string> = {};
      for (const [key, val] of Object.entries(rawBody)) {
        // Strip " / Value:", " / Va", " /" suffixes that GHL appends
        const cleanKey = key.replace(/\s*\/.*$/, "").trim();
        normalized[cleanKey] = String(val ?? "");
      }

      const email = (normalized["email"] ?? "").trim().toLowerCase();
      const contactName = (normalized["contactName"] ?? "").trim();
      const courseType = (normalized["courseType"] ?? "").toLowerCase();
      const language = (normalized["language"] ?? "sv").toLowerCase();

      console.log("[examWebhook] Raw body keys:", Object.keys(rawBody));
      console.log("[examWebhook] Normalized:", { email, contactName, courseType, language });

      // Validate required fields
      if (!email) {
        return res.status(400).json({ error: "Missing email" });
      }
      if (courseType !== "diplo" && courseType !== "cert") {
        return res.status(400).json({ error: "courseType must be 'diplo' or 'cert'" });
      }
      if (language !== "sv" && language !== "en") {
        return res.status(400).json({ error: "language must be 'sv' or 'en'" });
      }

      const db = await getDb();
      if (!db) {
        console.error("[examWebhook] DB unavailable");
        return res.status(500).json({ error: "DB unavailable" });
      }

      // Look up GHL contact by email to get the contactId
      let ghlContactId: string | null = null;
      let resolvedName = contactName;

      try {
        const contact = await searchContactByEmail(email);
        if (contact) {
          ghlContactId = contact.id;
          // Use GHL name if no name was provided in the webhook
          if (!resolvedName && (contact.firstName || contact.lastName)) {
            resolvedName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
          }
          console.log(`[examWebhook] Found GHL contact: ${contact.id} for email ${email}`);
        } else {
          console.warn(`[examWebhook] No GHL contact found for email ${email} — creating exam with email as ID`);
          // Use email as fallback contactId so the record is still created
          ghlContactId = `email:${email}`;
        }
      } catch (e) {
        console.error("[examWebhook] GHL contact lookup failed:", e);
        ghlContactId = `email:${email}`;
      }

      // Create exam record in queue
      await db.insert(exams).values({
        ghlContactId: ghlContactId!,
        contactName: resolvedName || email,
        contactEmail: email,
        courseType: courseType as "diplo" | "cert",
        language: language as "sv" | "en",
        status: "pending",
      });

      console.log(`[examWebhook] Exam submission recorded for ${resolvedName || email} (${courseType}/${language})`);

      // Notify admin via email
      sendAdminExamNotification({
        contactName: resolvedName || email,
        contactEmail: email,
        courseType: courseType as "diplo" | "cert",
        language,
      }).catch((e) => console.error("[examWebhook] Admin notification failed:", e));

      return res.json({
        ok: true,
        action: "exam_queued",
        email,
        courseType,
        language,
        ghlContactId,
      });
    } catch (err) {
      console.error("[examWebhook] Error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
