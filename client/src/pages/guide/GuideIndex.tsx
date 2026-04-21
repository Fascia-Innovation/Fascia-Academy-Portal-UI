import { Link } from "wouter";
import { BookOpen, Users, ClipboardList, LayoutDashboard, Award, GraduationCap, CheckSquare, ChevronRight } from "lucide-react";

type GuideModule = {
  id: string;
  del: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  available: boolean;
  slides: number;
};

const GUIDE_MODULES: GuideModule[] = [
  {
    id: "del1",
    del: "Del 1",
    title: "Kursledare — Från ansökan till aktiv",
    subtitle: "HL-pipeline, NDA & avtal, FasciaVibes-access, portalkonto och licens",
    icon: Users,
    href: "/guide/del1",
    available: true,
    slides: 7,
  },
  {
    id: "del2",
    del: "Del 2",
    title: "Portalen — Kursledarens vy",
    subtitle: "Inloggning, dashboard, My Courses, My Settlements, notifikationer",
    icon: LayoutDashboard,
    href: "/guide/del2",
    available: true,
    slides: 7,
  },
  {
    id: "del3",
    del: "Del 3",
    title: "Kursregistrering och genomförande",
    subtitle: "Registrera kurstillfälle, deltagarlista, markera showed, avräkning och fakturering",
    icon: ClipboardList,
    href: "/guide/del3",
    available: true,
    slides: 7,
  },
  {
    id: "del4",
    del: "Del 4",
    title: "Portalen — Admin",
    subtitle: "Home dashboard, Pending Actions, Settlements, User Management, Exam Queue",
    icon: LayoutDashboard,
    href: "/guide/del4",
    available: true,
    slides: 8,
  },
  {
    id: "del5",
    del: "Del 5",
    title: "Portalen — Affiliate",
    subtitle: "Affiliate-dashboard, provisioner, avräkningar och kommissionsvy",
    icon: Award,
    href: "/guide/del5",
    available: true,
    slides: 3,
  },
  {
    id: "del6",
    del: "Del 6",
    title: "Portalen — Rättare (Exam)",
    subtitle: "Exam Queue, godkänna/underkänna, certifikatutfärdande",
    icon: CheckSquare,
    href: "/guide/del6",
    available: true,
    slides: 3,
  },
  {
    id: "del7",
    del: "Del 7",
    title: "Kursdeltagare — Från bokning till certifikat",
    subtitle: "Bokningsflöde, HL pipeline, kursgenomförande, certifikat och verifiering",
    icon: GraduationCap,
    href: "/guide/del7",
    available: true,
    slides: 6,
  },
];

export default function GuideIndex() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[oklch(0.17_0.04_255)] flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Guide — Fascia Academy Portal</h1>
            <p className="text-sm text-muted-foreground">Interaktiv genomgång av systemet — för administratörer</p>
          </div>
        </div>
        <div className="h-px bg-border mt-4" />
      </div>

      {/* Intro text */}
      <div className="bg-[oklch(0.17_0.04_255)]/5 border border-[oklch(0.17_0.04_255)]/15 rounded-xl p-5">
        <p className="text-sm text-foreground leading-relaxed">
          Den här guiden är en interaktiv genomgång av Fascia Academy-portalen och de processer som omger den.
          Varje del täcker ett specifikt område — från kursledarens resa till adminvyer och certifikathantering.
          Presentationerna är avsedda för intern utbildning och onboarding av FA-teamet.
        </p>
      </div>

      {/* Module grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Presentationer</h2>
        <div className="grid gap-3">
          {GUIDE_MODULES.map((mod) => {
            const Icon = mod.icon;
            if (!mod.available) {
              return (
                <div
                  key={mod.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card opacity-50 cursor-not-allowed"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{mod.del}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Kommer snart</span>
                    </div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">{mod.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{mod.subtitle}</div>
                  </div>
                </div>
              );
            }
            return (
              <Link key={mod.id} href={mod.href}>
                <div className="flex items-center gap-4 p-4 rounded-xl border border-[oklch(0.17_0.04_255)]/20 bg-card hover:bg-[oklch(0.17_0.04_255)]/5 hover:border-[oklch(0.17_0.04_255)]/40 transition-all cursor-pointer group">
                  <div className="w-10 h-10 rounded-lg bg-[oklch(0.17_0.04_255)] flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[oklch(0.17_0.04_255)] uppercase tracking-wider">{mod.del}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{mod.slides} slides</span>
                    </div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">{mod.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{mod.subtitle}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
