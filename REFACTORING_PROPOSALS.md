# REFACTORING_PROPOSALS.md — Föreslagna moduluppdelningar

Inga kodändringar görs utan godkännande. Dessa förslag syftar till att minska kontextbehov för framtida AI-sessioner.

---

## Förslag 1: Dela upp `server/routers/courseDates.ts` (2195 rader)

**Nuvarande problem:** En enda fil hanterar registrering, godkännande, ombokning, avbokning, publicering, batch-skapande och snapshot-logik. En AI-session som bara behöver ändra ombokning måste läsa 2195 rader.

**Föreslagen uppdelning:**

```
server/routers/courseDates/
├── index.ts              ← Re-export av merged router
├── register.ts           ← registerCourse, registerMultipleDays
├── approve.ts            ← approveCourse, rejectCourse, pendingCourses
├── manage.ts             ← reschedule, cancel, updateParticipants
├── public.ts             ← publicDates, publicCourseDetail
├── batch.ts              ← batchCreate, batchSync
└── snapshots.ts          ← snapshotJob, participantSnapshots
```

**Förväntad effekt:** Varje delfil ~300–500 rader. En AI-session som fixar en ombokning-bugg behöver bara läsa `manage.ts` + `index.ts`.

**Risk:** Medel — imports mellan delfiler kan skapa cirkulära beroenden om inte noggrant planerat. Befintliga tester måste uppdateras.

**Kräver godkännande:** Ja

---

## Förslag 2: Dela upp `server/routers.ts` (1130 rader)

**Nuvarande problem:** Rot-routern blandar admin-procedurer (userManagement, settings), kursledar-procedurer (leaderProfile, availability), system-procedurer (notifyOwner, health) och auth (login, logout, resetPassword).

**Föreslagen uppdelning:**

```
server/routers/
├── users.ts              ← userManagement, leaderProfile, affiliates
├── auth.ts               ← login, logout, resetPassword, sessions
├── settings.ts           ← portalSettings, courseTypes, pricing
└── system.ts             ← health, notifyOwner, scheduled endpoints
```

Rot-filen `server/routers.ts` blir ~50 rader som bara importerar och mergar sub-routers.

**Förväntad effekt:** Tydlig separation — en auth-bugg kräver bara `auth.ts`, inte 1130 rader.

**Risk:** Medel — frontend-imports (`trpc.auth.login`) måste matcha nya router-namn.

**Kräver godkännande:** Ja

---

## Förslag 3: Dela upp `client/src/pages/MyCourses.tsx` (1754 rader)

**Nuvarande problem:** En sidkomponent som innehåller registreringsformulär, ombokning-dialog, avbokning-dialog, deltagarhantering, kursöversikt — allt i samma fil.

**Föreslagen uppdelning:**

```
client/src/pages/my-courses/
├── MyCourses.tsx          ← Huvudsida (layout, state, routing)
├── RegisterForm.tsx       ← Registreringsflöde
├── RescheduleDialog.tsx   ← Ombokning-modal
├── CancelDialog.tsx       ← Avbokning-modal
├── ParticipantList.tsx    ← Deltagarhantering
└── CourseCard.tsx          ← Enskild kursrad/kort
```

Uppdatera import i `App.tsx` till `./pages/my-courses/MyCourses`.

**Förväntad effekt:** Varje delfil ~250–400 rader. UI-ändringar i ombokning-dialogen kräver bara `RescheduleDialog.tsx`.

**Risk:** Låg — ren frontend-refaktorering utan backend-påverkan.

**Kräver godkännande:** Nej (kan genomföras direkt)

---

## Förslag 4: Flytta lösa skript till `scripts/`

**Nuvarande problem:** 7 st `.mjs`-filer i repo-roten (`check-user-db.mjs`, `check-user.mjs`, `check-victor.mjs`, `fix-emails.mjs`, `list-users.mjs`, `run_migration_0009.mjs`, `test-login.mjs`) — skapar visuellt brus och gör det svårare att hitta viktiga filer.

**Föreslagen uppdelning:** Flytta alla till `scripts/`. Inga andra ändringar.

**Förväntad effekt:** Renare rot-mapp. Alla engångsskript samlade.

**Risk:** Låg — skripten refereras inte av build/deploy.

**Kräver godkännande:** Nej

---

## Sammanfattning

| # | Förslag | Risk | Effekt | Godkännande |
|---|---------|------|--------|-------------|
| 1 | Dela courseDates.ts | Medel | Hög (2195→~400 rader/fil) | Ja |
| 2 | Dela routers.ts | Medel | Hög (1130→~50 rader rot) | Ja |
| 3 | Dela MyCourses.tsx | Låg | Medel (1754→~300 rader/fil) | Nej |
| 4 | Flytta lösa skript | Låg | Låg (renare rot) | Nej |

---

*Senast uppdaterad: Maj 2026*
