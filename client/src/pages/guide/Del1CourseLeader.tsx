/**
 * Del 1 — Kursledare: Från ansökan till aktiv
 *
 * Interactive Swedish presentation with 7 slides covering the full course leader journey.
 * Admins can toggle "Edit Mode" to edit any text field, heading, or list inline.
 * Changes are saved to the DB with optimistic updates for instant feedback.
 *
 * Note: "HL" = HighLevel (GoHighLevel CRM). GHL is not used.
 */
import { useState, useCallback, createContext, useContext } from "react";
import { Link } from "wouter";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  Star,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Mail,
  CreditCard,
  Shield,
  Laptop,
  GraduationCap,
  Circle,
  Pencil,
  PencilOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { EditableField } from "@/components/guide/EditableField";
import { EditableList } from "@/components/guide/EditableList";

// ─── Presentation ID ──────────────────────────────────────────────────────────
const PRES_ID = "del1";

// ─── Edit context ─────────────────────────────────────────────────────────────
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
  getField: (_s, _f, d) => d,
  getList: (_s, _f, d) => d,
});

function useEdit() { return useContext(EditContext); }

// ─── Slide definitions ────────────────────────────────────────────────────────
type Slide = { id: string; title: string; subtitle?: string };

const SLIDES: Slide[] = [
  { id: "overview", title: "Kursledarresan", subtitle: "Översikt — vad innebär det att vara kursledare hos FA?" },
  { id: "application", title: "Steg 1 — Ansökan", subtitle: "Ansökningsformuläret och vad som händer i HL" },
  { id: "review", title: "Steg 2 — Granskning och avtal", subtitle: "NDA, kontrakt och skapande av portalkonto" },
  { id: "registration", title: "Steg 3 — Registrering och FasciaVibes", subtitle: "Registreringsformulär, välkomstmail och betalning" },
  { id: "onboarding", title: "Steg 4 — Onboarding och utbildning", subtitle: "FasciaVibes-material, utbildning i Sollentuna" },
  { id: "active", title: "Steg 5 — Aktiv kursledare", subtitle: "Portalen, licens och vad som händer härnäst" },
  { id: "summary", title: "Sammanfattning", subtitle: "Hela flödet och kontaktinformation" },
];

// ─── Shared sub-components ────────────────────────────────────────────────────
function PipelineStep({ label, sublabel, active, completed, isLast }: {
  label: string; sublabel?: string; active?: boolean; completed?: boolean; isLast?: boolean;
}) {
  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
          active ? "border-[oklch(0.72_0.12_75)] bg-[oklch(0.72_0.12_75)] text-[oklch(0.17_0.04_255)]"
            : completed ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-[oklch(0.35_0.04_255)] bg-[oklch(0.22_0.04_255)] text-[oklch(0.65_0.03_250)]"
        )}>
          {completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-3 w-3 fill-current" />}
        </div>
        <div className="mt-2 text-center max-w-[90px]">
          <div className={cn("text-xs font-semibold leading-tight", active ? "text-[oklch(0.72_0.12_75)]" : completed ? "text-emerald-400" : "text-[oklch(0.65_0.03_250)]")}>{label}</div>
          {sublabel && <div className="text-[10px] text-[oklch(0.45_0.03_250)] mt-0.5 leading-tight">{sublabel}</div>}
        </div>
      </div>
      {!isLast && <div className={cn("w-8 h-0.5 mx-1 mt-[-20px]", completed ? "bg-emerald-500" : "bg-[oklch(0.28_0.04_255)]")} />}
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[oklch(0.28_0.04_255)] bg-[oklch(0.20_0.04_255)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[oklch(0.72_0.12_75)]/20">
          <Icon className="h-4 w-4 text-[oklch(0.72_0.12_75)]" />
        </div>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed space-y-1">{children}</div>
    </div>
  );
}

function StepBadge({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-[oklch(0.72_0.12_75)] flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-xs font-bold text-[oklch(0.17_0.04_255)]">{n}</span>
      </div>
      <span className="text-sm text-[oklch(0.85_0.03_250)]">{label}</span>
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

// ─── Slide: Overview ──────────────────────────────────────────────────────────
function SlideOverview() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "overview";

  const introText = getField(sid, "intro_text",
    "En kursledare är en certifierad specialist som licensieras av Fascia Academy för att hålla kurser i FA:s namn. Kursledaren driver sin verksamhet självständigt men under FA:s kvalitetsstämpel och metodologi."
  );
  const bullets = getList(sid, "bullets", [
    "Håller Intro-, Diplo-, Cert- och Viderekurser",
    "Marknadsför och säljer kurser lokalt",
    "Rapporterar deltagare via FA-portalen",
    "Betalar en årlig licensavgift till FA",
    "Fakturerar FA månadsvis för genomförda kurser",
  ]);
  const pipelineNote = getField(sid, "pipeline_note",
    "Hela processen hanteras i HL (HighLevel) CRM under \"Course Leaders\"-pipelinen."
  );

  const steps = [
    { label: "Ansökan", sublabel: "Prospect" },
    { label: "NDA", sublabel: "NDA Signed" },
    { label: "Avtal", sublabel: "Contract Signed" },
    { label: "Registrering", sublabel: "Onboarding" },
    { label: "Utbildning", sublabel: "Training Complete" },
    { label: "Aktiv", sublabel: "Active" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_what" def="Vad är en kursledare hos Fascia Academy?" />
          <EditableField value={introText} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline className="block">
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <EditableList items={bullets} onSave={(items) => saveList(sid, "bullets", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.12_75)] mt-0.5 shrink-0" />
                    <span className="text-sm text-[oklch(0.75_0.03_250)]">{item}</span>
                  </div>
                ))}
              </div>
            )}
          </EditableList>
        </div>

        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_journey" def="Kursledarens resa — snabböversikt" />
          <div className="bg-[oklch(0.22_0.04_255)] rounded-xl p-4 space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[oklch(0.72_0.12_75)]/20 border border-[oklch(0.72_0.12_75)]/40 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-[oklch(0.72_0.12_75)]">{i + 1}</span>
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-white">{s.label}</span>
                  <span className="text-xs text-[oklch(0.50_0.03_250)] ml-2">({s.sublabel})</span>
                </div>
              </div>
            ))}
          </div>
          <EditableField value={pipelineNote} onSave={(v) => save(sid, "pipeline_note", v)} editMode={editMode} multiline className="block">
            {(v) => <p className="text-xs text-[oklch(0.55_0.03_250)] italic">{v}</p>}
          </EditableField>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider mb-4">HL Pipeline — Course Leaders</h3>
        <div className="bg-[oklch(0.20_0.04_255)] rounded-xl p-5 overflow-x-auto">
          <div className="flex items-start gap-0 min-w-max">
            {steps.map((s, i) => (
              <PipelineStep key={i} label={s.label} sublabel={s.sublabel}
                active={i === steps.length - 1} completed={i < steps.length - 1} isLast={i === steps.length - 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide: Application ───────────────────────────────────────────────────────
function SlideApplication() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "application";

  const introText = getField(sid, "intro_text",
    "Ansökan sker via ett formulär på FasciaVibes. Det finns versioner på svenska och engelska. Formuläret samlar in grundläggande information om sökanden."
  );
  const formFields = getList(sid, "form_fields", [
    "Namn, e-post, telefon",
    "Stad och land",
    "Bakgrund och erfarenhet",
    "Motivationsbrev",
    "Samtycke till villkor",
  ]);
  const ghlSteps = getList(sid, "ghl_steps", [
    "En ny opportunity skapas i Course Leaders-pipelinen med stage: Prospect",
    "Taggen \"cl - prospect\" läggs till på kontakten",
    "Bekräftelsemail skickas: \"Vi har mottagit din kursledaransökan\"",
    "Intern notifikation skickas till FA-teamet",
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_form" def="Ansökningsformuläret" />
          <EditableField value={introText} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline className="block">
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider mb-2">Formuläret innehåller</div>
            <EditableList items={formFields} onSave={(items) => saveList(sid, "form_fields", items)} editMode={editMode}>
              {(items) => (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.12_75)]" />
                      <span className="text-sm text-[oklch(0.75_0.03_250)]">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </EditableList>
          </div>
          <a href="https://member.fasciavibes.com/checkout/course-leader-fascia-academy" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-[oklch(0.72_0.12_75)] hover:underline">
            <ExternalLink className="h-3 w-3" /> Öppna ansökningsformuläret (SE)
          </a>
        </div>

        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_hl" def="Vad händer automatiskt i HL?" />
          <EditableList items={ghlSteps} onSave={(items) => saveList(sid, "ghl_steps", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-3">
                {items.map((text, i) => <StepBadge key={i} n={i + 1} label={text} />)}
              </div>
            )}
          </EditableList>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <InfoCard icon={FileText} title="Formulär (SE)">
          <p>Course Leader Application — SE</p>
          <p className="text-[oklch(0.50_0.03_250)] text-xs mt-1">member.fasciavibes.com</p>
        </InfoCard>
        <InfoCard icon={FileText} title="Formulär (EN)">
          <p>Course Leader Application — EN</p>
          <p className="text-[oklch(0.50_0.03_250)] text-xs mt-1">member.fasciavibes.com</p>
        </InfoCard>
        <InfoCard icon={Users} title="HL Pipeline Stage">
          <p className="font-mono text-[oklch(0.72_0.12_75)]">Prospect</p>
          <p className="text-[oklch(0.50_0.03_250)] text-xs mt-1">Tag: cl - prospect</p>
        </InfoCard>
      </div>
    </div>
  );
}

// ─── Slide: Review ────────────────────────────────────────────────────────────
function SlideReview() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "review";

  const introText = getField(sid, "intro_text",
    "FA-teamet granskar varje ansökan individuellt. Processen är manuell och sker via HL CRM. Kandidaten kontaktas direkt av FA för vidare dialog."
  );
  const pipelineStages = getList(sid, "pipeline_stages", [
    "Prospect — Ansökan mottagen, granskning pågår",
    "NDA Signed — Sekretessavtal undertecknat av kandidaten",
    "Contract Signed — Kursledaravtal undertecknat — processen fortsätter",
  ]);
  const afterContractSteps = getList(sid, "after_contract_steps", [
    "Admin skapar portalkonto manuellt i User Management",
    "HL User ID och HL Contact ID fylls i (båda obligatoriska)",
    "Kursledaren får en registreringslänk via e-post",
    "Kursledaren sätter sitt lösenord och loggar in i portalen",
  ]);
  const ghlWarning = getField(sid, "ghl_warning",
    "Portalkontot måste kopplas till rätt HL-kontakt via HL Contact ID. Utan denna koppling kan systemet inte hämta bokningar, skicka e-post eller generera avräkningar korrekt."
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_review" def="FA granskar ansökan manuellt" />
          <EditableField value={introText} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline className="block">
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider mb-2">Pipeline-progression</div>
            <EditableList items={pipelineStages} onSave={(items) => saveList(sid, "pipeline_stages", items)} editMode={editMode}>
              {(items) => (
                <div className="space-y-2">
                  {items.map((item, i) => {
                    const [stage, ...rest] = item.split(" — ");
                    return (
                      <div key={i} className="flex items-start gap-3 bg-[oklch(0.22_0.04_255)] rounded-lg p-3">
                        <div className="w-2 h-2 rounded-full bg-[oklch(0.72_0.12_75)] mt-1.5 shrink-0" />
                        <div>
                          <div className="text-sm font-semibold text-[oklch(0.72_0.12_75)] font-mono">{stage}</div>
                          {rest.length > 0 && <div className="text-xs text-[oklch(0.65_0.03_250)] mt-0.5">{rest.join(" — ")}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </EditableList>
          </div>
        </div>

        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_after_contract" def="När Contract Signed är nått" />
          <EditableList items={afterContractSteps} onSave={(items) => saveList(sid, "after_contract_steps", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-3">
                {items.map((text, i) => <StepBadge key={i} n={i + 1} label={text} />)}
              </div>
            )}
          </EditableList>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mt-4">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-amber-300">Viktigt — HL-koppling</div>
                <EditableField value={ghlWarning} onSave={(v) => save(sid, "ghl_warning", v)} editMode={editMode} multiline className="block mt-1">
                  {(v) => <p className="text-xs text-amber-200/80 leading-relaxed">{v}</p>}
                </EditableField>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InfoCard icon={FileText} title="NDA — Sekretessavtal">
          <p>Undertecknas av kandidaten innan FA delar kursmaterial och metodologi.</p>
          <p className="text-[oklch(0.50_0.03_250)] text-xs mt-1">Hanteras manuellt av FA</p>
        </InfoCard>
        <InfoCard icon={Laptop} title="Portalkonto — User Management">
          <p>Admin → Settings → User Management → Add User</p>
          <p className="text-[oklch(0.50_0.03_250)] text-xs mt-1">Roll: Course Leader. HL User ID + HL Contact ID krävs.</p>
        </InfoCard>
      </div>
    </div>
  );
}

// ─── Slide: Registration ──────────────────────────────────────────────────────
function SlideRegistration() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "registration";

  const introText = getField(sid, "intro_text",
    "Efter signerat avtal fyller kursledaren i ett registreringsformulär i HL. Detta triggar ett HL-workflow som skickar välkomstmail och betalningslänkar."
  );
  const formFields = getList(sid, "form_fields", [
    "Bekräftelse av personuppgifter",
    "Faktureringsuppgifter",
    "Preferens för kursort och kurstyp",
    "Samtycke till licensvillkor",
  ]);
  const workflowSteps = getList(sid, "workflow_steps", [
    "Välkomstmail skickas från Victor Forsell (info@fasciaacademy.com)",
    "Betalningslänkar för licensavgift inkluderas i mailet",
    "Opportunity flyttas till stage: \"Onboarding / FasciaVibes Access\"",
    "FasciaVibes-access aktiveras vid genomförd betalning",
  ]);
  const emailExcerpt = getField(sid, "email_excerpt",
    "Hi [Name],\n\nWelcome to Fascia Academy! We are so excited to have you on board as a course leader.\n\nTo get started, please complete your registration and payment via one of the links below:\n\nSE (SEK): member.fasciavibes.com/checkout/course-leader-fascia-academy\nEN (EUR): member.fasciavibes.com/checkout/course-leader-fascia-academy-en\n\nOnce payment is confirmed, you will receive access to FasciaVibes..."
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_form" def="Course Leader Registration-formuläret" />
          <EditableField value={introText} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline className="block">
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider mb-2">Formuläret samlar in</div>
            <EditableList items={formFields} onSave={(items) => saveList(sid, "form_fields", items)} editMode={editMode}>
              {(items) => (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.12_75)]" />
                      <span className="text-sm text-[oklch(0.75_0.03_250)]">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </EditableList>
          </div>
        </div>

        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_workflow" def="HL Workflow — Confirmation" />
          <EditableList items={workflowSteps} onSave={(items) => saveList(sid, "workflow_steps", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-3">
                {items.map((text, i) => <StepBadge key={i} n={i + 1} label={text} />)}
              </div>
            )}
          </EditableList>
        </div>
      </div>

      <div className="bg-[oklch(0.22_0.04_255)] rounded-xl p-5 border border-[oklch(0.28_0.04_255)]">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-4 w-4 text-[oklch(0.72_0.12_75)]" />
          <span className="text-sm font-semibold text-white">Välkomstmail — utdrag</span>
          <span className="text-xs text-[oklch(0.50_0.03_250)] ml-auto">Från: Victor Forsell &lt;info@fasciaacademy.com&gt;</span>
        </div>
        <EditableField value={emailExcerpt} onSave={(v) => save(sid, "email_excerpt", v)} editMode={editMode} multiline className="block">
          {(v) => (
            <div className="text-xs text-[oklch(0.70_0.03_250)] leading-relaxed font-mono bg-[oklch(0.18_0.04_255)] rounded-lg p-4 whitespace-pre-wrap">{v}</div>
          )}
        </EditableField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InfoCard icon={CreditCard} title="Betalningslänkar">
          <p>SE (SEK): 5 000 kr inkl. moms</p>
          <p>EN (EUR): €500 inkl. moms</p>
          <p className="text-[oklch(0.50_0.03_250)] text-xs mt-1">Betalas via FasciaVibes checkout</p>
        </InfoCard>
        <InfoCard icon={Star} title="FasciaVibes-access">
          <p>Aktiveras automatiskt vid genomförd betalning.</p>
          <p className="text-[oklch(0.50_0.03_250)] text-xs mt-1">member.fasciavibes.com</p>
        </InfoCard>
      </div>
    </div>
  );
}

// ─── Slide: Onboarding ────────────────────────────────────────────────────────
function SlideOnboarding() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "onboarding";

  const introText = getField(sid, "intro_text",
    "FasciaVibes är FA:s utbildningsplattform. Kursledaren får tillgång till allt material som behövs för att hålla kurser — metodologi, presentationer, deltagarhandböcker och mer."
  );
  const fasciaVibesItems = getList(sid, "fasciavibes_items", [
    "Onboarding & Kunskapsbank (SE)",
    "Onboarding & Knowledge Bank (EN)",
    "Course Leader Community",
    "Course Leader Handbook",
    "Kursmaterial och presentationer",
    "Deltagarhandböcker",
  ]);
  const sollentunaText = getField(sid, "sollentuna_text",
    "Kursledaren bokar en utbildningsdag i Sollentuna hos Victor Forsell. Detta är en praktisk genomgång av kursinnehållet och metodologin."
  );
  const sollentunaSteps = getList(sid, "sollentuna_steps", [
    "Kursledaren kontaktar Victor för att boka datum",
    "Praktisk utbildning genomförs i Sollentuna",
    "HL-stage uppdateras till \"Training Complete\"",
    "Check-in med FA innan kursledarens första kurs",
  ]);
  const portalNote = getField(sid, "portal_note",
    "Under onboarding loggar kursledaren in i FA-portalen för första gången. Admin visar hur man registrerar kurstillfällen och hanterar deltagare."
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_fv" def="Onboarding i FasciaVibes" />
          <EditableField value={introText} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline className="block">
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider mb-2">Tillgängligt i FasciaVibes</div>
            <EditableList items={fasciaVibesItems} onSave={(items) => saveList(sid, "fasciavibes_items", items)} editMode={editMode}>
              {(items) => (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-sm text-[oklch(0.75_0.03_250)]">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </EditableList>
          </div>
        </div>

        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_sollentuna" def="Utbildning i Sollentuna" />
          <EditableField value={sollentunaText} onSave={(v) => save(sid, "sollentuna_text", v)} editMode={editMode} multiline className="block">
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <EditableList items={sollentunaSteps} onSave={(items) => saveList(sid, "sollentuna_steps", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-3">
                {items.map((text, i) => <StepBadge key={i} n={i + 1} label={text} />)}
              </div>
            )}
          </EditableList>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <GraduationCap className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-blue-300">Portalen — första inloggning</div>
                <EditableField value={portalNote} onSave={(v) => save(sid, "portal_note", v)} editMode={editMode} multiline className="block mt-1">
                  {(v) => <p className="text-xs text-blue-200/80 leading-relaxed">{v}</p>}
                </EditableField>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <InfoCard icon={BookOpen} title="FasciaVibes Onboarding (SE)">
          <p>member.fasciavibes.com/c/se-onboarding-och-kunskapsbank-kursledare/</p>
        </InfoCard>
        <InfoCard icon={BookOpen} title="FasciaVibes Onboarding (EN)">
          <p>member.fasciavibes.com/c/en-onboarding-and-knowledge-bank-course-leader/</p>
        </InfoCard>
        <InfoCard icon={Users} title="Course Leader Community">
          <p>member.fasciavibes.com/c/course-leader-information/</p>
        </InfoCard>
      </div>
    </div>
  );
}

// ─── Slide: Active ────────────────────────────────────────────────────────────
function SlideActive() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "active";

  const introText = getField(sid, "intro_text",
    "När HL-stage är satt till \"Active\" är kursledaren redo att hålla kurser. Portalen är det primära verktyget för kursadministration."
  );
  const canDoBullets = getList(sid, "can_do_bullets", [
    "Registrera kurstillfällen i portalen",
    "Se bokningar och deltagarlista",
    "Markera deltagare som showed/no-show",
    "Skicka meddelanden till deltagare (via admin-godkännande)",
    "Se och ladda ner avräkningar",
    "Fakturera FA månadsvis",
  ]);
  const licenseNote = getField(sid, "license_note",
    "Licensavgiften betalas via FasciaVibes och förnyar kursledarens åtkomst till plattformen. Förnyelse sker årsvis. Observera: den initiala registreringsavgiften (5 000 kr / €500) är högre — den lägre avgiften gäller från och med förnyelse år 2."
  );
  const settlementBullets = getList(sid, "settlement_bullets", [
    "Avräkning genereras månadsvis av admin",
    "Kursledaren fakturerar FA med 20 dagars betalningsvillkor",
    "Avräkningsunderlag finns i portalen under My Settlements",
    "PDF-export tillgänglig för varje avräkning",
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_active" def="Kursledaren är nu aktiv" />
          <EditableField value={introText} onSave={(v) => save(sid, "intro_text", v)} editMode={editMode} multiline className="block">
            {(v) => <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">{v}</p>}
          </EditableField>
          <div>
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider mb-2">Kursledaren kan nu</div>
            <EditableList items={canDoBullets} onSave={(items) => saveList(sid, "can_do_bullets", items)} editMode={editMode}>
              {(items) => (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.12_75)] mt-0.5 shrink-0" />
                      <span className="text-sm text-[oklch(0.75_0.03_250)]">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </EditableList>
          </div>
        </div>

        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_license" def="Licens och avgifter" />
          <div className="bg-[oklch(0.22_0.04_255)] rounded-xl p-4 space-y-3 border border-[oklch(0.28_0.04_255)]">
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider">Licensavgift — aktiv kursledare</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[oklch(0.18_0.04_255)] rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-[oklch(0.72_0.12_75)]">4 000 kr</div>
                <div className="text-xs text-[oklch(0.55_0.03_250)] mt-1">per år inkl. moms</div>
                <div className="text-xs text-[oklch(0.45_0.03_250)]">SEK</div>
              </div>
              <div className="bg-[oklch(0.18_0.04_255)] rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-[oklch(0.72_0.12_75)]">€400</div>
                <div className="text-xs text-[oklch(0.55_0.03_250)] mt-1">per år inkl. moms</div>
                <div className="text-xs text-[oklch(0.45_0.03_250)]">EUR</div>
              </div>
            </div>
            <EditableField value={licenseNote} onSave={(v) => save(sid, "license_note", v)} editMode={editMode} multiline className="block">
              {(v) => <p className="text-xs text-[oklch(0.55_0.03_250)] leading-relaxed">{v}</p>}
            </EditableField>
          </div>

          <div className="bg-[oklch(0.22_0.04_255)] rounded-xl p-4 space-y-2 border border-[oklch(0.28_0.04_255)]">
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider">Avräkning och fakturering</div>
            <EditableList items={settlementBullets} onSave={(items) => saveList(sid, "settlement_bullets", items)} editMode={editMode}>
              {(items) => (
                <div className="space-y-1.5">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.12_75)]" />
                      <span className="text-xs text-[oklch(0.70_0.03_250)]">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </EditableList>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide: Summary ───────────────────────────────────────────────────────────
function SlideSummary() {
  const { editMode, getField, getList, save, saveList } = useEdit();
  const sid = "summary";

  const flowSteps = getList(sid, "flow_steps", [
    "Ansökan — Formulär på FasciaVibes → HL Prospect",
    "NDA — Sekretessavtal undertecknas",
    "Avtal — Kursledaravtal → Admin skapar portalkonto",
    "Registrering — Registreringsformulär → Välkomstmail + betalningslänk",
    "FasciaVibes — Betalning → Access till material och community",
    "Utbildning — Onboarding i FasciaVibes + dag i Sollentuna",
    "Aktiv — Redo att hålla kurser — portalen är primärt verktyg",
  ]);
  const contactEmail = getField(sid, "contact_email", "info@fasciaacademy.com");
  const contactName = getField(sid, "contact_name", "Victor Forsell — Fascia Academy");
  const nextPartText = getField(sid, "next_part_text",
    "Del 2: Portalen — Kursledarens vy\nGenomgång av portalen ur kursledarens perspektiv: dashboard, My Courses, My Settlements och notifikationer."
  );

  const stepColors = ["bg-blue-500", "bg-purple-500", "bg-indigo-500", "bg-amber-500", "bg-orange-500", "bg-rose-500", "bg-emerald-500"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_flow" def="Hela flödet — sammanfattning" />
          <EditableList items={flowSteps} onSave={(items) => saveList(sid, "flow_steps", items)} editMode={editMode}>
            {(items) => (
              <div className="space-y-2">
                {items.map((item, i) => {
                  const [label, ...rest] = item.split(" — ");
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold", stepColors[i] || "bg-gray-500")}>
                        {i + 1}
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-white">{label}</span>
                        {rest.length > 0 && <span className="text-xs text-[oklch(0.60_0.03_250)] ml-2">{rest.join(" — ")}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </EditableList>
        </div>

        <div className="space-y-4">
          <EH3 sid={sid} fkey="h_contact" def="Kontakt och resurser" />
          <div className="space-y-3">
            <div className="bg-[oklch(0.22_0.04_255)] rounded-xl p-4 border border-[oklch(0.28_0.04_255)]">
              <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider mb-2">Primär kontakt</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-[oklch(0.72_0.12_75)]" />
                  <EditableField value={contactEmail} onSave={(v) => save(sid, "contact_email", v)} editMode={editMode} className="inline">
                    {(v) => <span className="text-sm text-[oklch(0.75_0.03_250)]">{v}</span>}
                  </EditableField>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-[oklch(0.72_0.12_75)]" />
                  <EditableField value={contactName} onSave={(v) => save(sid, "contact_name", v)} editMode={editMode} className="inline">
                    {(v) => <span className="text-sm text-[oklch(0.75_0.03_250)]">{v}</span>}
                  </EditableField>
                </div>
              </div>
            </div>

            <div className="bg-[oklch(0.22_0.04_255)] rounded-xl p-4 border border-[oklch(0.28_0.04_255)]">
              <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider mb-2">Viktiga länkar</div>
              <div className="space-y-1.5">
                {[
                  { label: "FasciaVibes (plattform)", href: "https://member.fasciavibes.com" },
                  { label: "Ansökan (SE)", href: "https://member.fasciavibes.com/checkout/course-leader-fascia-academy" },
                  { label: "Ansökan (EN)", href: "https://member.fasciavibes.com/checkout/course-leader-fascia-academy-en" },
                  { label: "fasciaacademy.com", href: "https://www.fasciaacademy.com" },
                ].map((link, i) => (
                  <a key={i} href={link.href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-[oklch(0.72_0.12_75)] hover:underline">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[oklch(0.72_0.12_75)]/10 border border-[oklch(0.72_0.12_75)]/30 rounded-xl p-4">
            <div className="text-sm font-semibold text-[oklch(0.72_0.12_75)] mb-1">Nästa del</div>
            <EditableField value={nextPartText} onSave={(v) => save(sid, "next_part_text", v)} editMode={editMode} multiline className="block">
              {(v) => <p className="text-xs text-[oklch(0.70_0.03_250)] leading-relaxed whitespace-pre-line">{v}</p>}
            </EditableField>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide renderer ───────────────────────────────────────────────────────────
function renderSlide(id: string) {
  switch (id) {
    case "overview": return <SlideOverview />;
    case "application": return <SlideApplication />;
    case "review": return <SlideReview />;
    case "registration": return <SlideRegistration />;
    case "onboarding": return <SlideOnboarding />;
    case "active": return <SlideActive />;
    case "summary": return <SlideSummary />;
    default: return null;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Del1CourseLeader() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const slide = SLIDES[currentSlide];

  const utils = trpc.useUtils();

  // Load all content overrides from DB
  const { data: contentMap = {} } = trpc.guide.getContent.useQuery({ presentationId: PRES_ID });
  const upsert = trpc.guide.upsertContent.useMutation({
    onSuccess: () => {
      void utils.guide.getContent.invalidate({ presentationId: PRES_ID });
    },
  });

  function goNext() { if (currentSlide < SLIDES.length - 1) setCurrentSlide(currentSlide + 1); }
  function goPrev() { if (currentSlide > 0) setCurrentSlide(currentSlide - 1); }

  const getField = useCallback((slideId: string, fieldKey: string, defaultVal: string): string => {
    const key = `${slideId}__${fieldKey}`;
    return contentMap[key] ?? defaultVal;
  }, [contentMap]);

  const getList = useCallback((slideId: string, fieldKey: string, defaultItems: string[]): string[] => {
    const key = `${slideId}__${fieldKey}`;
    const raw = contentMap[key];
    if (!raw) return defaultItems;
    try { return JSON.parse(raw) as string[]; } catch { return defaultItems; }
  }, [contentMap]);

  // Save a plain text field — with optimistic update
  const save = useCallback(async (slideId: string, fieldKey: string, value: string) => {
    utils.guide.getContent.setData(
      { presentationId: PRES_ID },
      (old) => ({ ...(old ?? {}), [`${slideId}__${fieldKey}`]: value })
    );
    await upsert.mutateAsync({ presentationId: PRES_ID, slideId, fieldKey, content: value });
  }, [upsert, utils]);

  // Save a list field — serialise to JSON, then optimistic update
  const saveList = useCallback(async (slideId: string, fieldKey: string, items: string[]) => {
    const value = JSON.stringify(items);
    utils.guide.getContent.setData(
      { presentationId: PRES_ID },
      (old) => ({ ...(old ?? {}), [`${slideId}__${fieldKey}`]: value })
    );
    await upsert.mutateAsync({ presentationId: PRES_ID, slideId, fieldKey, content: value });
  }, [upsert, utils]);

  return (
    <EditContext.Provider value={{ editMode, save, saveList, getField, getList }}>
      <div className="min-h-screen bg-[oklch(0.14_0.04_255)] flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[oklch(0.22_0.04_255)] bg-[oklch(0.17_0.04_255)] shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/guide">
              <button className="flex items-center gap-1.5 text-xs text-[oklch(0.55_0.03_250)] hover:text-white transition-colors">
                <ChevronLeft className="h-3.5 w-3.5" />
                Guide
              </button>
            </Link>
            <span className="text-[oklch(0.35_0.04_255)]">/</span>
            <span className="text-xs text-[oklch(0.65_0.03_250)]">Del 1</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditMode((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                editMode
                  ? "bg-[oklch(0.72_0.12_75)] text-[oklch(0.17_0.04_255)] border-[oklch(0.72_0.12_75)]"
                  : "bg-transparent text-[oklch(0.65_0.03_250)] border-[oklch(0.28_0.04_255)] hover:border-[oklch(0.72_0.12_75)] hover:text-[oklch(0.72_0.12_75)]"
              )}
              title={editMode ? "Avsluta redigeringsläge" : "Aktivera redigeringsläge"}
            >
              {editMode ? <PencilOff className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {editMode ? "Avsluta redigering" : "Redigera"}
            </button>
            <span className="text-xs text-[oklch(0.50_0.03_250)]">
              {currentSlide + 1} / {SLIDES.length}
            </span>
          </div>
        </div>

        {/* Edit mode banner */}
        {editMode && (
          <div className="flex items-center gap-2 px-6 py-2 bg-[oklch(0.72_0.12_75)]/10 border-b border-[oklch(0.72_0.12_75)]/30 shrink-0">
            <Pencil className="h-3.5 w-3.5 text-[oklch(0.72_0.12_75)]" />
            <span className="text-xs text-[oklch(0.72_0.12_75)] font-medium">Redigeringsläge aktivt</span>
            <span className="text-xs text-[oklch(0.60_0.03_250)]">— Klicka på valfri text, rubrik eller lista för att redigera. Ändringar sparas automatiskt.</span>
          </div>
        )}

        {/* Slide tabs */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-[oklch(0.22_0.04_255)] bg-[oklch(0.17_0.04_255)] overflow-x-auto shrink-0">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(i)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                i === currentSlide
                  ? "bg-[oklch(0.72_0.12_75)] text-[oklch(0.17_0.04_255)]"
                  : "text-[oklch(0.55_0.03_250)] hover:text-white hover:bg-[oklch(0.22_0.04_255)]"
              )}
            >
              <span className="opacity-60">{i + 1}.</span>
              {s.title}
            </button>
          ))}
        </div>

        {/* Slide content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-wider">Del 1 — Kursledare</span>
                <span className="text-[oklch(0.35_0.04_255)]">·</span>
                <span className="text-xs text-[oklch(0.50_0.03_250)]">Slide {currentSlide + 1}</span>
              </div>
              <h2 className="text-2xl font-bold text-white">{slide.title}</h2>
              {slide.subtitle && <p className="text-sm text-[oklch(0.60_0.03_250)]">{slide.subtitle}</p>}
              <div className="h-px bg-[oklch(0.22_0.04_255)] mt-3" />
            </div>
            {renderSlide(slide.id)}
          </div>
        </div>

        {/* Bottom nav */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-[oklch(0.22_0.04_255)] bg-[oklch(0.17_0.04_255)] shrink-0">
          <button
            onClick={goPrev}
            disabled={currentSlide === 0}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              currentSlide === 0 ? "text-[oklch(0.35_0.04_255)] cursor-not-allowed" : "text-[oklch(0.65_0.03_250)] hover:text-white hover:bg-[oklch(0.22_0.04_255)]"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Föregående
          </button>

          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={cn("rounded-full transition-all", i === currentSlide ? "w-6 h-2 bg-[oklch(0.72_0.12_75)]" : "w-2 h-2 bg-[oklch(0.28_0.04_255)] hover:bg-[oklch(0.40_0.04_255)]")}
              />
            ))}
          </div>

          <button
            onClick={goNext}
            disabled={currentSlide === SLIDES.length - 1}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              currentSlide === SLIDES.length - 1 ? "text-[oklch(0.35_0.04_255)] cursor-not-allowed" : "bg-[oklch(0.72_0.12_75)] text-[oklch(0.17_0.04_255)] hover:opacity-90"
            )}
          >
            Nästa
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </EditContext.Provider>
  );
}
