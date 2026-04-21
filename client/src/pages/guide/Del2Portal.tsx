/**
 * Del 2 — Portalen: Kursledarens vy
 * Interactive guide presentation for Fascia Academy admins.
 * 7 slides covering the portal from the course leader's perspective.
 * All text/lists/images are editable by admins in edit mode.
 */
import { useState, createContext, useContext, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  PencilOff,
  BarChart2,
  BookOpen,
  FileText,
  Bell,
  MessageSquare,
  Settings,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Info,
  User,
  Calendar,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { EditableField } from "@/components/guide/EditableField";
import { EditableList } from "@/components/guide/EditableList";
import { EditableImage } from "@/components/guide/EditableImage";

// ─── Presentation ID ──────────────────────────────────────────────────────────
const PRES_ID = "del2";

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
function InfoCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[oklch(0.20_0.04_255)] rounded-xl p-4 border border-[oklch(0.28_0.04_255)] space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[oklch(0.72_0.12_75)]/15 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-[oklch(0.72_0.12_75)]" />
        </div>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="text-sm text-[oklch(0.75_0.03_250)] space-y-1">{children}</div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, badge }: { icon: React.ElementType; label: string; active?: boolean; badge?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
      active
        ? "bg-[oklch(0.72_0.12_75)]/20 text-[oklch(0.72_0.12_75)] font-medium"
        : "text-[oklch(0.65_0.03_250)] hover:bg-[oklch(0.22_0.04_255)]"
    )}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] bg-[oklch(0.72_0.12_75)] text-[oklch(0.14_0.04_255)] rounded-full px-1.5 py-0.5 font-bold">{badge}</span>
      )}
    </div>
  );
}

// Helper: editable h3 heading
function EH3({ sid, fkey, def }: { sid: string; fkey: string; def: string }) {
  const { editMode, getField, save } = useEdit();
  const val = getField(sid, fkey, def);
  return (
    <EditableField value={val} onSave={(v) => save(sid, fkey, v)} editMode={editMode} className="block">
      {(v) => <h3 className="text-base font-semibold text-white">{v}</h3>}
    </EditableField>
  );
}

// Helper: editable image placeholder
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

// ─── Slide 1: Portal Overview ─────────────────────────────────────────────────
function SlideOverview() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "overview";
  const intro = getField(sid, "intro_text",
    "FA-portalen är kursledarens arbetsyta i Fascia Academy. Här hanterar kursledaren sina kurser, ser sina avräkningar och kommunicerar med FA-teamet."
  );
  const navItems = getList(sid, "nav_items", [
    "Home — välkomstsida med Action Items och Quick Stats",
    "My Courses — registrera och hantera kurstillfällen",
    "My Statistics — personlig statistik och intäktsöversikt",
    "My Settlements — månadsavräkningar och faktureringsunderlag",
    "Notifications — viktiga uppdateringar och påminnelser (i topbaren)",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="left_heading" def="Vad är FA-portalen?" />
          <EditableField value={intro} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline>
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div className="space-y-1">
            <EH3 sid={sid} fkey="nav_heading" def="Navigering i portalen" />
            <EditableList items={navItems} onSave={(items) => saveList(sid, "nav_items", items)} editMode={editMode}>
              {(items) => (
                <ul className="space-y-1.5 mt-2">
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
        </div>
        <div className="space-y-3">
          <EH3 sid={sid} fkey="sidebar_heading" def="Sidomenyn — kursledarens vy (engelska)" />
          <div className="bg-[oklch(0.18_0.04_255)] rounded-xl p-3 border border-[oklch(0.28_0.04_255)] space-y-1">
            <NavItem icon={BarChart2} label="Home" active />
            <NavItem icon={BookOpen} label="My Courses" />
            <NavItem icon={BarChart2} label="My Statistics" />
            <NavItem icon={FileText} label="My Settlements" />
          </div>
          <p className="text-xs text-[oklch(0.50_0.03_250)]">Notifications visas i topbaren (klocka-ikon), inte i sidomenyn.</p>
          <div>
            <p className="text-xs text-[oklch(0.50_0.03_250)] mb-2">Skärmdump — portalen (kursledarens vy)</p>
            <EImg sid={sid} fkey="portal_overview_screenshot" alt="Portalöversikt" label="Skärmdump från portalen — kursledarens startvy" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide 2: Statistics ──────────────────────────────────────────────────────
function SlideStatistics() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "statistics";
  const intro = getField(sid, "intro_text",
    "Home är kursledarens startsida i portalen. Den visar Action Items (viktiga uppgifter), nästa kurs och Quick Stats."
  );
  const widgets = getList(sid, "widgets", [
    "Action Items — viktiga uppgifter som kräver åtgärd (t.ex. faktura att skicka)",
    "Your Next Course — nästa schemalagda kurstillfälle med datum och plats",
    "Quick Stats — Upcoming Courses, Showed this month, Total Payout",
    "Quick Actions — genvägar till Register Course, My Courses, My Settlements, My Statistics",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="left_heading" def="Home — startsidan" />
          <EditableField value={intro} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline>
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <EH3 sid={sid} fkey="widgets_heading" def="Widgets på startsidan" />
            <EditableList items={widgets} onSave={(items) => saveList(sid, "widgets", items)} editMode={editMode}>
              {(items) => (
                <ul className="space-y-1.5 mt-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[oklch(0.75_0.03_250)]">
                      <div className="w-5 h-5 rounded-full bg-[oklch(0.72_0.12_75)]/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-[oklch(0.72_0.12_75)]">{i + 1}</span>
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </EditableList>
          </div>
        </div>
        <div className="space-y-3">
          <EH3 sid={sid} fkey="mockup_heading" def="Home — Quick Stats och Action Items" />
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: BookOpen, label: "Upcoming Courses", value: "3" },
              { icon: Calendar, label: "Next Course", value: "12 May" },
              { icon: User, label: "Showed (this month)", value: "12" },
              { icon: DollarSign, label: "Total Payout (6 mo)", value: "8 400 kr" },
            ].map((w, i) => (
              <div key={i} className="bg-[oklch(0.20_0.04_255)] rounded-xl p-3 border border-[oklch(0.28_0.04_255)]">
                <div className="flex items-center gap-2 mb-1">
                  <w.icon className="h-3.5 w-3.5 text-[oklch(0.72_0.12_75)]" />
                  <span className="text-xs text-[oklch(0.55_0.03_250)]">{w.label}</span>
                </div>
                <div className="text-lg font-bold text-white">{w.value}</div>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs text-[oklch(0.50_0.03_250)] mb-2">Skärmdump — Home</p>
            <EImg sid={sid} fkey="statistics_screenshot" alt="Home skärmdump" label="Skärmdump från portalen — Home (startsida)" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide 3: My Courses ──────────────────────────────────────────────────────
function SlideMyCourses() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "my_courses";
  const intro = getField(sid, "intro_text",
    "Under Mina kurser registrerar och hanterar kursledaren sina kurstillfällen. Kursledaren ansvarar för att hålla informationen uppdaterad."
  );
  const steps = getList(sid, "registration_steps", [
    "Klicka på \"Registrera ny kurs\"",
    "Fyll i kurstyp (Intro / Diplo / Cert), datum, plats och max antal deltagare",
    "Skicka in — admin granskar och godkänner",
    "Kursen visas på fasciaacademy.com efter godkännande",
  ]);
  const courseTypes = getList(sid, "course_types", [
    "Introduktionskurs — Fascia by Fascia Academy",
    "Diplomerad Fasciaspecialist — by Fascia Academy",
    "Certifierad Fasciaspecialist — by Fascia Academy",
    "Viderekurs (avancerad)",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="left_heading" def="My Courses" />
          <EditableField value={intro} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline>
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <EH3 sid={sid} fkey="steps_heading" def="Register new course" />
            <EditableList items={steps} onSave={(items) => saveList(sid, "registration_steps", items)} editMode={editMode}>
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
          <EH3 sid={sid} fkey="types_heading" def="Kurstyper (Course Types)" />
          <EditableList items={courseTypes} onSave={(items) => saveList(sid, "course_types", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[oklch(0.20_0.04_255)] rounded-lg px-3 py-2 border border-[oklch(0.28_0.04_255)]">
                    <BookOpen className="h-4 w-4 text-[oklch(0.72_0.12_75)] shrink-0" />
                    <span className="text-sm text-[oklch(0.80_0.03_250)]">{item}</span>
                  </div>
                ))}
              </div>
            )}
          </EditableList>
          <div>
            <p className="text-xs text-[oklch(0.50_0.03_250)] mb-2">Skärmdump — My Courses</p>
            <EImg sid={sid} fkey="my_courses_screenshot" alt="My Courses skärmdump" label="Skärmdump från portalen — My Courses" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide 4: Course Registration Form ───────────────────────────────────────
function SlideCourseForm() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "course_form";
  const intro = getField(sid, "intro_text",
    "Kursregistreringsformuläret fylls i av kursledaren. Admin granskar och godkänner innan kursen publiceras på fasciaacademy.com."
  );
  const fields = getList(sid, "form_fields", [
    "Kurstyp — Intro / Diplo / Cert / Videre",
    "Språk — Svenska / Engelska",
    "Startdatum och slutdatum",
    "Ort och adress",
    "Max antal deltagare",
    "Pris per deltagare (fylls i av FA)",
    "Eventuell kommentar till admin",
  ]);
  const adminActions = getList(sid, "admin_actions", [
    "Granska inlämnad kursregistrering",
    "Godkänn eller begär komplettering",
    "Publicera kursen på fasciaacademy.com",
    "Notifiera kursledaren om status",
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
            <EditableList items={fields} onSave={(items) => saveList(sid, "form_fields", items)} editMode={editMode}>
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
          <EH3 sid={sid} fkey="admin_heading" def="Admin-åtgärder efter inlämning" />
          <EditableList items={adminActions} onSave={(items) => saveList(sid, "admin_actions", items)} editMode={editMode}>
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
            <p className="text-xs text-[oklch(0.50_0.03_250)] mb-2">Skärmdump — kursregistreringsformuläret</p>
            <EImg sid={sid} fkey="course_form_screenshot" alt="Kursregistrering skärmdump" label="Skärmdump från portalen — Registrera ny kurs" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide 5: Settlements ─────────────────────────────────────────────────────
function SlideSettlements() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "settlements";
  const intro = getField(sid, "intro_text",
    "Under Avräkning ser kursledaren sina månadsavräkningar. Avräkning sker månadsvis och kursledaren fakturerar FA med 20 dagars betalningsvillkor."
  );
  const settlementInfo = getList(sid, "settlement_info", [
    "Avräkning sker månadsvis — baserat på genomförda kurser",
    "Kursledaren fakturerar FA — betalningsvillkor 20 dagar",
    "Avräkningsunderlaget genereras per kursledare",
    "Kursledaren kan ladda ner PDF-underlag direkt i portalen",
    "FA-teamet granskar och bekräftar avräkningsunderlaget",
  ]);
  const columns = getList(sid, "table_columns", [
    "Kurs — typ och datum",
    "Antal deltagare — bekräftade bokningar",
    "Kursintäkt — totalt inkasserat belopp",
    "FA-andel — plattformsavgift",
    "Kursledarens andel — utbetalningsbelopp",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="left_heading" def="My Settlements" />
          <EditableField value={intro} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline>
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <EH3 sid={sid} fkey="info_heading" def="Avräkningsprocess" />
            <EditableList items={settlementInfo} onSave={(items) => saveList(sid, "settlement_info", items)} editMode={editMode}>
              {(items) => (
                <ul className="space-y-1.5 mt-2">
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
        </div>
        <div className="space-y-4">
          <EH3 sid={sid} fkey="columns_heading" def="Kolumner i avräkningstabellen" />
          <EditableList items={columns} onSave={(items) => saveList(sid, "table_columns", items)} editMode={editMode}>
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
          <div>
            <p className="text-xs text-[oklch(0.50_0.03_250)] mb-2">Skärmdump — My Settlements</p>
            <EImg sid={sid} fkey="settlements_screenshot" alt="My Settlements skärmdump" label="Skärmdump från portalen — Avräkning / My Settlements" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide 6: Notifications & Messages ───────────────────────────────────────
function SlideNotifications() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "notifications";
  const notifTypes = getList(sid, "notif_types", [
    "Ny bokning — en deltagare har bokat en av dina kurser",
    "Avbokning — en deltagare har avbokat",
    "Kurs godkänd — admin har godkänt din kursregistrering (Pending Actions)",
    "Avräkning klar — månadsavräkning finns tillgänglig i My Settlements",
    "Påminnelse — faktura ska skickas till FA (Action Item på Home)",
  ]);
  const msgInfo = getList(sid, "msg_info", [
    "Notifications-ikonen (klocka) finns i topbaren — inte i sidomenyn",
    "Klicka på klockan för att se alla notifikationer",
    "Viktiga uppgifter visas även som Action Items på Home-sidan",
    "Kontakta FA-teamet via e-post: info@fasciaacademy.com",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="notif_heading" def="Notifikationer" />
          <EditableField
            value={getField(sid, "notif_intro", "Portalen skickar automatiska notifikationer vid viktiga händelser. Kursledaren ser dessa i notifikationsfliken och via e-post.")}
            onSave={(v) => save(sid, "notif_intro", v)}
            editMode={editMode}
            multiline
          >
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <EditableList items={notifTypes} onSave={(items) => saveList(sid, "notif_types", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-2">
                {items.map((item, i) => {
                  const icons = [Bell, AlertCircle, CheckCircle2, DollarSign, AlertCircle, MessageSquare];
                  const Icon = icons[i % icons.length];
                  return (
                    <div key={i} className="flex items-start gap-3 bg-[oklch(0.20_0.04_255)] rounded-lg px-3 py-2 border border-[oklch(0.28_0.04_255)]">
                      <Icon className="h-4 w-4 text-[oklch(0.72_0.12_75)] shrink-0 mt-0.5" />
                      <span className="text-sm text-[oklch(0.80_0.03_250)]">{item}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </EditableList>
        </div>
        <div className="space-y-4">
          <EH3 sid={sid} fkey="msg_heading" def="Meddelanden" />
          <EditableList items={msgInfo} onSave={(items) => saveList(sid, "msg_info", items)} editMode={editMode}>
            {(items) => (
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[oklch(0.75_0.03_250)]">
                    <MessageSquare className="h-4 w-4 text-[oklch(0.72_0.12_75)] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </EditableList>
          <div>
            <p className="text-xs text-[oklch(0.50_0.03_250)] mb-2">Skärmdump — Notifikationer / Meddelanden</p>
            <EImg sid={sid} fkey="notif_screenshot" alt="Notifikationer skärmdump" label="Skärmdump från portalen — Notifikationer eller Meddelanden" />
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
    "Portalen är kursledarens centrala arbetsyta hos FA",
    "Home — Action Items, nästa kurs och Quick Stats",
    "My Courses — registrera och hantera kurstillfällen",
    "My Statistics — personlig statistik och intäktsöversikt",
    "My Settlements — månadsvis underlag för fakturering till FA",
    "Notifications — klocka i topbaren, Action Items på Home",
  ]);
  const nextSteps = getList(sid, "next_steps", [
    "Del 3: Deltagare — från bokning till intyg",
    "Del 4: Avräkning — detaljerad genomgång av faktureringsprocessen",
    "Del 5: HL Dashboard — admin-vyn i GoHighLevel",
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="summary_heading" def="Sammanfattning — Del 2" />
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
                      <span className="text-xs font-bold text-[oklch(0.72_0.12_75)]">{i + 3}</span>
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
              value={getField(sid, "contact_text", "Frågor om portalen? Kontakta FA-teamet via meddelanden i portalen eller på info@fasciaacademy.com")}
              onSave={(v) => save(sid, "contact_text", v)}
              editMode={editMode}
              multiline
            >
              {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)]">{v}</p>}
            </EditableField>
            <a href="mailto:info@fasciaacademy.com" className="inline-flex items-center gap-1 text-xs text-[oklch(0.72_0.12_75)] hover:underline">
              <ExternalLink className="h-3 w-3" /> info@fasciaacademy.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide registry ───────────────────────────────────────────────────────────
const SLIDES = [
  { id: "overview", label: "Portalöversikt", component: SlideOverview },
  { id: "statistics", label: "Home", component: SlideStatistics },
  { id: "my_courses", label: "My Courses", component: SlideMyCourses },
  { id: "course_form", label: "Register Course", component: SlideCourseForm },
  { id: "settlements", label: "My Settlements", component: SlideSettlements },
  { id: "notifications", label: "Notifications", component: SlideNotifications },
  { id: "summary", label: "Sammanfattning", component: SlideSummary },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function Del2Portal() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editMode, setEditMode] = useState(false);

  // Load all content overrides for this presentation
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
      // Optimistic update
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
            <span className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-wider">Del 2 — Portalen</span>
            <span className="text-[oklch(0.40_0.03_250)]">·</span>
            <span className="text-sm text-[oklch(0.65_0.03_250)]">Slide {currentSlide + 1} av {SLIDES.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setEditMode((e) => !e)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  editMode
                    ? "bg-[oklch(0.72_0.12_75)] text-[oklch(0.14_0.04_255)]"
                    : "bg-[oklch(0.22_0.04_255)] text-[oklch(0.65_0.03_250)] hover:bg-[oklch(0.26_0.04_255)]"
                )}
              >
                {editMode ? <PencilOff className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                {editMode ? "Avsluta redigering" : "Redigera"}
              </button>
            )}
          </div>
        </div>

        {/* Edit mode banner */}
        {editMode && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-amber-300">Redigeringsläge aktivt — klicka på text, listor eller bilder för att redigera. Ändringar sparas automatiskt.</span>
          </div>
        )}

        {/* Slide tabs */}
        <div className="border-b border-[oklch(0.22_0.04_255)] px-6 overflow-x-auto">
          <div className="flex gap-1 py-2 min-w-max">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                  i === currentSlide
                    ? "bg-[oklch(0.72_0.12_75)]/20 text-[oklch(0.72_0.12_75)]"
                    : "text-[oklch(0.55_0.03_250)] hover:text-white hover:bg-[oklch(0.20_0.04_255)]"
                )}
              >
                {i + 1}. {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Slide content */}
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Slide heading */}
          <div className="mb-6">
            <EditableField
              value={getField(slide.id, "slide_title", slide.label)}
              onSave={(v) => save(slide.id, "slide_title", v)}
              editMode={editMode}
              className="block"
            >
              {(v) => <h1 className="text-2xl font-bold text-white">{v}</h1>}
            </EditableField>
            <EditableField
              value={getField(slide.id, "slide_subtitle", `Portalen — kursledarens vy · Slide ${currentSlide + 1}`)}
              onSave={(v) => save(slide.id, "slide_subtitle", v)}
              editMode={editMode}
              className="block mt-1"
            >
              {(v) => <p className="text-sm text-[oklch(0.55_0.03_250)]">{v}</p>}
            </EditableField>
          </div>

          <SlideComponent />
        </div>

        {/* Bottom navigation */}
        <div className="sticky bottom-0 bg-[oklch(0.16_0.04_255)] border-t border-[oklch(0.22_0.04_255)] px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setCurrentSlide((s) => Math.max(0, s - 1))}
            disabled={currentSlide === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[oklch(0.22_0.04_255)] text-[oklch(0.65_0.03_250)] hover:bg-[oklch(0.26_0.04_255)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Föregående
          </button>
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  "rounded-full transition-all",
                  i === currentSlide
                    ? "w-6 h-2 bg-[oklch(0.72_0.12_75)]"
                    : "w-2 h-2 bg-[oklch(0.30_0.04_255)] hover:bg-[oklch(0.45_0.04_255)]"
                )}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentSlide((s) => Math.min(SLIDES.length - 1, s + 1))}
            disabled={currentSlide === SLIDES.length - 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[oklch(0.72_0.12_75)] text-[oklch(0.14_0.04_255)] hover:bg-[oklch(0.68_0.12_75)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Nästa <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </EditContext.Provider>
  );
}
