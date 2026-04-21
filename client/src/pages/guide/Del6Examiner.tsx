/**
 * Del 6 — Portalen: Rättare (Exam)
 * 3 slides covering the examiner role.
 */
import { useState, useCallback, createContext, useContext } from "react";
import { Link } from "wouter";
import {
  ChevronLeft, ChevronRight, ClipboardCheck, CheckCircle2,
  Pencil, PencilOff, AlertCircle, GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { EditableField } from "@/components/guide/EditableField";
import { EditableList } from "@/components/guide/EditableList";
import { EditableImage } from "@/components/guide/EditableImage";

const PRES_ID = "del6";

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

// ─── Examiner nav mock ────────────────────────────────────────────────────────
function ExamNavMock({ active }: { active: string }) {
  const nav = [
    { label: "Exam Queue", icon: ClipboardCheck },
  ];
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
        {nav.map(({ label, icon: Icon }) => (
          <div key={label} className={cn("flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] transition-colors", active === label ? "bg-[oklch(0.72_0.12_75)]/20 text-[oklch(0.72_0.12_75)] font-semibold" : "text-muted-foreground")}>
            <Icon className="h-3 w-3 shrink-0" /><span>{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-[oklch(0.22_0.04_255)] px-1">
        <div className="text-[9px] text-muted-foreground">Rättare</div>
        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 inline-block mt-0.5">Examiner</span>
      </div>
    </div>
  );
}

// ─── Slides ───────────────────────────────────────────────────────────────────
function SlideExaminerRole() {
  const sid = "examiner_role";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 6 — RÄTTARE · Slide 1</div>
          <EditableField value={getField(sid, "title", "Portalen — Rättare (Exam)")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
            {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
          </EditableField>
          <EditableField value={getField(sid, "subtitle", "Rättarens roll och åtkomst i portalen")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
            {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
          </EditableField>
        </div>
        <div>
          <EH3 sid={sid} fkey="role_heading" def="Vad är en rättare?" />
          <EditableField value={getField(sid, "role_body", "En rättare är en person som har tillgång till Exam Queue utan att vara fullständig admin. Rättarens enda funktion i portalen är att granska och bedöma inskickade prov för Diplo- och Cert-kurser. Rollen möjliggör att någon utanför FA-teamet kan rätta prov utan att ha tillgång till övriga adminvyer.")} onSave={(v) => save(sid, "role_body", v)} editMode={editMode} multiline className="mt-1">
            {(v) => <p className="text-sm text-muted-foreground leading-relaxed mt-1">{v}</p>}
          </EditableField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><ClipboardCheck className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="access_heading" def="Rättarens åtkomst" /></div>
            <EList sid={sid} fkey="access_list" def={["Exam Queue — se alla inskickade prov", "Granska provinnehåll (svar, bilagor)", "Godkänna eller underkänna prov", "Ingen åtkomst till kurser, deltagare eller avräkningar"]} />
          </div>
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><AlertCircle className="h-4 w-4 text-amber-400" /><EH3 sid={sid} fkey="note_heading" def="Viktigt att veta" /></div>
            <EList sid={sid} fkey="note_list" def={["Rättare kan kombineras med kursledar-rollen (samma logik som affiliate)", "Admin sätter upp rättarrollen i User Management", "Rättarens beslut är ett steg — admin godkänner slutligen intyget", "Inga automail går ut från portalen utan admin-godkännande"]} />
          </div>
        </div>
        <EImg sid={sid} fkey="screenshot" label="Skärmdump — Exam Queue (rättarens vy)" />
      </div>
      <ExamNavMock active="Exam Queue" />
    </div>
  );
}

function SlideExamQueue() {
  const sid = "exam_queue";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 6 — RÄTTARE · Slide 2</div>
          <EditableField value={getField(sid, "title", "Exam Queue — Granska prov")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
            {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
          </EditableField>
          <EditableField value={getField(sid, "subtitle", "Hur rättaren ser och bedömer inskickade prov")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
            {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
          </EditableField>
        </div>
        <div>
          <EH3 sid={sid} fkey="queue_heading" def="Exam Queue — vad syns?" />
          <EditableField value={getField(sid, "queue_body", "Exam Queue visar alla prov som deltagare har skickat in och som väntar på bedömning. Rättaren ser deltagarens namn, kurstyp, inlämningsdatum och provinnehåll. Varje prov kan granskas och bedömas som godkänt eller underkänt.")} onSave={(v) => save(sid, "queue_body", v)} editMode={editMode} multiline className="mt-1">
            {(v) => <p className="text-sm text-muted-foreground leading-relaxed mt-1">{v}</p>}
          </EditableField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <EH3 sid={sid} fkey="info_heading" def="Information per prov" />
            <div className="mt-2">
              <EList sid={sid} fkey="info_list" def={["Deltagarens namn och kurstyp (Diplo/Cert)", "Inlämningsdatum och kursledare", "Provinnehåll — svar och eventuella bilagor", "Status: Pending / Approved / Failed"]} />
            </div>
          </div>
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <EH3 sid={sid} fkey="actions_heading" def="Rättarens åtgärder" />
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-300">Godkänn — provet är godkänt</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span className="text-xs text-red-300">Underkänn — provet är underkänt</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Rättarens beslut skickas vidare till admin för slutgodkännande av intyg.</p>
            </div>
          </div>
        </div>
        <EImg sid={sid} fkey="screenshot" label="Skärmdump — Exam Queue med prov i kön" />
      </div>
      <ExamNavMock active="Exam Queue" />
    </div>
  );
}

function SlideCertFlow() {
  const sid = "cert_flow";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 6 — RÄTTARE · Slide 3</div>
        <EditableField value={getField(sid, "title", "Flöde — Prov till intyg")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
          {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
        </EditableField>
        <EditableField value={getField(sid, "subtitle", "Showed + godkänt prov → admin → intyg (Diplo och Cert)")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
          {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
        </EditableField>
      </div>
      <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-5 border border-[oklch(0.22_0.04_255)]">
        <EH3 sid={sid} fkey="flow_heading" def="Steg-för-steg — Diplo och Cert" />
        <div className="mt-4 space-y-2">
          {[
            { n: 1, label: "Showed markerat", desc: "Kursledaren markerar deltagaren som showed i portalen efter genomförd kurs.", color: "text-[oklch(0.72_0.12_75)]", bg: "bg-[oklch(0.72_0.12_75)]/20" },
            { n: 2, label: "Prov inskickat", desc: "Deltagaren skickar in sitt prov via det digitala kursmaterialet.", color: "text-blue-400", bg: "bg-blue-500/20" },
            { n: 3, label: "Rättaren granskar", desc: "Provet hamnar i Exam Queue. Rättaren granskar och godkänner/underkänner.", color: "text-purple-400", bg: "bg-purple-500/20" },
            { n: 4, label: "Admin godkänner intyg", desc: "Admin ser att showed + godkänt prov finns och utfärdar intyget manuellt. Inga automail går ut utan admin-godkännande.", color: "text-emerald-400", bg: "bg-emerald-500/20" },
            { n: 5, label: "Intyg utfärdat", desc: "Intyget visas i Issued Certificates och kan delas/verifieras via unik länk.", color: "text-amber-400", bg: "bg-amber-500/20" },
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
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <EH3 sid={sid} fkey="note_heading" def="Säkerhetsspärr" />
            <EditableField value={getField(sid, "note_body", "Inga automail skickas till deltagare från portalen utan att admin godkänner. Detta gäller även intyg — admin måste manuellt utfärda intyget efter att showed och godkänt prov finns registrerade.")} onSave={(v) => save(sid, "note_body", v)} editMode={editMode} multiline className="mt-1">
              {(v) => <p className="text-xs text-amber-200/80 mt-1">{v}</p>}
            </EditableField>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <div className="flex items-center gap-2 mb-2"><GraduationCap className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="intro_heading" def="Intro-kurser" /></div>
          <EList sid={sid} fkey="intro_list" def={["Kräver bara showed — inget prov", "Admin utfärdar intyg direkt efter showed", "Snabbare process — inget Exam Queue-steg"]} />
        </div>
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <div className="flex items-center gap-2 mb-2"><ClipboardCheck className="h-4 w-4 text-purple-400" /><EH3 sid={sid} fkey="diplo_heading" def="Diplo- och Cert-kurser" /></div>
          <EList sid={sid} fkey="diplo_list" def={["Kräver showed + godkänt prov", "Prov rättas av rättare i Exam Queue", "Admin utfärdar intyg efter båda villkoren uppfyllda"]} />
        </div>
      </div>
      <EImg sid={sid} fkey="screenshot" label="Skärmdump — Issued Certificates (admin)" />
    </div>
  );
}

const SLIDES = [
  { id: "examiner_role", label: "Rättarens roll", component: <SlideExaminerRole /> },
  { id: "exam_queue", label: "Exam Queue", component: <SlideExamQueue /> },
  { id: "cert_flow", label: "Prov → Intyg", component: <SlideCertFlow /> },
];

export default function Del6Examiner() {
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
            <span className="text-xs text-[oklch(0.65_0.03_250)]">Del 6 — Rättare</span>
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
