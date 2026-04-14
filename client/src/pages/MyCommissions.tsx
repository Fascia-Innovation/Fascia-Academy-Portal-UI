import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useDashAuth } from "@/contexts/DashAuthContext";
import MonthPicker from "@/components/ui/MonthPicker";
import { Loader2, TrendingUp, Hash } from "lucide-react";

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

const COURSE_TYPE_LABEL: Record<string, string> = {
  intro: "Intro Course",
  diplo: "Diploma Course",
  cert: "Certification",
  vidare: "Advanced",
};

export default function MyCommissions() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { user } = useDashAuth();

  const { data, isLoading, error } = trpc.affiliate.myData.useQuery({ year, month });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            My Commissions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.name} — attended bookings and commission earned
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
      ) : !data?.affiliateCode ? (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No affiliate code assigned to your account.</p>
          <p className="text-xs mt-1">Contact your administrator to set up your affiliate code.</p>
        </div>
      ) : !data.bookings.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No attended bookings found for this period.</p>
          <p className="text-xs mt-1">Commissions are earned when participants attend the course (status: Showed).</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Affiliate code + summary */}
          <div className="bg-[oklch(0.22_0.04_255)] rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-[oklch(0.72_0.12_75)]/20">
                <Hash className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-0.5">Your Affiliate Code</div>
                <div className="text-xl font-bold font-mono">{data.affiliateCode}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
              <div>
                <div className="text-xs text-white/60 mb-1">Attended Bookings</div>
                <div className="text-2xl font-bold">{data.bookings.length}</div>
              </div>
              <div>
                <div className="text-xs text-[oklch(0.72_0.12_75)] mb-1">Commission (SEK)</div>
                <div className="text-2xl font-bold">{fmt(data.totalSEK, "SEK")}</div>
              </div>
              <div>
                <div className="text-xs text-[oklch(0.72_0.12_75)] mb-1">Commission (EUR)</div>
                <div className="text-2xl font-bold">{fmt(data.totalEUR, "EUR")}</div>
              </div>
            </div>
          </div>

          {/* Booking table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                Booking Details
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Participant</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Course</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Paid (incl. VAT)</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Excl. VAT</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Commission (30%)</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Currency</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bookings.map((b, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-sm font-medium text-foreground">{b.contactName}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        <div>{COURSE_TYPE_LABEL[b.courseType] ?? b.courseType}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-foreground">{fmt(b.paidAmountInclVAT, b.currency)}</td>
                      <td className="py-3 px-4 text-sm text-right text-muted-foreground">{fmt(b.paidAmountExclVAT, b.currency)}</td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-[oklch(0.22_0.04_255)]">
                        {fmt(b.commission, b.currency)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">{b.currency}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr>
                    <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-foreground">Total</td>
                    <td className="py-3 px-4 text-sm text-right">
                      {data.totalSEK > 0 && <div className="font-bold text-[oklch(0.22_0.04_255)]">{fmt(data.totalSEK, "SEK")}</div>}
                      {data.totalEUR > 0 && <div className="font-bold text-[oklch(0.22_0.04_255)]">{fmt(data.totalEUR, "EUR")}</div>}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <strong>How commissions work:</strong> You earn 30% of the paid amount excl. VAT for each participant who attends a course using your affiliate code.
            Commissions are settled monthly and included in your settlement report sent to info@fasciaacademy.com.
          </div>
        </div>
      )}
    </div>
  );
}
