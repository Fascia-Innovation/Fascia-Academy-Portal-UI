import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, BarChart3 } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export default function MonthlyHistory() {
  const [months, setMonths] = useState(12);

  const { data, isLoading, error } = trpc.admin.monthlyHistory.useQuery({ months });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Monthly History
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Month-by-month comparison of revenue, payouts, and commissions</p>
        </div>
        <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6">Last 6 months</SelectItem>
            <SelectItem value="12">Last 12 months</SelectItem>
            <SelectItem value="24">Last 24 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{error.message}</div>
      ) : !data?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No historical data available.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* SEK Chart */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-base font-semibold text-foreground mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Revenue vs Payouts — SEK
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 250)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "Participants") return [value, name];
                    return [fmt(value, "SEK"), name];
                  }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid oklch(0.88 0.01 250)", fontSize: "12px" }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="revenueSEK" name="Revenue" fill="oklch(0.22 0.04 255)" radius={[3, 3, 0, 0]} opacity={0.85} />
                <Bar yAxisId="left" dataKey="payoutSEK" name="Payouts" fill="oklch(0.72 0.12 75)" radius={[3, 3, 0, 0]} opacity={0.85} />
                <Bar yAxisId="left" dataKey="commissionSEK" name="Commissions" fill="oklch(0.65 0.12 160)" radius={[3, 3, 0, 0]} opacity={0.85} />
                <Line yAxisId="right" type="monotone" dataKey="participants" name="Participants" stroke="oklch(0.60 0.18 30)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* EUR Chart */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-base font-semibold text-foreground mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Revenue vs Payouts — EUR
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 250)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [fmt(value, "EUR"), name]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid oklch(0.88 0.01 250)", fontSize: "12px" }}
                />
                <Legend />
                <Bar dataKey="revenueEUR" name="Revenue" fill="oklch(0.22 0.04 255)" radius={[3, 3, 0, 0]} opacity={0.85} />
                <Bar dataKey="payoutEUR" name="Payouts" fill="oklch(0.72 0.12 75)" radius={[3, 3, 0, 0]} opacity={0.85} />
                <Bar dataKey="commissionEUR" name="Commissions" fill="oklch(0.65 0.12 160)" radius={[3, 3, 0, 0]} opacity={0.85} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Data table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>Monthly Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Month</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Participants</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Revenue SEK</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Payouts SEK</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Commissions SEK</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Revenue EUR</th>
                    <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Payouts EUR</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((row) => (
                    <tr key={`${row.year}-${row.month}`} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-sm font-medium text-foreground">{row.label}</td>
                      <td className="py-3 px-4 text-sm text-right text-foreground">{row.participants}</td>
                      <td className="py-3 px-4 text-sm text-right text-foreground">{row.revenueSEK > 0 ? fmt(row.revenueSEK, "SEK") : "—"}</td>
                      <td className="py-3 px-4 text-sm text-right text-foreground">{row.payoutSEK > 0 ? fmt(row.payoutSEK, "SEK") : "—"}</td>
                      <td className="py-3 px-4 text-sm text-right text-foreground">{row.commissionSEK > 0 ? fmt(row.commissionSEK, "SEK") : "—"}</td>
                      <td className="py-3 px-4 text-sm text-right text-foreground">{row.revenueEUR > 0 ? fmt(row.revenueEUR, "EUR") : "—"}</td>
                      <td className="py-3 px-4 text-sm text-right text-foreground">{row.payoutEUR > 0 ? fmt(row.payoutEUR, "EUR") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
