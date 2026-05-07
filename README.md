# Fascia Academy Dashboard — Portal UI

Internal admin and course leader portal for **Fascia Academy**. Built on React 19 + Tailwind 4 + Express 4 + tRPC 11, with GoHighLevel (GHL) as the CRM/booking backend.

---

## Overview

The portal serves three user roles:

| Role | Access |
|------|--------|
| **Admin** | Full access: course management, settlements, certificates, exam queue, student data, user management |
| **Course Leader** | Own courses, own statistics, settlement history, exam submissions |
| **Affiliate** | Commission overview and settlement history |

---

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, shadcn/ui, tRPC client
- **Backend:** Express 4, tRPC 11, Drizzle ORM (MySQL/TiDB)
- **External:** GoHighLevel (GHL) REST API — calendars, contacts, appointments, tags
- **Auth:** Custom session-based auth (`fa_dash_session` cookie) with bcrypt password hashing

---

## Key Features

### Admin

| Feature | Route | Description |
|---------|-------|-------------|
| Overview | `/` | KPI dashboard — revenue, bookings, upcoming courses |
| Course Calendar | `/courses-admin` → Calendar tab | Live GHL calendar view with participant list and remove-participant action |
| Manage Dates | `/courses-admin` → Dates tab | DB-managed course dates with **GHL sync-check warning** |
| Students | `/students` | All GHL contacts with course history |
| Course Leaders | `/course-leaders` | Ranking and stats per leader |
| Affiliates | `/affiliates` | Affiliate ranking and commission overview |
| Settlements | `/settlements` | Generate, review and approve settlement PDFs |
| Pending Actions | `/pending-actions` | Course registration approvals, reschedule/cancellation requests |
| Exam Queue | `/exam-queue` | Review and grade diploma/cert exam submissions |
| Issued Certificates | `/issued-certificates` | View, delete and bulk-delete issued certificates |
| Certificate Templates | `/certificate-templates` | Manage PDF certificate templates |
| Settings | `/settings` | Dashboard user management (add/edit/delete/activate/deactivate) |

### Course Leader

| Feature | Route | Description |
|---------|-------|-------------|
| My Overview | `/my-overview` | Personal KPI dashboard |
| My Courses | `/my-courses` | Upcoming and past courses with participant attendance |
| My Statistics | `/my-statistics` | Revenue and booking statistics |
| My Settlements | `/my-settlements` | Settlement history and PDF download |
| My Commissions | `/my-commissions` | Affiliate commission overview (if affiliate) |

### Public

| Route | Description |
|-------|-------------|
| `/courses` | Public course booking page (calendar, map, course leader views) |
| `/certificate/:id` | Public certificate verification page |
| `/login` | Dashboard login |

---

## Public Booking Page (`/courses`)

The public-facing booking page lets visitors find and book courses without logging in.

### Views
- **Kalender** — chronological list of all upcoming courses grouped by month
- **Karta** — Google Maps view with clustered pins per city; click a pin to see courses in that city
- **Kursledare** — compact course leader cards (photo, name, city, course type colour dots); click to expand and see all upcoming dates with times, price and booking button

### Colour coding (course type)
| Colour | Course type |
|--------|-------------|
| Green | Introduktionskurs Fascia (Intro) |
| Blue | Diplomerad Fasciaspecialist (Diplo) |
| Yellow | Certifierad Fasciaspecialist (Cert) |
| Red | Vidareutbildning för Certifierade Fasciaspecialister (Vidare) |

### Buttons
- **Mer info om kursen** — opens a detail modal with course description
- **Till bokning** — opens the booking modal; confirms the date and links to the GHL booking widget with the date pre-selected
- **Gå till bokning** (inside modal) — navigates to the GHL booking widget

### Sidebar — Mer om kurserna
Sticky sidebar on desktop (below list on mobile) with a short description and price for each course type, linking to `fasciaacademy.com` for full details.

---

## GHL Sync Check

**Manage Dates** includes an automatic sync check that compares every upcoming DB course date against GHL free slots for the same calendar and date:

- **Amber warning banner** — lists all mismatches with date, course leader, course type, city and reason
- **Green confirmation banner** — shown when all upcoming dates are in sync
- Refresh button to re-run the check on demand (cached 5 min)

**Why a mismatch can occur:**
1. Course added in portal but not yet configured in GHL calendar
2. Date changed in GHL without updating the portal
3. All slots for that date are fully booked in GHL (no free slots returned)

---

## Address / City Parsing

When a course leader registers a course, the city is auto-extracted from the GHL calendar's `meetingLocation` field. The parser handles three formats:

| Format | Example | Result |
|--------|---------|--------|
| Tab-separated (standard) | `Berga allé 1\t25452\tHelsingborg` | city = `Helsingborg` |
| Two parts | `Storgatan 1\tStockholm` | city = `Stockholm` |
| Single string with commas | `Storgatan 1, 123 45 Stockholm` | city = `Stockholm` (last comma part) |
| Single string without commas | `Tingsvägen 17191 61 Sollentuna` | city = `Sollentuna` (last non-numeric word) |

> **Note:** The GHL user's `meetingLocation` should ideally be set in tab-separated format (`Street\tPostalCode\tCity`) for best results.

---

## Timezone

All course dates are stored and handled in **Europe/Stockholm (UTC+2)**. Date strings sent from the frontend always include the `+02:00` offset to prevent UTC drift.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `dashboard_users` | Admin / course leader / affiliate accounts |
| `dashboard_sessions` | Session tokens (bcrypt-signed) |
| `course_dates` | Manually registered course dates (feeds public booking page) |
| `settlements` | Settlement documents per leader/affiliate |
| `settlement_lines` | Line items per settlement |
| `settlement_adjustments` | Manual adjustments to settlements |
| `exams` | Exam submissions from course leaders |
| `certificates` | Issued certificates (linked to exam or direct) |
| `participant_snapshots` | Point-in-time snapshots of course participants |
| `course_leader_messages` | Messages between admin and course leader on a course date |
| `password_reset_tokens` | One-time tokens for password reset |
| `users` | Manus OAuth users (framework, not used for dashboard auth) |

---

## Project Structure

```
client/src/
  pages/          ← Page components (one per route)
  components/     ← Shared UI components
  contexts/       ← React contexts (DashAuthContext)
  hooks/          ← Custom hooks
  lib/trpc.ts     ← tRPC client binding
  App.tsx         ← Routes and layout
server/
  routers/        ← Feature routers (courseDates, settlements, certificates, …)
  routers.ts      ← Root router (admin, courseLeader, system)
  ghl.ts          ← GoHighLevel API helpers
  dashboardAuth.ts← Session auth helpers
  db.ts           ← Drizzle query helpers
drizzle/
  schema.ts       ← All table definitions
  migrations/     ← Generated SQL migrations
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing |
| `GHL_API_KEY` | GoHighLevel API key |
| `GHL_LOCATION_ID` | GHL location ID |
| `BUILT_IN_FORGE_API_KEY` | Manus built-in API key (server-side) |
| `BUILT_IN_FORGE_API_URL` | Manus built-in API base URL |

---

## Development

```bash
pnpm install
pnpm dev          # starts Vite + Express concurrently on port 3000
pnpm test         # run Vitest
pnpm drizzle-kit generate  # generate migration SQL after schema changes
```

After schema changes: read the generated `.sql` file in `drizzle/migrations/` and apply it via the database UI or `webdev_execute_sql`.

---

## Removing a Participant from a Course

1. Go to **Course Calendar** in the admin menu
2. Expand a slot to see the participant list
3. Click the red trash icon next to the participant's name
4. Confirm — the appointment is cancelled in GHL and the list refreshes

---

## User Management (Settings)

- **Add user** — create admin, course leader or affiliate account
- **Edit user** — update name, email, role, GHL contact ID, profile URL
- **Activate / Deactivate** — toggle active status (inactive users cannot log in)
- **Delete user** — permanently removes the user; admins can delete themselves (blocked if last active admin)

---

## Security Hardening

The following security measures are in place:

| Measure | Details |
|---------|--------|
| Password hashing | bcrypt (cost 12), with transparent migration from legacy SHA-256 |
| Timing-safe comparison | `crypto.timingSafeEqual` for legacy hash path |
| Rate limiting | Login + password reset: max 10 attempts per 15 min per IP |
| Session invalidation | All sessions destroyed on password reset |
| Cookie security | `httpOnly`, `secure` (prod), `sameSite=lax`, `maxAge=7d` |
| CSP | Strict Content-Security-Policy (no `unsafe-eval` in production) |
| Headers | HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options (admin routes) |
| Permissions-Policy | Scoped: payment (self + Stripe), camera/mic/geo disabled |
| Input validation | Zod schemas on all tRPC inputs; min password 10 chars |
| SQL injection | Parameterized queries only (Drizzle ORM + prepared statements) |
| XSS prevention | HTML-escaped user content in email templates |
| Storage proxy | Path traversal protection with allowlist validation |
| API data exposure | `passwordHash` stripped from all API responses |
| Certificate soft-delete | Revoked certificates return 404 on public verification |
| Settlement bounds | Adjustment amounts capped at ±100,000 SEK; paidInclVat capped at 500,000 SEK |

---

## Performance Optimizations

| Optimization | Impact |
|-------------|--------|
| Database indexes | 9 composite indexes on `course_dates`, `certificates`, `settlements`, `settlement_lines` |
| Background sync | `bookedSeatsSync.ts` updates booked seats from GHL every 5 min |
| Zero live GHL calls | Public booking page reads entirely from DB — no GHL API calls per visitor |
| In-memory cache | GHL users (10 min TTL), calendars (10 min TTL) for admin views |

The public booking page can now handle thousands of concurrent visitors without hitting GHL rate limits (previously limited to ~100 req/min).

---

## Deployment

Hosted on [Manus](https://manus.im). Click **Publish** in the Management UI after creating a checkpoint. Custom domain can be configured under Settings → Domains.

Live URL: `fascidash-9qucsw5g.manus.space`

---

*Last updated: May 2026*
