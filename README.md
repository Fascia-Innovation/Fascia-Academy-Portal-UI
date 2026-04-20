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
| `/courses` | Public course booking page (from DB course dates) |
| `/certificate/:id` | Public certificate verification page |
| `/login` | Dashboard login |

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

## Deployment

Hosted on [Manus](https://manus.im). Click **Publish** in the Management UI after creating a checkpoint. Custom domain can be configured under Settings → Domains.

---

*Last updated: April 2026*
