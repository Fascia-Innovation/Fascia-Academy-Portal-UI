import { useState } from "react";
import { Link } from "wouter";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Users,
  FileText,
  Star,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Mail,
  CreditCard,
  Shield,
  Laptop,
  GraduationCap,
  ClipboardList,
  Banknote,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Brand colors ─────────────────────────────────────────────────────────────
const FA_DARK = "oklch(0.17 0.04 255)";
const FA_GOLD = "oklch(0.72 0.12 75)";

// ─── Slide type ───────────────────────────────────────────────────────────────
type Slide = {
  id: string;
  title: string;
  subtitle?: string;
};

const SLIDES: Slide[] = [
  { id: "overview", title: "Kursledarresan", subtitle: "Översikt — vad innebär det att vara kursledare hos FA?" },
  { id: "application", title: "Steg 1 — Ansökan", subtitle: "Ansökningsformuläret och vad som händer i GHL" },
  { id: "review", title: "Steg 2 — Granskning och avtal", subtitle: "NDA, kontrakt och skapande av portalkonto" },
  { id: "registration", title: "Steg 3 — Registrering och FasciaVibes", subtitle: "Registreringsformulär, välkomstmail och betalning" },
  { id: "onboarding", title: "Steg 4 — Onboarding och utbildning", subtitle: "FasciaVibes-material, utbildning i Sollentuna" },
  { id: "active", title: "Steg 5 — Aktiv kursledare", subtitle: "Portalen, licens och vad som händer härnäst" },
  { id: "summary", title: "Sammanfattning", subtitle: "Hela flödet och kontaktinformation" },
];

// ─── Pipeline step component ──────────────────────────────────────────────────
function PipelineStep({
  label,
  sublabel,
  active,
  completed,
  isLast,
}: {
  label: string;
  sublabel?: string;
  active?: boolean;
  completed?: boolean;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
            active
              ? "border-[oklch(0.72_0.12_75)] bg-[oklch(0.72_0.12_75)] text-[oklch(0.17_0.04_255)]"
              : completed
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-[oklch(0.35_0.04_255)] bg-[oklch(0.22_0.04_255)] text-[oklch(0.65_0.03_250)]"
          )}
        >
          {completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-3 w-3 fill-current" />}
        </div>
        <div className="mt-2 text-center max-w-[90px]">
          <div className={cn("text-xs font-semibold leading-tight", active ? "text-[oklch(0.72_0.12_75)]" : completed ? "text-emerald-400" : "text-[oklch(0.65_0.03_250)]")}>
            {label}
          </div>
          {sublabel && <div className="text-[10px] text-[oklch(0.45_0.03_250)] mt-0.5 leading-tight">{sublabel}</div>}
        </div>
      </div>
      {!isLast && (
        <div className={cn("w-8 h-0.5 mx-1 mt-[-20px]", completed ? "bg-emerald-500" : "bg-[oklch(0.28_0.04_255)]")} />
      )}
    </div>
  );
}

// ─── Info card ────────────────────────────────────────────────────────────────
function InfoCard({ icon: Icon, title, children, accent }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-[oklch(0.28_0.04_255)] bg-[oklch(0.20_0.04_255)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", accent || "bg-[oklch(0.72_0.12_75)]/20")}>
          <Icon className={cn("h-4 w-4", accent ? "text-white" : "text-[oklch(0.72_0.12_75)]")} />
        </div>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed space-y-1">{children}</div>
    </div>
  );
}

// ─── Step badge ───────────────────────────────────────────────────────────────
function StepBadge({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-[oklch(0.72_0.12_75)] flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-[oklch(0.17_0.04_255)]">{n}</span>
      </div>
      <span className="text-sm text-[oklch(0.85_0.03_250)]">{label}</span>
    </div>
  );
}

// ─── Slide content ────────────────────────────────────────────────────────────
function SlideOverview() {
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
          <h3 className="text-base font-semibold text-white">Vad är en kursledare hos Fascia Academy?</h3>
          <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">
            En kursledare är en certifierad specialist som licensieras av Fascia Academy för att hålla kurser
            i FA:s namn. Kursledaren driver sin verksamhet självständigt men under FA:s kvalitetsstämpel
            och metodologi.
          </p>
          <div className="space-y-2">
            {[
              "Håller Intro-, Diplo-, Cert- och Viderekurser",
              "Marknadsför och säljer kurser lokalt",
              "Rapporterar deltagare via FA-portalen",
              "Betalar en årlig licensavgift till FA",
              "Fakturerar FA månadsvis för genomförda kurser",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.12_75)] mt-0.5 shrink-0" />
                <span className="text-sm text-[oklch(0.75_0.03_250)]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Kursledarens resa — snabböversikt</h3>
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
                {i < steps.length - 1 && (
                  <div className="w-px h-4 bg-[oklch(0.28_0.04_255)] absolute left-[21px] translate-y-4" />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-[oklch(0.55_0.03_250)] italic">
            Hela processen hanteras i GHL (GoHighLevel) CRM under "Course Leaders"-pipelinen.
          </p>
        </div>
      </div>

      {/* Pipeline visual */}
      <div>
        <h3 className="text-sm font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider mb-4">GHL Pipeline — Course Leaders</h3>
        <div className="bg-[oklch(0.20_0.04_255)] rounded-xl p-5 overflow-x-auto">
          <div className="flex items-start gap-0 min-w-max">
            {steps.map((s, i) => (
              <PipelineStep
                key={i}
                label={s.label}
                sublabel={s.sublabel}
                active={i === steps.length - 1}
                completed={i < steps.length - 1}
                isLast={i === steps.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideApplication() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Ansökningsformuläret</h3>
          <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">
            Ansökan sker via ett formulär på FasciaVibes. Det finns versioner på svenska och engelska.
            Formuläret samlar in grundläggande information om sökanden.
          </p>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider">Formuläret innehåller</div>
            {[
              "Namn, e-post, telefon",
              "Stad och land",
              "Bakgrund och erfarenhet",
              "Motivationsbrev",
              "Samtycke till villkor",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.12_75)]" />
                <span className="text-sm text-[oklch(0.75_0.03_250)]">{item}</span>
              </div>
            ))}
          </div>
          <a
            href="https://member.fasciavibes.com/checkout/course-leader-fascia-academy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-[oklch(0.72_0.12_75)] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Öppna ansökningsformuläret (SE)
          </a>
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Vad händer automatiskt i GHL?</h3>
          <div className="space-y-3">
            {[
              { n: 1, text: "En ny opportunity skapas i Course Leaders-pipelinen med stage: Prospect" },
              { n: 2, text: 'Taggen "cl - prospect" läggs till på kontakten' },
              { n: 3, text: 'Bekräftelsemail skickas: "Vi har mottagit din kursledaransökan"' },
              { n: 4, text: "Intern notifikation skickas till FA-teamet" },
            ].map((item) => (
              <StepBadge key={item.n} n={item.n} label={item.text} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <InfoCard icon={ClipboardList} title="Formulär (SE)">
          <p>Course Leader Application — SE</p>
          <p className="text-[oklch(0.50_0.03_250)] text-xs mt-1">member.fasciavibes.com</p>
        </InfoCard>
        <InfoCard icon={ClipboardList} title="Formulär (EN)">
          <p>Course Leader Application — EN</p>
          <p className="text-[oklch(0.50_0.03_250)] text-xs mt-1">member.fasciavibes.com</p>
        </InfoCard>
        <InfoCard icon={Users} title="GHL Pipeline Stage">
          <p className="font-mono text-[oklch(0.72_0.12_75)]">Prospect</p>
          <p className="text-[oklch(0.50_0.03_250)] text-xs mt-1">Tag: cl - prospect</p>
        </InfoCard>
      </div>
    </div>
  );
}

function SlideReview() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">FA granskar ansökan manuellt</h3>
          <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">
            FA-teamet granskar varje ansökan individuellt. Processen är manuell och sker via GHL CRM.
            Kandidaten kontaktas direkt av FA för vidare dialog.
          </p>
          <div className="space-y-3">
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider">Pipeline-progression</div>
            {[
              { stage: "Prospect", desc: "Ansökan mottagen, granskning pågår" },
              { stage: "NDA Signed", desc: "Sekretessavtal undertecknat av kandidaten" },
              { stage: "Contract Signed", desc: "Kursledaravtal undertecknat — processen fortsätter" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-[oklch(0.22_0.04_255)] rounded-lg p-3">
                <div className="w-2 h-2 rounded-full bg-[oklch(0.72_0.12_75)] mt-1.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-[oklch(0.72_0.12_75)] font-mono">{item.stage}</div>
                  <div className="text-xs text-[oklch(0.65_0.03_250)] mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">När Contract Signed är nått</h3>
          <div className="space-y-3">
            {[
              { n: 1, text: "Admin skapar portalkonto manuellt i User Management" },
              { n: 2, text: "GHL User ID och GHL Contact ID fylls i (båda obligatoriska)" },
              { n: 3, text: "Kursledaren får en registreringslänk via e-post" },
              { n: 4, text: "Kursledaren sätter sitt lösenord och loggar in i portalen" },
            ].map((item) => (
              <StepBadge key={item.n} n={item.n} label={item.text} />
            ))}
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mt-4">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-amber-300">Viktigt — GHL-koppling</div>
                <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                  Portalkontot måste kopplas till rätt GHL-kontakt via GHL Contact ID. Utan denna koppling
                  kan systemet inte hämta bokningar, skicka e-post eller generera avräkningar korrekt.
                </p>
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
          <p className="text-[oklch(0.50_0.03_250)] text-xs mt-1">Roll: Course Leader. GHL User ID + GHL Contact ID krävs.</p>
        </InfoCard>
      </div>
    </div>
  );
}

function SlideRegistration() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Course Leader Registration-formuläret</h3>
          <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">
            Efter signerat avtal fyller kursledaren i ett registreringsformulär i GHL.
            Detta triggar ett GHL-workflow som skickar välkomstmail och betalningslänkar.
          </p>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider">Formuläret samlar in</div>
            {[
              "Bekräftelse av personuppgifter",
              "Faktureringsuppgifter",
              "Preferens för kursort och kurstyp",
              "Samtycke till licensvillkor",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.12_75)]" />
                <span className="text-sm text-[oklch(0.75_0.03_250)]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">GHL Workflow — Confirmation</h3>
          <div className="space-y-3">
            {[
              { n: 1, text: 'Välkomstmail skickas från Victor Forsell (info@fasciaacademy.com)' },
              { n: 2, text: 'Betalningslänkar för licensavgift inkluderas i mailet' },
              { n: 3, text: 'Opportunity flyttas till stage: "Onboarding / FasciaVibes Access"' },
              { n: 4, text: 'FasciaVibes-access aktiveras vid genomförd betalning' },
            ].map((item) => (
              <StepBadge key={item.n} n={item.n} label={item.text} />
            ))}
          </div>
        </div>
      </div>

      {/* Welcome email excerpt */}
      <div className="bg-[oklch(0.22_0.04_255)] rounded-xl p-5 border border-[oklch(0.28_0.04_255)]">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-4 w-4 text-[oklch(0.72_0.12_75)]" />
          <span className="text-sm font-semibold text-white">Välkomstmail — utdrag</span>
          <span className="text-xs text-[oklch(0.50_0.03_250)] ml-auto">Från: Victor Forsell &lt;info@fasciaacademy.com&gt;</span>
        </div>
        <div className="text-xs text-[oklch(0.70_0.03_250)] leading-relaxed space-y-2 font-mono bg-[oklch(0.18_0.04_255)] rounded-lg p-4">
          <p>Hi [Name],</p>
          <p>Welcome to Fascia Academy! We are so excited to have you on board as a course leader.</p>
          <p>To get started, please complete your registration and payment via one of the links below:</p>
          <p className="text-[oklch(0.72_0.12_75)]">
            SE (SEK): member.fasciavibes.com/checkout/course-leader-fascia-academy<br />
            EN (EUR): member.fasciavibes.com/checkout/course-leader-fascia-academy-en
          </p>
          <p>Once payment is confirmed, you will receive access to FasciaVibes...</p>
          <p className="text-[oklch(0.55_0.03_250)]">— Victor Forsell, Fascia Academy</p>
        </div>
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

function SlideOnboarding() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Onboarding i FasciaVibes</h3>
          <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">
            FasciaVibes är FA:s utbildningsplattform. Kursledaren får tillgång till allt material
            som behövs för att hålla kurser — metodologi, presentationer, deltagarhandböcker och mer.
          </p>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider">Tillgängligt i FasciaVibes</div>
            {[
              "Onboarding & Kunskapsbank (SE)",
              "Onboarding & Knowledge Bank (EN)",
              "Course Leader Community",
              "Course Leader Handbook",
              "Kursmaterial och presentationer",
              "Deltagarhandböcker",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-sm text-[oklch(0.75_0.03_250)]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Utbildning i Sollentuna</h3>
          <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">
            Kursledaren bokar en utbildningsdag i Sollentuna hos Victor Forsell. Detta är en praktisk
            genomgång av kursinnehållet och metodologin.
          </p>
          <div className="space-y-3">
            {[
              { n: 1, text: "Kursledaren kontaktar Victor för att boka datum" },
              { n: 2, text: "Praktisk utbildning genomförs i Sollentuna" },
              { n: 3, text: 'GHL-stage uppdateras till "Training Complete"' },
              { n: 4, text: "Check-in med FA innan kursledarens första kurs" },
            ].map((item) => (
              <StepBadge key={item.n} n={item.n} label={item.text} />
            ))}
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <GraduationCap className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-blue-300">Portalen — första inloggning</div>
                <p className="text-xs text-blue-200/80 mt-1 leading-relaxed">
                  Under onboarding loggar kursledaren in i FA-portalen för första gången.
                  Admin visar hur man registrerar kurstillfällen och hanterar deltagare.
                </p>
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

function SlideActive() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Kursledaren är nu aktiv</h3>
          <p className="text-sm text-[oklch(0.75_0.03_250)] leading-relaxed">
            När GHL-stage är satt till "Active" är kursledaren redo att hålla kurser.
            Portalen är det primära verktyget för kursadministration.
          </p>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider">Kursledaren kan nu</div>
            {[
              "Registrera kurstillfällen i portalen",
              "Se bokningar och deltagarlista",
              "Markera deltagare som showed/no-show",
              "Skicka meddelanden till deltagare (via admin-godkännande)",
              "Se och ladda ner avräkningar",
              "Fakturera FA månadsvis",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.12_75)] mt-0.5 shrink-0" />
                <span className="text-sm text-[oklch(0.75_0.03_250)]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Licens och avgifter</h3>

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
            <p className="text-xs text-[oklch(0.55_0.03_250)] leading-relaxed">
              Licensavgiften betalas via FasciaVibes och förnyar kursledarens åtkomst till plattformen.
              Förnyelse sker årsvis. Observera: den initiala registreringsavgiften (5 000 kr / €500) är
              högre — den lägre avgiften gäller från och med förnyelse år 2.
            </p>
          </div>

          <div className="bg-[oklch(0.22_0.04_255)] rounded-xl p-4 space-y-2 border border-[oklch(0.28_0.04_255)]">
            <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider">Avräkning och fakturering</div>
            <div className="space-y-1.5">
              {[
                "Avräkning genereras månadsvis av admin",
                "Kursledaren fakturerar FA med 20 dagars betalningsvillkor",
                "Avräkningsunderlag finns i portalen under My Settlements",
                "PDF-export tillgänglig för varje avräkning",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.12_75)]" />
                  <span className="text-xs text-[oklch(0.70_0.03_250)]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideSummary() {
  const fullFlow = [
    { step: "1", label: "Ansökan", desc: "Formulär på FasciaVibes → GHL Prospect", color: "bg-blue-500" },
    { step: "2", label: "NDA", desc: "Sekretessavtal undertecknas", color: "bg-purple-500" },
    { step: "3", label: "Avtal", desc: "Kursledaravtal → Admin skapar portalkonto", color: "bg-indigo-500" },
    { step: "4", label: "Registrering", desc: "Registreringsformulär → Välkomstmail + betalningslänk", color: "bg-amber-500" },
    { step: "5", label: "FasciaVibes", desc: "Betalning → Access till material och community", color: "bg-orange-500" },
    { step: "6", label: "Utbildning", desc: "Onboarding i FasciaVibes + dag i Sollentuna", color: "bg-rose-500" },
    { step: "7", label: "Aktiv", desc: "Redo att hålla kurser — portalen är primärt verktyg", color: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Hela flödet — sammanfattning</h3>
          <div className="space-y-2">
            {fullFlow.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold", item.color)}>
                  {item.step}
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">{item.label}</span>
                  <span className="text-xs text-[oklch(0.60_0.03_250)] ml-2">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Kontakt och resurser</h3>
          <div className="space-y-3">
            <div className="bg-[oklch(0.22_0.04_255)] rounded-xl p-4 border border-[oklch(0.28_0.04_255)]">
              <div className="text-xs font-semibold text-[oklch(0.65_0.03_250)] uppercase tracking-wider mb-2">Primär kontakt</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-[oklch(0.72_0.12_75)]" />
                  <span className="text-sm text-[oklch(0.75_0.03_250)]">info@fasciaacademy.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-[oklch(0.72_0.12_75)]" />
                  <span className="text-sm text-[oklch(0.75_0.03_250)]">Victor Forsell — Fascia Academy</span>
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
                  <a
                    key={i}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-[oklch(0.72_0.12_75)] hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[oklch(0.72_0.12_75)]/10 border border-[oklch(0.72_0.12_75)]/30 rounded-xl p-4">
            <div className="text-sm font-semibold text-[oklch(0.72_0.12_75)] mb-1">Nästa del</div>
            <p className="text-xs text-[oklch(0.70_0.03_250)] leading-relaxed">
              Del 2: Portalen — Kursledarens vy<br />
              Genomgång av portalen ur kursledarens perspektiv: dashboard, My Courses, My Settlements och notifikationer.
            </p>
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
  const slide = SLIDES[currentSlide];

  function goNext() { if (currentSlide < SLIDES.length - 1) setCurrentSlide(currentSlide + 1); }
  function goPrev() { if (currentSlide > 0) setCurrentSlide(currentSlide - 1); }

  return (
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-[oklch(0.50_0.03_250)]">
            {currentSlide + 1} / {SLIDES.length}
          </span>
        </div>
      </div>

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
          {/* Slide header */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[oklch(0.72_0.12_75)] uppercase tracking-wider">
                Del 1 — Kursledare
              </span>
              <span className="text-[oklch(0.35_0.04_255)]">·</span>
              <span className="text-xs text-[oklch(0.50_0.03_250)]">Slide {currentSlide + 1}</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{slide.title}</h2>
            {slide.subtitle && (
              <p className="text-sm text-[oklch(0.60_0.03_250)]">{slide.subtitle}</p>
            )}
            <div className="h-px bg-[oklch(0.22_0.04_255)] mt-3" />
          </div>

          {/* Slide body */}
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
            currentSlide === 0
              ? "text-[oklch(0.35_0.04_255)] cursor-not-allowed"
              : "text-[oklch(0.65_0.03_250)] hover:text-white hover:bg-[oklch(0.22_0.04_255)]"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Föregående
        </button>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={cn(
                "rounded-full transition-all",
                i === currentSlide
                  ? "w-6 h-2 bg-[oklch(0.72_0.12_75)]"
                  : "w-2 h-2 bg-[oklch(0.28_0.04_255)] hover:bg-[oklch(0.40_0.04_255)]"
              )}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={currentSlide === SLIDES.length - 1}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            currentSlide === SLIDES.length - 1
              ? "text-[oklch(0.35_0.04_255)] cursor-not-allowed"
              : "bg-[oklch(0.72_0.12_75)] text-[oklch(0.17_0.04_255)] hover:opacity-90"
          )}
        >
          Nästa
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
