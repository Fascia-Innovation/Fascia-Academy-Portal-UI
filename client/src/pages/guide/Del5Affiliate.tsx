/**
 * Del 5 — Portalen: Affiliate
 * 3 slides covering the affiliate role in the portal.
 */
import { useState, useCallback, createContext, useContext } from "react";
import { Link } from "wouter";
import {
  ChevronLeft, ChevronRight, Award, FileText, TrendingUp,
  Pencil, PencilOff, CheckCircle2, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { EditableField } from "@/components/guide/EditableField";
import { EditableList } from "@/components/guide/EditableList";
import { EditableImage } from "@/components/guide/EditableImage";

const PRES_ID = "del5";

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

// ─── Affiliate nav mock ───────────────────────────────────────────────────────
function AffNavMock({ active }: { active: string }) {
  const nav = [
    { label: "My Settlements", icon: FileText },
    { label: "My Commissions", icon: TrendingUp },
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
        <div className="text-[9px] text-muted-foreground">Kalle</div>
        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 inline-block mt-0.5">Affiliate</span>
      </div>
    </div>
  );
}

// ─── Slides ───────────────────────────────────────────────────────────────────
function SlideAffiliateView() {
  const sid = "affiliate_view";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 5 — AFFILIATE · Slide 1</div>
          <EditableField value={getField(sid, "title", "Portalen — Affiliate")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
            {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
          </EditableField>
          <EditableField value={getField(sid, "subtitle", "Vad ser en affiliate i portalen?")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
            {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
          </EditableField>
        </div>
        <div>
          <EH3 sid={sid} fkey="intro_heading" def="Affiliatens vy" />
          <EditableField value={getField(sid, "intro_body", "En affiliate har en förenklad portalvy med två sidor: My Settlements och My Commissions. Affiliaten ser sina egna provisioner och avräkningar — inte kursledarens data.")} onSave={(v) => save(sid, "intro_body", v)} editMode={editMode} multiline className="mt-1">
            {(v) => <p className="text-sm text-muted-foreground leading-relaxed mt-1">{v}</p>}
          </EditableField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="settlements_heading" def="My Settlements" /></div>
            <EList sid={sid} fkey="settlements_list" def={["Månadsavräkningar för affiliateprovisioner", "Se utbetalda och väntande provisioner", "Ladda ner avräkning som PDF", "Filtrera per månad"]} />
          </div>
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-[oklch(0.65_0.15_200)]" /><EH3 sid={sid} fkey="commissions_heading" def="My Commissions" /></div>
            <EList sid={sid} fkey="commissions_list" def={["Bokningar som genererats via affiliatekoden", "Provision per bokning och kurstyp", "Månatlig sammanställning av intjänad provision", "Kräver att affiliatekod är tilldelad av admin"]} />
          </div>
        </div>
        <EImg sid={sid} fkey="screenshot" label="Skärmdump — My Commissions (affiliatens vy)" />
      </div>
      <AffNavMock active="My Commissions" />
    </div>
  );
}

function SlideRoleCombination() {
  const sid = "role_combination";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 5 — AFFILIATE · Slide 2</div>
          <EditableField value={getField(sid, "title", "Rollkombination — Kursledare + Affiliate")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
            {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
          </EditableField>
          <EditableField value={getField(sid, "subtitle", "En kursledare kan också vara affiliate")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
            {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
          </EditableField>
        </div>
        <div>
          <EH3 sid={sid} fkey="combo_heading" def="Hur fungerar kombinationen?" />
          <EditableField value={getField(sid, "combo_body", "En kursledare kan tilldelas affiliate-rollen av admin. Kursledaren ser då sin vanliga kursledarvy (Home, My Courses, My Statistics, My Settlements) plus affiliatevyn (My Commissions). Rollerna är separata — kursledarens avräkning och affiliatens provision hanteras oberoende av varandra.")} onSave={(v) => save(sid, "combo_body", v)} editMode={editMode} multiline className="mt-1">
            {(v) => <p className="text-sm text-muted-foreground leading-relaxed mt-1">{v}</p>}
          </EditableField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><UserCheck className="h-4 w-4 text-[oklch(0.72_0.12_75)]" /><EH3 sid={sid} fkey="cl_heading" def="Kursledarens vy" /></div>
            <EList sid={sid} fkey="cl_list" def={["Home — Action Items och kommande kurser", "My Courses — registrera och hantera kurser", "My Statistics — statistik och intäkter", "My Settlements — månadsavräkningar"]} />
          </div>
          <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
            <div className="flex items-center gap-2 mb-2"><Award className="h-4 w-4 text-[oklch(0.65_0.15_200)]" /><EH3 sid={sid} fkey="aff_heading" def="Affiliatens tillägg" /></div>
            <EList sid={sid} fkey="aff_list" def={["My Commissions — provisioner via affiliatekod", "Affiliatekod tilldelas av admin i Course Leaders-sidan", "Provision beräknas på bokningar via koden", "Visas separat från kursledarens avräkning"]} />
          </div>
        </div>
        <EImg sid={sid} fkey="screenshot" label="Skärmdump — kursledare med affiliate-roll" />
      </div>
      <AffNavMock active="My Commissions" />
    </div>
  );
}

function SlideAdminSetup() {
  const sid = "admin_setup";
  const { editMode, getField, save } = useEdit();
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-widest mb-1">DEL 5 — AFFILIATE · Slide 3</div>
        <EditableField value={getField(sid, "title", "Admin — Sätta upp en affiliate")} onSave={(v) => save(sid, "title", v)} editMode={editMode} multiline={false}>
          {(v) => <h1 className="text-3xl font-bold text-foreground">{v}</h1>}
        </EditableField>
        <EditableField value={getField(sid, "subtitle", "Steg för steg — från användare till aktiv affiliate")} onSave={(v) => save(sid, "subtitle", v)} editMode={editMode} multiline={false}>
          {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
        </EditableField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <EH3 sid={sid} fkey="steps_heading" def="Steg för admin" />
          <div className="mt-3 space-y-2">
            {[
              { n: 1, text: "Gå till Affiliates i adminmenyn" },
              { n: 2, text: "Välj befintlig användare eller skapa nytt konto" },
              { n: 3, text: "Tilldela affiliate-rollen och sätt affiliatekod" },
              { n: 4, text: "Affiliaten loggar in och ser My Commissions" },
            ].map(({ n, text }) => (
              <div key={n} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[oklch(0.72_0.12_75)]/20 border border-[oklch(0.72_0.12_75)]/40 flex items-center justify-center shrink-0 text-[10px] font-bold text-[oklch(0.72_0.12_75)]">{n}</div>
                <span className="text-xs text-muted-foreground leading-snug">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
          <EH3 sid={sid} fkey="code_heading" def="Affiliatekoden" />
          <div className="mt-2">
            <EList sid={sid} fkey="code_list" def={["Unik kod per affiliate (t.ex. KALLE2024)", "Deltagare anger koden vid bokning på fasciaacademy.com", "Provision beräknas automatiskt på bokningar med koden", "Admin kan se alla aktiva koder i Affiliates-sidan"]} />
          </div>
        </div>
      </div>
      <div className="bg-[oklch(0.17_0.04_255)] rounded-xl p-4 border border-[oklch(0.22_0.04_255)]">
        <EH3 sid={sid} fkey="next_heading" def="Nästa del" />
        <EditableField value={getField(sid, "next_body", "Del 6 täcker Rättare-rollen — hur en rättare ser Exam Queue, granskar inskickade prov och hur godkänt prov + showed leder till att admin utfärdar intyg.")} onSave={(v) => save(sid, "next_body", v)} editMode={editMode} multiline className="mt-1">
          {(v) => <p className="text-sm text-muted-foreground mt-1">{v}</p>}
        </EditableField>
      </div>
      <EImg sid={sid} fkey="screenshot" label="Skärmdump — Affiliates-sidan (admin)" />
    </div>
  );
}

const SLIDES = [
  { id: "affiliate_view", label: "Affiliatens vy", component: <SlideAffiliateView /> },
  { id: "role_combination", label: "Rollkombination", component: <SlideRoleCombination /> },
  { id: "admin_setup", label: "Admin-setup", component: <SlideAdminSetup /> },
];

export default function Del5Affiliate() {
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
            <span className="text-xs text-[oklch(0.65_0.03_250)]">Del 5 — Affiliate</span>
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
