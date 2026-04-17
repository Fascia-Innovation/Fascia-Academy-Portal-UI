# Fascia Academy Portal & GHL Integration: Improvement Recommendations

**Date:** April 17, 2026
**Scope:** Full system review covering the Portal, GHL integration, workflows, pipelines, certificates, email, booking page, and scalability.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Webhook Flow: "Showed" Trigger Verification](#2-webhook-flow-showed-trigger-verification)
3. [Course Leader Experience — Replacing GHL Entirely](#3-course-leader-experience--replacing-ghl-entirely)
4. [Customer Journey — Booking to Certificate](#4-customer-journey--booking-to-certificate)
5. [GHL Integration & API Robustness](#5-ghl-integration--api-robustness)
6. [Pipeline & Workflow Alignment](#6-pipeline--workflow-alignment)
7. [Certificate & Exam System](#7-certificate--exam-system)
8. [Settlement & Payout System](#8-settlement--payout-system)
9. [Email & Communication](#9-email--communication)
10. [Public Booking Page (fasciaacademy.com)](#10-public-booking-page)
11. [Admin Portal Improvements](#11-admin-portal-improvements)
12. [Scalability & Architecture](#12-scalability--architecture)
13. [Priority Matrix](#13-priority-matrix)

---

## 1. Executive Summary

The Fascia Academy Portal has matured into a comprehensive system that handles course registration, participant tracking, settlements, exams, and certificates. This document identifies **42 improvement recommendations** across all system components, organized by priority and effort.

The most impactful improvements fall into three categories:

- **Completing the course leader GHL exit** (sections 2-3): The new "Mark Participants" feature is the final piece needed to remove course leader dependency on GHL. However, the webhook chain from "showed" to certificate/exam creation needs verification and a potential gap needs closing.
- **Customer journey friction reduction** (sections 4, 10): The booking flow has several drop-off points that can be smoothed.
- **Scalability preparation** (section 12): As the number of course leaders and locations grows, certain architectural decisions need revisiting.

---

## 2. Webhook Flow: "Showed" Trigger Verification

### Current Flow (Code Review)

The system has **two separate paths** for the "showed" trigger, which creates a potential gap:

**Path A — GHL Webhook (existing, external):**
```
GHL Workflow detects "showed" status
  → POST /api/webhooks/ghl-shown
    → Reads contactId, calendarId, appointmentStatus
    → Detects courseType from calendar name
    → Intro/Vidare: generates certificate PDF + DB record
    → Diplo/Cert: creates pending exam record
```

**Path B — Portal "Mark as Showed" (new feature):**
```
Course leader clicks "Mark showed" in Portal
  → PUT /calendars/appointments/{id} (GHL API)
    → Updates appointment status to "showed"
    → Returns success
    → (END — no webhook triggered from Portal side)
```

### Critical Gap Identified

When a course leader marks a participant as "showed" via the Portal, the GHL appointment status is updated correctly. **However, whether GHL's internal workflow then fires the webhook to `/api/webhooks/ghl-shown` depends entirely on how the GHL workflow is configured.** There are two scenarios:

| Scenario | What Happens | Risk |
|----------|-------------|------|
| GHL workflow triggers on **any** status change to "showed" | Webhook fires → certificate/exam created automatically | **No gap** — works as intended |
| GHL workflow triggers only on **manual** status changes in GHL UI | Webhook does NOT fire when status is changed via API | **Gap** — no certificate/exam created |

### Recommendations

| # | Recommendation | Priority | Effort |
|---|---------------|----------|--------|
| 2.1 | **Test the webhook trigger** with a real appointment: mark "showed" via Portal, check if `/api/webhooks/ghl-shown` receives the POST. This is the single most important verification needed. | **Critical** | 30 min |
| 2.2 | **Add a fallback path in the Portal**: If the webhook does NOT fire from API updates, the `markParticipantShowed` mutation should also call the same certificate/exam creation logic directly (duplicating what `ghl-shown` webhook does). Add a `skipIfWebhookHandled` flag to prevent double-creation. | **Critical** | 2-3 hrs |
| 2.3 | **Add webhook receipt logging**: Create a `webhook_log` table that records every incoming webhook with timestamp, payload hash, and result. This makes debugging much easier and provides an audit trail. | **High** | 1-2 hrs |
| 2.4 | **Add idempotency to certificate/exam creation**: Before inserting a new certificate or exam record, check if one already exists for the same contactId + courseType + date range. This prevents duplicates if both the webhook AND the fallback path fire. | **High** | 1 hr |

---

## 3. Course Leader Experience — Replacing GHL Entirely

### Current State

With the new "Mark Participants" feature, the Portal now covers all course leader needs:

| Task | Portal | GHL | Status |
|------|--------|-----|--------|
| Register new course dates | Yes | No | Complete |
| View upcoming courses | Yes | No | Complete |
| View course history | Yes | No | Complete |
| View participant list | Yes | Yes | **New — just built** |
| Mark participants as showed | Yes | Yes | **New — just built** |
| Mark participants as no-show | Yes | Yes | **New — just built** |
| View statistics | Yes | No | Complete |
| View settlements | Yes | No | Complete |
| Receive notifications | Yes | No | Complete |
| Send messages to participants | No | Yes | Not needed (admin task) |

### Recommendations

| # | Recommendation | Priority | Effort |
|---|---------------|----------|--------|
| 3.1 | **Add a confirmation dialog** before marking "showed" — this is an irreversible action that triggers certificate/exam creation. Currently it's a single click. Add: "This will mark [Name] as having completed the course. A certificate/exam will be generated. Continue?" | **High** | 30 min |
| 3.2 | **Add batch "Mark all as showed"** button for course leaders who have 12+ participants. Marking one by one is tedious. Include a "Select all / Deselect all" checkbox pattern. | **Medium** | 2 hrs |
| 3.3 | **Show participant count in the course card header** (e.g., "8 participants") without needing to expand the list. This gives a quick overview. | **Medium** | 30 min |
| 3.4 | **Add participant email/phone visibility toggle** — some course leaders may not need to see contact details. Default to showing name + status only, with an "expand" to see email/phone. This also aligns with data protection responsibilities. | **Medium** | 1 hr |
| 3.5 | **Disable GHL access for course leaders** once the webhook verification (2.1) confirms the full chain works. Document the process: remove GHL user accounts for course leaders, update onboarding materials. | **High** | Admin task |
| 3.6 | **Add "Course completed" summary email** to course leaders after they mark all participants. Include: course date, number of showed/no-show, next steps (invoice reminder). | **Low** | 2 hrs |

---

## 4. Customer Journey — Booking to Certificate

### Current Customer Flow

```
Customer visits /courses (or fasciaacademy.com)
  → Filters by type/leader/location
  → Clicks "Mer info" → sees course details
  → Clicks "Boka" → GHL booking widget opens in new tab
  → Fills in details + pays via Klarna/Stripe
  → Receives confirmation email from GHL
  → Attends course
  → Course leader marks "showed"
  → [Intro/Vidare] Certificate generated automatically
  → [Diplo/Cert] Exam created → student submits exam → examiner grades → certificate
```

### Friction Points Identified

| Step | Issue | Impact |
|------|-------|--------|
| Booking page → GHL widget | Opens in new tab, different design/branding | Medium — breaks trust, some users may not complete |
| GHL widget time format | Shows AM/PM (10:00 AM) instead of 24h format | Low — confusing for Swedish users |
| Post-booking | No "what to expect" email from Portal | Medium — customer has no Portal awareness |
| Post-course (Intro/Vidare) | Certificate is generated but not automatically emailed to student | **High** — student never receives their certificate |
| Post-course (Diplo/Cert) | Student must submit exam via separate GHL form | Medium — another system switch |
| Exam result | Email sent via GHL Conversations API | Low — works but depends on GHL |

### Recommendations

| # | Recommendation | Priority | Effort |
|---|---------------|----------|--------|
| 4.1 | **Auto-email certificates for Intro/Vidare**: The webhook creates the certificate and PDF but does NOT send it to the student. Add an email step after certificate creation in `ghlWebhook.ts` that sends the PDF as a link. Use the same GHL Conversations API pattern as `sendExamResultEmail`. | **Critical** | 2 hrs |
| 4.2 | **Add a "My Certificates" page for students**: Allow students to log in (via Manus OAuth or a simple email+code flow) and download their certificates. This is a long-term improvement but adds significant value. | **Low** | 8+ hrs |
| 4.3 | **Embed GHL booking widget inline** instead of opening a new tab. GHL supports iframe embedding. This keeps the customer on the Fascia Academy page. | **Medium** | 3-4 hrs |
| 4.4 | **Add a post-booking confirmation page** in the Portal that shows: course details, what to bring, venue directions, course leader contact. Currently the customer is redirected to GHL's generic confirmation. | **Medium** | 4 hrs |
| 4.5 | **Add "Upcoming course" reminder email** 48 hours before the course date. Can be triggered by a scheduled task that checks courseDates with startDate within 48h. | **Medium** | 3 hrs |
| 4.6 | **Track customer progression** across course types: after completing Intro, suggest Diplo. After Diplo, suggest Cert. This can be done via tags in GHL or a new table in the Portal. | **Low** | 4-6 hrs |

---

## 5. GHL Integration & API Robustness

### Current Architecture

The Portal communicates with GHL via REST API v2 for:
- Calendar management (read calendars, slots, events)
- Appointment management (read, update status)
- Contact management (search, read, add tags)
- Email sending (via Conversations API)

A TTL cache (5-10 min) reduces API calls and mitigates GHL's rate limits (429 errors).

### Issues Found in Code Review

| Issue | Location | Severity |
|-------|----------|----------|
| No retry logic for 429 rate limits on write operations | `ghl.ts` — all `fetch` calls | Medium |
| `sendAdminExamNotification` hardcodes portal URL | `ghl.ts:726` — `fascidash-9qucsw5g.manus.space` | Low (works but fragile) |
| `ADMIN_CONTACT_ID` is hardcoded | `ghl.ts:670` — `DE7AomgMw1EEbM3SIVj0` | Low (works but fragile) |
| Calendar name parsing assumes specific format | `extractCourseLeaderName` — splits on `-` | Medium (breaks if name contains `-`) |
| No health check for GHL API availability | — | Low |

### Recommendations

| # | Recommendation | Priority | Effort |
|---|---------------|----------|--------|
| 5.1 | **Add retry with exponential backoff** for GHL write operations (PUT, POST). Currently, if a 429 is returned during `markParticipantShowed`, the operation fails silently. Implement a simple 3-retry pattern with 1s/2s/4s delays. | **High** | 1-2 hrs |
| 5.2 | **Move hardcoded values to environment variables**: `ADMIN_CONTACT_ID`, portal URL in notification emails. These should be configurable without code changes. | **Medium** | 30 min |
| 5.3 | **Add a GHL API health indicator** to the admin dashboard. A simple "GHL: Connected / Degraded / Down" badge based on the last successful API call timestamp. | **Low** | 1 hr |
| 5.4 | **Improve calendar name parsing**: The `extractCourseLeaderName` function assumes names don't contain hyphens. Use a more robust pattern or store the course leader name separately in the calendar metadata. | **Low** | 30 min |
| 5.5 | **Consider GHL API v2 migration**: Some endpoints use Version `2021-04-15`, others use `2021-07-28`. Standardize to the latest stable version for consistency. | **Low** | 1 hr |

---

## 6. Pipeline & Workflow Alignment

### Expected Pipeline Stages (from Knowledge Base)

**Intro Pipeline:**
1. Intresserad / kontakta
2. Bokad kurs / betalt
3. Tagg — Intro CF Completed *(triggered by course leader)*
4. (auto) Flyttas till nasta steg
5. Intyg skickat / Klart *(preferably automated)*

**Diplo/Cert Pipeline:**
1. Intresserad / kontakta
2. Bokad kurs / betalt
3. Tagg — Diplo/Quali FS Complete *(triggered by course leader)*
4. Tagg — Godkant prov *(triggered by FA)*
5. (auto) Flyttas till nasta steg
6. Intyg skickat / Klart *(preferably automated)*

### Current Portal Implementation vs. Expected

| Pipeline Step | Expected Trigger | Portal Implementation | Gap? |
|--------------|-----------------|----------------------|------|
| Bokad kurs / betalt | GHL booking | GHL handles this | No |
| Intro CF Completed | Course leader marks "showed" | Portal sets GHL status to "showed" | **Partial** — no tag set |
| Diplo/Quali FS Complete | Course leader marks "showed" | Portal sets GHL status to "showed" | **Partial** — no tag set |
| Godkant prov | Examiner marks "passed" | Portal sets tag `exam-passed-diplomerad-fs-se` etc. | **Yes** — tag is set |
| Intyg skickat | Auto after certificate | Certificate PDF generated, but **not emailed** (Intro/Vidare) | **Gap** |

### Critical Gap: Missing Tags on "Showed"

When a course leader marks a participant as "showed" via the Portal, the GHL appointment status is updated but **no completion tag is set on the contact**. The expected tags are:

- `Intro CF – Completed` (for Intro courses)
- `Vidare/advance FS - Complete` (for Vidare courses)
- `Diplo/Quali FS - Complete` (for Diplo courses, before exam)
- `Cert FS - Complete` (for Cert courses, before exam)

These tags are what GHL workflows use to move contacts through pipeline stages. Without them, the pipeline automation breaks.

### Recommendations

| # | Recommendation | Priority | Effort |
|---|---------------|----------|--------|
| 6.1 | **Set completion tags when marking "showed"**: In the `markParticipantShowed` mutation, after updating the appointment status, also call `setGhlTag(contactId, tag)` with the appropriate completion tag based on courseType. This requires looking up the contactId from the appointment data. | **Critical** | 2 hrs |
| 6.2 | **Add tag verification in the webhook handler**: When `/api/webhooks/ghl-shown` fires, also set the completion tag if it hasn't been set already. This provides a safety net. | **High** | 1 hr |
| 6.3 | **Document the full tag taxonomy**: Create a reference table of all tags used, their purpose, and which system sets them. Currently this knowledge is spread across code and the knowledge base. | **Medium** | 1 hr |
| 6.4 | **Add pipeline stage tracking in the Portal**: Show which pipeline stage each student is in (from GHL). This gives admin a unified view without switching to GHL. | **Low** | 4-6 hrs |

---

## 7. Certificate & Exam System

### Current State

The certificate system works well for the exam flow (Diplo/Cert):
- Exam submitted via webhook → pending record created
- Examiner grades in Portal → certificate generated + tag set + email sent

For Intro/Vidare, certificates are generated automatically but have gaps.

### Issues Found

| Issue | Severity |
|-------|----------|
| Intro/Vidare certificates are generated but never emailed to the student | **Critical** |
| Certificate PDF uses only Helvetica font (no Fascia Academy branding/logo) | Low |
| No certificate verification system (QR code or verification URL) | Low |
| Exam grading has no "request supplementary information" option (only pass/fail) | Medium |
| No exam resubmission tracking (if student fails and resubmits, it's a new record) | Medium |

### Recommendations

| # | Recommendation | Priority | Effort |
|---|---------------|----------|--------|
| 7.1 | **Email Intro/Vidare certificates automatically** (same as 4.1 — this is the most impactful single fix). | **Critical** | 2 hrs |
| 7.2 | **Add "Request supplementary info" option** to exam grading. Instead of just pass/fail, allow the examiner to request additional information. This sets status to "needs_supplement" and sends an email to the student. The knowledge base specifically mentions this capability. | **High** | 3 hrs |
| 7.3 | **Link exam resubmissions**: When a student who previously failed submits a new exam, link it to the original exam record. Show the history in the exam queue so the examiner has context. | **Medium** | 2 hrs |
| 7.4 | **Add Fascia Academy logo to certificate PDF**: Upload the logo to S3 and embed it in the PDF. Also consider using a more distinctive font. | **Low** | 2 hrs |
| 7.5 | **Add certificate verification URL**: Generate a unique verification code per certificate and add a QR code to the PDF that links to a public verification page. This adds credibility. | **Low** | 4 hrs |

---

## 8. Settlement & Payout System

### Current State

The settlement system is comprehensive:
- Monthly settlement generation per course leader
- Line-by-line breakdown (participant, paid amount, fees, payout)
- Admin approval workflow
- Amendment support
- Manual adjustments
- FA company details on settlement documents

### Issues Found

| Issue | Severity |
|-------|----------|
| Settlement generation depends on GHL appointment data which may have rate limit issues | Medium |
| No automatic invoice reminder to course leaders | Low |
| No settlement PDF export for course leaders | Medium |
| Missing amount flag (`missingAmount`) has no resolution workflow | Low |

### Recommendations

| # | Recommendation | Priority | Effort |
|---|---------------|----------|--------|
| 8.1 | **Add settlement PDF export**: Course leaders need a PDF they can attach to their invoice. Generate a PDF with FA company details, line items, and totals. The data is already there; it just needs a PDF template. | **High** | 3-4 hrs |
| 8.2 | **Add invoice reminder to action items**: When a settlement is approved, add an action item to the course leader's Home page: "Create invoice for [Month Year] — [Amount]". This is already partially implemented but could be more prominent. | **Medium** | 1 hr |
| 8.3 | **Add "Resolve missing amount" workflow**: When a settlement line has `missingAmount=true`, allow admin to manually enter the correct amount and recalculate. Currently the flag is shown but there's no resolution path. | **Medium** | 2 hrs |
| 8.4 | **Cache settlement data**: Once a settlement is approved, its data should never change. Consider snapshotting all GHL data at generation time (which is already done via `settlementLines`) and never re-fetching. | **Low** | Already done |

---

## 9. Email & Communication

### Current Email Flows

| Email | Trigger | Sender | Via |
|-------|---------|--------|-----|
| Booking confirmation | Customer books via GHL | GHL | GHL auto |
| Exam result (passed) | Examiner marks passed | info@fasciaacademy.com | GHL Conversations API |
| Exam result (failed) | Examiner marks failed | info@fasciaacademy.com | GHL Conversations API |
| Admin exam notification | New exam submitted | info@fasciaacademy.com | GHL Conversations API |
| Course leader notifications | Various status changes | Portal | In-app only |

### Missing Emails

| Email | When | Why Important |
|-------|------|--------------|
| Certificate delivery (Intro/Vidare) | After "showed" | Student never receives their certificate |
| Course reminder | 48h before course | Reduces no-shows |
| Post-course feedback request | 24h after course | Collects testimonials, improves quality |
| Course leader settlement ready | Settlement approved | Prompts invoice creation |
| Welcome email to new course leader | Account created | Onboarding |

### Recommendations

| # | Recommendation | Priority | Effort |
|---|---------------|----------|--------|
| 9.1 | **Implement certificate delivery email** (Intro/Vidare) — see 4.1 and 7.1. | **Critical** | 2 hrs |
| 9.2 | **Add course reminder email** (48h before). Use a scheduled task or cron job. | **Medium** | 3 hrs |
| 9.3 | **Add settlement notification email** to course leaders when their settlement is approved. | **Medium** | 1 hr |
| 9.4 | **Add welcome email** when a new course leader account is created in the Portal. Include login credentials, quick start guide, and links to onboarding materials. | **Low** | 2 hrs |
| 9.5 | **Consider moving email sending from GHL to a dedicated service** (e.g., Resend, SendGrid). Currently all emails go through GHL's Conversations API, which means: (a) emails appear in GHL conversation history (good for CRM), (b) but if GHL is down, no emails are sent. A hybrid approach could use GHL for CRM-tracked emails and a direct service for transactional emails. | **Low** | Long-term |

---

## 10. Public Booking Page

### Current State

The public booking page (`/courses`) is well-built with:
- Bilingual support (SE/EN)
- Calendar, Map, and Course Leader views
- Course type and leader filtering
- "Mer info" modal with venue details
- GHL booking widget integration
- Course description section ("Mer om kurserna")

### Issues Found

| Issue | Severity |
|-------|----------|
| GHL booking widget opens in new tab (breaks flow) | Medium |
| No SEO metadata (title, description, OG tags) | Medium |
| No course availability indicator before clicking "Boka" | Low |
| "12/12 platser kvar" format shows remaining/max which is confusing when no seats are booked | Low |
| No testimonials or social proof section | Low |
| Map view requires clicking individual markers to see courses | Low |

### Recommendations

| # | Recommendation | Priority | Effort |
|---|---------------|----------|--------|
| 10.1 | **Embed GHL widget inline** (iframe) instead of new tab. This is the highest-impact UX improvement for the booking page. | **Medium** | 3-4 hrs |
| 10.2 | **Add SEO metadata**: Set `<title>`, `<meta description>`, and Open Graph tags dynamically based on language. This is important for organic search traffic. | **Medium** | 1 hr |
| 10.3 | **Simplify seat display**: Change "12/12 platser kvar" to just "12 platser kvar" when no seats are booked. Only show "X/Y" format when some seats are taken (e.g., "8/12 platser kvar"). | **Low** | 30 min |
| 10.4 | **Add a testimonials section**: Show 3-4 rotating testimonials from past participants. Can be hardcoded initially, then made dynamic. | **Low** | 2 hrs |
| 10.5 | **Add structured data (JSON-LD)** for courses. This enables rich snippets in Google search results (course name, date, price, location). | **Low** | 1-2 hrs |

---

## 11. Admin Portal Improvements

### Current Admin Features

The admin portal is comprehensive with: Overview dashboard, Course management, Student tracking, Course leader ranking, Affiliate ranking, Settlements, Pending actions queue, Exam queue, User management, and Settings.

### Recommendations

| # | Recommendation | Priority | Effort |
|---|---------------|----------|--------|
| 11.1 | **Add "Certificates" to admin sidebar**: The Certificates page exists but is not in the main navigation. Add it between "Exam Queue" and "Settings". | **High** | 15 min |
| 11.2 | **Add bulk settlement generation**: Currently settlements are generated one by one per course leader per month. Add a "Generate all settlements for [Month]" button. | **Medium** | 2-3 hrs |
| 11.3 | **Add course leader activity log**: Track when course leaders log in, register courses, mark participants. Useful for identifying inactive leaders. | **Low** | 3 hrs |
| 11.4 | **Add data export** (CSV) for settlements, students, and courses. Currently no export functionality exists. Important for accounting and reporting. | **Medium** | 2-3 hrs |
| 11.5 | **Add "Upcoming courses" calendar view** for admin: A visual calendar showing all approved courses across all leaders. Currently admin sees a list view only. | **Low** | 4 hrs |

---

## 12. Scalability & Architecture

### Current Scale

The system currently handles a small number of course leaders and locations. As the business grows, several areas need attention.

### Scaling Concerns

| Area | Current Approach | Scaling Risk | When It Matters |
|------|-----------------|-------------|-----------------|
| GHL API calls | Per-request with TTL cache | Rate limits at 100+ concurrent users | 20+ active course leaders |
| Settlement generation | Fetches all GHL appointments per leader | Slow with 50+ leaders | 30+ leaders |
| Participant list | Live GHL fetch per course | Slow if many courses expanded | 50+ courses/month |
| Certificate PDF | Generated on-demand, stored in S3 | PDF generation is CPU-intensive | 100+ certs/month |
| Database | TiDB (MySQL-compatible) | No concerns at current scale | 10,000+ records |

### Recommendations

| # | Recommendation | Priority | Effort |
|---|---------------|----------|--------|
| 12.1 | **Snapshot participant data at course completion**: Instead of always fetching from GHL, store participant records in the Portal database when a course is completed. This makes the Portal independent of GHL for historical data and dramatically improves performance. | **High** | 4-6 hrs |
| 12.2 | **Add background job processing**: Settlement generation, certificate PDF creation, and email sending should run as background jobs, not in the request/response cycle. Use a simple queue (database-backed) to decouple these operations. | **Medium** | 6-8 hrs |
| 12.3 | **Prepare for Shopify migration**: The knowledge base mentions a planned migration to Shopify. Design new features with this in mind — keep GHL-specific logic isolated in `ghl.ts` so it can be swapped out. Consider creating an abstraction layer for "booking provider" that both GHL and Shopify can implement. | **Low** | Architectural |
| 12.4 | **Add monitoring and alerting**: Set up basic monitoring for: webhook failures, GHL API errors, certificate generation failures, settlement calculation anomalies. A simple approach: log errors to a dedicated table and show a "System Health" panel in admin. | **Medium** | 3-4 hrs |
| 12.5 | **Consider multi-country support**: As Fascia Academy expands beyond Sweden, the system needs to handle: multiple currencies (already partially done with SEK/EUR), multiple languages (already done with sv/en), different VAT rates, and different payment providers. | **Low** | Long-term |

---

## 13. Priority Matrix

### Critical (Do This Week)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 2.1 | Test webhook trigger (showed via Portal → webhook fires?) | 30 min | Validates entire flow |
| 2.2 | Add fallback certificate/exam creation in Portal (if webhook doesn't fire) | 2-3 hrs | Ensures no certificates are lost |
| 4.1 / 7.1 / 9.1 | Email Intro/Vidare certificates to students | 2 hrs | Students actually receive their certificates |
| 6.1 | Set completion tags when marking "showed" | 2 hrs | Pipeline automation works correctly |

### High Priority (Do This Month)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 2.3 | Webhook receipt logging | 1-2 hrs | Debugging & audit trail |
| 2.4 | Idempotency for certificate/exam creation | 1 hr | Prevents duplicates |
| 3.1 | Confirmation dialog before "showed" | 30 min | Prevents accidental clicks |
| 5.1 | GHL API retry with backoff | 1-2 hrs | Reliability |
| 7.2 | "Request supplementary info" for exams | 3 hrs | Better exam workflow |
| 8.1 | Settlement PDF export | 3-4 hrs | Course leaders need this for invoicing |
| 11.1 | Add Certificates to admin sidebar | 15 min | Quick win |
| 12.1 | Snapshot participant data at completion | 4-6 hrs | Performance & GHL independence |

### Medium Priority (Next Quarter)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 3.2 | Batch "Mark all as showed" | 2 hrs | UX for large courses |
| 4.3 | Embed GHL booking widget inline | 3-4 hrs | Better booking UX |
| 4.5 | Course reminder email (48h before) | 3 hrs | Reduces no-shows |
| 9.2 | Course reminder email | 3 hrs | Customer experience |
| 9.3 | Settlement notification email | 1 hr | Course leader experience |
| 10.2 | SEO metadata for booking page | 1 hr | Organic traffic |
| 11.4 | Data export (CSV) | 2-3 hrs | Accounting & reporting |
| 12.4 | Monitoring and alerting | 3-4 hrs | Operational visibility |

### Low Priority (Backlog)

Items 3.4, 3.6, 4.2, 4.6, 5.3, 5.4, 5.5, 6.4, 7.4, 7.5, 9.4, 9.5, 10.3, 10.4, 10.5, 11.3, 11.5, 12.2, 12.3, 12.5.

---

## Appendix: Existing Known Issues (from todo.md)

The following items from the project's todo.md are still open and should be addressed:

- **Login issue for forsellvictor1@gmail.com** — investigate why course leader cannot log in after password change.
- **Translate Pending Actions admin page to English** — all labels, badges, buttons.
- **Add Edit & Resubmit button** to needs_revision course cards (course leader view).
- **Translate revision request email to English.**

These should be prioritized alongside the recommendations above.
