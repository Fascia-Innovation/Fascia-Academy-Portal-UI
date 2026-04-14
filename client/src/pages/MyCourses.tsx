import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useDashAuth } from "@/contexts/DashAuthContext";
import MonthPicker from "@/components/ui/MonthPicker";
import { Loader2, BookOpen, ChevronDown, ChevronUp, Hash, Info } from "lucide-react";

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function fmtPrecise(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

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

export default function MyCourses() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { user } = useDashAuth();

  const { data, isLoading, error } = trpc.courseLeader.myData.useQuery({ year, month });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            My Courses
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.name} — participant list and payout breakdown
          </p>
        </div>
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{error.message}</div>
      ) : !data?.courses.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No attended participants found for this period.</p>
          <p className="text-xs mt-1">Only participants with status "Showed" are included in settlements.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="text-xs text-muted-foreground mb-1">Total Participants</div>
              <div className="text-2xl font-bold text-foreground">
                {data.courses.reduce((s, c) => s + c.participants.length, 0)}
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="text-xs text-muted-foreground mb-1">Courses This Month</div>
              <div className="text-2xl font-bold text-foreground">{data.courses.length}</div>
            </div>
            <div className="bg-[oklch(0.22_0.04_255)] rounded-xl border border-[oklch(0.30_0.05_255)] p-5">
              <div className="text-xs text-[oklch(0.72_0.12_75)] mb-1">Total Payout (SEK)</div>
              <div className="text-2xl font-bold text-white">
                {fmt(data.courses.filter(c => c.currency === "SEK").reduce((s, c) => s + c.totalPayout, 0), "SEK")}
              </div>
            </div>
            <div className="bg-[oklch(0.22_0.04_255)] rounded-xl border border-[oklch(0.30_0.05_255)] p-5">
              <div className="text-xs text-[oklch(0.72_0.12_75)] mb-1">Total Payout (EUR)</div>
              <div className="text-2xl font-bold text-white">
                {fmt(data.courses.filter(c => c.currency === "EUR").reduce((s, c) => s + c.totalPayout, 0), "EUR")}
              </div>
            </div>
          </div>

          {/* Per-course breakdown */}
          {data.courses.map((course, idx) => (
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
                      <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Affiliate Code</th>
                      <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Your Payout</th>
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
            Please issue your invoice to Fascia Academy with payment terms of 20 days.
          </div>
        </div>
      )}
    </div>
  );
}
