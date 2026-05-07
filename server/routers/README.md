# server/routers/ — tRPC Feature Routers

## Ansvar

Denna mapp innehåller domänspecifika tRPC-routers. Varje fil definierar procedurer (queries och mutations) för en avgränsad affärsdomän.

## Ansvarar INTE för

- UI-rendering (det hör till `client/src/pages/`)
- Ramverksplumbing (det hör till `server/_core/`)
- Databasschema (det hör till `drizzle/schema.ts`)
- GHL API-anrop direkt (använd helpers i `server/ghl.ts`)

## Viktiga filer

| Fil | Rader | Domän | Beskrivning |
|-----|-------|-------|-------------|
| `courseDates.ts` | ~2200 | Kursregistrering | Register, approve, reschedule, cancel, publish, batch-create, snapshots |
| `settlements.ts` | ~1040 | Avräkningar | Generera, granska, godkänna avräkningar |
| `certificatesRouter.ts` | ~570 | Certifikat | Utfärda, lista, verifiera certifikat |
| `exams.ts` | ~425 | Examina | Submit, grade, lista examenssubmissioner |
| `courseMessages.ts` | ~350 | Meddelanden | Skicka/läsa meddelanden admin ↔ kursledare |
| `adminHome.ts` | ~330 | Admin KPI | Dashboard-statistik, snabbåtgärder |
| `guideRouter.ts` | ~150 | Guide | CRUD för redigerbart guide-innehåll |

## Lokala beroenden

- `server/db.ts` — Query-helpers
- `server/ghl.ts` — GHL API-klient
- `drizzle/schema.ts` — Tabellreferenser för Drizzle queries
- `server/_core/trpc.ts` — `publicProcedure`, `protectedProcedure`, `router`
- `server/dashboardAuth.ts` — `dashProcedure`, `adminProcedure`

## Vanliga ändringar

1. Lägga till en ny procedur: definiera i relevant router-fil, registrera i `server/routers.ts`
2. Ändra validering: uppdatera zod-schema i `.input()`
3. Ändra query: uppdatera Drizzle-query i procedurens body

## Tester

- `server/courseDates.test.ts`
- `server/ghl.test.ts`
- `server/dashboard.test.ts`
- `server/messages.test.ts`

Kör med `pnpm test`.

## Saker som INTE ska ändras utan godkännande

- Procedure-namn (bryter frontend-anrop)
- Auth-guards (`dashProcedure` → `publicProcedure` = säkerhetsrisk)
- Avräkningsberäkningar (ekonomisk risk)
