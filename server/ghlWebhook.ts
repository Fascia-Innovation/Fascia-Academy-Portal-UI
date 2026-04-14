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
import { detectCourseType, getCalendars } from "./ghl";
import { generateCertificatePdf } from "./certificatePdf";

export function registerGhlWebhookRoutes(app: Express): void {
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
}
