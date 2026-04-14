import { useState } from "react";
import { trpc } from "@/lib/trpc";
import MonthPicker from "@/components/ui/MonthPicker";
import { Loader2, Medal, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export default function CourseLeaderRanking() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, error } = trpc.admin.courseLeaderRanking.useQuery({ year, month });

  const rankColors = ["text-yellow-500", "text-slate-400", "text-amber-600"];
  const rankBg = ["bg-yellow-50 border-yellow-200", "bg-slate-50 border-slate-200", "bg-amber-50 border-amber-200"];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Course Leader Rankings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Performance by participants, revenue, and payout</p>
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
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No attended appointments found for this period.</p>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {data.length >= 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {data.slice(0, 3).map((leader, i) => (
                <div key={leader.name} className={`rounded-xl border p-5 ${rankBg[i] ?? "bg-card border-border"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Medal className={`h-5 w-5 ${rankColors[i] ?? "text-muted-foreground"}`} />
                    <span className="text-sm font-medium text-muted-foreground">#{i + 1}</span>
                  </div>
                  <div className="font-semibold text-foreground text-lg mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {leader.name}
                  </div>
                  <div className="text-3xl font-bold text-foreground mb-3">{leader.participants}</div>
                  <div className="text-xs text-muted-foreground">participants</div>
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
                    {leader.revSEK > 0 && <div className="text-sm text-muted-foreground">Revenue: <span className="font-medium text-foreground">{fmt(leader.revSEK, "SEK")}</span></div>}
                    {leader.revEUR > 0 && <div className="text-sm text-muted-foreground">Revenue: <span className="font-medium text-foreground">{fmt(leader.revEUR, "EUR")}</span></div>}
                    {leader.payoutSEK > 0 && <div className="text-sm text-muted-foreground">Payout: <span className="font-medium text-foreground">{fmt(leader.payoutSEK, "SEK")}</span></div>}
                    {leader.payoutEUR > 0 && <div className="text-sm text-muted-foreground">Payout: <span className="font-medium text-foreground">{fmt(leader.payoutEUR, "EUR")}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bar chart */}
          <div className="bg-card rounded-xl border border-border p-6 mb-8">
            <h2 className="text-base font-semibold text-foreground mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Participants by Course Leader
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 250)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid oklch(0.88 0.01 250)", fontSize: "12px" }}
                />
                <Bar dataKey="participants" name="Participants" fill="oklch(0.22 0.04 255)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Full table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                All Course Leaders
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">#</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Name</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Participants</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Revenue (SEK)</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Revenue (EUR)</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Payout (SEK)</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Payout (EUR)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((leader, i) => (
                    <tr key={leader.name} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-sm text-muted-foreground">{i + 1}</td>
                      <td className="py-3 px-4 text-sm font-medium text-foreground">{leader.name}</td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-foreground">{leader.participants}</td>
                      <td className="py-3 px-4 text-sm text-right text-foreground">{leader.revSEK > 0 ? fmt(leader.revSEK, "SEK") : "—"}</td>
                      <td className="py-3 px-4 text-sm text-right text-foreground">{leader.revEUR > 0 ? fmt(leader.revEUR, "EUR") : "—"}</td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-foreground">{leader.payoutSEK > 0 ? fmt(leader.payoutSEK, "SEK") : "—"}</td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-foreground">{leader.payoutEUR > 0 ? fmt(leader.payoutEUR, "EUR") : "—"}</td>
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
