# REPO_MAP.md — Fascia Academy Dashboard

## Repo-översikt

Intern admin- och kursledarportal för Fascia Academy. Hanterar kursregistrering, bokningar (via GHL), avräkningar, certifikat, examina och en publik bokningssida. Monorepo med React-frontend och Express/tRPC-backend som delar TypeScript-typer.

---

## Mappstruktur

| Mapp | Ansvar | Ansvarar INTE för |
|------|--------|-------------------|
| `client/src/pages/` | Sidkomponenter (en per route) | Backend-logik, databasåtkomst |
| `client/src/components/` | Återanvändbara UI-komponenter (shadcn/ui + egna) | Affärslogik |
| `client/src/components/ui/` | shadcn/ui primitiver — rör ej utan gott skäl | — |
| `client/src/contexts/` | React contexts (DashAuthContext) | — |
| `client/src/hooks/` | Custom hooks | — |
| `client/src/lib/` | tRPC-klient, utilities | — |
| `server/routers/` | Feature-routers (tRPC-procedurer per domän) | UI, frontend-state |
| `server/_core/` | Ramverksplumbing (OAuth, context, Vite, LLM, storage proxy) — **rör ej** | Affärslogik |
| `server/` (root) | Rot-router, GHL-helpers, auth, DB-helpers, tester | — |
| `drizzle/` | Databasschema + migrationer | — |
| `shared/` | Delade konstanter och typer (frontend + backend) | — |
| `scripts/` | Engångsskript, diagnostik, migreringar — **ej produktion** | — |
| `client/src/pages/guide/` | Interaktiv guide (Del 1–7) med redigerbart innehåll | — |

---

## Modulgränser (separata arbetskontexter)

| Modul | Primära filer | Beskrivning |
|-------|---------------|-------------|
| **Kursregistrering** | `server/routers/courseDates.ts`, `client/src/pages/MyCourses.tsx`, `client/src/pages/CourseDates.tsx`, `client/src/pages/PendingActions.tsx` | Registrera, godkänna, omboka, avboka kurser |
| **Publik bokningssida** | `client/src/pages/PublicCourses.tsx` | Kalender-, kart- och kursledarvy för besökare |
| **Avräkningar** | `server/routers/settlements.ts`, `client/src/pages/Settlements.tsx`, `server/settlementEmail.ts` | Generera, granska, godkänna avräkningar |
| **Certifikat** | `server/routers/certificatesRouter.ts`, `server/certificatePdf.ts`, `client/src/pages/IssuedCertificates.tsx`, `client/src/pages/CertificateTemplates.tsx`, `client/src/pages/CertificatePublic.tsx` | Utfärda, hantera, verifiera certifikat |
| **Examina** | `server/routers/exams.ts`, `client/src/pages/ExamQueue.tsx` | Examenssubmission och bedömning |
| **GHL-integration** | `server/ghl.ts`, `server/ghlWebhook.ts` | All kommunikation med GoHighLevel API |
| **Auth** | `server/dashboardAuth.ts`, `client/src/contexts/DashAuthContext` (i App.tsx), `client/src/pages/Login.tsx` | Session-baserad inloggning, lösenordsåterställning |
| **Admin dashboard** | `server/routers/adminHome.ts`, `client/src/pages/AdminHome.tsx`, `client/src/pages/AdminOverview.tsx` | KPI-dashboard, statistik |
| **Guide** | `server/routers/guideRouter.ts`, `client/src/pages/guide/` | Interaktiv onboarding-guide |
| **Meddelanden** | `server/routers/courseMessages.ts` | Meddelanden mellan admin och kursledare |
| **Databas** | `drizzle/schema.ts`, `server/db.ts` | Schema-definition och query-helpers |
| **UI-bibliotek** | `client/src/components/ui/` | shadcn/ui-primitiver |

---

## Beroenden mellan moduler

```
PublicCourses ──reads──→ courseDates (DB)
MyCourses ──calls──→ courseDates router ──calls──→ GHL (calendars)
Settlements ──reads──→ GHL (appointments) + courseDates (DB)
Certificates ──reads──→ exams (DB)
ExamQueue ──reads──→ GHL (contacts) + exams (DB)
AdminHome ──reads──→ GHL + courseDates + settlements
Auth ──manages──→ dashboardSessions + dashboardUsers
```

---

## Kontextgrupper (filer som ofta läses tillsammans)

| Grupp | Filer |
|-------|-------|
| Kursregistrering (backend) | `server/routers/courseDates.ts`, `drizzle/schema.ts`, `server/ghl.ts` |
| Kursregistrering (frontend) | `client/src/pages/MyCourses.tsx`, `client/src/pages/CourseDates.tsx`, `client/src/pages/PendingActions.tsx` |
| Publik bokningssida | `client/src/pages/PublicCourses.tsx`, `server/routers/courseDates.ts` (publicDates-procedur) |
| Avräkningar | `server/routers/settlements.ts`, `server/ghl.ts`, `server/settlementEmail.ts`, `drizzle/schema.ts` |
| Certifikat | `server/routers/certificatesRouter.ts`, `server/certificatePdf.ts`, `drizzle/schema.ts` |
| Auth | `server/dashboardAuth.ts`, `server/routers.ts` (login/logout), `drizzle/schema.ts` |
| Layout/Navigation | `client/src/App.tsx`, `client/src/components/DashboardLayout.tsx` |

---

## Separationsprinciper

- **Frontend ↔ Backend:** All kommunikation via tRPC. Ingen direkt DB-åtkomst från frontend.
- **GHL ↔ Intern logik:** All GHL-kommunikation isolerad i `server/ghl.ts` och `server/ghlWebhook.ts`. Övriga moduler anropar helpers, aldrig GHL direkt.
- **Schema ↔ Queries:** Schema i `drizzle/schema.ts`, queries i `server/db.ts` eller direkt i routers.
- **Framework ↔ App:** `server/_core/` och `client/src/_core/` är ramverksplumbing — rör ej utan infrastrukturskäl.
- **UI-primitiver ↔ Sidkomponenter:** `components/ui/` är generiska primitiver; sidspecifik logik hör hemma i `pages/`.

---

## Osäkerheter

| Område | Beskrivning |
|--------|-------------|
| `server/routers.ts` (1130 rader) | Blandning av admin-procedurer, kursledar-procedurer och system-procedurer i en fil. Bör eventuellt delas upp ytterligare. |
| `server/routers/courseDates.ts` (2195 rader) | Mycket stor fil med registrering, godkännande, ombokning, avbokning, publicering, batch-skapande, snapshot-logik. Kandidat för uppdelning. |
| `client/src/pages/MyCourses.tsx` (1754 rader) | Stor sidkomponent med registrering, ombokning, avbokning, deltagarhantering i samma fil. |
| `scripts/` | Blandning av engångsskript och diagnostik. Oklart vilka som fortfarande är relevanta. |
| Lösa `.mjs`-filer i roten | `check-user-db.mjs`, `fix-emails.mjs`, `list-users.mjs` etc. — troligen engångsskript som kan tas bort eller flyttas till `scripts/`. |

---

*Senast uppdaterad: Maj 2026*
