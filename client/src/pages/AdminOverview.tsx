import { useState } from "react";
import { trpc } from "@/lib/trpc";
import MonthPicker from "@/components/ui/MonthPicker";
import { Loader2, Users, TrendingUp, Percent, DollarSign, Minus, ArrowUpRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function KpiCard({
  label,
  sek,
  eur,
  icon: Icon,
  accent = false,
}: {
  label: string;
  sek: number;
  eur: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${accent ? "bg-[oklch(0.22_0.04_255)] text-white border-[oklch(0.30_0.05_255)]" : "bg-card border-border"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${accent ? "bg-[oklch(0.72_0.12_75)]/20" : "bg-muted"}`}>
          <Icon className={`h-4 w-4 ${accent ? "text-[oklch(0.72_0.12_75)]" : "text-muted-foreground"}`} />
        </div>
        <ArrowUpRight className={`h-4 w-4 ${accent ? "text-[oklch(0.72_0.12_75)]" : "text-muted-foreground"}`} />
      </div>
      <div className={`text-xs font-medium mb-1 ${accent ? "text-[oklch(0.72_0.12_75)]" : "text-muted-foreground"}`}>{label}</div>
      <div className={`text-xl font-semibold ${accent ? "text-white" : "text-foreground"}`}>{fmt(sek, "SEK")}</div>
      {eur > 0 && (
        <div className={`text-sm mt-0.5 ${accent ? "text-white/70" : "text-muted-foreground"}`}>{fmt(eur, "EUR")}</div>
      )}
    </div>
  );
}

export default function AdminOverview() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, error } = trpc.admin.overview.useQuery({ year, month });
  const { data: historyData, isLoading: histLoading } = trpc.admin.monthlyHistory.useQuery({ months: 6 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          Could not load data: {error.message}
        </div>
      </div>
    );
  }

  const d = data!;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Financial Overview
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Monthly settlement summary across all courses</p>
        </div>
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {/* Participant count */}
      <div className="flex items-center gap-2 mb-6 p-4 bg-[oklch(0.22_0.04_255)] rounded-xl text-white">
        <Users className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
        <span className="text-sm text-white/70">Total participants this month:</span>
        <span className="text-lg font-bold">{d.participantCount}</span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <KpiCard label="Total Revenue (incl. VAT)" sek={d.revenue.sek} eur={d.revenue.eur} icon={DollarSign} accent />
        <KpiCard label="VAT (25%)" sek={d.vat.sek} eur={d.vat.eur} icon={Percent} />
        <KpiCard label="Transaction Fees (3.1%)" sek={d.transactionFees.sek} eur={d.transactionFees.eur} icon={Minus} />
        <KpiCard label="FA Margin" sek={d.faMargin.sek} eur={d.faMargin.eur} icon={TrendingUp} />
        <KpiCard label="Affiliate Commissions (30%)" sek={d.affiliateCommissions.sek} eur={d.affiliateCommissions.eur} icon={Users} />
        <KpiCard label="Course Leader Payouts" sek={d.courseLeaderPayouts.sek} eur={d.courseLeaderPayouts.eur} icon={ArrowUpRight} accent />
      </div>

      {/* Revenue flow breakdown */}
      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <h2 className="text-base font-semibold text-foreground mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
          Revenue Breakdown — SEK
        </h2>
        <div className="space-y-3">
          {[
            { label: "Gross Revenue (incl. VAT)", value: d.revenue.sek, pct: 100, color: "bg-[oklch(0.22_0.04_255)]" },
            { label: "VAT (25%)", value: -d.vat.sek, pct: -(d.revenue.sek > 0 ? (d.vat.sek / d.revenue.sek) * 100 : 0), color: "bg-red-400" },
            { label: "Transaction Fees (3.1%)", value: -d.transactionFees.sek, pct: -(d.revenue.sek > 0 ? (d.transactionFees.sek / d.revenue.sek) * 100 : 0), color: "bg-orange-400" },
            { label: "FA Margin", value: -d.faMargin.sek, pct: -(d.revenue.sek > 0 ? (d.faMargin.sek / d.revenue.sek) * 100 : 0), color: "bg-purple-400" },
            { label: "Affiliate Commissions", value: -d.affiliateCommissions.sek, pct: -(d.revenue.sek > 0 ? (d.affiliateCommissions.sek / d.revenue.sek) * 100 : 0), color: "bg-blue-400" },
            { label: "Course Leader Payouts", value: d.courseLeaderPayouts.sek, pct: d.revenue.sek > 0 ? (d.courseLeaderPayouts.sek / d.revenue.sek) * 100 : 0, color: "bg-[oklch(0.72_0.12_75)]" },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-4">
              <div className="w-48 text-sm text-muted-foreground shrink-0">{row.label}</div>
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.color}`}
                  style={{ width: `${Math.abs(row.pct)}%` }}
                />
              </div>
              <div className={`text-sm font-medium w-32 text-right ${row.value < 0 ? "text-red-600" : "text-foreground"}`}>
                {row.value < 0 ? "−" : ""}{fmt(Math.abs(row.value), "SEK")}
              </div>
              <div className="text-xs text-muted-foreground w-12 text-right">{Math.abs(row.pct).toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* 6-month trend chart */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-base font-semibold text-foreground mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
          6-Month Trend — SEK
        </h2>
        {histLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={historyData ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.22 0.04 255)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.22 0.04 255)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.72 0.12 75)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.72 0.12 75)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 250)" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "oklch(0.52 0.02 250)" }} />
              <YAxis tick={{ fontSize: 12, fill: "oklch(0.52 0.02 250)" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => [fmt(value, "SEK"), name]}
                contentStyle={{ borderRadius: "8px", border: "1px solid oklch(0.88 0.01 250)", fontSize: "12px" }}
              />
              <Legend />
              <Area type="monotone" dataKey="revenueSEK" name="Revenue" stroke="oklch(0.22 0.04 255)" fill="url(#revGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="payoutSEK" name="Payouts" stroke="oklch(0.72 0.12 75)" fill="url(#payGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="commissionSEK" name="Commissions" stroke="oklch(0.65 0.12 160)" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
