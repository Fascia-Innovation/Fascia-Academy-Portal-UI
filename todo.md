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
- [ ] Upcoming Courses shows empty even though GHL has real bookings for Victor, Fredrik, Ivar

## High Priority
- [ ] PUBLIC: Customer-facing course booking page (no login required) — all available dates by course type/language, filterable by city, click to book via GHL link

## In Progress
- [x] Rename "Upcoming Courses" to "Upcoming Bookings" in sidebar and page title
- [x] New admin view: Course Calendar — all GHL availability grouped by course type + language, showing date/time/location/course leader/available seats/booked participants list
