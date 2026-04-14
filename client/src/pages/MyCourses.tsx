import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useDashAuth } from "@/contexts/DashAuthContext";
import MonthPicker from "@/components/ui/MonthPicker";
import {
  Loader2, BookOpen, ChevronDown, ChevronUp, Hash, Info,
  CalendarDays, MapPin, Clock, ExternalLink, History, Banknote,
  Users, TrendingUp,
} from "lucide-react";

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}
function fmtPrecise(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("sv-SE", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

const COURSE_TYPE_LABELS: Record<string, string> = {
  intro: "Introduktionskurs",
  diplo: "Diplomerad Fasciaspecialist",
  cert: "Certifierad Fasciaspecialist",
  vidare: "Vidareutbildning",
};

// ─── Participant row ──────────────────────────────────────────────────────────
type Participant = {
  contactId: string;
  contactName: string;
  paidAmountInclVAT: number;
  paidAmountExclVAT: number;
  vatAmount: number;
  transactionFee: number;
  faMargin: number;
  affiliateCommission: number;
  affiliateCode: string | null;
  courseLeaderPayout: number;
  currency: "SEK" | "EUR";
};

function ParticipantRow({ p }: { p: Participant }) {
  const [open, setOpen] = useState(false);
  const c = p.currency;
  return (
    <>
      <tr
        className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <td className="py-3 px-4 text-sm font-medium text-foreground">{p.contactName}</td>
        <td className="py-3 px-4 text-sm text-right text-foreground">{fmtPrecise(p.paidAmountInclVAT, c)}</td>
        <td className="py-3 px-4 text-sm text-right text-muted-foreground">{fmtPrecise(p.paidAmountExclVAT, c)}</td>
        <td className="py-3 px-4 text-sm text-right">
          {p.affiliateCode ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
              <Hash className="h-3 w-3" />{p.affiliateCode}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
        <td className="py-3 px-4 text-sm text-right font-semibold text-[oklch(0.22_0.04_255)]">
          {fmtPrecise(p.courseLeaderPayout, c)}
        </td>
        <td className="py-3 px-4 text-right">
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />}
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="px-4 py-4">
            <div className="bg-white rounded-lg border border-border p-4 max-w-lg">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Payout Breakdown — {p.contactName}
              </div>
              <div className="space-y-2">
                {[
                  { label: "Paid (incl. 25% VAT)", value: p.paidAmountInclVAT, sign: "+" },
                  { label: "VAT (25%)", value: -p.vatAmount, sign: "−" },
                  { label: "= Excl. VAT", value: p.paidAmountExclVAT, sign: "", bold: true },
                  { label: "Transaction fee (3.1%)", value: -p.transactionFee, sign: "−" },
                  { label: "FA margin", value: -p.faMargin, sign: "−" },
                  ...(p.affiliateCommission > 0 ? [{ label: `Affiliate commission (${p.affiliateCode}) 30%`, value: -p.affiliateCommission, sign: "−" }] : []),
                  { label: "Your payout", value: p.courseLeaderPayout, sign: "=", bold: true, highlight: true },
                ].map((row) => (
                  <div key={row.label} className={`flex items-center justify-between text-sm ${row.highlight ? "pt-2 border-t border-border" : ""}`}>
                    <span className={`${row.bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {row.sign && <span className="mr-1 text-xs">{row.sign}</span>}
                      {row.label}
                    </span>
                    <span className={`font-mono ${row.highlight ? "font-bold text-[oklch(0.22_0.04_255)]" : row.value < 0 ? "text-red-600" : "text-foreground"} ${row.bold ? "font-semibold" : ""}`}>
                      {row.value < 0 ? "−" : ""}{fmtPrecise(Math.abs(row.value), c)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Course date card ─────────────────────────────────────────────────────────
type CourseRow = {
  id: number;
  courseType: string;
  language: string;
  city: string;
  country: string;
  venueName: string | null;
  address: string | null;
  startDate: Date | string;
  endDate: Date | string;
  maxSeats: number;
  ghlCalendarId: string;
  notes: string | null;
};

function CourseDateCard({ row, past }: { row: CourseRow; past?: boolean }) {
  const label = COURSE_TYPE_LABELS[row.courseType] ?? row.courseType;
  const langFlag = row.language === "sv" ? "🇸🇪" : "🇬🇧";
  const bookUrl = `https://api.leadconnectorhq.com/widget/booking/${row.ghlCalendarId}`;

  return (
    <div className={`bg-card border border-border rounded-xl p-5 flex flex-col gap-3 ${past ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-[oklch(0.22_0.04_255)]/10 text-[oklch(0.22_0.04_255)] font-medium">
              {langFlag} {label}
            </span>
            {!past && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                Upcoming
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            {fmtDate(row.startDate)}
            {new Date(row.startDate).toDateString() !== new Date(row.endDate).toDateString() && (
              <span className="text-muted-foreground font-normal"> – {fmtDate(row.endDate)}</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">Max seats</div>
          <div className="text-lg font-bold text-foreground">{row.maxSeats}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span>{row.venueName ? `${row.venueName}, ` : ""}{row.city}, {row.country}</span>
      </div>
      {row.address && (
        <div className="text-xs text-muted-foreground pl-5">{row.address}</div>
      )}

      {!past && (
        <a
          href={bookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[oklch(0.22_0.04_255)] hover:underline mt-1"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View booking page
        </a>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MyCourses() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const { user } = useDashAuth();

  const { data: payoutData, isLoading: payoutLoading, error: payoutError } = trpc.courseLeader.myData.useQuery({ year, month });
  const { data: schedule, isLoading: scheduleLoading } = trpc.courseDates.myCourseSchedule.useQuery();

  const publicPageUrl = `/courses?lang=sv&courseLeaderName=${encodeURIComponent(user?.name ?? "")}`;

  const historyToShow = showAllHistory
    ? (schedule?.past ?? [])
    : (schedule?.past ?? []).slice(0, 3);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            My Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.name} — course schedule and payout overview
          </p>
        </div>
        <a
          href={publicPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          My public booking page
        </a>
      </div>

      {/* ── Upcoming Courses ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Upcoming Courses
          </h2>
        </div>

        {scheduleLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading schedule...
          </div>
        ) : !schedule?.upcoming.length ? (
          <div className="bg-muted/30 rounded-xl border border-border p-8 text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No upcoming published course dates.</p>
            <p className="text-xs mt-1">Contact admin to add or publish your course dates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedule.upcoming.map((row) => (
              <CourseDateCard key={row.id} row={row as CourseRow} />
            ))}
          </div>
        )}
      </section>

      {/* ── Payout Overview ── */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
            <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Payout Overview
            </h2>
          </div>
          <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        </div>

        {payoutLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : payoutError ? (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{payoutError.message}</div>
        ) : !payoutData?.courses.length ? (
          <div className="bg-muted/30 rounded-xl border border-border p-8 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No completed participants found for this period.</p>
            <p className="text-xs mt-1">Only participants with status "Showed" are included in settlements.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Users className="h-3.5 w-3.5" /> Total participants
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {payoutData.courses.reduce((s, c) => s + c.participants.length, 0)}
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <BookOpen className="h-3.5 w-3.5" /> Courses this period
                </div>
                <div className="text-2xl font-bold text-foreground">{payoutData.courses.length}</div>
              </div>
              <div className="bg-[oklch(0.22_0.04_255)] rounded-xl border border-[oklch(0.30_0.05_255)] p-5">
                <div className="flex items-center gap-1.5 text-xs text-[oklch(0.72_0.12_75)] mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Payout (SEK)
                </div>
                <div className="text-2xl font-bold text-white">
                  {fmt(payoutData.courses.filter(c => c.currency === "SEK").reduce((s, c) => s + c.totalPayout, 0), "SEK")}
                </div>
              </div>
              <div className="bg-[oklch(0.22_0.04_255)] rounded-xl border border-[oklch(0.30_0.05_255)] p-5">
                <div className="flex items-center gap-1.5 text-xs text-[oklch(0.72_0.12_75)] mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Payout (EUR)
                </div>
                <div className="text-2xl font-bold text-white">
                  {fmt(payoutData.courses.filter(c => c.currency === "EUR").reduce((s, c) => s + c.totalPayout, 0), "EUR")}
                </div>
              </div>
            </div>

            {/* Per-course breakdown */}
            {payoutData.courses.map((course, idx) => (
              <div key={idx} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-6 py-4 bg-muted/30 border-b border-border flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {course.calendarName}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[oklch(0.22_0.04_255)]/10 text-[oklch(0.22_0.04_255)] font-medium capitalize">
                        {course.courseType}
                      </span>
                      <span className="text-xs text-muted-foreground">{course.currency}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Total payout</div>
                    <div className="text-lg font-bold text-[oklch(0.22_0.04_255)]">
                      {fmt(course.totalPayout, course.currency)}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/20">
                      <tr>
                        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Participant</th>
                        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Paid (incl. VAT)</th>
                        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Excl. VAT</th>
                        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Affiliate code</th>
                        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Your payout</th>
                        <th className="py-3 px-4 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.participants.map((p) => (
                        <ParticipantRow key={p.contactId} p={p} />
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      <tr>
                        <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-foreground">Total</td>
                        <td className="py-3 px-4 text-sm text-right font-bold text-[oklch(0.22_0.04_255)]">
                          {fmt(course.totalPayout, course.currency)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <strong>Note:</strong> Payout = Paid amount excl. VAT − 3.1% transaction fee − FA margin − affiliate commission (if applicable).
              Please invoice Fascia Academy with 20-day payment terms.
            </div>
          </div>
        )}
      </section>

      {/* ── Course History ── */}
      {(schedule?.past?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
            <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Course History
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyToShow.map((row) => (
              <CourseDateCard key={row.id} row={row as CourseRow} past />
            ))}
          </div>
          {(schedule?.past?.length ?? 0) > 3 && (
            <button
              onClick={() => setShowAllHistory(!showAllHistory)}
              className="mt-4 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              {showAllHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showAllHistory ? "Show less" : `Show all ${schedule?.past?.length} past courses`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
