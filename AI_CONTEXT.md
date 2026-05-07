# AI_CONTEXT.md — Arbetsinstruktioner för AI-utvecklare

## Startordning

Läs alltid dessa filer först, i denna ordning:

1. `REPO_MAP.md` — Förstå projektets struktur och modulgränser
2. `AI_CONTEXT.md` — Denna fil (arbetsregler och kontextstrategi)
3. `ARCHITECTURE.md` — Systemarkitektur, dataflöden, risker
4. Relevant modul-README (se tabell nedan)

Läs **aldrig** hela repot. Identifiera vilken modul uppgiften berör och läs bara de filer som listas i kontextgruppen.

---

## Kontextstrategi

### Hitta rätt filer

1. Bestäm vilken modul uppgiften tillhör (se REPO_MAP.md → Modulgränser)
2. Läs modulens README om den finns (`server/README.md`, `client/src/pages/README.md`)
3. Läs bara de filer som listas i modulens kontextgrupp
4. Om du behöver förstå datamodellen: läs `drizzle/schema.ts` (bara relevanta tabeller)
5. Om du behöver förstå GHL-integrationen: läs `server/ghl.ts`

### Arbetsmodell per uppgiftstyp

| Uppgiftstyp | Läs först | Läs sedan | Undvik att läsa |
|-------------|-----------|-----------|-----------------|
| **Ny feature** | `REPO_MAP.md`, relevant modul-README | Berörda komponenter, hooks, API-routes, schema, tester | Orelaterade moduler, deployment, globala konfigurationsfiler |
| **Bugfix** | `TASKS.md`, felbeskrivning, relevant modul-README | Bara filer kopplade till buggen och närliggande tester | Hela frontend eller backend om buggen är lokal |
| **UI-ändring** | Relevant frontend-README | Berörda sidkomponenter, stilfiler, visuella tester | API-lager, databas och deployment |
| **API/integration** | `ARCHITECTURE.md`, relevant backend-README | API-klienter, routes, schemas, auth-beroenden, tester | UI-komponenter som inte påverkas |
| **Databasändring** | `ARCHITECTURE.md`, `drizzle/schema.ts` | Migrations, seed-data, databasnära tester | UI-filer om ändringen inte påverkar gränssnittet |
| **Deployment-problem** | `ARCHITECTURE.md` (deployment-sektion) | CI-konfiguration, build scripts, miljövariabler, loggar | Produktlogik som inte påverkar deployment |
| **Dokumentation** | `REPO_MAP.md`, `AI_CONTEXT.md`, relevant modul-README | Bara filer som behövs för att verifiera dokumentationen | Kodfiler utanför berörd modul |

---

## Modulregler

### Vad som får och inte får ändras per modul

| Modul | Fritt att ändra | Kräver extra försiktighet |
|-------|-----------------|--------------------------|
| `client/src/pages/` | Sidkomponenter, layout, styling | — |
| `client/src/components/ui/` | **Rör ej** utan gott skäl — shadcn/ui-primitiver | Alla ändringar |
| `server/routers/` | Procedurer, validering, queries | Ändra ej procedure-namn (bryter frontend) |
| `server/ghl.ts` | Interna helpers | API-anrop (kan bryta integrationen) |
| `server/_core/` | **Rör ej** — ramverksplumbing | Alla ändringar |
| `drizzle/schema.ts` | Nya tabeller/kolumner (med migration) | Ändra/ta bort befintliga kolumner |
| `shared/` | Nya konstanter/typer | Ändra befintliga (bryter båda sidor) |

---

## Säkerhetsregler

1. **Ändra aldrig** `server/_core/` utan explicit godkännande
2. **Ändra aldrig** auth-logik (`server/dashboardAuth.ts`) utan att beskriva konsekvensen
3. **Ändra aldrig** avräkningsberäkningar utan att verifiera med testdata
4. **Ändra aldrig** GHL API-anrop utan att förstå rate limits och felhantering
5. **Ta aldrig bort** databaskolumner utan migration och backup-plan
6. **Exponera aldrig** `GHL_API_KEY`, `JWT_SECRET` eller andra hemligheter i frontend-kod

---

## Testregler

- Kör `pnpm test` efter alla ändringar
- Kör `npx tsc --noEmit` för typecheck
- Befintliga testfiler: `server/*.test.ts`
- Tester använder Vitest
- Vid nya features: skriv minst en test per tRPC-procedur

---

## Stoppsignaler

Avbryt och fråga om godkännande om:

- Du behöver ändra databasschema (risk för dataförlust)
- Du behöver ändra auth-flödet
- Du behöver ändra GHL-integrationen
- Du hittar en bugg som påverkar avräkningar/betalningar
- Du är osäker på affärslogik som inte framgår av koden
- En ändring påverkar fler än 3 moduler samtidigt

---

## Tekniska konventioner

| Konvention | Detalj |
|------------|--------|
| Språk i kod | Engelska (variabelnamn, kommentarer) |
| Språk i UI | Svenska (primärt), engelska (sekundärt via i18n-objekt i varje sida) |
| Datum/tid | UTC timestamps i DB, `+02:00` offset vid skapande, lokal visning i frontend |
| tRPC-procedurer | Namngivning: `modul.action` (t.ex. `courseDates.register`) |
| Frontend state | tRPC useQuery/useMutation — ingen Redux/Zustand |
| Styling | Tailwind 4 utilities + shadcn/ui-komponenter |
| Formulär | react-hook-form + zod-validering |

---

## Vanliga uppgifter — snabbreferens

### Lägga till en ny sida
1. Skapa `client/src/pages/NyaSidan.tsx`
2. Registrera route i `client/src/App.tsx`
3. Lägg till nav-item i `client/src/components/DashboardLayout.tsx`

### Lägga till en ny tRPC-procedur
1. Skapa/uppdatera router i `server/routers/`
2. Registrera i `server/routers.ts` (appRouter)
3. Anropa från frontend med `trpc.routerName.procedureName.useQuery/useMutation`

### Lägga till en ny databastabell
1. Definiera i `drizzle/schema.ts`
2. Kör `pnpm drizzle-kit generate`
3. Läs genererad SQL och applicera via `webdev_execute_sql`
4. Skapa query-helpers i `server/db.ts`

---

*Senast uppdaterad: Maj 2026*
