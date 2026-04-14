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
