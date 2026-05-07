# drizzle/ — Databasschema och migrationer

## Ansvar

Definierar alla databastabeller (TiDB/MySQL) via Drizzle ORM. Genererar och lagrar SQL-migrationer.

## Ansvarar INTE för

- Query-logik (det ligger i `server/db.ts` och routers)
- Seed-data (det ligger i `scripts/`)

## Viktiga filer

| Fil | Beskrivning |
|-----|-------------|
| `schema.ts` | Alla tabeller: users, dashboard_users, course_dates, settlements, exams, certificates m.fl. |
| `migrations/` | Genererade SQL-migrationer (appliceras via `webdev_execute_sql`) |
| `meta/` | Drizzle-kit metadata (rör ej manuellt) |

## Tabeller (15 st)

| Tabell | Domän |
|--------|-------|
| `users` | Manus OAuth-users (ej dashboard) |
| `dashboard_users` | Portalanvändare (admin, kursledare, affiliate) |
| `dashboard_sessions` | Aktiva sessioner |
| `course_dates` | Kurstillfällen |
| `settlements` | Avräkningsdokument |
| `settlement_lines` | Avräkningsrader |
| `settlement_adjustments` | Manuella justeringar |
| `exams` | Examenssubmissioner |
| `certificates` | Utfärdade certifikat |
| `certificate_templates` | PDF-mallar |
| `participant_snapshots` | Deltagardata-snapshots |
| `course_participant_snapshots` | Kursspecifika deltagardata |
| `course_leader_messages` | Meddelanden |
| `password_reset_tokens` | Lösenordsåterställning |
| `guide_content` | Guide-innehåll |

## Vanliga ändringar

1. **Ny tabell:** Definiera i `schema.ts` → `pnpm drizzle-kit generate` → applicera SQL
2. **Ny kolumn:** Lägg till i tabellen i `schema.ts` → generera migration → applicera
3. **Ta bort kolumn:** ⚠️ Kräver godkännande — risk för dataförlust

## Saker som INTE ska ändras utan godkännande

- Ta bort eller byta namn på befintliga kolumner (dataförlust)
- Ändra kolumntyper (kan bryta befintlig data)
- Ta bort tabeller
