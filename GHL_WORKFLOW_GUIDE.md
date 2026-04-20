# GHL Workflow Setup Guide — Exam Submission Workflows

**Portal URL:** `https://fascidash-9qucsw5g.manus.space`

---

## Bakgrund

När en student skickar in sitt prov (via ett GHL Survey/Form) behöver GHL skicka ett webhook-anrop till Portalen. Portalen skapar då ett ärende i **Exam Queue** som admin/examinator kan godkänna eller underkänna.

Du behöver skapa **4 workflows** — en per kombination av kurstyp och språk:

| Workflow | Kurstyp | Språk |
|----------|---------|-------|
| 1 | Diplo/Quali | Svenska (sv) |
| 2 | Diplo/Quali | Engelska (en) |
| 3 | Cert | Svenska (sv) |
| 4 | Cert | Engelska (en) |

---

## Steg-för-steg per workflow

### Steg 1 — Skapa workflow

1. Gå till **Automation → Workflows** i GHL
2. Klicka **+ Create Workflow**
3. Välj **Start from Scratch**
4. Namnge workflowen, t.ex.: `FA – Exam Submitted – Diplo SE`
5. Placera den i mappen `FA – Course Automation`

---

### Steg 2 — Sätt trigger

1. Klicka på **+ Add Trigger**
2. Välj **Survey Submitted** (eller **Form Submitted** om du använder formulär istället för survey)
3. Under **Filters**: välj det specifika provet/formuläret för denna kurstyp + språk
   - T.ex. för Diplo SE: välj formuläret `Prov – Diplomerad Fasciaspecialist (SE)`
4. Klicka **Save Trigger**

---

### Steg 3 — Lägg till webhook-action

1. Klicka **+** för att lägga till ett steg
2. Välj **Send Webhook** (under "Integrations" eller "Actions")
3. Konfigurera enligt nedan:

**Method:** `POST`

**URL:**
```
https://fascidash-9qucsw5g.manus.space/api/webhooks/exam-submitted
```

**Headers:**
```
Content-Type: application/json
```

**Body (JSON)** — anpassa `courseType` och `language` per workflow:

**Workflow 1 — Diplo SE:**
```json
{
  "email": "{{contact.email}}",
  "contactName": "{{contact.full_name}}",
  "courseType": "diplo",
  "language": "sv"
}
```

**Workflow 2 — Diplo EN:**
```json
{
  "email": "{{contact.email}}",
  "contactName": "{{contact.full_name}}",
  "courseType": "diplo",
  "language": "en"
}
```

**Workflow 3 — Cert SE:**
```json
{
  "email": "{{contact.email}}",
  "contactName": "{{contact.full_name}}",
  "courseType": "cert",
  "language": "sv"
}
```

**Workflow 4 — Cert EN:**
```json
{
  "email": "{{contact.email}}",
  "contactName": "{{contact.full_name}}",
  "courseType": "cert",
  "language": "en"
}
```

4. Klicka **Save**

---

### Steg 4 — Aktivera workflow

1. Klicka **Publish** (eller toggle till **Active**) uppe till höger
2. Kontrollera att statusen visar **Active**

---

## Testa att det fungerar

1. Skicka in ett testprov med en testdeltagare (t.ex. din egen e-post)
2. Gå till Portalen → **Exam Queue**
3. Kontrollera att ett nytt ärende dyker upp inom 30 sekunder
4. Om inget dyker upp: kontrollera GHL Workflow History (klicka på workflowen → "History") för att se om webhook-anropet skickades och om det fick ett svar

---

## Felsökning

| Problem | Lösning |
|---------|---------|
| Inget ärende i Exam Queue | Kontrollera GHL Workflow History — fick webhook 200 OK? |
| "Missing email" error | Kontrollera att `{{contact.email}}` är ifyllt på kontakten |
| "courseType must be diplo or cert" | Kontrollera att du skrivit `"diplo"` eller `"cert"` (ej stora bokstäver) |
| Workflow triggas inte | Kontrollera att rätt formulär är valt i trigger-filtret |

---

## Bekräftelsemail — Lägg till datum och tid

För att lägga till datum och starttid i bekräftelsemailet för varje kalender:

1. Gå till **Calendars** → välj en kalender → **Edit**
2. Gå till fliken **Notifications**
3. Hitta **Appointment Booked — Customer Confirmation**
4. Klicka **Edit** på e-postmallen
5. Lägg till följande variabler i e-posttexten där du vill ha datum/tid:

```
Datum: {{appointment.formatted_start_date}}
Tid: {{appointment.start_time}}
```

**Exempel på text:**
```
Din bokning är bekräftad!

Kurs: {{appointment.title}}
Datum: {{appointment.formatted_start_date}}
Starttid: {{appointment.start_time}}
Plats: {{appointment.meeting_location}}
```

6. Klicka **Save**
7. Upprepa för varje kalender

> **Tips:** Om du har många kalendrar — kontrollera om det finns en **global e-postmall** under Settings → Notifications som gäller för alla kalendrar, så behöver du bara uppdatera den en gång.

---

## Sammanfattning — Vad Portalen gör automatiskt

När kursledaren markerar en deltagare som "Showed" i Portalen händer följande **automatiskt utan att du behöver göra något i GHL**:

| Kurstyp | Vad händer |
|---------|-----------|
| **Intro** | Intyg genereras som PDF → skickas till studenten via e-post (info@fasciaacademy.com) |
| **Vidare** | Intyg genereras som PDF → skickas till studenten via e-post |
| **Diplo/Cert** | Inget intyg ännu — väntar på godkänt prov i Exam Queue |
| **Alla** | GHL-tagg sätts på kontakten (t.ex. "Intro CF – Completed") |

När admin godkänner ett prov i Exam Queue:

| Kurstyp | Vad händer |
|---------|-----------|
| **Diplo/Cert** (showed + godkänt prov) | Intyg genereras → skickas till studenten |
| **Diplo/Cert** (ej showed än) | Intyg sparas men skickas när "Showed" markeras |
