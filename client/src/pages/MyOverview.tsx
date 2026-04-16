/**
 * Course Leader: My Overview
 * Motivational dashboard showing personal stats, trends, and upcoming courses.
 * Compares with self over time (not with other leaders).
 */
import { trpc } from "@/lib/trpc";
import { useDashAuth } from "@/contexts/DashAuthContext";
import {
  Loader2, TrendingUp, Users, CalendarDays, Banknote,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  if (previous === 0) return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />;
  const pct = ((current - previous) / previous) * 100;
  if (pct > 0) return (
    <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
      <ArrowUpRight className="h-3.5 w-3.5" /> +{pct.toFixed(0)}%
    </span>
  );
  if (pct < 0) return (
    <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium">
      <ArrowDownRight className="h-3.5 w-3.5" /> {pct.toFixed(0)}%
    </span>
  );
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function MyOverview() {
  const { user } = useDashAuth();
  const { data, isLoading, error } = trpc.courseLeader.myOverview.useQuery(undefined, { staleTime: 120_000 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{error.message}</div>
      </div>
    );
  }

  const stats = data!;
  const months = stats.monthlyStats;
  const currentMonth = months[months.length - 1];
  const previousMonth = months.length >= 2 ? months[months.length - 2] : null;

  // Find max participants for bar chart scaling
  const maxParticipants = Math.max(...months.map((m) => m.participants), 1);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your personal performance overview — last 6 months
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <CalendarDays className="h-3.5 w-3.5" />
            Upcoming Courses
          </div>
          <div className="text-3xl font-bold text-foreground">{stats.upcomingCourses}</div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Participants (this month)
            </div>
            {previousMonth && (
              <TrendIndicator current={currentMonth?.participants ?? 0} previous={previousMonth.participants} />
            )}
          </div>
          <div className="text-3xl font-bold text-foreground">{currentMonth?.participants ?? 0}</div>
        </div>

        <div className="bg-[oklch(0.22_0.04_255)] rounded-xl border border-[oklch(0.30_0.05_255)] p-5">
          <div className="flex items-center gap-1.5 text-xs text-[oklch(0.72_0.12_75)] mb-2">
            <Banknote className="h-3.5 w-3.5" />
            Total Payout (6 mo, SEK)
          </div>
          <div className="text-3xl font-bold text-white">{fmt(stats.totalPayoutSEK, "SEK")}</div>
        </div>

        <div className="bg-[oklch(0.22_0.04_255)] rounded-xl border border-[oklch(0.30_0.05_255)] p-5">
          <div className="flex items-center gap-1.5 text-xs text-[oklch(0.72_0.12_75)] mb-2">
            <Banknote className="h-3.5 w-3.5" />
            Total Payout (6 mo, EUR)
          </div>
          <div className="text-3xl font-bold text-white">{fmt(stats.totalPayoutEUR, "EUR")}</div>
        </div>
      </div>

      {/* Participants Trend Chart */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Participants Over Time
          </h2>
        </div>
        <div className="flex items-end gap-3 h-48">
          {months.map((m) => {
            const height = maxParticipants > 0 ? (m.participants / maxParticipants) * 100 : 0;
            return (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{m.participants}</span>
                <div className="w-full relative" style={{ height: "160px" }}>
                  <div
                    className="absolute bottom-0 w-full rounded-t-lg bg-[oklch(0.72_0.12_75)]/80"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Payout Breakdown */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Monthly Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/20">
              <tr>
                <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Month</th>
                <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-center">Participants</th>
                <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Payout (SEK)</th>
                <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Payout (EUR)</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.label} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 text-sm font-medium text-foreground">{m.label}</td>
                  <td className="py-3 px-4 text-sm text-center text-foreground">{m.participants}</td>
                  <td className="py-3 px-4 text-sm text-right font-medium text-foreground">{fmt(m.payoutSEK, "SEK")}</td>
                  <td className="py-3 px-4 text-sm text-right font-medium text-foreground">{fmt(m.payoutEUR, "EUR")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30">
              <tr>
                <td className="py-3 px-4 text-sm font-bold text-foreground">Total (6 months)</td>
                <td className="py-3 px-4 text-sm text-center font-bold text-foreground">{stats.totalParticipants}</td>
                <td className="py-3 px-4 text-sm text-right font-bold text-[oklch(0.22_0.04_255)]">{fmt(stats.totalPayoutSEK, "SEK")}</td>
                <td className="py-3 px-4 text-sm text-right font-bold text-[oklch(0.22_0.04_255)]">{fmt(stats.totalPayoutEUR, "EUR")}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Motivational note */}
      <div className="bg-[oklch(0.72_0.12_75)]/10 border border-[oklch(0.72_0.12_75)]/30 rounded-xl p-5 text-center">
        <p className="text-sm text-foreground">
          <strong>Total participants trained:</strong> {stats.totalParticipants} in the last 6 months.
          {stats.totalParticipants > 0 && " Keep up the great work!"}
        </p>
      </div>
    </div>
  );
}
