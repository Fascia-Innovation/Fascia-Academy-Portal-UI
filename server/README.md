# server/ — Backend

## Ansvar

Express 4 + tRPC 11 backend. Hanterar all affärslogik, databasåtkomst, GHL-integration, auth och fillagring.

## Ansvarar INTE för

- UI-rendering
- Frontend-routing
- Tailwind/CSS-styling

## Viktiga filer

| Fil | Beskrivning |
|-----|-------------|
| `routers.ts` | Rot-router — samlar alla sub-routers till `appRouter`. Innehåller även admin/leader/system-procedurer (~1130 rader, kandidat för uppdelning) |
| `routers/` | Feature-routers per domän (se `routers/README.md`) |
| `db.ts` | Drizzle query-helpers (CRUD-funktioner) |
| `ghl.ts` | GoHighLevel API-klient (kalendrar, kontakter, appointments) |
| `ghlWebhook.ts` | Webhook-handler för GHL-events |
| `dashboardAuth.ts` | Egen session-auth (bcrypt + cookies), `dashProcedure`/`adminProcedure` |
| `certificatePdf.ts` | PDFKit-baserad certifikat-generering |
| `settlementEmail.ts` | E-postmallar för avräkningar |
| `snapshotJob.ts` | Schemalagt jobb för deltagardata-snapshots |
| `storage.ts` | S3 storagePut/storageGet helpers |
| `_core/` | **Ramverksplumbing — rör ej** (OAuth, context, Vite, env, LLM) |

## Lokala beroenden

- `drizzle/schema.ts` — Tabellschema
- `shared/` — Delade typer och konstanter
- Extern: GHL REST API, TiDB/MySQL, AWS S3

## Vanliga ändringar

1. **Ny procedur:** Skapa i `routers/`, registrera i `routers.ts`
2. **Ny DB-query:** Lägg till i `db.ts`
3. **Ny GHL-operation:** Lägg till helper i `ghl.ts`

## Tester

Alla testfiler: `server/*.test.ts`. Kör med `pnpm test`.

## Saker som INTE ska ändras utan godkännande

- `_core/` (hela mappen)
- `dashboardAuth.ts` (auth-flöde)
- Avräkningsberäkningar i `routers/settlements.ts`
- GHL API-anrop i `ghl.ts` (kan bryta integration)
