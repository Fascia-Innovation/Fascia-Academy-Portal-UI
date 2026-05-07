# TASKS.md — Prioriterad arbetslista

Uppgifter nedbrutna i avgränsade enheter som framtida AI-sessioner kan genomföra utan att behöva förstå hela repot.

---

## Hög prioritet

### T1: Dela upp `server/routers/courseDates.ts` (2195 rader)
- **Modul:** Kursregistrering (backend)
- **Syfte:** Minska kontextbehov — filen är för stor för att läsas i sin helhet varje session
- **Berörda filer:** `server/routers/courseDates.ts`, `server/routers.ts`
- **Risknivå:** Medel (refaktorering utan funktionsändring)
- **Kräver godkännande:** Ja — föreslå uppdelning först, vänta på OK
- **Acceptanskriterier:** Filen delas i 3–4 delfiler (t.ex. `courseDates/register.ts`, `courseDates/approve.ts`, `courseDates/public.ts`, `courseDates/batch.ts`), alla tester passerar, TypeScript 0 errors

### T2: Dela upp `server/routers.ts` (1130 rader)
- **Modul:** Backend (rot-router)
- **Syfte:** Rot-routern blandar admin-, kursledar- och systemprocedurer
- **Berörda filer:** `server/routers.ts`
- **Risknivå:** Medel
- **Kräver godkännande:** Ja
- **Acceptanskriterier:** Separera i `server/routers/users.ts`, `server/routers/dashboard.ts` etc. Alla tester passerar.

### T3: Dela upp `client/src/pages/MyCourses.tsx` (1754 rader)
- **Modul:** Kursregistrering (frontend)
- **Syfte:** Minska kontextbehov vid UI-ändringar
- **Berörda filer:** `client/src/pages/MyCourses.tsx`
- **Risknivå:** Låg (ren frontend-refaktorering)
- **Kräver godkännande:** Nej — kan genomföras direkt
- **Acceptanskriterier:** Dela i subkomponenter under `client/src/pages/my-courses/` (t.ex. `RegisterForm.tsx`, `RescheduleDialog.tsx`, `ParticipantList.tsx`). Ingen funktionsändring.

---

## Medel prioritet

### T4: Flytta lösa `.mjs`-skript till `scripts/`
- **Modul:** Repo-hygien
- **Syfte:** Rensa rot-mappen, samla alla skript på ett ställe
- **Berörda filer:** `check-user-db.mjs`, `check-user.mjs`, `check-victor.mjs`, `fix-emails.mjs`, `list-users.mjs`, `run_migration_0009.mjs`, `test-login.mjs`
- **Risknivå:** Låg
- **Kräver godkännande:** Nej
- **Acceptanskriterier:** Alla `.mjs`-filer i roten flyttade till `scripts/`. Inget annat ändras.

### T5: Skapa testsvit för avräkningsmodulen
- **Modul:** Avräkningar
- **Syfte:** Avräkningsberäkningar är ekonomiskt kritiska men saknar automatiserade tester
- **Berörda filer:** `server/routers/settlements.ts`, ny fil `server/settlements.test.ts`
- **Risknivå:** Låg (lägger bara till tester)
- **Kräver godkännande:** Nej
- **Acceptanskriterier:** Minst 5 testfall som verifierar provisionsberäkning, periodfiltrering, justeringar

### T6: Förbättra address-parsern med fler testfall
- **Modul:** Kursregistrering (backend)
- **Syfte:** Parsern har haft buggar med otypiska adressformat
- **Berörda filer:** `server/routers/courseDates.ts` (extractCityFromAddress-funktionen)
- **Risknivå:** Låg
- **Kräver godkännande:** Nej
- **Acceptanskriterier:** Enhetstester för alla kända adressformat (tab-separerat, komma-separerat, postnummer+stad, ren stad)

### T7: Dokumentera GHL-integrationen
- **Modul:** GHL-integration
- **Syfte:** `server/ghl.ts` saknar dokumentation om vilka endpoints som används och varför
- **Berörda filer:** `server/ghl.ts`, ny fil `server/GHL_README.md`
- **Risknivå:** Låg
- **Kräver godkännande:** Nej
- **Acceptanskriterier:** README med lista över använda GHL-endpoints, rate limits, felhantering, och vilka moduler som beror på varje endpoint

---

## Låg prioritet

### T8: Ta bort `client/src/pages/ComponentShowcase.tsx`
- **Modul:** Frontend
- **Syfte:** 1437 rader demo-komponent som inte används i produktion
- **Berörda filer:** `client/src/pages/ComponentShowcase.tsx`, `client/src/App.tsx` (route)
- **Risknivå:** Låg
- **Kräver godkännande:** Ja — bekräfta att den inte behövs
- **Acceptanskriterier:** Filen borttagen, route borttagen, inga brutna imports

### T9: Rensa `scripts/` från obsoleta diagnostikskript
- **Modul:** Repo-hygien
- **Syfte:** Flera `diag-*.mjs`-filer som troligen var engångsdebugging
- **Berörda filer:** `scripts/diag-*.mjs`
- **Risknivå:** Låg
- **Kräver godkännande:** Ja — bekräfta vilka som kan tas bort
- **Acceptanskriterier:** Obsoleta skript borttagna, relevanta behållna

### T10: Lägg till JSDoc-kommentarer i `server/db.ts`
- **Modul:** Databas
- **Syfte:** Query-helpers saknar dokumentation om vad de returnerar och när de ska användas
- **Berörda filer:** `server/db.ts`
- **Risknivå:** Låg
- **Kräver godkännande:** Nej
- **Acceptanskriterier:** Varje exporterad funktion har JSDoc med @param, @returns, @example

---

*Senast uppdaterad: Maj 2026*
