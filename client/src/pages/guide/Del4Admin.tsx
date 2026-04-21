/**
 * Del 4 — Portalen: Admin
 * 8 slides covering the full admin portal view.
 * Uses the same EditContext + EImg + EList helper pattern as Del 1.
 */
import { useState, useCallback, createContext, useContext } from "react";
import { Link } from "wouter";
import {
  ChevronLeft, ChevronRight, Home, BarChart2, BookOpen, Users, UserCheck,
  Award, FileText, AlertTriangle, ClipboardCheck, Settings, Shield,
  GraduationCap, Pencil, PencilOff, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { EditableField } from "@/components/guide/EditableField";
import { EditableList } from "@/components/guide/EditableList";
import { EditableImage } from "@/components/guide/EditableImage";

const PRES_ID = "del4";

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

// ─── Shared helpers ───────────────────────────────────────────────────────────
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
function EList({ sid, fkey, def, className }: { sid: string; fkey: string; def: string[]; className?: string }) {
  const { editMode, getList, saveList } = useEdit();
  const items = getList(sid, fkey, def);
  return (
    <EditableList items={items} onSave={(it) => saveList(sid, fkey, it)} editMode={editMode} className={className}>
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

// ─── Admin nav mock ───────────────────────────────────────────────────────────
const ADMIN_NAV = [
  { label: "Home", icon: Home },
  { label: "Statistics", icon: BarChart2 },
  { label: "Courses", icon: BookOpen },
  { label: "Students", icon: Users },
  { label: "Course Leaders", icon: UserCheck },
  { label: "Affiliates", icon: Award },
  { label: "Settlements", icon: FileText },
  { label: "Pending Actions", icon: AlertTriangle },
  { label: "Exam Queue", icon: ClipboardCheck },
  { label: "Settings", icon: Settings },
  { label: "Issued Certificates", icon: Shield },
  { label: "Cert Templates", icon: GraduationCap },
];
function AdminNavMock({ active }: { active: string }) {
  return (
    <div className="bg-[oklch(0.13_0.04_255)] rounded-xl border border-[oklch(0.22_0.04_255)] p-3 w-44 shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-7 h-7 rounded-lg bg-[oklch(0.72_0.12_75)] flex items-center justify-center text-[oklch(0.13_0.04_255)] text-xs font-bold">FA</div>
        <div>
          <div className="text-[11px] font-semibold text-foreground">Fascia Academy</div>
          <div className="text-[9px] text-muted-foreground">Dashboard</div>
        </div>
      </div>
      <div className="space-y-0.5">
        {ADMIN_NAV.map(({ label, icon: Icon }) => (
          <div key={label} className={cn("flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] transition-colors", active === label ? "bg-[oklch(0.72_0.12_75)]/20 text-[oklch(0.72_0.12_75)] font-semibold" : "text-muted-foreground")}>
            <Icon className="h-3 w-3 shrink-0" /><span>{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-[oklch(0.22_0.04_255)] px-1">
        <div className="text-[9px] text-muted-foreground">Fascia Academy Admin</div>
        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[oklch(0.72_0.12_75)]/20 text-[oklch(0.72_0.12_75)] inline-block mt-0.5">Administrator</span>
      </div>
    </div>
  );
}

// ─── Slides ───────────────────────────────────────────────────────────────────
function SlideOverview() {
  const sid = "overview";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 4 — ADMIN · Slide 1</div>
          <EditableField value={getField(sid, "title", "Portalen — Admin")} onSave={(v) => save(sid, "title", v)} editMode={editMode} className="text-3xl font-bold text-foreground block" multiline={false}>
            {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
          </EditableField>
          <EditableField value={getField(sid, "subtitle", "Adminvyn — vad ser FA-teamet i portalen?")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} className="text-sm text-muted-foreground mt-1 block" multiline={false}>
            {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
          </EditableField>
        </div>
        <div>
          <EH3 sid={sid} fkey="left_heading" def="Vad är adminvyn?" />
          <EditableField value={getField(sid, "left_body", "FA-teamet har tillgång till hela portalen via adminvyn. Härifrån hanteras kurser, kursledare, studenter, avräkningar, certifikat och systemkonfiguration. Adminvyn är på engelska.")} onSave={(v) => save(sid, "left_body", v)} editMode={editMode} multiline className="block mt-1">
            {(v) => <p className="text-sm text-muted-foreground leading-relaxed mt-1">{v}</p>}
          </EditableField>
        </div>
        <div>
          <EH3 sid={sid} fkey="nav_heading" def="Adminmenyn — 12 sektioner" />
          <div className="mt-2">
            <EList sid={sid} fkey="nav_list" def={["Home — Action Items, snabbåtgärder och kommande kurser", "Statistics — KPI-kort, intäkter och kursöversikt", "Courses — alla registrerade kurstillfällen", "Students — alla deltagare och deras bokningsstatus", "Course Leaders — hantera kursledare och deras status", "Affiliates — affiliatekoder och provisioner", "Settlements — månadsavräkningar per kursledare", "Pending Actions — kursregistreringar som väntar på godkännande", "Exam Queue — inskickade prov som väntar på rättning", "Settings — systeminställningar", "Issued Certificates — utfärdade intyg", "Cert Templates — certifikatmallar"]} />
          </div>
        </div>
        <EImg sid={sid} fkey="screenshot" label="Skärmdump — adminmenyn" />
      </div>
      <AdminNavMock active="Home" />
    </div>
  );
}

function SlideHomeStats() {
  const sid = "home_stats";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 4 — ADMIN · Slide 2</div>
          <EditableField value={getField(sid, "title", "Home & Statistics")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
            {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
          </EditableField>
          <EditableField value={getField(sid, "subtitle", "Startsidan och statistiköversikten")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
            {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
          </EditableField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><Home className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="home_heading" def="Home" /></div>
            <EList sid={sid} fkey="home_list" def={["Action Items — kursregistreringar och prov som väntar", "Upcoming Courses — kurser de närmaste dagarna", "Quick Actions — genvägar till vanliga åtgärder", "Recent Activity — senaste händelser i systemet"]} />
          </div>
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><BarChart2 className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="stats_heading" def="Statistics" /></div>
            <EList sid={sid} fkey="stats_list" def={["KPI-kort: totala intäkter, aktiva kursledare, studenter", "Kursöversikt per månad och kurstyp", "Intäktsfördelning per kursledare", "Filtrerbart per tidsperiod"]} />
          </div>
        </div>
        <EImg sid={sid} fkey="screenshot" label="Skärmdump — Home dashboard" />
      </div>
      <AdminNavMock active="Statistics" />
    </div>
  );
}

function SlideCoursesStudents() {
  const sid = "courses_students";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 4 — ADMIN · Slide 3</div>
          <EditableField value={getField(sid, "title", "Courses & Students")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
            {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
          </EditableField>
          <EditableField value={getField(sid, "subtitle", "Kursöversikt och deltagarhantering")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
            {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
          </EditableField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><BookOpen className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="courses_heading" def="Courses" /></div>
            <EList sid={sid} fkey="courses_list" def={["Alla registrerade kurstillfällen från alla kursledare", "Filtrera på kurstyp, datum, kursledare och status", "Godkänn, avvisa eller begär komplettering", "Se deltagarlista per kurs", "Publicera kurs på fasciaacademy.com"]} />
          </div>
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="students_heading" def="Students" /></div>
            <EList sid={sid} fkey="students_list" def={["Alla studenter i systemet", "Se bokningshistorik per student", "Betalningsstatus och kursdeltagande", "Länk till HL-kontakt för varje student", "Filtrera på kurstyp och kursledare"]} />
          </div>
        </div>
        <EImg sid={sid} fkey="screenshot" label="Skärmdump — Courses-sidan" />
      </div>
      <AdminNavMock active="Courses" />
    </div>
  );
}

function SlideCourseLeaders() {
  const sid = "course_leaders";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 4 — ADMIN · Slide 4</div>
          <EditableField value={getField(sid, "title", "Course Leaders")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
            {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
          </EditableField>
          <EditableField value={getField(sid, "subtitle", "Hantera kursledare och deras status i portalen")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
            {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
          </EditableField>
        </div>
        <div>
          <EH3 sid={sid} fkey="left_heading" def="Vad kan admin göra?" />
          <div className="mt-2">
            <EList sid={sid} fkey="actions_list" def={["Se alla kursledare och deras HL-pipeline-status", "Skapa portalkonto manuellt efter signerat avtal", "Tilldela roller: Course Leader, Affiliate, Examiner", "Se kursledarens kurser, avräkningar och statistik", "Aktivera/inaktivera kursledarkonto", "Länk till HL-kontakt för varje kursledare"]} />
          </div>
        </div>
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <EH3 sid={sid} fkey="roles_heading" def="Rollkombinationer" />
          <div className="mt-2">
            <EList sid={sid} fkey="roles_list" def={["Course Leader — standardroll för aktiva kursledare", "Course Leader + Affiliate — kursledare som också är affiliate", "Course Leader + Examiner — kursledare som också rättar prov", "Admin kan tilldela flera roller till samma användare"]} />
          </div>
        </div>
        <EImg sid={sid} fkey="screenshot" label="Skärmdump — Course Leaders-sidan" />
      </div>
      <AdminNavMock active="Course Leaders" />
    </div>
  );
}

function SlideAffiliatesSettlements() {
  const sid = "affiliates_settlements";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 4 — ADMIN · Slide 5</div>
          <EditableField value={getField(sid, "title", "Affiliates & Settlements")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
            {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
          </EditableField>
          <EditableField value={getField(sid, "subtitle", "Affiliatehantering och månadsavräkningar")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
            {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
          </EditableField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><Award className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="aff_heading" def="Affiliates" /></div>
            <EList sid={sid} fkey="aff_list" def={["Se alla affiliates och deras affiliatekoder", "Tilldela affiliatekod till en användare", "Se provisioner per affiliate och månad", "En kursledare kan också vara affiliate"]} />
          </div>
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="settle_heading" def="Settlements" /></div>
            <EList sid={sid} fkey="settle_list" def={["Månadsavräkningar genereras automatiskt", "Admin granskar och låser avräkningen", "Kursledaren fakturerar FA med 20 dagars betalningsvillkor", "PDF-avräkning tillgänglig för nedladdning", "Filtrera per kursledare, månad och status"]} />
          </div>
        </div>
        <EImg sid={sid} fkey="screenshot" label="Skärmdump — Settlements-sidan" />
      </div>
      <AdminNavMock active="Settlements" />
    </div>
  );
}

function SlidePendingExam() {
  const sid = "pending_exam";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 4 — ADMIN · Slide 6</div>
          <EditableField value={getField(sid, "title", "Pending Actions & Exam Queue")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
            {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
          </EditableField>
          <EditableField value={getField(sid, "subtitle", "Godkänn kursregistreringar och rätta prov")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
            {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
          </EditableField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-amber-400" /><EH3 sid={sid} fkey="pending_heading" def="Pending Actions" /></div>
            <EList sid={sid} fkey="pending_list" def={["Kursregistreringar som väntar på admin-godkännande", "Godkänn → kursen publiceras på fasciaacademy.com", "Admin skapar HL-tillgänglighet för startdatum", "Begär komplettering om info saknas", "Avvisa med kommentar om kursen inte kan godkännas"]} />
          </div>
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><ClipboardCheck className="h-4 w-4 text-[oklch(0.65_0.15_200)]" /><EH3 sid={sid} fkey="exam_heading" def="Exam Queue" /></div>
            <EList sid={sid} fkey="exam_list" def={["Inskickade prov från Diplo/Cert-deltagare", "Rättare (eller admin) granskar provet", "Godkänt prov + showed → admin utfärdar intyg", "Underkänt prov → deltagaren meddelas via admin", "Inga automatiska mail utan admin-godkännande"]} />
          </div>
        </div>
        <div className="bg-[oklch(0.72_0.12_75)]/10 border border-[oklch(0.72_0.12_75)]/30 rounded-xl p-3">
          <EditableField value={getField(sid, "note", "Säkerhetsspärr: Inga mail skickas automatiskt till deltagare från portalen utan att admin godkänner. Detta gäller både kursbekräftelser och certifikat.")} onSave={(v) => save(sid, "note", v)} editMode={editMode} multiline>
            {(v) => <p className="text-xs text-[oklch(0.72_0.12_75)] leading-relaxed">{v}</p>}
          </EditableField>
        </div>
        <EImg sid={sid} fkey="screenshot" label="Skärmdump — Pending Actions" />
      </div>
      <AdminNavMock active="Pending Actions" />
    </div>
  );
}

function SlideCertificates() {
  const sid = "certificates";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 4 — ADMIN · Slide 7</div>
          <EditableField value={getField(sid, "title", "Issued Certificates & Cert Templates")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
            {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
          </EditableField>
          <EditableField value={getField(sid, "subtitle", "Certifikathantering och mallar")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
            {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
          </EditableField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="issued_heading" def="Issued Certificates" /></div>
            <EList sid={sid} fkey="issued_list" def={["Alla utfärdade intyg i systemet", "Intro: showed → admin utfärdar intyg", "Diplo/Cert: showed + godkänt prov → admin utfärdar", "Admin kan markera flera intyg och skicka ut samlat", "Intyget skickas via info@fasciaacademy.com"]} />
          </div>
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><GraduationCap className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="templates_heading" def="Cert Templates" /></div>
            <EList sid={sid} fkey="templates_list" def={["Mallar för olika kurstyper (Intro, Diplo, Cert, Vidare)", "Separata mallar för svenska och engelska", "Admin kan redigera och skapa nya mallar", "Mallen används automatiskt vid certifikatutfärdande"]} />
          </div>
        </div>
        <EImg sid={sid} fkey="screenshot" label="Skärmdump — Issued Certificates" />
      </div>
      <AdminNavMock active="Issued Certificates" />
    </div>
  );
}

function SlideSummary() {
  const sid = "summary";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 4 — ADMIN · Slide 8</div>
        <EditableField value={getField(sid, "title", "Sammanfattning — Del 4")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
          {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
        </EditableField>
        <EditableField value={getField(sid, "subtitle", "Adminvyn i korthet")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
          {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
        </EditableField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <div className="flex items-center gap-2 mb-2"><BookOpen className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="s1_heading" def="Kurshantering" /></div>
          <EList sid={sid} fkey="s1_list" def={["Courses: godkänn och publicera", "Pending Actions: granska inlämnade", "Students: deltagaröversikt"]} />
        </div>
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <div className="flex items-center gap-2 mb-2"><UserCheck className="h-4 w-4 text-[oklch(0.65_0.15_200)]" /><EH3 sid={sid} fkey="s2_heading" def="Personalhantering" /></div>
          <EList sid={sid} fkey="s2_list" def={["Course Leaders: roller och status", "Affiliates: koder och provisioner", "Rollkombinationer möjliga"]} />
        </div>
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <div className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-[oklch(0.65_0.12_130)]" /><EH3 sid={sid} fkey="s3_heading" def="Certifikat & Säkerhet" /></div>
          <EList sid={sid} fkey="s3_list" def={["Exam Queue: rättning av prov", "Intyg kräver admin-godkännande", "Inga automail utan admin-åtgärd"]} />
        </div>
      </div>
      <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
        <EH3 sid={sid} fkey="next_heading" def="Nästa del" />
        <EditableField value={getField(sid, "next_body", "Del 5 täcker Affiliate-rollen — vad en affiliate ser i portalen (My Settlements, My Commissions) och hur admin sätter upp affiliatekoder.")} onSave={(v) => save(sid, "next_body", v)} editMode={editMode} multiline className="mt-1">
          {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
        </EditableField>
      </div>
    </div>
  );
}

// ─── Slide registry ───────────────────────────────────────────────────────────
const SLIDES = [
  { id: "overview", label: "Översikt", component: <SlideOverview /> },
  { id: "home_stats", label: "Home & Statistics", component: <SlideHomeStats /> },
  { id: "courses_students", label: "Courses & Students", component: <SlideCoursesStudents /> },
  { id: "course_leaders", label: "Course Leaders", component: <SlideCourseLeaders /> },
  { id: "affiliates_settlements", label: "Affiliates & Settlements", component: <SlideAffiliatesSettlements /> },
  { id: "pending_exam", label: "Pending & Exam Queue", component: <SlidePendingExam /> },
  { id: "certificates", label: "Certificates", component: <SlideCertificates /> },
  { id: "summary", label: "Sammanfattning", component: <SlideSummary /> },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function Del4Admin() {
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
            <span className="text-xs text-[oklch(0.65_0.03_250)]">Del 4 — Admin</span>
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
