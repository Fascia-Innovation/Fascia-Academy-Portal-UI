import { useState } from "react";
import { trpc } from "@/lib/trpc";
import MonthPicker from "@/components/ui/MonthPicker";
import { Loader2, Award, Hash } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export default function AffiliateRanking() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, error } = trpc.admin.affiliateRanking.useQuery({ year, month });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Affiliate Rankings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Bookings and commissions earned per affiliate code</p>
        </div>
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{error.message}</div>
      ) : !data?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No affiliate-referred attendances found for this period.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="text-xs text-muted-foreground mb-1">Active Affiliates</div>
              <div className="text-2xl font-bold text-foreground">{data.length}</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="text-xs text-muted-foreground mb-1">Total Bookings</div>
              <div className="text-2xl font-bold text-foreground">{data.reduce((s, a) => s + a.bookings, 0)}</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="text-xs text-muted-foreground mb-1">Total Commissions (SEK)</div>
              <div className="text-2xl font-bold text-foreground">{fmt(data.reduce((s, a) => s + a.commSEK, 0), "SEK")}</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="text-xs text-muted-foreground mb-1">Total Commissions (EUR)</div>
              <div className="text-2xl font-bold text-foreground">{fmt(data.reduce((s, a) => s + a.commEUR, 0), "EUR")}</div>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-card rounded-xl border border-border p-6 mb-8">
            <h2 className="text-base font-semibold text-foreground mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Bookings by Affiliate Code
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 250)" />
                <XAxis dataKey="code" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid oklch(0.88 0.01 250)", fontSize: "12px" }} />
                <Bar dataKey="bookings" name="Bookings" fill="oklch(0.72 0.12 75)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>All Affiliates</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">#</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Affiliate Code</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Attended Bookings</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Commission (SEK)</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Commission (EUR)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((aff, i) => (
                    <tr key={aff.code} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-sm text-muted-foreground">{i + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-mono font-medium text-foreground">{aff.code}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-foreground">{aff.bookings}</td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-foreground">{aff.commSEK > 0 ? fmt(aff.commSEK, "SEK") : "—"}</td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-foreground">{aff.commEUR > 0 ? fmt(aff.commEUR, "EUR") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
