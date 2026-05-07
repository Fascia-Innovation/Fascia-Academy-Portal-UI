# ARCHITECTURE.md — Fascia Academy Dashboard

## Systemarkitektur

```
┌─────────────────────────────────────────────────────────┐
│                    KLIENT (React 19)                      │
│  Vite + Tailwind 4 + shadcn/ui + tRPC-klient            │
│  Sidor: Admin | Kursledare | Publik                      │
└───────────────────────┬─────────────────────────────────┘
                        │ tRPC (HTTP, /api/trpc)
┌───────────────────────▼─────────────────────────────────┐
│                   SERVER (Express 4)                      │
│  tRPC 11 routers → Drizzle ORM → TiDB/MySQL             │
│  GHL REST API-klient                                     │
│  S3 storage (bilder, PDF)                                │
│  LLM-helper (Manus built-in)                             │
└───────┬───────────────┬──────────────┬──────────────────┘
        │               │              │
   ┌────▼────┐    ┌─────▼─────┐  ┌────▼────┐
   │  TiDB   │    │    GHL    │  │   S3    │
   │ (MySQL) │    │  REST API │  │ Storage │
   └─────────┘    └───────────┘  └─────────┘
```

---

## Centrala dataflöden

### 1. Kursregistrering (kursledare)
```
Kursledare → MyCourses.tsx → trpc.courseDates.registerCourse
  → Validerar mot GHL-kalender (hämtar slots)
  → Sparar i course_dates (status: pending_approval)
  → Notifierar admin
```

### 2. Godkännande (admin)
```
Admin → PendingActions.tsx → trpc.courseDates.approveCourse
  → Uppdaterar status → published
  → Kursen syns på PublicCourses.tsx
```

### 3. Publik bokning (besökare)
```
Besökare → PublicCourses.tsx → trpc.courseDates.publicDates (publicProcedure)
  → Hämtar alla published course_dates
  → Klick "Till bokning" → GHL-bokningswidget (extern URL)
```

### 4. Avräkning (admin)
```
Admin → Settlements.tsx → trpc.settlements.generate
  → Hämtar appointments från GHL för vald period
  → Beräknar provision per kursledare
  → Sparar settlement + settlement_lines i DB
  → PDF genereras och skickas via e-post
```

### 5. Examensflöde
```
Kursledare → MyCourses.tsx → trpc.exams.submit (laddar upp svar)
  → Admin → ExamQueue.tsx → trpc.exams.grade
  → Om godkänd → trpc.certificates.issue → PDF genereras → sparas i S3
```

---

## API-lager och externa tjänster

| Tjänst | Syfte | Konfiguration |
|--------|-------|---------------|
| **GoHighLevel (GHL)** | CRM: kalendrar, kontakter, appointments, tags | `GHL_API_KEY`, `GHL_LOCATION_ID` |
| **TiDB/MySQL** | Primär databas | `DATABASE_URL` |
| **AWS S3** | Fillagring (certifikat-PDF, profilbilder) | Injiceras via plattform |
| **Manus LLM** | AI-funktioner (invokeLLM) | `BUILT_IN_FORGE_API_KEY` |
| **Manus OAuth** | Ägare-autentisering (ej dashboard-auth) | `VITE_APP_ID`, `OAUTH_SERVER_URL` |

---

## Autentisering och behörighetsflöden

### Dashboard-auth (primärt)
- Egen session-baserad auth med bcrypt-hashade lösenord
- Cookie: `fa_dash_session`
- Roller: `admin`, `course_leader`, `affiliate`
- Fil: `server/dashboardAuth.ts`

### Manus OAuth (sekundärt)
- Används för ägare/plattformsåtkomst (ej kursledare)
- Cookie: `app_session_id`
- Fil: `server/_core/oauth.ts`

### Behörighetsnivåer i tRPC
```
publicProcedure    → Ingen auth krävs (PublicCourses, CertificatePublic)
protectedProcedure → Manus OAuth-user (systemRouter)
dashProcedure      → Dashboard-session krävs (alla admin/leader-procedurer)
adminProcedure     → dashProcedure + role === 'admin'
```

---

## Databasstruktur (konceptuell)

### Kärnentiteter
- **dashboard_users** — Alla portalanvändare (admin, kursledare, affiliate)
- **course_dates** — Registrerade kurstillfällen med status (pending → published → completed)
- **settlements** — Avräkningsdokument per kursledare/affiliate
- **exams** — Examenssubmissioner (bilder + metadata)
- **certificates** — Utfärdade certifikat (länkade till exam eller direkt)

### Stödjande
- **dashboard_sessions** — Aktiva sessioner
- **settlement_lines** / **settlement_adjustments** — Radposter och justeringar
- **participant_snapshots** / **course_participant_snapshots** — Deltagardata vid specifik tidpunkt
- **course_leader_messages** — Kommunikation admin ↔ kursledare
- **certificate_templates** — PDF-mallar per certifikattyp
- **guide_content** — Redigerbart guide-innehåll
- **password_reset_tokens** — Engångstokens

---

## Deploymentflöde

1. Utveckling sker i Manus sandbox (port 3000)
2. `webdev_save_checkpoint` → skapar git-commit i internt S3-repo
3. Användaren klickar **Publish** i Management UI
4. Byggs med `vite build` + `esbuild` → deployas till Manus Cloud Run
5. Domän: `fascidash-9qucsw5g.manus.space`
6. GitHub-mirror: `Fascia-Innovation/Fascia-Academy-Portal-UI`

### Miljövariabler
Alla env-variabler injiceras av plattformen. Se `server/_core/env.ts` för fullständig lista. Inga `.env`-filer committas.

---

## Viktiga designbeslut

| Beslut | Motivering |
|--------|------------|
| Egen dashboard-auth istället för Manus OAuth | Kursledare och affiliates behöver egna konton utan Manus-konto |
| GHL som bokningssystem | Befintlig infrastruktur hos kunden; portalen är ett lager ovanpå |
| course_dates i egen DB (ej GHL) | Ger kontroll över publicering, godkännande, metadata som GHL saknar |
| tRPC end-to-end | Typsäkerhet frontend ↔ backend utan manuella API-kontrakt |
| Timezone: Europe/Stockholm (+02:00) | Alla datum skickas med explicit offset för att undvika UTC-drift |
| Monorepo utan workspace | Enkel setup; client/server/shared delar tsconfig |

---

## Riskområden (extra försiktighet krävs)

| Område | Risk | Konsekvens vid fel |
|--------|------|-------------------|
| `server/ghl.ts` | GHL API-ändringar kan bryta all data-hämtning | Avräkningar, kalender, deltagarlistor slutar fungera |
| `drizzle/schema.ts` | Schemaändringar kräver migrering av produktionsdata | Dataförlust om migration misslyckas |
| `server/dashboardAuth.ts` | Auth-buggar → obehörig åtkomst | Säkerhetsrisk |
| `server/routers/settlements.ts` | Beräkningsfel → felaktiga utbetalningar | Ekonomisk risk |
| `server/certificatePdf.ts` | PDF-generering med PDFKit — komplex layout | Certifikat ser fel ut |
| `server/_core/` | Ramverksplumbing — ändra ej utan infrastrukturskäl | Hela appen kan sluta fungera |

---

*Senast uppdaterad: Maj 2026*
