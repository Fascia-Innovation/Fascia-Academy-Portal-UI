/**
 * Del 3 — Kursregistrering och genomförande
 * Interactive guide presentation for Fascia Academy admins.
 * 7 slides covering the full course registration and execution flow.
 * All text/lists/images are editable by admins in edit mode.
 */
import { useState, createContext, useContext, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  PencilOff,
  BookOpen,
  FileText,
  CheckCircle2,
  AlertCircle,
  Info,
  Calendar,
  Users,
  ClipboardList,
  Tag,
  ArrowRight,
  Clock,
  MapPin,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { EditableField } from "@/components/guide/EditableField";
import { EditableList } from "@/components/guide/EditableList";
import { EditableImage } from "@/components/guide/EditableImage";

// ─── Presentation ID ──────────────────────────────────────────────────────────
const PRES_ID = "del3";

// ─── Edit context ─────────────────────────────────────────────────────────────
type EditCtx = {
  editMode: boolean;
  contentMap: Record<string, string>;
  getField: (sid: string, key: string, def: string) => string;
  getList: (sid: string, key: string, def: string[]) => string[];
  save: (sid: string, key: string, val: string) => Promise<void>;
  saveList: (sid: string, key: string, items: string[]) => Promise<void>;
};
const EditContext = createContext<EditCtx>({
  editMode: false,
  contentMap: {},
  getField: (_s, _k, d) => d,
  getList: (_s, _k, d) => d,
  save: async () => {},
  saveList: async () => {},
});
const useEdit = () => useContext(EditContext);

// ─── Reusable sub-components ──────────────────────────────────────────────────
function EH3({ sid, fkey, def }: { sid: string; fkey: string; def: string }) {
  const { editMode, getField, save } = useEdit();
  const val = getField(sid, fkey, def);
  return (
    <EditableField value={val} onSave={(v) => save(sid, fkey, v)} editMode={editMode} className="block">
      {(v) => <h3 className="text-base font-semibold text-white">{v}</h3>}
    </EditableField>
  );
}

function EImg({ sid, fkey, alt, label }: { sid: string; fkey: string; alt: string; label: string }) {
  const { editMode, getField, save } = useEdit();
  const src = getField(sid, fkey, "") || null;
  return (
    <EditableImage
      presentationId={PRES_ID}
      slideId={sid}
      fieldKey={fkey}
      src={src}
      alt={alt}
      onSave={(url) => save(sid, fkey, url)}
      editMode={editMode}
      className="w-full rounded-xl overflow-hidden border border-[oklch(0.28_0.04_255)]"
      imgClassName="w-full h-full object-contain rounded-xl"
      placeholder={
        <div className="w-full h-44 flex flex-col items-center justify-center rounded-xl bg-[oklch(0.20_0.04_255)] border-2 border-dashed border-[oklch(0.30_0.04_255)] gap-2">
          <div className="w-8 h-8 rounded-full bg-[oklch(0.72_0.12_75)]/10 flex items-center justify-center">
            <svg className="h-4 w-4 text-[oklch(0.45_0.03_250)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-xs text-[oklch(0.45_0.03_250)] text-center px-4">{label}</p>
          {editMode && <p className="text-[10px] text-[oklch(0.72_0.12_75)]">↑ Klicka för att ladda upp</p>}
        </div>
      }
    />
  );
}

// ─── Slide 1: Overview ────────────────────────────────────────────────────────
function SlideOverview() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "overview";
  const intro = getField(sid, "intro_text",
    "Del 3 täcker hela flödet från att kursledaren registrerar ett kurstillfälle i portalen till att kursen är genomförd och deltagarna är markerade."
  );
  const steps = getList(sid, "flow_steps", [
    "1. Kursledaren registrerar kurstillfälle i portalen (My Courses)",
    "2. Admin granskar och godkänner i Pending Actions",
    "3. Kursen publiceras på fasciaacademy.com",
    "4. Admin skapar tillgänglighet för startdatum i HL",
    "5. Deltagare bokar och betalas via FasciaVibes",
    "6. Kursledaren markerar showed efter genomförd kurs",
    "7. Avräkning genereras och kursledaren fakturerar FA",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="left_heading" def="Flödesöversikt — Del 3" />
          <EditableField value={intro} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline>
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <EH3 sid={sid} fkey="steps_heading" def="Steg-för-steg" />
            <EditableList items={steps} onSave={(items) => saveList(sid, "flow_steps", items)} editMode={editMode}>
              {(items) => (
                <ol className="space-y-2 mt-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[oklch(0.75_0.03_250)]">
                      <div className="w-5 h-5 rounded-full bg-[oklch(0.72_0.12_75)]/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-[oklch(0.72_0.12_75)]">{i + 1}</span>
                      </div>
                      {item.replace(/^\d+\.\s/, "")}
                    </li>
                  ))}
                </ol>
              )}
            </EditableList>
          </div>
        </div>
        <div className="space-y-4">
          <EH3 sid={sid} fkey="right_heading" def="Ansvar per roll" />
          <div className="space-y-2">
            {[
              { role: "Kursledare", color: "oklch(0.72_0.12_75)", tasks: ["Registrerar kurstillfälle", "Markerar showed", "Fakturerar FA"] },
              { role: "FA-Admin", color: "oklch(0.65_0.15_200)", tasks: ["Granskar och godkänner", "Skapar HL-tillgänglighet", "Genererar avräkning"] },
              { role: "Deltagare", color: "oklch(0.65_0.12_130)", tasks: ["Bokar via fasciaacademy.com", "Betalar via FasciaVibes", "Genomför kursen"] },
            ].map((r, i) => (
              <div key={i} className="bg-[oklch(0.20_0.04_255)] rounded-xl p-3 border border-[oklch(0.28_0.04_255)]">
                <div className="text-xs font-semibold mb-1.5" style={{ color: `oklch(${r.color.replace("oklch(", "").replace(")", "")})` }}>{r.role}</div>
                <div className="flex flex-wrap gap-1.5">
                  {r.tasks.map((t, j) => (
                    <span key={j} className="text-xs bg-[oklch(0.25_0.04_255)] text-[oklch(0.75_0.03_250)] rounded-full px-2 py-0.5">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs text-[oklch(0.50_0.03_250)] mb-2">Skärmdump — My Courses (kursledarens vy)</p>
            <EImg sid={sid} fkey="overview_screenshot" alt="My Courses overview" label="Skärmdump från portalen — My Courses startsida" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide 2: Register Course Form ───────────────────────────────────────────
function SlideRegisterForm() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "register_form";
  const intro = getField(sid, "intro_text",
    "Kursledaren registrerar kurstillfällen direkt i portalen under My Courses. Formuläret skickas till admin för granskning."
  );
  const formFields = getList(sid, "form_fields", [
    "Kalender — välj rätt kalender för kurstypen",
    "Startdatum, starttid och sluttid dag 1",
    "Eventuella extradagar",
    "Övrig bokningsinfo utöver mall",
    "Eventuell kommentar till admin",
    "Namn på lokalen",
    "Adress, kurstyp, kontaktuppgifter kursledare, max deltagare hämtas automatiskt från kalendern",
  ]);
  const courseTypes = getList(sid, "course_types", [
    "Intro — Introduktionskurs: Fascia by Fascia Academy",
    "Diplo — Diplomerad Fasciaspecialist: by Fascia Academy",
    "Cert — Certifierad Fasciaspecialist: by Fascia Academy",
    "Videre — Viderekurs (avancerad)",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="left_heading" def="Register New Course — formuläret" />
          <EditableField value={intro} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline>
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <EH3 sid={sid} fkey="fields_heading" def="Fält i formuläret" />
            <EditableList items={formFields} onSave={(items) => saveList(sid, "form_fields", items)} editMode={editMode}>
              {(items) => (
                <ul className="space-y-1.5 mt-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[oklch(0.75_0.03_250)]">
                      <ClipboardList className="h-4 w-4 text-[oklch(0.72_0.12_75)] shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </EditableList>
          </div>
        </div>
        <div className="space-y-4">
          <EH3 sid={sid} fkey="types_heading" def="Kurstyper (Course Types)" />
          <EditableList items={courseTypes} onSave={(items) => saveList(sid, "course_types", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-2">
                {items.map((item, i) => {
                  const [type, ...rest] = item.split(" — ");
                  return (
                    <div key={i} className="flex items-center gap-3 bg-[oklch(0.20_0.04_255)] rounded-lg px-3 py-2 border border-[oklch(0.28_0.04_255)]">
                      <span className="text-xs font-bold text-[oklch(0.72_0.12_75)] w-10 shrink-0">{type}</span>
                      <span className="text-sm text-[oklch(0.75_0.03_250)]">{rest.join(" — ")}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </EditableList>
          <div className="bg-[oklch(0.18_0.04_255)] rounded-xl p-3 border border-amber-500/30">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <EditableField
                value={getField(sid, "note_text", "Kursledaren ansvarar för att registrera sina egna kurser. Admin behöver inte längre fylla i ett separat registreringsformulär — detta sparar tid för FA-teamet.")}
                onSave={(v) => save(sid, "note_text", v)}
                editMode={editMode}
                multiline
              >
                {(v) => <p className="text-xs text-amber-300 leading-relaxed">{v}</p>}
              </EditableField>
            </div>
          </div>
          <div>
            <p className="text-xs text-[oklch(0.50_0.03_250)] mb-2">Skärmdump — Register New Course</p>
            <EImg sid={sid} fkey="register_form_screenshot" alt="Register Course form" label="Skärmdump från portalen — Register New Course formuläret" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide 3: Admin Approval (Pending Actions) ────────────────────────────────
function SlideAdminApproval() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "admin_approval";
  const intro = getField(sid, "intro_text",
    "När kursledaren skickat in kursregistreringen hamnar den i Pending Actions i adminvyn. Admin granskar och godkänner eller begär komplettering."
  );
  const adminSteps = getList(sid, "admin_steps", [
    "Kursregistrering visas i Pending Actions med status Pending",
    "Admin granskar datum, plats, kurstyp och kommentar",
    "Godkänn — kursen publiceras på fasciaacademy.com",
    "Begär komplettering — kursledaren notifieras och kan uppdatera",
    "Admin skapar tillgänglighet för startdatum i HL (Dashboard)",
    "Kursledaren notifieras om godkännande via Notifications",
  ]);
  const hlSteps = getList(sid, "hl_steps", [
    "Öppna HL Dashboard → Calendars",
    "Hitta rätt kalender för kurstypen",
    "Lägg till tillgänglighet för kursens startdatum",
    "Bekräfta att bokningslänken fungerar på fasciaacademy.com",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="left_heading" def="Pending Actions — admin granskar" />
          <EditableField value={intro} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline>
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <EH3 sid={sid} fkey="steps_heading" def="Admin-flöde i portalen" />
            <EditableList items={adminSteps} onSave={(items) => saveList(sid, "admin_steps", items)} editMode={editMode}>
              {(items) => (
                <ol className="space-y-2 mt-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[oklch(0.75_0.03_250)]">
                      <div className="w-5 h-5 rounded-full bg-[oklch(0.72_0.12_75)] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-[oklch(0.14_0.04_255)]">{i + 1}</span>
                      </div>
                      {item}
                    </li>
                  ))}
                </ol>
              )}
            </EditableList>
          </div>
        </div>
        <div className="space-y-4">
          <EH3 sid={sid} fkey="hl_heading" def="Skapa tillgänglighet i HL" />
          <EditableList items={hlSteps} onSave={(items) => saveList(sid, "hl_steps", items)} editMode={editMode}>
            {(items) => (
              <ol className="space-y-2">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 bg-[oklch(0.20_0.04_255)] rounded-lg px-3 py-2 border border-[oklch(0.28_0.04_255)] text-sm text-[oklch(0.75_0.03_250)]">
                    <div className="w-5 h-5 rounded-full bg-[oklch(0.65_0.15_200)]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-[oklch(0.65_0.15_200)]">{i + 1}</span>
                    </div>
                    {item}
                  </li>
                ))}
              </ol>
            )}
          </EditableList>
          <div className="bg-[oklch(0.18_0.04_255)] rounded-xl p-3 border border-[oklch(0.65_0.15_200)]/30">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-[oklch(0.65_0.15_200)] shrink-0 mt-0.5" />
              <EditableField
                value={getField(sid, "hl_note", "HL (GoHighLevel) kallas alltid 'Dashboard' internt. Portalen och Dashboard är två separata system — portalen är FA:s egna, Dashboard är HL.")}
                onSave={(v) => save(sid, "hl_note", v)}
                editMode={editMode}
                multiline
              >
                {(v) => <p className="text-xs text-[oklch(0.65_0.15_200)] leading-relaxed">{v}</p>}
              </EditableField>
            </div>
          </div>
          <div>
            <p className="text-xs text-[oklch(0.50_0.03_250)] mb-2">Skärmdump — Pending Actions</p>
            <EImg sid={sid} fkey="pending_actions_screenshot" alt="Pending Actions" label="Skärmdump från portalen — Pending Actions (admin)" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide 4: Participant List ────────────────────────────────────────────────
function SlideParticipants() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "participants";
  const intro = getField(sid, "intro_text",
    "När kursen är godkänd och publicerad börjar deltagare boka via fasciaacademy.com. Kursledaren ser deltagarlistan direkt i portalen under My Courses."
  );
  const listInfo = getList(sid, "list_info", [
    "Deltagarlistan uppdateras automatiskt när deltagare bokar",
    "Varje deltagare visas med namn, e-post och betalningsstatus",
    "Kursledaren kan se antal bokade vs. max deltagare",
    "Avbokningar visas med status Cancellation requested",
    "Kursledaren kan skicka meddelanden till deltagare i portalen",
    "Om en deltagare bokar hos flera kursledare syns de på respektive lista",
  ]);
  const statusBadges = getList(sid, "status_badges", [
    "Approved — bekräftad bokning och betalning",
    "Pending — bokning inväntar bekräftelse",
    "Cancellation requested — deltagaren har begärt avbokning",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="left_heading" def="Deltagarlistan — My Courses" />
          <EditableField value={intro} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline>
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <EH3 sid={sid} fkey="list_heading" def="Information i deltagarlistan" />
            <EditableList items={listInfo} onSave={(items) => saveList(sid, "list_info", items)} editMode={editMode}>
              {(items) => (
                <ul className="space-y-1.5 mt-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[oklch(0.75_0.03_250)]">
                      <Users className="h-4 w-4 text-[oklch(0.72_0.12_75)] shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </EditableList>
          </div>
        </div>
        <div className="space-y-4">
          <EH3 sid={sid} fkey="status_heading" def="Bokningsstatus" />
          <EditableList items={statusBadges} onSave={(items) => saveList(sid, "status_badges", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-2">
                {items.map((item, i) => {
                  const [status, ...rest] = item.split(" — ");
                  const colors = [
                    { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
                    { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
                    { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
                  ];
                  const c = colors[i % colors.length];
                  return (
                    <div key={i} className={`flex items-start gap-3 rounded-lg px-3 py-2 border bg-[oklch(0.20_0.04_255)] border-[oklch(0.28_0.04_255)]`}>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border} shrink-0 mt-0.5`}>{status}</span>
                      <span className="text-sm text-[oklch(0.75_0.03_250)]">{rest.join(" — ")}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </EditableList>
          <div className="bg-[oklch(0.18_0.04_255)] rounded-xl p-3 border border-[oklch(0.72_0.12_75)]/20">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-[oklch(0.72_0.12_75)] shrink-0 mt-0.5" />
              <EditableField
                value={getField(sid, "spots_note", "Tillgängliga platser visas som '20/20 spots left' (kvarvarande platser), inte antal bokade. Alla kurser av samma kursledare har samma deltagartak.")}
                onSave={(v) => save(sid, "spots_note", v)}
                editMode={editMode}
                multiline
              >
                {(v) => <p className="text-xs text-[oklch(0.72_0.12_75)] leading-relaxed">{v}</p>}
              </EditableField>
            </div>
          </div>
          <div>
            <p className="text-xs text-[oklch(0.50_0.03_250)] mb-2">Skärmdump — deltagarlistan</p>
            <EImg sid={sid} fkey="participants_screenshot" alt="Deltagarlista" label="Skärmdump från portalen — deltagarlistan i My Courses" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide 5: Showed Marking ──────────────────────────────────────────────────
function SlideShowed() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "showed";
  const intro = getField(sid, "intro_text",
    "Efter att kursen är genomförd markerar kursledaren vilka deltagare som dök upp (showed). Detta triggar automatiken i HL-pipelinen."
  );
  const showedSteps = getList(sid, "showed_steps", [
    "Öppna kursen i My Courses efter genomförd kursdag",
    "Gå till deltagarlistan för kurstillfället",
    "Markera varje deltagare som 'Showed' eller 'No-show'",
    "Bekräfta — systemet triggar automatisk tagg i HL",
    "Avräkningsunderlaget uppdateras baserat på showed-deltagare",
  ]);
  const pipelineTags = getList(sid, "pipeline_tags", [
    "Intro: Tagg 'Intro CF – Completed' (triggas av kursledare)",
    "Diplo: Tagg 'Diplo/Quali FS - Complete' (triggas av kursledare)",
    "Cert: Tagg 'Cert FS - Complete' (triggas av kursledare)",
    "Videre: Tagg 'Vidare/advance FS - Complete' (triggas av kursledare)",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="left_heading" def="Markera showed — efter kursen" />
          <EditableField value={intro} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline>
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <EH3 sid={sid} fkey="steps_heading" def="Steg för kursledaren" />
            <EditableList items={showedSteps} onSave={(items) => saveList(sid, "showed_steps", items)} editMode={editMode}>
              {(items) => (
                <ol className="space-y-2 mt-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[oklch(0.75_0.03_250)]">
                      <div className="w-5 h-5 rounded-full bg-[oklch(0.72_0.12_75)] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-[oklch(0.14_0.04_255)]">{i + 1}</span>
                      </div>
                      {item}
                    </li>
                  ))}
                </ol>
              )}
            </EditableList>
          </div>
        </div>
        <div className="space-y-4">
          <EH3 sid={sid} fkey="tags_heading" def="HL Pipeline-taggar per kurstyp" />
          <EditableList items={pipelineTags} onSave={(items) => saveList(sid, "pipeline_tags", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-2">
                {items.map((item, i) => {
                  const [type, ...rest] = item.split(": ");
                  return (
                    <div key={i} className="flex items-start gap-3 bg-[oklch(0.20_0.04_255)] rounded-lg px-3 py-2 border border-[oklch(0.28_0.04_255)]">
                      <Tag className="h-4 w-4 text-[oklch(0.72_0.12_75)] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-[oklch(0.72_0.12_75)]">{type}: </span>
                        <span className="text-sm text-[oklch(0.75_0.03_250)]">{rest.join(": ")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </EditableList>
          <div className="bg-[oklch(0.18_0.04_255)] rounded-xl p-3 border border-amber-500/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <EditableField
                value={getField(sid, "showed_note", "Taggar är språkoberoende och ska inte ändras. De triggar automatik i HL-pipelinen. Deltagare flyttas till nästa steg först när de bokat nästa kurs — ingen automatisk progression.")}
                onSave={(v) => save(sid, "showed_note", v)}
                editMode={editMode}
                multiline
              >
                {(v) => <p className="text-xs text-amber-300 leading-relaxed">{v}</p>}
              </EditableField>
            </div>
          </div>
          <div>
            <p className="text-xs text-[oklch(0.50_0.03_250)] mb-2">Skärmdump — markera showed</p>
            <EImg sid={sid} fkey="showed_screenshot" alt="Showed marking" label="Skärmdump från portalen — markera showed i deltagarlistan" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide 6: Settlement & Invoice ───────────────────────────────────────────
function SlideSettlement() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "settlement";
  const intro = getField(sid, "intro_text",
    "Avräkning genereras månadsvis baserat på genomförda kurser och showed-deltagare. Kursledaren fakturerar FA med 20 dagars betalningsvillkor."
  );
  const settlementFlow = getList(sid, "settlement_flow", [
    "FA genererar avräkningsunderlag per kursledare månadsvis",
    "Kursledaren ser underlaget i My Settlements i portalen",
    "Kursledaren laddar ner PDF-underlaget",
    "Kursledaren skickar faktura till FA baserat på underlaget",
    "Betalningsvillkor: 20 dagar",
    "FA bekräftar och betalar ut",
  ]);
  const settlementCols = getList(sid, "settlement_cols", [
    "Kurs — typ och datum",
    "Antal deltagare — bekräftade showed",
    "Kursintäkt — totalt inkasserat belopp",
    "FA-andel — plattformsavgift",
    "Kursledarens andel — utbetalningsbelopp",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="left_heading" def="Avräkning och fakturering" />
          <EditableField value={intro} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline>
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <EH3 sid={sid} fkey="flow_heading" def="Avräkningsflöde" />
            <EditableList items={settlementFlow} onSave={(items) => saveList(sid, "settlement_flow", items)} editMode={editMode}>
              {(items) => (
                <ol className="space-y-2 mt-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[oklch(0.75_0.03_250)]">
                      <div className="w-5 h-5 rounded-full bg-[oklch(0.72_0.12_75)]/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-[oklch(0.72_0.12_75)]">{i + 1}</span>
                      </div>
                      {item}
                    </li>
                  ))}
                </ol>
              )}
            </EditableList>
          </div>
        </div>
        <div className="space-y-4">
          <EH3 sid={sid} fkey="cols_heading" def="Kolumner i avräkningstabellen" />
          <EditableList items={settlementCols} onSave={(items) => saveList(sid, "settlement_cols", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-1.5">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[oklch(0.20_0.04_255)] rounded-lg px-3 py-2 border border-[oklch(0.28_0.04_255)]">
                    <FileText className="h-3.5 w-3.5 text-[oklch(0.72_0.12_75)] shrink-0" />
                    <span className="text-sm text-[oklch(0.80_0.03_250)]">{item}</span>
                  </div>
                ))}
              </div>
            )}
          </EditableList>
          <div className="bg-[oklch(0.18_0.04_255)] rounded-xl p-3 border border-[oklch(0.72_0.12_75)]/30">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-[oklch(0.72_0.12_75)] shrink-0 mt-0.5" />
              <EditableField
                value={getField(sid, "invoice_note", "Kursledaren fakturerar FA — inte tvärtom. Avräkningsunderlaget är ett underlag, inte en faktura. Kursledaren skapar och skickar sin egen faktura baserat på underlaget.")}
                onSave={(v) => save(sid, "invoice_note", v)}
                editMode={editMode}
                multiline
              >
                {(v) => <p className="text-xs text-[oklch(0.72_0.12_75)] leading-relaxed">{v}</p>}
              </EditableField>
            </div>
          </div>
          <div>
            <p className="text-xs text-[oklch(0.50_0.03_250)] mb-2">Skärmdump — My Settlements</p>
            <EImg sid={sid} fkey="settlement_screenshot" alt="My Settlements" label="Skärmdump från portalen — My Settlements" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide 7: Summary ─────────────────────────────────────────────────────────
function SlideSummary() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "summary";
  const summaryPoints = getList(sid, "summary_points", [
    "Kursledaren registrerar kurstillfälle i portalen (My Courses)",
    "Admin godkänner i Pending Actions och skapar HL-tillgänglighet",
    "Deltagare bokar via fasciaacademy.com — listan uppdateras automatiskt",
    "Kursledaren markerar showed efter genomförd kurs",
    "Taggar i HL triggas automatiskt per kurstyp (Intro/Diplo/Cert/Videre)",
    "Avräkning genereras månadsvis — kursledaren fakturerar FA (20 dagar)",
  ]);
  const nextSteps = getList(sid, "next_steps", [
    "Del 4: Portalen — Admin (Pending Actions, Settlements, User Management)",
    "Del 5: Portalen — Affiliate (provisioner och avräkningar)",
    "Del 6: Portalen — Rättare / Exam Queue",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="summary_heading" def="Sammanfattning — Del 3" />
          <EditableList items={summaryPoints} onSave={(items) => saveList(sid, "summary_points", items)} editMode={editMode}>
            {(items) => (
              <ul className="space-y-2">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[oklch(0.75_0.03_250)]">
                    <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.12_75)] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </EditableList>
        </div>
        <div className="space-y-4">
          <EH3 sid={sid} fkey="next_heading" def="Kommande delar i guiden" />
          <EditableList items={nextSteps} onSave={(items) => saveList(sid, "next_steps", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[oklch(0.20_0.04_255)] rounded-xl p-3 border border-[oklch(0.28_0.04_255)]">
                    <div className="w-6 h-6 rounded-full bg-[oklch(0.72_0.12_75)]/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[oklch(0.72_0.12_75)]">{i + 4}</span>
                    </div>
                    <span className="text-sm text-[oklch(0.80_0.03_250)]">{item}</span>
                  </div>
                ))}
              </div>
            )}
          </EditableList>
          <div className="bg-[oklch(0.18_0.04_255)] rounded-xl p-4 border border-[oklch(0.72_0.12_75)]/30 space-y-2">
            <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-wider">Kontakt</div>
            <EditableField
              value={getField(sid, "contact_text", "Frågor om kursregistrering eller avräkning? Kontakta FA-teamet på info@fasciaacademy.com")}
              onSave={(v) => save(sid, "contact_text", v)}
              editMode={editMode}
              multiline
            >
              {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)]">{v}</p>}
            </EditableField>
            <a href="mailto:info@fasciaacademy.com" className="inline-flex items-center gap-1 text-xs text-[oklch(0.72_0.12_75)] hover:underline">
              <ArrowRight className="h-3 w-3" /> info@fasciaacademy.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide registry ───────────────────────────────────────────────────────────
const SLIDES = [
  { id: "overview", label: "Flödesöversikt", component: SlideOverview },
  { id: "register_form", label: "Register Course", component: SlideRegisterForm },
  { id: "admin_approval", label: "Pending Actions", component: SlideAdminApproval },
  { id: "participants", label: "Deltagarlistan", component: SlideParticipants },
  { id: "showed", label: "Showed", component: SlideShowed },
  { id: "settlement", label: "Avräkning", component: SlideSettlement },
  { id: "summary", label: "Sammanfattning", component: SlideSummary },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function Del3CourseExecution() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editMode, setEditMode] = useState(false);

  const { data: rawContent } = trpc.guide.getContent.useQuery({ presentationId: PRES_ID });
  const contentMap: Record<string, string> = rawContent ?? {};

  const utils = trpc.useUtils();
  const upsert = trpc.guide.upsertContent.useMutation({
    onSuccess: () => {
      utils.guide.getContent.invalidate({ presentationId: PRES_ID });
    },
  });

  const getField = useCallback(
    (sid: string, key: string, def: string) => contentMap[`${sid}__${key}`] ?? def,
    [contentMap]
  );

  const getList = useCallback(
    (sid: string, key: string, def: string[]): string[] => {
      const raw = contentMap[`${sid}__${key}`];
      if (!raw) return def;
      try { return JSON.parse(raw); } catch { return def; }
    },
    [contentMap]
  );

  const save = useCallback(
    async (sid: string, key: string, val: string) => {
      utils.guide.getContent.setData(
        { presentationId: PRES_ID },
        (old) => ({ ...(old ?? {}), [`${sid}__${key}`]: val })
      );
      await upsert.mutateAsync({ presentationId: PRES_ID, slideId: sid, fieldKey: key, content: val });
    },
    [utils, upsert]
  );

  const saveList = useCallback(
    async (sid: string, key: string, items: string[]) => {
      const val = JSON.stringify(items);
      utils.guide.getContent.setData(
        { presentationId: PRES_ID },
        (old) => ({ ...(old ?? {}), [`${sid}__${key}`]: val })
      );
      await upsert.mutateAsync({ presentationId: PRES_ID, slideId: sid, fieldKey: key, content: val });
    },
    [utils, upsert]
  );

  const slide = SLIDES[currentSlide];
  const SlideComponent = slide.component;

  return (
    <EditContext.Provider value={{ editMode, contentMap, getField, getList, save, saveList }}>
      <div className="min-h-screen bg-[oklch(0.14_0.04_255)] text-white">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-[oklch(0.16_0.04_255)] border-b border-[oklch(0.22_0.04_255)] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-wider">Del 3 — Kursregistrering</span>
            <span className="text-[oklch(0.40_0.03_250)]">·</span>
            <span className="text-xs text-[oklch(0.55_0.03_250)]">Slide {currentSlide + 1} av {SLIDES.length}</span>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setEditMode(!editMode)}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors",
                  editMode
                    ? "bg-[oklch(0.72_0.12_75)]/20 border-[oklch(0.72_0.12_75)]/50 text-[oklch(0.72_0.12_75)]"
                    : "bg-[oklch(0.20_0.04_255)] border-[oklch(0.28_0.04_255)] text-[oklch(0.55_0.03_250)] hover:text-white"
                )}
              >
                {editMode ? <PencilOff className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                {editMode ? "Avsluta redigering" : "Redigera"}
              </button>
            )}
            <a href="/guide" className="text-xs text-[oklch(0.55_0.03_250)] hover:text-white transition-colors">← Guide</a>
          </div>
        </div>

        {editMode && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 text-xs text-amber-300 flex items-center gap-2">
            <Pencil className="h-3 w-3" />
            Redigeringsläge aktivt — klicka på text för att redigera. Ändringar sparas automatiskt.
          </div>
        )}

        {/* Slide tabs */}
        <div className="border-b border-[oklch(0.22_0.04_255)] px-6 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  "px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                  i === currentSlide
                    ? "border-[oklch(0.72_0.12_75)] text-[oklch(0.72_0.12_75)]"
                    : "border-transparent text-[oklch(0.50_0.03_250)] hover:text-white"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Slide content */}
        <div className="px-8 py-8 max-w-6xl mx-auto">
          <div className="mb-6">
            <div className="text-xs text-[oklch(0.50_0.03_250)] mb-1">
              Del 3 — Kursregistrering och genomförande · Slide {currentSlide + 1}
            </div>
            <EditableField
              value={getField(slide.id, "slide_title", slide.label)}
              onSave={(v) => save(slide.id, "slide_title", v)}
              editMode={editMode}
              className="block"
            >
              {(v) => <h2 className="text-2xl font-bold text-white">{v}</h2>}
            </EditableField>
            <EditableField
              value={getField(slide.id, "slide_subtitle", {
                overview: "Flödesöversikt — hela processen från registrering till avräkning",
                register_form: "Kursledaren registrerar kurstillfälle i portalen",
                admin_approval: "Admin granskar, godkänner och skapar HL-tillgänglighet",
                participants: "Deltagarlistan uppdateras automatiskt när deltagare bokar",
                showed: "Kursledaren markerar showed — triggar HL-pipeline-taggar",
                settlement: "Månadsvis avräkning och fakturering till FA",
                summary: "Sammanfattning och nästa steg",
              }[slide.id] ?? "")}
              onSave={(v) => save(slide.id, "slide_subtitle", v)}
              editMode={editMode}
              className="block mt-1"
            >
              {(v) => <p className="text-sm text-[oklch(0.55_0.03_250)]">{v}</p>}
            </EditableField>
          </div>

          <SlideComponent />
        </div>

        {/* Navigation */}
        <div className="sticky bottom-0 bg-[oklch(0.16_0.04_255)] border-t border-[oklch(0.22_0.04_255)] px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-[oklch(0.20_0.04_255)] border border-[oklch(0.28_0.04_255)] text-[oklch(0.65_0.03_250)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Föregående
          </button>
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === currentSlide ? "bg-[oklch(0.72_0.12_75)] w-4" : "bg-[oklch(0.30_0.04_255)] hover:bg-[oklch(0.45_0.04_255)]"
                )}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentSlide(Math.min(SLIDES.length - 1, currentSlide + 1))}
            disabled={currentSlide === SLIDES.length - 1}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-[oklch(0.72_0.12_75)] text-[oklch(0.14_0.04_255)] font-medium hover:bg-[oklch(0.78_0.12_75)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Nästa <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </EditContext.Provider>
  );
}
