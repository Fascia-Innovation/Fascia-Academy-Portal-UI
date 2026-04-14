/**
 * Settlements page — admin view for managing monthly settlements.
 * Shows all settlements with status badges, approve/adjust/amend actions.
 * Course leaders and affiliates are redirected to their own settlement views.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, Clock, ChevronRight, Plus, RefreshCw, Edit, Download } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Settlement {
  id: number;
  userId: number;
  userType: "course_leader" | "affiliate";
  periodYear: number;
  periodMonth: number;
  currency: string;
  status: "pending" | "approved" | "amended";
  totalPaidInclVat: string;
  totalNetExclVat: string;
  totalTransactionFee: string;
  totalFaMargin: string;
  totalAffiliateDeduction: string;
  totalAdjustments: string;
  totalPayout: string;
  participantCount: number;
  approvedAt: string | null;
  userName: string;
  userEmail: string;
  invoiceReference: string | null;
}

interface SettlementLine {
  id: number;
  participantName: string;
  participantEmail: string;
  calendarName: string;
  courseType: string;
  courseDate: string;
  affiliateCode: string;
  paidInclVat: string;
  netExclVat: string;
  transactionFee: string;
  faMargin: string;
  affiliateDeduction: string;
  payout: string;
  missingAmount: boolean;
}

interface Adjustment {
  id: number;
  amount: string;
  currency: string;
  comment: string;
  createdByName: string;
  createdAt: Date | string;
}

// ─── Month helpers ────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function periodLabel(year: number, month: number) {
  return `${MONTHS[month - 1]} ${year}`;
}
function fmt(val: string | number) {
  return Number(val).toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
  if (status === "pending")  return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200"><AlertCircle className="w-3 h-3 mr-1" />Amended</Badge>;
}

// ─── Settlement detail dialog ─────────────────────────────────────────────────
function SettlementDetail({
  settlementId,
  onClose,
  onApproved,
}: {
  settlementId: number;
  onClose: () => void;
  onApproved: () => void;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.settlements.get.useQuery({ id: settlementId });
  const approveMut  = trpc.settlements.approve.useMutation({ onSuccess: () => { refetch(); onApproved(); toast.success("Settlement approved — notification sent to user."); } });
  const amendMut    = trpc.settlements.amend.useMutation({ onSuccess: () => { refetch(); utils.settlements.list.invalidate(); toast.success("Amendment created — old settlement marked as amended."); } });
  const recalcMut   = trpc.settlements.recalculate.useMutation({ onSuccess: () => { refetch(); toast.success("Recalculated from GHL"); } });

  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjCurrency, setAdjCurrency] = useState<"SEK" | "EUR">("SEK");
  const [adjComment, setAdjComment] = useState("");
  const addAdjMut = trpc.settlements.addAdjustment.useMutation({
    onSuccess: () => {
      refetch();
      setShowAdjForm(false);
      setAdjAmount("");
      setAdjComment("");
      toast.success("Adjustment added");
    },
  });

  if (isLoading || !data) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  const { settlement, lines, adjustments, faCompany } = data as {
    settlement: Settlement & { userPhone?: string };
    lines: SettlementLine[];
    adjustments: Adjustment[];
    faCompany: { name: string; orgNr: string; address: string; email: string; paymentTerms: string };
  };

  const isPending  = settlement.status === "pending";
  const isApproved = settlement.status === "approved";
  const isAmended  = settlement.status === "amended";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">{settlement.userName}</h2>
          <p className="text-sm text-muted-foreground">{periodLabel(settlement.periodYear, settlement.periodMonth)} · {settlement.userType === "course_leader" ? "Course Leader" : "Affiliate"}</p>
          {settlement.invoiceReference && <p className="text-xs text-muted-foreground mt-0.5">Ref: {settlement.invoiceReference}</p>}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={settlement.status} />
          {isPending && (
            <>
              <Button size="sm" variant="outline" onClick={() => recalcMut.mutate({ id: settlement.id })} disabled={recalcMut.isPending}>
                <RefreshCw className="w-3 h-3 mr-1" />Recalculate
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approveMut.mutate({ id: settlement.id })} disabled={approveMut.isPending}>
                <CheckCircle className="w-3 h-3 mr-1" />Approve
              </Button>
            </>
          )}
          {isApproved && (
            <Button size="sm" variant="outline" onClick={() => amendMut.mutate({ id: settlement.id })} disabled={amendMut.isPending}>
              <Edit className="w-3 h-3 mr-1" />Amend
            </Button>
          )}
        </div>
      </div>

      {isAmended && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          This settlement has been superseded by an amendment. It is kept for historical reference only.
        </div>
      )}

      {/* FA Company info */}
      <div className="bg-muted/40 rounded-lg p-4 text-sm">
        <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">Invoice to</p>
        <p className="font-semibold">{faCompany.name}</p>
        <p className="text-muted-foreground">{faCompany.orgNr} · {faCompany.address}</p>
        <p className="text-muted-foreground">{faCompany.email} · Payment terms: {faCompany.paymentTerms}</p>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Paid incl. VAT",      val: settlement.totalPaidInclVat },
          { label: "Net excl. VAT",        val: settlement.totalNetExclVat },
          { label: "Transaction fee",      val: settlement.totalTransactionFee },
          { label: "FA margin",            val: settlement.totalFaMargin },
          { label: "Affiliate deduction",  val: settlement.totalAffiliateDeduction },
          { label: "Manual adjustments",   val: settlement.totalAdjustments },
        ].map(({ label, val }) => (
          <div key={label} className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium">{fmt(val)} {settlement.currency}</p>
          </div>
        ))}
      </div>
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
        <span className="font-semibold text-lg">Total Payout</span>
        <span className={`text-2xl font-bold ${Number(settlement.totalPayout) < 0 ? "text-red-600" : "text-green-700"}`}>
          {fmt(settlement.totalPayout)} {settlement.currency}
        </span>
      </div>

      {/* Participants */}
      <div>
        <h3 className="font-semibold mb-3">Participants ({lines.length})</h3>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No participants found.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Name</th>
                  <th className="text-left p-2 font-medium hidden sm:table-cell">Course</th>
                  <th className="text-left p-2 font-medium hidden md:table-cell">Date</th>
                  <th className="text-right p-2 font-medium">Paid</th>
                  <th className="text-right p-2 font-medium">Payout</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-t hover:bg-muted/20">
                    <td className="p-2">
                      <span>{line.participantName}</span>
                      {line.missingAmount && <span className="ml-1 text-xs text-amber-600" title="Paid amount missing in GHL">⚠</span>}
                      {line.affiliateCode && <span className="ml-1 text-xs text-blue-600">[{line.affiliateCode}]</span>}
                    </td>
                    <td className="p-2 hidden sm:table-cell text-muted-foreground capitalize">{line.courseType}</td>
                    <td className="p-2 hidden md:table-cell text-muted-foreground">{line.courseDate}</td>
                    <td className="p-2 text-right">{fmt(line.paidInclVat)}</td>
                    <td className={`p-2 text-right font-medium ${Number(line.payout) < 0 ? "text-red-600" : ""}`}>
                      {fmt(line.payout)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjustments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Manual Adjustments</h3>
          {!isAmended && (
            <Button size="sm" variant="outline" onClick={() => setShowAdjForm(!showAdjForm)}>
              <Plus className="w-3 h-3 mr-1" />Add
            </Button>
          )}
        </div>

        {showAdjForm && (
          <div className="border rounded-lg p-4 mb-3 bg-muted/20 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (+ or −)</Label>
                <Input type="number" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} placeholder="e.g. -500 or 1000" />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={adjCurrency} onValueChange={(v) => setAdjCurrency(v as "SEK" | "EUR")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEK">SEK</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Comment</Label>
              <Textarea value={adjComment} onChange={(e) => setAdjComment(e.target.value)} placeholder="Reason for adjustment..." rows={2} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addAdjMut.mutate({ settlementId: settlement.id, amount: Number(adjAmount), currency: adjCurrency, comment: adjComment })} disabled={!adjAmount || !adjComment || addAdjMut.isPending}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdjForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {adjustments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No adjustments.</p>
        ) : (
          <div className="space-y-2">
            {adjustments.map((adj) => (
              <div key={adj.id} className="flex items-start justify-between border rounded-lg p-3 text-sm">
                <div>
                  <p className="font-medium">{adj.comment}</p>
                  <p className="text-xs text-muted-foreground">by {adj.createdByName} · {new Date(adj.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`font-semibold ${Number(adj.amount) < 0 ? "text-red-600" : "text-green-700"}`}>
                  {Number(adj.amount) > 0 ? "+" : ""}{fmt(adj.amount)} {adj.currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Generate dialog ──────────────────────────────────────────────────────────
function GenerateDialog({ onClose, onGenerated }: { onClose: () => void; onGenerated: () => void }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() === 0 ? 12 : now.getMonth()); // previous month

  const generateMut = trpc.settlements.generate.useMutation({
    onSuccess: (data) => {
      const generated = data.results.filter((r: { status: string }) => r.status === "generated").length;
      const skipped   = data.results.filter((r: { status: string }) => r.status.startsWith("skipped")).length;
      toast.success(`Generated ${generated} settlement(s)`, { description: `${skipped} skipped (no data or already exists)` });
      onGenerated();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Generate settlements for all active course leaders and affiliates for the selected month. Skips users who already have a settlement for that period.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Year</Label>
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} min={2024} max={2030} />
        </div>
        <div>
          <Label>Month</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => generateMut.mutate({ year, month })} disabled={generateMut.isPending}>
          {generateMut.isPending ? "Generating..." : "Generate"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Settlements() {
  const utils = trpc.useUtils();

  const [filterStatus, setFilterStatus] = useState<"pending" | "approved" | "amended" | undefined>(undefined);
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  const { data: settlements = [], isLoading, refetch } = trpc.settlements.list.useQuery({
    status: filterStatus,
  });

  const grouped = (settlements as Settlement[]).reduce((acc, s) => {
    const key = `${s.periodYear}-${String(s.periodMonth).padStart(2, "0")}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {} as Record<string, Settlement[]>);

  const sortedPeriods = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settlements</h1>
          <p className="text-muted-foreground text-sm">Monthly payout settlements for course leaders and affiliates</p>
        </div>
        <Button onClick={() => setShowGenerate(true)}>
          <Plus className="w-4 h-4 mr-2" />Generate
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {([undefined, "pending", "approved", "amended"] as const).map((s) => (
          <Button
            key={String(s)}
            size="sm"
            variant={filterStatus === s ? "default" : "outline"}
            onClick={() => setFilterStatus(s)}
          >
            {s === undefined ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading settlements...</div>
      ) : sortedPeriods.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium mb-2">No settlements found</p>
          <p className="text-sm">Click "Generate" to create settlements for a month.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedPeriods.map((period) => {
            const [y, m] = period.split("-").map(Number);
            return (
              <div key={period}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {periodLabel(y, m)}
                </h2>
                <div className="space-y-2">
                  {grouped[period].map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedId(s.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{s.userName}</p>
                          <p className="text-xs text-muted-foreground capitalize">{s.userType.replace("_", " ")} · {s.participantCount} participant{s.participantCount !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`font-semibold ${Number(s.totalPayout) < 0 ? "text-red-600" : ""}`}>
                            {fmt(s.totalPayout)} {s.currency}
                          </p>
                          <p className="text-xs text-muted-foreground">payout</p>
                        </div>
                        <StatusBadge status={s.status} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={selectedId !== null} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Settlement Detail</DialogTitle>
          </DialogHeader>
          {selectedId !== null && (
            <SettlementDetail
              settlementId={selectedId}
              onClose={() => setSelectedId(null)}
              onApproved={() => { refetch(); utils.settlements.list.invalidate(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Generate dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Settlements</DialogTitle>
          </DialogHeader>
          <GenerateDialog onClose={() => setShowGenerate(false)} onGenerated={() => refetch()} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
