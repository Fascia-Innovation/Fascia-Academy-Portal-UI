/**
 * Del 7 — Kursdeltagare: Från bokning till intyg
 * 6 slides covering the student journey for Intro and Diplo courses.
 */
import { useState, useCallback, createContext, useContext } from "react";
import { Link } from "wouter";
import {
  ChevronLeft, ChevronRight, Mail, CheckCircle2,
  Pencil, PencilOff, AlertCircle, GraduationCap, Calendar, CreditCard, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { EditableField } from "@/components/guide/EditableField";
import { EditableList } from "@/components/guide/EditableList";
import { EditableImage } from "@/components/guide/EditableImage";

const PRES_ID = "del7";

type EditCtx = {
  editMode: boolean;
  save: (slideId: string, fieldKey: string, value: string) => Promise<void>;
  saveList: (slideId: string, fieldKey: string, items: string[]) => Promise<void>;
  getField: (slideId: string, fieldKey: string, defaultVal: string) => string;
  getList: (slideId: string, fieldKey: string, defaultItems: string[]) => string[];
};
const EditContext = createContext<EditCtx>({
  editMode: false,
  save: async () => {},
  saveList: async () => {},
  getField: (_s, _k, d) => d,
  getList: (_s, _k, d) => d,
});
function useEdit() { return useContext(EditContext); }

function EH3({ sid, fkey, def }: { sid: string; fkey: string; def: string }) {
  const { editMode, getField, save } = useEdit();
  return (
    <EditableField value={getField(sid, fkey, def)} onSave={(v) => save(sid, fkey, v)} editMode={editMode} className="block">
      {(v) => <h3 className="text-base font-semibold text-white">{v}</h3>}
    </EditableField>
  );
}
function EImg({ sid, fkey, label }: { sid: string; fkey: string; label: string }) {
  const { editMode, getField, save } = useEdit();
  const src = getField(sid, fkey, "") || null;
  return (
    <EditableImage
      presentationId={PRES_ID} slideId={sid} fieldKey={fkey} src={src} alt={label}
      onSave={(url) => save(sid, fkey, url)} editMode={editMode}
      className="w-full rounded-xl overflow-hidden border border-[oklch(0.28_0.04_255)]"
      imgClassName="w-full h-full object-contain rounded-xl"
      placeholder={
        <div className="w-full h-36 flex flex-col items-center justify-center rounded-xl bg-[oklch(0.20_0.04_255)] border-2 border-dashed border-[oklch(0.30_0.04_255)] gap-2">
          <svg className="h-5 w-5 text-[oklch(0.45_0.03_250)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <p className="text-xs text-[oklch(0.45_0.03_250)] text-center px-4">{label}</p>
          {editMode && <p className="text-[10px] text-[oklch(0.72_0.12_75)]">↑ Klicka för att ladda upp</p>}
        </div>
      }
    />
  );
}
function EList({ sid, fkey, def }: { sid: string; fkey: string; def: string[] }) {
  const { editMode, getList, saveList } = useEdit();
  const items = getList(sid, fkey, def);
  return (
    <EditableList items={items} onSave={(it) => saveList(sid, fkey, it)} editMode={editMode}>
      {(it) => (
        <ul className="space-y-1.5">
          {it.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-[oklch(0.72_0.12_75)] mt-0.5 shrink-0" />
              <span className="text-xs text-muted-foreground leading-snug">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </EditableList>
  );
}

// ─── Shared email mock ────────────────────────────────────────────────────────
function EmailMock({ subject, body }: { subject: string; body: string }) {
  return (
    <div className="bg-[oklch(0.17_0.04_255)] rounded-xl border border-[oklch(0.22_0.04_255)] p-4">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[oklch(0.22_0.04_255)]">
        <Mail className="h-4 w-4 text-[oklch(0.72_0.12_75)]" />
        <span className="text-xs font-semibold text-foreground">{subject}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  );
}

// ─── Slides ───────────────────────────────────────────────────────────────────
function SlideOverview() {
  const sid = "student_overview";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 7 — KURSDELTAGARE · Slide 1</div>
        <EditableField value={getField(sid, "title", "Kursdeltagare — Från bokning till intyg")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
          {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
        </EditableField>
        <EditableField value={getField(sid, "subtitle", "Deltagarens resa — Intro och Diplo/Cert")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
          {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
        </EditableField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-[oklch(0.72_0.12_75)]/20 border border-[oklch(0.72_0.12_75)]/40 flex items-center justify-center">
              <BookOpen className="h-3 w-3 text-[oklch(0.72_0.12_75)]" />
            </div>
            <EH3 sid={sid} fkey="intro_heading" def="Intro-kurser" />
          </div>
          <EList sid={sid} fkey="intro_steps" def={["Bokar via fasciaacademy.com", "Betalar via Stripe", "Får bekräftelsemail + påminnelse 7 dagar innan", "Genomför kursen", "Kursledaren markerar showed", "Admin utfärdar intyg"]} />
        </div>
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
              <GraduationCap className="h-3 w-3 text-purple-400" />
            </div>
            <EH3 sid={sid} fkey="diplo_heading" def="Diplo- och Cert-kurser" />
          </div>
          <EList sid={sid} fkey="diplo_steps" def={["Bokar via fasciaacademy.com", "Betalar via Stripe", "Får bekräftelsemail + påminnelse 7 dagar innan", "Genomför kursen + skriver prov i digitalt material", "Kursledaren markerar showed", "Rättare godkänner prov i Exam Queue", "Admin utfärdar intyg"]} />
        </div>
      </div>
      <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
        <EH3 sid={sid} fkey="note_heading" def="Vidareutbildning och Cert" />
        <EditableField value={getField(sid, "note_body", "Vidareutbildning följer samma logik som Intro (showed räcker). Cert följer samma logik som Diplo (showed + godkänt prov krävs).")} onSave={(v) => save(sid, "note_body", v)} editMode={editMode} multiline className="mt-1">
          {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
        </EditableField>
      </div>
    </div>
  );
}

function SlideBookingIntro() {
  const sid = "booking_intro";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 7 — KURSDELTAGARE · Slide 2</div>
          <EditableField value={getField(sid, "title", "Intro — Bokning och bekräftelse")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
            {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
          </EditableField>
          <EditableField value={getField(sid, "subtitle", "Vad händer när en deltagare bokar en Intro-kurs?")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
            {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
          </EditableField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-3 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><CreditCard className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="booking_heading" def="Bokning och betalning" /></div>
            <EList sid={sid} fkey="booking_list" def={["Deltagaren hittar kursen på fasciaacademy.com", "Väljer datum och fyller i kontaktuppgifter", "Betalar via Stripe (kort eller Klarna)", "Bokning bekräftad direkt efter betalning"]} />
          </div>
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-3 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><Mail className="h-4 w-4 text-blue-400" /><EH3 sid={sid} fkey="email_heading" def="Automatiska mail (HL)" /></div>
            <EList sid={sid} fkey="email_list" def={["Bekräftelsemail skickas direkt efter bokning", "Innehåller kursinformation, datum, plats och kursledare", "Påminnelsemail skickas 7 dagar innan kursstart", "Inga ytterligare automail från portalen"]} />
          </div>
        </div>
        <div>
          <EH3 sid={sid} fkey="confirm_email_heading" def="Bekräftelsemail — Intro SE (faktisk mall)" />
          <div className="mt-2">
            <EmailMock
              subject="Din bokning är bekräftad - Välkommen till Fascia Academy!"
              body={getField(sid, "confirm_email_body", `Hej {{contact.first_name}},

Din bokning är bekräftad - Välkommen till Fascia Academy!
Datum: {{appointment.formatted_start_date}}
Tid: {{appointment.start_time}}

Kursinformation – schema, tider och plats
All praktisk information om ditt kurstillfälle, inklusive tider, plats och kursledare, hittar du på hemsidan via den länk du använde vid bokning.

Inför kursdagen
Du behöver inte ta med någon egen utrustning – allt som används under kursdagen finns på plats. Vi rekommenderar bekväma kläder som möjliggör rörelse och praktiskt arbete.

Ditt kursmaterial – FasciaVibes
Det digitala kursmaterialet ingår i kursen och finns tillgängligt direkt. Logga in eller skapa ditt konto via länken nedan:
Länk: Gå till kursmaterial – Introduktionskurs Fascia

Materialet är uppdelat i:
• Introduktionsdag Fascia – digitalt upplägg
• Grundläggande synsätt på kroppen och fascia
• Kunskapsperspektiv och förståelse
• Den levande kroppen
• Föreläsning om fascia och den levande kroppen
• Praktiska delar

Inför kursdagen ska du ha gått igenom del 1–4.
Du behåller åtkomsten till materialet via ditt konto i FasciaVibes även efter avslutad kurs.

När du aktiverat din åtkomst får du även ett direktmeddelande från Fascia Academy med mer information.

FasciaVibes Open
Genom ditt köp har du även tillgång till FasciaVibes Open – den kostnadsfria delen av plattformen med inspelade webbinarier, digitala kurser och övrigt material.

FasciaVibes Member
Vill du fördjupa dig och utvecklas inom fascia som yrke? Som medlem får du tillgång till forum, fördjupade resurser, digitala workshops och inspelade sessioner. 149 kr/månad, ingen bindningstid.
Länk: Bli FasciaVibes Member

Kvitto
Ditt kvitto har skickats separat från Stripe till din e-postadress.

Frågor
Kontakta gärna din kursledare direkt (telefonnummer finns i kursinformationen).
Eller maila oss på info@fasciaacademy.com

Vänliga hälsningar,
Fascia Academy
info@fasciaacademy.com`)}
            />
          </div>
          {editMode && (
            <EditableField value={getField(sid, "confirm_email_body", "")} onSave={(v) => save(sid, "confirm_email_body", v)} editMode={editMode} multiline className="mt-2">
              {() => <span className="text-[10px] text-[oklch(0.72_0.12_75)]">Klicka här för att redigera mailinnehållet ovan</span>}
            </EditableField>
          )}
        </div>
        <EImg sid={sid} fkey="screenshot" label="Skärmdump — bokningssidan på fasciaacademy.com" />
      </div>
    </div>
  );
}

function SlideReminderIntro() {
  const sid = "reminder_intro";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 7 — KURSDELTAGARE · Slide 3</div>
        <EditableField value={getField(sid, "title", "Intro — Påminnelse och kursdag")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
          {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
        </EditableField>
        <EditableField value={getField(sid, "subtitle", "7-dagarspåminnelse och vad som händer på kursdagen")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
          {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
        </EditableField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <EH3 sid={sid} fkey="reminder_heading" def="Påminnelsemail — 7 dagar innan" />
            <div className="mt-2">
              <EmailMock
                subject="Påminnelse - din kurs startar om 7 dagar"
                body={getField(sid, "reminder_email_body", `Hej {{contact.first_name}},

Påminnelse - din kurs startar om 7 dagar
Du har en bokad kurs: {{appointment.title}}
Kursstart: {{appointment.start_time}}

Inför kurstillfället
Kom ihåg att gå igenom det förberedande kursmaterialet innan kursstart. Vilka delar detta gäller samt exakt upplägg framgår i kursinformationen på hemsidan.

Kursinformation - schema, tider och upplägg
All praktisk information om ditt kurstillfälle, inklusive tider, plats och kursledare, hittar du på hemsidan via den länk du använde vid bokning.

Vid frågor
Kontakta gärna din kursledare direkt (telefonnummer finns i kursinformationen). Eller mejla oss på info@fasciaacademy.com

Vänliga hälsningar
Fascia Academy info@fasciaacademy.com`)}
              />
            </div>
            {editMode && (
              <EditableField value={getField(sid, "reminder_email_body", "")} onSave={(v) => save(sid, "reminder_email_body", v)} editMode={editMode} multiline className="mt-2">
                {() => <span className="text-[10px] text-[oklch(0.72_0.12_75)]">Klicka här för att redigera påminnelsemailet ovan</span>}
              </EditableField>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><Calendar className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="day_heading" def="På kursdagen" /></div>
            <EList sid={sid} fkey="day_list" def={["Deltagaren anländer till kurslokalen", "Kursledaren genomför kursen", "Kursledaren markerar showed i portalen (My Courses)", "Admin ser showed i Pending Actions och utfärdar intyg"]} />
          </div>
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><GraduationCap className="h-4 w-4 text-emerald-400" /><EH3 sid={sid} fkey="cert_heading" def="Intyg (Intro)" /></div>
            <EList sid={sid} fkey="cert_list" def={["Admin utfärdar intyget manuellt efter showed", "Intyget visas i Issued Certificates", "Deltagaren kan verifiera intyget via unik länk", "Inga automail om intyg — admin hanterar kommunikation"]} />
          </div>
        </div>
      </div>
      <EImg sid={sid} fkey="screenshot" label="Skärmdump — Issued Certificates med Intro-intyg" />
    </div>
  );
}

function SlideBookingDiplo() {
  const sid = "booking_diplo";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 7 — KURSDELTAGARE · Slide 4</div>
        <EditableField value={getField(sid, "title", "Diplo — Bokning och bekräftelse")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
          {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
        </EditableField>
        <EditableField value={getField(sid, "subtitle", "Diplo-kursen — bokning, betalning och bekräftelse")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
          {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
        </EditableField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><CreditCard className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="booking_heading" def="Bokning och betalning" /></div>
            <EList sid={sid} fkey="booking_list" def={["Deltagaren hittar Diplo-kursen på fasciaacademy.com", "Väljer datum och fyller i kontaktuppgifter", "Betalar via Stripe (kort eller Klarna)", "Bokning bekräftad direkt efter betalning"]} />
          </div>
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><BookOpen className="h-4 w-4 text-purple-400" /><EH3 sid={sid} fkey="material_heading" def="Digitalt kursmaterial" /></div>
            <EList sid={sid} fkey="material_list" def={["Deltagaren får tillgång till digitalt kursmaterial", "Materialet innehåller kursinformation och provfrågor", "Provet skrivs i det digitala materialet under/efter kursen", "Inskickat prov hamnar i Exam Queue"]} />
          </div>
        </div>
        <div>
          <EH3 sid={sid} fkey="confirm_heading" def="Bekräftelsemail — Diplo SE (faktisk mall)" />
          <div className="mt-2">
            <EmailMock
              subject="Din bokning är bekräftad - Välkommen till Fascia Academy!"
              body={getField(sid, "confirm_email_body", `Hej {{contact.first_name}},

Din bokning är bekräftad - Välkommen till Fascia Academy!
Datum: {{appointment.formatted_start_date}}
Tid: {{appointment.start_time}}

Kursinformation – schema, tider och plats
All praktisk information om ditt kurstillfälle, inklusive tider, plats och kursledare, hittar du på hemsidan via den länk du använde vid bokning.

Inför kursdagen
Du behöver inte ta med någon egen utrustning – allt som används under kursdagen finns på plats. Vi rekommenderar bekväma kläder som möjliggör rörelse och praktiskt arbete.

Upplägg
Utbildningen består av fyra kursdagar med fokus på praktiskt behandlingsarbete. Upplägget inkluderar:
• Fyra kursdagar med fokus på manuell och maskinell fasciabehandling
• Digitalt utbildningsmaterial med teori
• Videomaterial på behandlingstekniker
• Digitalt prov

Ditt kursmaterial – FasciaVibes
Det digitala kursmaterialet ingår i kursen och finns tillgängligt direkt. Logga in eller skapa ditt konto via länken nedan:
Länk: Gå till kursmaterial – Diplomerad Fasciaspecialist

Materialet är uppdelat i:
• Modul 1 – Fasciakunskap, maskinkunskap och fascialinjer
• Praktik 1 – Introduktion (behandlingsfilmer)
• Modul 2 – Föreläsningar om kroppen, behandling och yrket som terapeut
• Modul 3 – Anatomi, scanning
• Modul 4 – Nersystemet, behandlingsschema, cervikalen
• Praktik 2
• Prov

Inför kursdagen ska du ha gått igenom Modul 1–4.
Du behåller åtkomsten till materialet via ditt konto i FasciaVibes även efter avslutad kurs.

När du aktiverat din åtkomst får du även ett direktmeddelande från Fascia Academy med mer information.

Diplom – krav för godkännande
För att erhålla diplomet krävs både godkänt deltagande och godkänt digitalt prov. Det digitala provet hittar du sist i kursmaterialet och kan göras innan eller efter ditt kurstillfälle. Provet rättas manuellt.

FasciaVibes Open
Genom ditt köp har du även tillgång till FasciaVibes Open – den kostnadsfria delen av plattformen med inspelade webbinarier, digitala kurser och övrigt material.

FasciaVibes Member
Vill du fördjupa dig och utvecklas inom fascia som yrke? Som medlem får du tillgång till forum, fördjupade resurser, digitala workshops och inspelade sessioner. 149 kr/månad, ingen bindningstid.
Länk: Bli FasciaVibes Member

Kvitto
Ditt kvitto har skickats separat från Stripe till din e-postadress.

Frågor
Kontakta gärna din kursledare direkt (telefonnummer finns i kursinformationen).
Eller maila oss på info@fasciaacademy.com

Vänliga hälsningar,
Fascia Academy
info@fasciaacademy.com`)}
            />
          </div>
          {editMode && (
            <EditableField value={getField(sid, "confirm_email_body", "")} onSave={(v) => save(sid, "confirm_email_body", v)} editMode={editMode} multiline className="mt-2">
              {() => <span className="text-[10px] text-[oklch(0.72_0.12_75)]">Klicka här för att redigera mailinnehållet ovan</span>}
            </EditableField>
          )}
        </div>
      </div>
      <EImg sid={sid} fkey="screenshot" label="Skärmdump — Diplo-kurs på fasciaacademy.com" />
    </div>
  );
}

function SlideExamDiplo() {
  const sid = "exam_diplo";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 7 — KURSDELTAGARE · Slide 5</div>
        <EditableField value={getField(sid, "title", "Diplo — Kursdag och prov")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
          {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
        </EditableField>
        <EditableField value={getField(sid, "subtitle", "Showed + prov → rättning → intyg")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
          {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
        </EditableField>
      </div>
      <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-5 border border-[oklch(0.22_0.04_255)]">
        <EH3 sid={sid} fkey="flow_heading" def="Flöde — Diplo-kurs" />
        <div className="mt-4 space-y-2">
          {[
            { n: 1, label: "Kursdag(ar)", desc: "Deltagaren genomför Diplo-kursen (1–2 dagar beroende på upplägg).", color: "text-[oklch(0.72_0.12_75)]", bg: "bg-[oklch(0.72_0.12_75)]/20" },
            { n: 2, label: "Showed markerat", desc: "Kursledaren markerar deltagaren som showed i portalen (My Courses).", color: "text-blue-400", bg: "bg-blue-500/20" },
            { n: 3, label: "Prov inskickat", desc: "Deltagaren skriver och skickar in provet via det digitala kursmaterialet.", color: "text-purple-400", bg: "bg-purple-500/20" },
            { n: 4, label: "Rättning i Exam Queue", desc: "Rättaren granskar provet och godkänner eller underkänner.", color: "text-amber-400", bg: "bg-amber-500/20" },
            { n: 5, label: "Admin utfärdar intyg", desc: "Admin ser att showed + godkänt prov finns och utfärdar intyget manuellt.", color: "text-emerald-400", bg: "bg-emerald-500/20" },
          ].map(({ n, label, desc, color, bg }) => (
            <div key={n} className="flex items-start gap-3">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border", bg, color, "border-current/30")}>{n}</div>
              <div>
                <div className={cn("text-xs font-semibold", color)}>{label}</div>
                <div className="text-xs text-muted-foreground leading-snug">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <EH3 sid={sid} fkey="underkand_heading" def="Om provet underkänns" />
              <EditableField value={getField(sid, "underkand_body", "Deltagaren kan skriva om provet. Admin och kursledare kommunicerar med deltagaren direkt — inga automail skickas från portalen.")} onSave={(v) => save(sid, "underkand_body", v)} editMode={editMode} multiline className="mt-1">
                {(v) => <p className="text-xs text-amber-200/80 mt-1">{v}</p>}
              </EditableField>
            </div>
          </div>
        </div>
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <div className="flex items-center gap-2 mb-2"><GraduationCap className="h-4 w-4 text-emerald-400" /><EH3 sid={sid} fkey="cert_heading" def="Intyg (Diplo)" /></div>
          <EList sid={sid} fkey="cert_list" def={["Kräver showed + godkänt prov", "Admin utfärdar intyget manuellt", "Intyget visas i Issued Certificates", "Deltagaren kan verifiera intyget via unik länk"]} />
        </div>
      </div>
      <EImg sid={sid} fkey="screenshot" label="Skärmdump — Exam Queue med Diplo-prov" />
    </div>
  );
}

function SlideSummary() {
  const sid = "student_summary";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 7 — KURSDELTAGARE · Slide 6</div>
        <EditableField value={getField(sid, "title", "Sammanfattning — Deltagarens resa")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
          {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
        </EditableField>
        <EditableField value={getField(sid, "subtitle", "Hela flödet i korthet")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
          {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
        </EditableField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-[oklch(0.72_0.12_75)]" />
            <EH3 sid={sid} fkey="intro_heading" def="Intro / Vidareutbildning" />
          </div>
          <div className="space-y-1.5">
            {["Bokar på fasciaacademy.com", "Betalar via Stripe", "Bekräftelsemail + påminnelse 7 dagar", "Genomför kurs", "Showed markerat av kursledare", "Admin utfärdar intyg"].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[oklch(0.72_0.12_75)]/20 border border-[oklch(0.72_0.12_75)]/40 flex items-center justify-center text-[9px] font-bold text-[oklch(0.72_0.12_75)]">{i + 1}</div>
                <span className="text-xs text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="h-4 w-4 text-purple-400" />
            <EH3 sid={sid} fkey="diplo_heading" def="Diplo / Cert" />
          </div>
          <div className="space-y-1.5">
            {["Bokar på fasciaacademy.com", "Betalar via Stripe", "Bekräftelsemail + påminnelse 7 dagar", "Genomför kurs + skriver prov i digitalt material", "Showed markerat av kursledare", "Rättare godkänner prov i Exam Queue", "Admin utfärdar intyg"].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-[9px] font-bold text-purple-400">{i + 1}</div>
                <span className="text-xs text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
        <EH3 sid={sid} fkey="next_heading" def="Guiden är nu komplett" />
        <EditableField value={getField(sid, "next_body", "Del 1–7 täcker hela Fascia Academy-systemet: kursledarresan, portalen (kursledare, admin, affiliate, rättare), kursregistrering och genomförande, samt deltagarens resa från bokning till intyg. Alla delar är redigerbara direkt i portalen.")} onSave={(v) => save(sid, "next_body", v)} editMode={editMode} multiline className="mt-1">
          {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
        </EditableField>
      </div>
    </div>
  );
}

const SLIDES = [
  { id: "student_overview", label: "Översikt", component: <SlideOverview /> },
  { id: "booking_intro", label: "Intro — Bokning", component: <SlideBookingIntro /> },
  { id: "reminder_intro", label: "Intro — Kursdag", component: <SlideReminderIntro /> },
  { id: "booking_diplo", label: "Diplo — Bokning", component: <SlideBookingDiplo /> },
  { id: "exam_diplo", label: "Diplo — Prov", component: <SlideExamDiplo /> },
  { id: "student_summary", label: "Sammanfattning", component: <SlideSummary /> },
];

export default function Del7Student() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const utils = trpc.useUtils();

  const { data: contentMap = {} } = trpc.guide.getContent.useQuery({ presentationId: PRES_ID });
  const upsert = trpc.guide.upsertContent.useMutation({
    onSuccess: () => { void utils.guide.getContent.invalidate({ presentationId: PRES_ID }); },
  });

  const getField = useCallback((slideId: string, fieldKey: string, defaultVal: string): string => {
    return (contentMap as Record<string, string>)[`${slideId}__${fieldKey}`] ?? defaultVal;
  }, [contentMap]);

  const getList = useCallback((slideId: string, fieldKey: string, defaultItems: string[]): string[] => {
    const raw = (contentMap as Record<string, string>)[`${slideId}__${fieldKey}`];
    if (!raw) return defaultItems;
    try { return JSON.parse(raw) as string[]; } catch { return defaultItems; }
  }, [contentMap]);

  const save = useCallback(async (slideId: string, fieldKey: string, value: string) => {
    utils.guide.getContent.setData({ presentationId: PRES_ID }, (old) => ({ ...(old ?? {}), [`${slideId}__${fieldKey}`]: value }));
    await upsert.mutateAsync({ presentationId: PRES_ID, slideId, fieldKey, content: value });
  }, [upsert, utils]);

  const saveList = useCallback(async (slideId: string, fieldKey: string, items: string[]) => {
    const value = JSON.stringify(items);
    utils.guide.getContent.setData({ presentationId: PRES_ID }, (old) => ({ ...(old ?? {}), [`${slideId}__${fieldKey}`]: value }));
    await upsert.mutateAsync({ presentationId: PRES_ID, slideId, fieldKey, content: value });
  }, [upsert, utils]);

  return (
    <EditContext.Provider value={{ editMode, save, saveList, getField, getList }}>
      <div className="min-h-screen bg-[oklch(0.14_0.04_255)] flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-[oklch(0.22_0.04_255)] bg-[oklch(0.17_0.04_255)] shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/guide">
              <button className="flex items-center gap-1.5 text-xs text-[oklch(0.55_0.03_250)] hover:text-white transition-colors">
                <ChevronLeft className="h-3.5 w-3.5" />Guide
              </button>
            </Link>
            <span className="text-[oklch(0.35_0.04_255)]">/</span>
            <span className="text-xs text-[oklch(0.65_0.03_250)]">Del 7 — Kursdeltagare</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setEditMode((v) => !v)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border", editMode ? "bg-[oklch(0.72_0.12_75)] text-[oklch(0.17_0.04_255)] border-[oklch(0.72_0.12_75)]" : "bg-transparent text-[oklch(0.65_0.03_250)] border-[oklch(0.28_0.04_255)] hover:border-[oklch(0.72_0.12_75)] hover:text-[oklch(0.72_0.12_75)]")}>
              {editMode ? <PencilOff className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {editMode ? "Avsluta redigering" : "Redigera"}
            </button>
            <span className="text-xs text-[oklch(0.50_0.03_250)]">{currentSlide + 1} / {SLIDES.length}</span>
          </div>
        </div>
        {editMode && (
          <div className="bg-[oklch(0.72_0.12_75)]/10 border-b border-[oklch(0.72_0.12_75)]/30 px-6 py-2 text-xs text-[oklch(0.72_0.12_75)] flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5" />Redigeringsläge aktivt — klicka på text för att redigera. Ändringar sparas automatiskt.
          </div>
        )}
        <div className="flex gap-1 px-6 pt-4 overflow-x-auto">
          {SLIDES.map((s, i) => (
            <button key={s.id} onClick={() => setCurrentSlide(i)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0", i === currentSlide ? "bg-[oklch(0.72_0.12_75)] text-[oklch(0.13_0.04_255)]" : "text-[oklch(0.55_0.03_250)] hover:text-white")}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex-1 px-6 py-6 max-w-6xl w-full mx-auto">
          {SLIDES[currentSlide].component}
        </div>
        <div className="flex items-center justify-center gap-4 py-4 border-t border-[oklch(0.22_0.04_255)]">
          <button onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0} className="p-1.5 rounded-full hover:bg-[oklch(0.22_0.04_255)] disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-4 w-4 text-[oklch(0.55_0.03_250)]" />
          </button>
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => setCurrentSlide(i)} className={cn("rounded-full transition-all", i === currentSlide ? "w-5 h-2 bg-[oklch(0.72_0.12_75)]" : "w-2 h-2 bg-[oklch(0.35_0.04_255)] hover:bg-[oklch(0.55_0.03_250)]")} />
            ))}
          </div>
          <button onClick={() => setCurrentSlide(Math.min(SLIDES.length - 1, currentSlide + 1))} disabled={currentSlide === SLIDES.length - 1} className="p-1.5 rounded-full hover:bg-[oklch(0.22_0.04_255)] disabled:opacity-30 transition-colors">
            <ChevronRight className="h-4 w-4 text-[oklch(0.55_0.03_250)]" />
          </button>
          {currentSlide < SLIDES.length - 1 && (
            <button onClick={() => setCurrentSlide(currentSlide + 1)} className="px-3 py-1 bg-[oklch(0.72_0.12_75)] text-[oklch(0.13_0.04_255)] rounded-full text-xs font-semibold hover:opacity-90 transition-opacity">
              Nästa →
            </button>
          )}
        </div>
      </div>
    </EditContext.Provider>
  );
}
