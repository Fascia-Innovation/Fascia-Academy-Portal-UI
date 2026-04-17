# Fascia Academy Dashboard — TODO

## Database & Backend
- [x] Extend schema: local_users table with role (admin/course_leader/affiliate), ghl_contact_id, affiliate_code
- [x] GHL API service: calendars, appointments, contacts, custom fields
- [x] tRPC: admin overview (revenue, margin, fees, commissions)
- [x] tRPC: course leader ranking
- [x] tRPC: affiliate ranking
- [x] tRPC: monthly history
- [x] tRPC: upcoming courses
- [x] tRPC: course leader detail (per-participant breakdown)
- [x] tRPC: affiliate detail (per-booking commissions)
- [x] tRPC: auth — email+password login (local users table)
- [x] Role-based access enforcement (admin / course_leader / affiliate)
- [x] User management CRUD (admin only)

## Frontend
- [x] Global design system (deep navy + gold palette, Inter + Playfair Display)
- [x] Login page (email + password)
- [x] Admin: Overview page (KPI cards + 6-month area chart)
- [x] Admin: Course leader ranking table + bar chart
- [x] Admin: Affiliate ranking table + bar chart
- [x] Admin: Monthly history (composed chart + table)
- [x] Admin: Upcoming courses calendar view
- [x] Admin: User management (create/edit/activate/deactivate)
- [x] Course Leader: Own courses + per-participant payout breakdown (expandable rows)
- [x] Affiliate: Own bookings + commission breakdown
- [x] Sidebar navigation (role-aware, deep navy)
- [x] Loading states + error states throughout

## Secrets
- [x] GHL_API_KEY stored as secret
- [x] GHL_LOCATION_ID stored as secret
- [ ] SMTP credentials (future — email sending for settlement reports)

## Bugs / Fixes
- [x] Fix GHL API 422 error: /calendars/events requires calendarId or userId parameter (now fetches per-calendar)
- [x] Fix all appointment-fetching calls to use correct GHL API endpoints

## Low Priority / Future
- [ ] Email settlement reports (monthly automation)
- [ ] Custom domain emails (fornamn.efternamn@fasciaacademy.com)
- [ ] Export to PDF/Excel
- [ ] Shopify integration when migrating

## Test Setup
- [x] Create user: Victor Forsell (course_leader) — calendar: "Introduktionskurs Fascia - Victor Forsell - Test"
- [x] Create user: Victor Forsell (affiliate) — affiliateCode: VICTOR
- [x] Create user: Fredrik Kjellberg (course_leader) — calendar: "Introduktionskurs Fascia - Fredrik Kjellberg - Helsingborg"
- [x] Create user: Ivar Bohlin (course_leader) — calendar: "Fascia Academy Sollentuna" (multi-leader)
- [x] Seed mock appointment data for all three course leaders across 2 months
- [x] Fix Fascia Academy Sollentuna calendar matching (multi-leader — use ghlContactId field as calendar ID override in User Management)

## Features in Progress
- [x] Admin "View as user" impersonation — click any user in User Management to preview their dashboard view

## Python Scripts
- [x] Fix formula order in course_leader_settlement.py (align with dashboard: paid/1.25 - txFee - margin - affiliate)
- [x] Add Sollentuna calendar override handling in course_leader_settlement.py
- [x] Fix affiliate_settlement.py date filter (use CF_COURSE_DATE instead of dateAdded)
- [x] Sync all fixes and save updated scripts

## Active Bugs
- [x] Upcoming Bookings: shows empty — fixed (mock mode was enabled, now disabled)
- [x] Course Calendar: shows 0 slots — fixed (mock mode disabled, parallel fetching, 30-day limit enforced)
- [ ] Course Calendar visar 1723 felaktiga slots (alla 30-min free-slots) — måste visa faktiska kursdatum (date-specific hours) istället

## High Priority
- [ ] PUBLIC: Customer-facing course booking page (no login required) — all available dates by course type/language, filterable by city, click to book via GHL link

## In Progress
- [x] Rename "Upcoming Courses" to "Upcoming Bookings" in sidebar and page title
- [x] New admin view: Course Calendar — all GHL availability grouped by course type + language, showing date/time/location/course leader/available seats/booked participants list

## In Progress
- [x] Sätt Ivar Bohlins GHL-kalender-ID automatiskt i databasen
- [x] Revert Swedish UI translations back to English (dashboard = English, chat = Swedish)

## Public Booking Page + Course Calendar (High Priority)
- [x] Admin: course_dates table i DB (calendar_id, date, start_time, end_time, city, course_type, language, max_seats, course_leader_id, booking_url)
- [x] Admin: Course Date Management UI — lägg till/redigera/ta bort kursdatum (30 sek per entry)
- [x] Public: /courses sida med kursledarvy (karta + profiler) och kalendervy
- [x] Public: Språkstöd via URL-parameter (?lang=sv / ?lang=en), svenska som standard
- [x] Public: Bokningsmodal (GHL-widget inbäddad, stannar på sidan)
- [x] Public: Google Maps kartnålar per stad, popup med kursledarfoto + "Boka" + "Mer info"
- [x] Public: Filtrera på språk / kurstyp / kursledare
- [x] Public: Pre-select datum i GHL-bokningslänk (testa ?date= URL-parameter)
- [x] GHL: Hämta kursledarnas profilbilder från GHL team members API (lämna tomt om ingen bild finns)

## Medium Priority
- [ ] GHL: Byt bokningsformulärspråk för svenska kalendrar (First Name → Förnamn osv) — görs direkt i GHL Calendar Settings

## Course Dates Admin UX Improvements
- [x] DB: Add `phone` field to local_users (course leaders), add `address` + `venue_name` + `courseLeaderPhone` fields to course_dates
- [x] Admin form: Replace calendar dropdown with searchable combobox (type to filter)
- [x] Admin form: Add address / venue name field per course date
- [x] Admin form: Phone number field per course date (for booking text)
- [x] Admin form: Live preview of auto-generated course description (template + dynamic fields)
- [x] Course description templates: one per course type (intro/diplo/cert/vidare), SE + EN variants
- [ ] Public /courses: Show venue name + address on course cards and booking modal

## Course Dates Admin UX Round 2
- [x] Fix calendar search: filter strictly on course leader name + calendar name (not show all when no match)
- [x] Copy/duplicate course date (copies as Draft/unpublished)
- [x] Auto-fill address + city from GHL calendar meetingLocation when calendar is selected
- [x] Make description template text editable in the form (textarea, pre-filled from template)
- [x] Default times: 10:00 start, 17:00 end; auto-set end date = start date when start date changes
- [x] Copy-to-clipboard button in description preview

## Round 3: Multi-day dates, Prices, Public Page Overhaul
### Admin
- [ ] DB: Add `additional_days` (JSON array of {date, startTime, endTime}) to course_dates
- [ ] DB: Add `booking_info` (text, optional) to course_dates for vägbeskrivning/extra info
- [ ] DB: Add `profile_url` to local_users (course leader website link)
- [ ] Fix GHL address auto-fill: parse street/zip/city correctly into Address + City fields
- [ ] Admin form: Multi-day date picker (add/remove extra days with date+time each)
- [ ] Admin form: "Other information for booking" textarea (vägbeskrivning etc)
- [ ] User Management: Add profile_url field per user

### Public /courses page
- [ ] Full course names SE: Introduktionskurs Fascia, Diplomerad Fasciaspecialist, Certifierad Fasciaspecialist, Vidareutbildning för Certifierade Fasciaspecialister
- [ ] Full course names EN: Introduction Course Fascia, Qualified Fascia Specialist, Certified Fascia Specialist, Advanced Training for Certified Fascia Specialists
- [ ] Prices on course cards: SE (3500/15000/50000/9375 kr inkl. moms), EN (/10 in EUR)
- [ ] Reorder page sections: 1. Kalender, 2. Karta, 3. Kursledare
- [ ] "Mer info" modal: template text (left) + unique info (right: all dates/times, contact, address, booking_info)
- [ ] Multi-day courses: show "Startdatum" label clearly
- [ ] Kursledarkort: fix layout overlap, add "Om kursledaren" button → profile_url link
- [ ] "Mer info" button in Calendar view (next to Boka)
- [ ] "Mer info" button in Map popup (next to Boka)
- [ ] Map popup: show course type first, then course leader
- [ ] Section "Mer om kurserna": one link/button per course type → fasciaacademy.com (with TODO note to update URLs)

## Round 4: Course Leader Dashboard Improvements
- [x] Rename "My Courses" page — remove "attendees" from subtitle, renamed to "My Dashboard"
- [x] Course leader dashboard: add "Upcoming Courses" section (their own published course dates from course_dates table)
- [x] Course leader dashboard: add "Course History" section (past course dates)
- [x] Course leader dashboard: add link to their public booking page (/courses filtered by their name)
- [x] Fix GHL attendees connection — investigated: empty = no "showed" status appointments in selected month (correct behavior)
- [x] Add "Quick Links" page (Snabblänkar) for admin: shortcuts to add new course date, add new user, view public page, etc.
- [ ] Remove "vidare" course type from public page filters (not in use currently)
- [ ] Prices: confirm "vidare" price (placeholder 9375 kr) — skip for now since not in use

## Round 5: In-Portal Settlement System
- [x] DB schema: settlements, settlement_lines, settlement_adjustments tables
- [x] DB schema: add invoiceReference field to dashboard_users
- [x] Backend: settlement calculation engine (same formula as Python script, handles 0 kr correctly, flags empty paidAmount)
- [x] Backend: tRPC procedures — generate, list, get, approve, addAdjustment, amend, recalculate
- [x] Backend: email notification to course leader/affiliate on approval
- [x] Admin UI: Settlements list page (all users, filter by status/period)
- [x] Admin UI: Settlement detail page (lines, adjustments, approve button, amend button, recalculate)
- [x] Course leader UI: My Settlements page (pending + approved)
- [x] Affiliate UI: My Settlements page (same component)
- [x] Fix 0 kr paidAmount fallback bug (0 kr = free booking, FA margin still applies)
- [x] Add invoiceReference field to User Management form
- [x] FA company details shown on settlement detail page

## Round 6: Dual-Role Support (Course Leader + Affiliate)
- [x] DB: Add `isAffiliate` boolean column to dashboard_users (default false)
- [x] Backend: Update DashboardUser type, dashboardAuth create/update, routers schema
- [x] Frontend: Add "Also an Affiliate" toggle in User Management form (shown for course_leader role)
- [x] Frontend: Sidebar shows both "My Dashboard" and "My Commissions" when isAffiliate=true
- [x] Frontend: Role badge shows "Course Leader & Affiliate" for dual-role users
- [x] Frontend: Affiliate Code field shown when isAffiliate toggle is on

## Round 7: Fixes & Improvements
- [ ] User Management: fix dual-role badge (show "Course Leader & Affiliate" badge when isAffiliate=true)
- [ ] User Management: clarify GHL Calendar ID tooltip/label (explain it's the calendar name, not an ID)
- [ ] Quick Links: add course leader version of the page with their specific links (forms, FasciaVibes, handbook, contact)
- [ ] Upcoming Bookings: investigate why Fredrik Kjellberg and Ivar Bohlin don't appear (GHL calendar ID mismatch?)
- [ ] Course Calendar: use full course names (e.g. "Introduktionskurs Fascia by Fascia Academy") instead of abbreviations
- [ ] Course Dates admin: use full course names in the course type display
- [ ] Course Calendar: rename info button to "Mer info om kursen"
- [ ] Settlements: hide Generate button from course leader view (admin only)
- [ ] Public page: fix start date placement (show next to date, not as separate label)
- [ ] Public page: seats display as "X/Y" format (e.g. "8/20") with FOMO text ("X platser kvar")
- [ ] Public page: make "Mer info" and "Boka" buttons larger and more prominent
- [ ] Public page: use full course names in calendar and leader card views
- [ ] Public page: leader section - remove course type badges, add "Mer info om kursledaren" button instead
- [ ] Public page: course journey section - add numbered steps (1-2-3) with short descriptions, mark intro as 1 day
- [ ] Public page: move "Mer om kurserna" section higher up
- [ ] Forgot password: add forgot password link on login page that sends reset email to course leader

## Round 7: Completed Fixes
- [x] User Management: fix dual-role badge (show "+ Affiliate" badge when isAffiliate=true for any role)
- [x] User Management: clarify GHL Contact ID column header (was "GHL Calendar Name")
- [x] Quick Links: course leader version of the page with their specific links (forms, FasciaVibes, handbook, contact) — already existed at /leader-links
- [x] Settlements: hide Generate button from course leader view (admin only) — gated with isAdmin check
- [x] Forgot password: add forgot password link on login page + reset password page + backend procedures
- [x] Course Calendar: use full Swedish course names in COURSE_TYPE_LABELS
- [x] Course Dates admin: use full Swedish course names in COURSE_TYPE_LABELS
- [x] Course Dates admin: add bookedSeats field (manual update) + show booked/max in table
- [x] Public page: seats display as "X/Y platser" format with FOMO (⚡ Få platser kvar!) + Fullbokad
- [x] Public page: make "Mer info" and "Boka" buttons larger (px-5 py-2.5, font-bold)
- [x] Public page: leader section - full course names in date rows, "Mer info om kursen" button text
- [x] Public page: course journey section - numbered steps (1-2-3) with short descriptions, intro marked as 1 dag
- [x] Public page: "Mer om kurserna" section moved above the course list
- [x] Public page: bookedSeats included in MoreInfoModal seats display

## 🔴 HIGH PRIORITY: Intyg & Prov (Certificate & Exam Flow)
- [ ] DB: Add `certificates` table (userId, courseType, issuedAt, certificateNumber, pdfUrl)
- [ ] DB: Add `exams` table (userId, courseType, status: pending/passed/failed, score, examDate, notes)
- [ ] Admin UI: Mark participant as "exam passed" on course date detail → triggers certificate generation
- [ ] Backend: Auto-generate PDF certificate (name, course type, date, certificate number)
- [ ] Backend: Store certificate PDF in S3, save URL in certificates table
- [ ] Admin UI: Certificate list — view/download/resend per user
- [ ] Course leader UI: Trigger "exam completed" tag per participant (sends to admin for approval)
- [ ] Course leader UI: View which participants have passed/pending exam per course date
- [ ] Email: Send certificate PDF to participant on approval (via info@fasciaacademy.com)
- [ ] Public: Certificate verification page (/verify?cert=XXXXX) — enter cert number to verify authenticity

## Round 8: Exam & Certificate Flow
- [x] DB: Add `exams` table (id, contactId, contactName, contactEmail, courseType, language, status: pending/passed/failed, examinedBy, examinedAt, notes, createdAt)
- [x] DB: Add `certificates` table (id, contactId, contactName, courseType, language, issuedAt, pdfUrl, examinedBy)
- [x] DB: Add `canExamineExams` boolean column to dashboard_users (default false)
- [x] Backend: GHL webhook endpoint POST /api/webhooks/ghl-shown — receives shown trigger, creates exam (diplo/cert) or certificate (intro/vidare)
- [x] Backend: NEW webhook POST /api/webhooks/exam-submitted — receives exam form submission from GHL Survey workflow
- [x] Backend: tRPC exam procedures — listPending, listAll, markPassed, markFailed
- [x] Backend: tRPC certificate procedures — list, getDownloadUrl
- [x] Backend: PDF certificate generation (placeholder design: name, course type, date, Ivar Bohlin signature)
- [x] Backend: GHL tag setter — set exam-passed-qualified-fs or exam-passed-certified-fs on contact via GHL API
- [x] Frontend: Exam Queue page — tasklist sorted by createdAt, Godkänd/Underkänd buttons, notes field
- [x] Frontend: Certificate List page — all issued certificates with download button
- [x] Frontend: Add canExamineExams toggle in User Management form
- [x] Frontend: Sidebar nav — show Exam Queue for admin + canExamineExams users
- [x] Frontend: Role-based access — examiner sees only Exam Queue, not financials
- [ ] GHL: Configure webhook in GHL workflow to POST to portal on shown status (manual step in GHL)

## Round 9: Public Page & UX Fixes (Apr 2026)
- [x] Public page: courseLeaderName URL param — /courses?courseLeaderName=Anna now pre-filters leader
- [x] Public page: hide vidare from filter dropdown (not in use currently)
- [x] User Management: GHL Calendar ID label clarified with better help text and instructions
- [x] Backend: searchContactByEmail helper added to ghl.ts
- [x] Backend: /api/webhooks/exam-submitted endpoint added (receives GHL Survey submissions)

## Round 10: Examiner Feedback Field + GHL Workflow Guide
- [x] Frontend: Renamed "Kommentar" → "Feedback to student" in Exam Queue dialog with clearer UX (English, with email context hint)
- [x] Backend: Send result email to student via GHL API when exam is graded (passed/failed) with examiner feedback
- [x] Backend: Added sendExamResultEmail() helper in ghl.ts using GHL Conversations API
- [x] Docs: Created GHL Workflow setup guide for all 4 exam forms at /home/ubuntu/fascia_ghl_workflow_guide.md

## Round 11: Simplify result email — GHL Certificates handles the certificate
- [x] Remove PDF link from approved result email (GHL Certificates sends the certificate separately)
- [x] Update approved email text: "Ditt intyg skickas till dig inom kort via ett separat e-postmeddelande"
- [x] Remove pdfUrl from sendExamResultEmail signature and all call sites
- [x] Update ExamQueue.tsx success toast to not mention PDF

## Round 12: GHL Certificates reminder + GHL Workflow guide delivery
- [x] Add GHL Certificates reminder in Exam Queue approval dialog
- [x] Deliver simplified GHL Workflow setup guide

## Round 13: Bug fix — booking dialog infinite loading spinner
- [ ] Investigate why Payment Information section in booking dialog spins indefinitely
- [ ] Fix the root cause

## Round 13: Fix GHL booking widget iframe — Stripe not loading
- [x] Add full allow attribute to booking iframe (payment, popups, forms, scripts)
- [x] Add server-side headers to allow Stripe/GHL domains in iframe context

## Round 14: Replace booking iframe with external link dialog
- [x] Replace BookingModal iframe with course info + "Gå till bokning" button opening GHL in new tab

## Backlog / Att göra

### HÖG PRIORITET
- [ ] GHL: Uppdatera bekräftelsemail för alla kalenders — lägg till datum ({{appointment.formatted_start_date}}) och starttid ({{appointment.start_time}})
- [ ] GHL: Gå igenom och förbättra bokningstext för alla kurstyper (Intro, Diplo, Cert)
  - Steglista som guidar studenten genom hela resan från bokning till diplom/certifikat
  - Info om vad som ska förberedas innan första tillfället
  - För Diplo + Cert: tydlig info om provet och hur det fungerar
- [ ] GHL: Sätt upp 4 workflows för provformulären (se fascia_ghl_workflow_guide.md)

### LÅGT PRIORITET
- [ ] GHL: Hitta inställning för 24-timmarsformat (ta bort AM/PM i bokningswidgeten) — troligen under Calendars → kalender → Widget appearance eller Settings → Business Info

## Round 15: Portal Restructure

### Navigation & Layout
- [x] New admin sidebar: Overview, Courses, Students, Course Leaders, Affiliates, Settlements, Exam Queue, Certificates, Settings
- [x] Remove standalone pages: Monthly History, Upcoming Bookings, Course Calendar, Course Dates, Quick Links, User Management
- [x] Quick Links → header dropdown widget (both admin and course leader links)
- [x] Course leader sidebar: My Overview, My Courses, My Settlements (+ Exam Queue if canExamineExams)

### Merged Overview Page (Admin)
- [x] Merge AdminOverview + MonthlyHistory into single Overview page with tabs (Current Month / History)
- [x] Current Month tab: KPI cards + revenue breakdown (existing AdminOverview content)
- [x] History tab: charts + data table (existing MonthlyHistory content)

### Merged Courses Page (Admin)
- [x] Three tabs: Calendar, Upcoming Bookings, Manage Dates
- [x] Calendar tab: existing CourseCalendar content with participant lists per event
- [x] Upcoming Bookings tab: existing UpcomingCourses content
- [x] Manage Dates tab: existing CourseDates admin CRUD
- [x] Participant list per event (admin sees full data: name, email, phone, status)

### Students Page (Admin)
- [x] New page pulling participant data from GHL
- [x] Show: name, email, booked courses, completed courses + dates, certificates, course leader, total spend
- [x] Exam pass/fail NOT shown (only whether they have certificate)
- [x] No export functionality

### Quick Links Header Widget
- [x] Dropdown in header area with admin quick links (add course date, add user, public page, GHL, etc.)
- [x] Course leader version with their specific links (forms, handbook, community, contact)

### Course Leader Views
- [x] My Overview: motivational stats (participants over time, compare with self), upcoming courses summary, payout summary
- [x] My Courses: upcoming courses + participant lists with privacy controls
- [x] Privacy: upcoming/active courses show first+last name + phone; historical courses show first+last name only
- [x] Privacy: settlement/invoice context shows first+last name only
- [x] No export of customer data for course leaders
- [x] No historical customer lists accessible

### Settings Page (Admin)
- [x] Merge User Management into Settings page
- [x] Preserve View As functionality prominently

### Notifications
- [x] Header notification indicator for: new bookings, settlement approved, new exam to grade (only if canExamineExams)

### Backend
- [x] Students tRPC procedure: fetch contacts from GHL with course/certificate data
- [x] Course leader data access controls: restrict PII based on course timing

## Round 16: Course Leader Self-Service + Admin Approval Flow

### Course Registration by Course Leader
- [x] Booking Calendar dropdown: course leaders see only their own calendars, admin sees all
- [x] Calendar info section (read-only): course leader name, phone, address, city, max seats with lock icons
- [x] Info banner explaining calendar-controlled fields and how to request changes
- [x] "Request new calendar" placeholder link
- [x] Venue Name field (obligatory, editable)
- [x] Start/End date & time fields
- [x] Additional Course Days with validation per course type (Intro=1, Diplo/Quali>=4, Cert>=6, Vidare/Adva>=2)
- [x] Additional Booking Info (optional)
- [x] Message to Admin field (optional, triggers notification)
- [x] Auto-generated Course Description (read-only, based on course type)
- [x] Remove: Course Type dropdown, Language dropdown, Booked Seats, Published toggle, example names
- [x] Status field: pending_approval -> approved / needs_revision / rejected
- [x] Email notification to course leader on "needs revision"

### Course Actions (per course date)
- [x] Copy button: duplicates course with new date required
- [x] Cancel button: sets status to pending_cancellation, admin must approve + handle availability
- [x] Reschedule button: sets status to pending_reschedule with new date, admin must approve
- [x] All actions require admin approval (admin handles GHL calendar availability)
- [x] Course leader gets notification when action is completed
- [x] Minimum fee of 1000 kr per course date (applied when normal compensation is less)

### Batch Registration
- [x] Batch creation: register multiple dates at once (same calendar, same venue, different dates)
- [x] Copy of a batch course = copies single course only (not the batch)

### Change Log
- [x] Per-course timeline showing: created, approved, rescheduled, cancelled, etc.
- [x] Shows who did what and when

### Admin Pending Actions View
- [x] Consolidated view of all pending tasks: new courses, cancellations, reschedules, exams, settlements
- [x] Prioritized by deadline (nearest course date first)
- [x] Approve / Request Completion / Reject actions
- [x] Completion request sends email to course leader

### Admin CourseDates Updates
- [x] Status column showing pending/approved/needs_revision/cancelled/rescheduled
- [x] Approval workflow integrated into existing Manage Dates tab
- [x] Change log (Historik) dialog per course date in admin table

## Round 16b: Notification Bell + Repeat Course

### Admin Notification Bell — Real Pending Actions Alerts
- [x] Wire notification bell to show real-time pending course actions (new registrations, cancellation requests, reschedule requests, revision resubmissions)
- [x] Each pending item shows course leader name, course type, action type, and time since submitted
- [x] Clicking a notification navigates to Pending Actions page
- [x] Badge count reflects actual pending items

### Course Leader — Repeat Course (Upprepa kurs)
- [x] Add "Upprepa kurs" button on historical/past courses in MyCourses view
- [x] Pre-fills registration form with same calendar, venue, booking info — but requires new dates
- [x] Works like copy but from the course leader's perspective (not admin duplicate)

## Bug: Login issue for forsellvictor1@gmail.com
- [ ] Investigate why course leader cannot log in after password change
- [ ] Fix auth flow if needed

## Round 17: View-by-View Review Fixes

### My Overview Fixes
- [x] Better error handling for GHL 429 rate limit (retry button instead of raw error)
- [x] Upcoming Courses: check status='approved' instead of published=true
- [x] Update Quick Links for course leaders (remove old GHL form links, point to in-app features)
- [x] Improve calendar matching fallback when ghlContactId is null (also checks courseDates table)
- [x] Add server-side GHL cache (calendars 5min, appointments 5min, contacts 10min) to reduce API calls and avoid 429 rate limits
- [x] Optimize myOverview to reuse single calendar fetch and batch appointment fetches

### Welcome Page + My Overview Improvements
- [x] Create lightweight "Home" page for course leaders (DB-only, no GHL calls)
- [x] Show notifications: courses needing revision, pending count, recently approved/cancelled
- [x] Show next upcoming course from courseDates table
- [x] Quick stats: upcoming, completed, pending counts
- [x] Quick action buttons (Register Course, My Courses, My Settlements, My Statistics)
- [x] Empty state with CTA when no courses registered
- [x] Rename "My Overview" → "My Statistics" in sidebar
- [x] Fix "Participants (this month)" → "Showed (this month)" to clarify it's confirmed attendees
- [x] Add empty state to My Statistics when all data is 0
- [x] Update routing: /my-overview → LeaderHome, /my-statistics → MyOverview

### Two-Tier Notification System
**Notification Bell (feedback from FA):**
- [x] Course approved notification
- [x] Cancellation request processed notification
- [x] Reschedule request approved notification
- [x] Course needs revision notification
- [x] Cancellation/reschedule rejected notification

**Home Page (action items / tasks):**
- [x] Courses needing revision (needs_revision) → "Update your course details"
- [x] Create invoice for approved settlement → "Create invoice for [period]"
- [x] Create invoice for affiliate commission → "Create invoice for affiliate commission [period]"
- [x] Empty state: "No action items — you're all caught up!" ✓

**Backend:**
- [x] New tRPC procedure: leaderNotifications (DB-only, returns recent status changes)
- [x] New tRPC procedure: leaderActionItems (DB-only, returns tasks needing attention)
