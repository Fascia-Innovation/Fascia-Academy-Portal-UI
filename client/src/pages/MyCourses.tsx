import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useDashAuth } from "@/contexts/DashAuthContext";
import MonthPicker from "@/components/ui/MonthPicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, BookOpen, ChevronDown, ChevronUp, Hash, Info,
  CalendarDays, MapPin, Clock, ExternalLink, History, Banknote,
  Users, TrendingUp, Plus, Copy, XCircle, RefreshCw, Lock,
  AlertTriangle, CheckCircle, MessageSquare, Layers,
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
function fmtDateShort(d: Date | string) {
  return new Date(d).toLocaleDateString("sv-SE");
}

const COURSE_TYPE_LABELS: Record<string, string> = {
  intro: "Introduktionskurs",
  diplo: "Diplomerad Fasciaspecialist",
  cert: "Certifierad Fasciaspecialist",
  vidare: "Vidareutbildning",
};

const MIN_DAYS: Record<string, number> = { intro: 1, diplo: 4, cert: 6, vidare: 2 };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending_approval: { label: "Väntar på godkännande", color: "bg-amber-100 text-amber-800", icon: Clock },
  pending_cancellation: { label: "Avbokning begärd", color: "bg-red-100 text-red-800", icon: XCircle },
  pending_reschedule: { label: "Ombokning begärd", color: "bg-blue-100 text-blue-800", icon: RefreshCw },
  needs_revision: { label: "Komplettering behövs", color: "bg-orange-100 text-orange-800", icon: AlertTriangle },
  approved: { label: "Godkänd", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  cancelled: { label: "Avbokad", color: "bg-gray-100 text-gray-600", icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-600", icon: Info };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

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
      <tr className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setOpen(!open)}>
        <td className="py-3 px-4 text-sm font-medium text-foreground">{p.contactName}</td>
        <td className="py-3 px-4 text-sm text-right text-foreground">{fmtPrecise(p.paidAmountInclVAT, c)}</td>
        <td className="py-3 px-4 text-sm text-right text-muted-foreground">{fmtPrecise(p.paidAmountExclVAT, c)}</td>
        <td className="py-3 px-4 text-sm text-right">
          {p.affiliateCode ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
              <Hash className="h-3 w-3" />{p.affiliateCode}
            </span>
          ) : <span className="text-muted-foreground text-xs">—</span>}
        </td>
        <td className="py-3 px-4 text-sm text-right font-semibold text-[oklch(0.22_0.04_255)]">{fmtPrecise(p.courseLeaderPayout, c)}</td>
        <td className="py-3 px-4 text-right">
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />}
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="px-4 py-4">
            <div className="bg-white rounded-lg border border-border p-4 max-w-lg">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Payout Breakdown — {p.contactName}
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
                      {row.sign && <span className="mr-1 text-xs">{row.sign}</span>}{row.label}
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

// ─── Calendar Info Box ───────────────────────────────────────────────────────
type CalendarInfo = {
  id: string;
  name: string;
  courseType: string | null;
  language: string | null;
  primaryUserName: string | null;
  primaryUserPhone: string | null;
  maxSeats: number;
  autoAddress: string | null;
  autoCity: string | null;
};

function CalendarInfoBox({ cal }: { cal: CalendarInfo }) {
  const langLabel = cal.language === "sv" ? "Svenska" : cal.language === "en" ? "English" : cal.language;
  const typeLabel = cal.courseType ? (COURSE_TYPE_LABELS[cal.courseType] ?? cal.courseType) : "—";
  return (
    <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <Lock className="h-3.5 w-3.5" /> Kalenderinformation
      </div>
      <p className="text-xs text-muted-foreground">
        Följande uppgifter hämtas från din bokningskalender och gäller för alla kurstillfällen i denna kalender.
        Vill du ändra något kan du begära detta via meddelande till admin, men observera att ändringar påverkar alla bokningar i kalendern.
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        <div><span className="text-muted-foreground">Kursledare:</span> <span className="font-medium">{cal.primaryUserName ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Telefon:</span> <span className="font-medium">{cal.primaryUserPhone ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Kurstyp:</span> <span className="font-medium">{typeLabel}</span></div>
        <div><span className="text-muted-foreground">Språk:</span> <span className="font-medium">{langLabel ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Adress:</span> <span className="font-medium">{cal.autoAddress ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Stad:</span> <span className="font-medium">{cal.autoCity ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Max platser:</span> <span className="font-medium">{cal.maxSeats}</span></div>
      </div>
      <p className="text-xs text-muted-foreground italic">
        Behöver du en ny kalender med andra inställningar? <span className="underline cursor-pointer">Begär här</span> (kommer snart)
      </p>
    </div>
  );
}

// ─── Additional Days Editor ──────────────────────────────────────────────────
type AdditionalDay = { date: string; startTime: string; endTime: string };

function AdditionalDaysEditor({
  days, onChange, courseType,
}: {
  days: AdditionalDay[];
  onChange: (days: AdditionalDay[]) => void;
  courseType: string;
}) {
  const minDays = MIN_DAYS[courseType] ?? 1;
  const isIntro = courseType === "intro";
  const minAdditional = Math.max(0, minDays - 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Ytterligare kursdagar
          {!isIntro && <span className="text-muted-foreground font-normal ml-1">(minst {minAdditional} extra {minAdditional === 1 ? "dag" : "dagar"})</span>}
        </Label>
        {!isIntro && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...days, { date: "", startTime: "09:00", endTime: "16:00" }])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Lägg till dag
          </Button>
        )}
      </div>
      {isIntro && (
        <p className="text-xs text-muted-foreground">Introduktionskurs är alltid 1 dag. Inga extra dagar kan läggas till.</p>
      )}
      {days.map((day, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            type="date"
            value={day.date}
            onChange={(e) => {
              const updated = [...days];
              updated[i] = { ...updated[i], date: e.target.value };
              onChange(updated);
            }}
            className="flex-1"
          />
          <Input
            type="time"
            value={day.startTime}
            onChange={(e) => {
              const updated = [...days];
              updated[i] = { ...updated[i], startTime: e.target.value };
              onChange(updated);
            }}
            className="w-28"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="time"
            value={day.endTime}
            onChange={(e) => {
              const updated = [...days];
              updated[i] = { ...updated[i], endTime: e.target.value };
              onChange(updated);
            }}
            className="w-28"
          />
          {days.length > minAdditional && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(days.filter((_, j) => j !== i))}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Register Course Dialog ──────────────────────────────────────────────────
function RegisterCourseDialog({
  open, onOpenChange, calendars, isBatch,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  calendars: CalendarInfo[];
  isBatch?: boolean;
}) {
  const utils = trpc.useUtils();
  const registerMut = trpc.courseDates.leaderRegister.useMutation();
  const batchMut = trpc.courseDates.leaderBatchRegister.useMutation();

  const [calId, setCalId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("17:00");
  const [venueName, setVenueName] = useState("");
  const [bookingInfo, setBookingInfo] = useState("");
  const [leaderMessage, setLeaderMessage] = useState("");
  const [additionalDays, setAdditionalDays] = useState<AdditionalDay[]>([]);
  // Batch-specific
  const [batchDates, setBatchDates] = useState<{ date: string; startTime: string; endTime: string; additionalDays: AdditionalDay[] }[]>([
    { date: "", startTime: "10:00", endTime: "17:00", additionalDays: [] },
  ]);

  const selectedCal = calendars.find((c) => c.id === calId);
  const courseType = selectedCal?.courseType ?? "intro";

  // Pre-fill additional days based on course type when calendar changes
  const handleCalChange = (newCalId: string) => {
    setCalId(newCalId);
    const cal = calendars.find((c) => c.id === newCalId);
    const ct = cal?.courseType ?? "intro";
    const minExtra = Math.max(0, (MIN_DAYS[ct] ?? 1) - 1);
    if (ct === "intro") {
      setAdditionalDays([]);
    } else if (additionalDays.length < minExtra) {
      const newDays = [...additionalDays];
      while (newDays.length < minExtra) {
        newDays.push({ date: "", startTime: "09:00", endTime: "16:00" });
      }
      setAdditionalDays(newDays);
    }
  };

  const handleSubmit = async () => {
    if (!calId || !venueName) {
      toast.error("Fyll i alla obligatoriska fält");
      return;
    }

    try {
      if (isBatch) {
        const validDates = batchDates.filter((d) => d.date);
        if (validDates.length === 0) {
          toast.error("Lägg till minst ett datum");
          return;
        }
        await batchMut.mutateAsync({
          ghlCalendarId: calId,
          venueName,
          bookingInfo: bookingInfo || undefined,
          leaderMessage: leaderMessage || undefined,
          dates: validDates.map((d) => ({
            startDate: `${d.date}T${d.startTime}:00`,
            endDate: `${d.date}T${d.endTime}:00`,
            additionalDays: d.additionalDays.length > 0 ? JSON.stringify(d.additionalDays) : undefined,
          })),
        });
        toast.success(`${validDates.length} kurstillfällen registrerade!`, { description: "Väntar på admin-godkännande." });
      } else {
        if (!startDate) {
          toast.error("Välj ett startdatum");
          return;
        }
        await registerMut.mutateAsync({
          ghlCalendarId: calId,
          startDate: `${startDate}T${startTime}:00`,
          endDate: `${startDate}T${endTime}:00`,
          venueName,
          additionalDays: additionalDays.length > 0 ? JSON.stringify(additionalDays) : undefined,
          bookingInfo: bookingInfo || undefined,
          leaderMessage: leaderMessage || undefined,
        });
        toast.success("Kurs registrerad!", { description: "Väntar på admin-godkännande." });
      }
      utils.courseDates.myCourseSchedule.invalidate();
      onOpenChange(false);
      // Reset
      setCalId(""); setStartDate(""); setVenueName(""); setBookingInfo(""); setLeaderMessage(""); setAdditionalDays([]);
      setBatchDates([{ date: "", startTime: "10:00", endTime: "17:00", additionalDays: [] }]);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const isLoading = registerMut.isPending || batchMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBatch ? <Layers className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {isBatch ? "Batch-registrera kurser" : "Registrera ny kurs"}
          </DialogTitle>
          <DialogDescription>
            {isBatch ? "Registrera flera kurstillfällen samtidigt för samma kalender." : "Fyll i uppgifterna nedan. Kursen skickas till admin för godkännande."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Calendar selector */}
          <div>
            <Label>Bokningskalender *</Label>
            <Select value={calId} onValueChange={handleCalChange}>
              <SelectTrigger><SelectValue placeholder="Välj kalender..." /></SelectTrigger>
              <SelectContent>
                {calendars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Calendar info box */}
          {selectedCal && <CalendarInfoBox cal={selectedCal} />}

          {/* Single course fields */}
          {!isBatch && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Startdatum *</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>Starttid</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <Label>Sluttid (dag 1)</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>

              {courseType !== "intro" && (
                <AdditionalDaysEditor
                  days={additionalDays}
                  onChange={setAdditionalDays}
                  courseType={courseType}
                />
              )}
            </>
          )}

          {/* Batch date fields */}
          {isBatch && selectedCal && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Kurstillfällen</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBatchDates([...batchDates, { date: "", startTime: "10:00", endTime: "17:00", additionalDays: [] }])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Lägg till datum
                </Button>
              </div>
              {batchDates.map((bd, i) => (
                <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Tillfälle {i + 1}</span>
                    {batchDates.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setBatchDates(batchDates.filter((_, j) => j !== i))} className="text-destructive h-6">
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input type="date" value={bd.date} onChange={(e) => {
                      const u = [...batchDates]; u[i] = { ...u[i], date: e.target.value }; setBatchDates(u);
                    }} />
                    <Input type="time" value={bd.startTime} onChange={(e) => {
                      const u = [...batchDates]; u[i] = { ...u[i], startTime: e.target.value }; setBatchDates(u);
                    }} />
                    <Input type="time" value={bd.endTime} onChange={(e) => {
                      const u = [...batchDates]; u[i] = { ...u[i], endTime: e.target.value }; setBatchDates(u);
                    }} />
                  </div>
                  {courseType !== "intro" && (
                    <AdditionalDaysEditor
                      days={bd.additionalDays}
                      onChange={(newDays) => {
                        const u = [...batchDates]; u[i] = { ...u[i], additionalDays: newDays }; setBatchDates(u);
                      }}
                      courseType={courseType}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Venue name */}
          <div>
            <Label>Venue / Lokal *</Label>
            <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="T.ex. Fasciaklinikerna Helsingborg" />
          </div>

          {/* Additional booking info */}
          <div>
            <Label>Ytterligare bokningsinformation (valfritt)</Label>
            <Textarea value={bookingInfo} onChange={(e) => setBookingInfo(e.target.value)} placeholder="T.ex. parkering, hiss, portkod..." rows={2} />
          </div>

          {/* Message to admin */}
          <div>
            <Label>Meddelande till Admin (valfritt)</Label>
            <Textarea value={leaderMessage} onChange={(e) => setLeaderMessage(e.target.value)} placeholder="Valfritt meddelande till admin..." rows={2} />
          </div>

          {/* Day count validation info */}
          {selectedCal && courseType !== "intro" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              <strong>Obs:</strong> {COURSE_TYPE_LABELS[courseType] ?? courseType} kräver minst {MIN_DAYS[courseType]} dagar (startdag + {(MIN_DAYS[courseType] ?? 1) - 1} extra).
            </div>
          )}

          {/* Minimum fee notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Administrationsavgift:</strong> En minimumavgift på 1 000 kr per kurstillfälle gäller.
            Avgiften tas ut om din normala ersättning understiger detta belopp.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Avbryt</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !calId || !venueName}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isBatch ? "Registrera alla" : "Skicka för godkännande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cancel Dialog ───────────────────────────────────────────────────────────
function CancelDialog({ open, onOpenChange, courseId, courseName }: {
  open: boolean; onOpenChange: (v: boolean) => void; courseId: number; courseName: string;
}) {
  const utils = trpc.useUtils();
  const cancelMut = trpc.courseDates.leaderCancel.useMutation();
  const [msg, setMsg] = useState("");

  const handleCancel = async () => {
    try {
      await cancelMut.mutateAsync({ id: courseId, leaderMessage: msg || undefined });
      toast.success("Avbokning begärd", { description: "Admin kommer att hantera din begäran." });
      utils.courseDates.myCourseSchedule.invalidate();
      onOpenChange(false);
      setMsg("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-destructive" /> Avboka kurs</DialogTitle>
          <DialogDescription>Begär avbokning av {courseName}. Admin måste godkänna och hantera eventuella bokade deltagare.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Obs:</strong> En minimumavgift på 1 000 kr gäller vid avbokning. Admin hanterar availability-ändringen i kalendern.
          </div>
          <div>
            <Label>Anledning / Meddelande (valfritt)</Label>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Beskriv varför du vill avboka..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button variant="destructive" onClick={handleCancel} disabled={cancelMut.isPending}>
            {cancelMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Begär avbokning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reschedule Dialog ───────────────────────────────────────────────────────
function RescheduleDialog({ open, onOpenChange, course }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  course: { id: number; courseType: string; startDate: Date | string };
}) {
  const utils = trpc.useUtils();
  const rescheduleMut = trpc.courseDates.leaderReschedule.useMutation();
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("10:00");
  const [newEndTime, setNewEndTime] = useState("17:00");
  const [newAdditionalDays, setNewAdditionalDays] = useState<AdditionalDay[]>([]);
  const [msg, setMsg] = useState("");

  const handleReschedule = async () => {
    if (!newDate) {
      toast.error("Välj nytt datum");
      return;
    }
    try {
      await rescheduleMut.mutateAsync({
        id: course.id,
        newStartDate: `${newDate}T${newStartTime}:00`,
        newEndDate: `${newDate}T${newEndTime}:00`,
        newAdditionalDays: newAdditionalDays.length > 0 ? JSON.stringify(newAdditionalDays) : undefined,
        leaderMessage: msg || undefined,
      });
      toast.success("Ombokning begärd", { description: "Admin kommer att hantera din begäran." });
      utils.courseDates.myCourseSchedule.invalidate();
      onOpenChange(false);
      setNewDate(""); setMsg(""); setNewAdditionalDays([]);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Omboka kurs</DialogTitle>
          <DialogDescription>
            Nuvarande datum: {fmtDate(course.startDate)}. Ange nytt önskat datum nedan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Nytt datum *</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <Label>Starttid</Label>
              <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
            </div>
            <div>
              <Label>Sluttid</Label>
              <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
            </div>
          </div>
          {course.courseType !== "intro" && (
            <AdditionalDaysEditor days={newAdditionalDays} onChange={setNewAdditionalDays} courseType={course.courseType} />
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Obs:</strong> Ombokning kräver alltid admin-godkännande. En minimumavgift på 1 000 kr gäller.
          </div>
          <div>
            <Label>Meddelande till Admin (valfritt)</Label>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Anledning till ombokning..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleReschedule} disabled={rescheduleMut.isPending || !newDate}>
            {rescheduleMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Begär ombokning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Copy Dialog ─────────────────────────────────────────────────────────────
function CopyDialog({ open, onOpenChange, course }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  course: { id: number; courseType: string; venueName: string | null; bookingInfo?: string | null };
}) {
  const utils = trpc.useUtils();
  const copyMut = trpc.courseDates.leaderCopy.useMutation();
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("10:00");
  const [newEndTime, setNewEndTime] = useState("17:00");
  const [venueName, setVenueName] = useState(course.venueName ?? "");
  const [bookingInfo, setBookingInfo] = useState(course.bookingInfo ?? "");
  const [newAdditionalDays, setNewAdditionalDays] = useState<AdditionalDay[]>([]);
  const [msg, setMsg] = useState("");

  const handleCopy = async () => {
    if (!newDate || !venueName) {
      toast.error("Fyll i datum och lokal");
      return;
    }
    try {
      await copyMut.mutateAsync({
        id: course.id,
        newStartDate: `${newDate}T${newStartTime}:00`,
        newEndDate: `${newDate}T${newEndTime}:00`,
        venueName,
        bookingInfo: bookingInfo || undefined,
        newAdditionalDays: newAdditionalDays.length > 0 ? JSON.stringify(newAdditionalDays) : undefined,
        leaderMessage: msg || undefined,
      });
      toast.success("Kurs kopierad!", { description: "Väntar på admin-godkännande." });
      utils.courseDates.myCourseSchedule.invalidate();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Copy className="h-5 w-5" /> Kopiera kurs</DialogTitle>
          <DialogDescription>Skapa ett nytt kurstillfälle baserat på denna kurs. Välj nytt datum.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Nytt datum *</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <Label>Starttid</Label>
              <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
            </div>
            <div>
              <Label>Sluttid</Label>
              <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
            </div>
          </div>
          {course.courseType !== "intro" && (
            <AdditionalDaysEditor days={newAdditionalDays} onChange={setNewAdditionalDays} courseType={course.courseType} />
          )}
          <div>
            <Label>Venue / Lokal *</Label>
            <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} />
          </div>
          <div>
            <Label>Ytterligare bokningsinformation (valfritt)</Label>
            <Textarea value={bookingInfo} onChange={(e) => setBookingInfo(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Meddelande till Admin (valfritt)</Label>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleCopy} disabled={copyMut.isPending || !newDate || !venueName}>
            {copyMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Kopiera och skicka
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Change Log Dialog ───────────────────────────────────────────────────────
function ChangeLogDialog({ open, onOpenChange, courseId }: {
  open: boolean; onOpenChange: (v: boolean) => void; courseId: number;
}) {
  const { data, isLoading } = trpc.courseDates.getChangeLog.useQuery({ id: courseId }, { enabled: open });

  const ACTION_LABELS: Record<string, string> = {
    created: "Skapad",
    batch_created: "Batch-skapad",
    approved: "Godkänd",
    cancellation_requested: "Avbokning begärd",
    cancellation_approved: "Avbokning godkänd",
    cancellation_denied: "Avbokning nekad",
    reschedule_requested: "Ombokning begärd",
    reschedule_approved: "Ombokning godkänd",
    reschedule_denied: "Ombokning nekad",
    revision_requested: "Komplettering begärd",
    resubmitted: "Komplettering inskickad",
    rejected: "Avvisad",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Ändringslogg</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !data?.log?.length ? (
          <p className="text-sm text-muted-foreground py-4">Ingen historik tillgänglig.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {data.log.map((entry: any, i: number) => (
              <div key={i} className="border-l-2 border-border pl-4 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                  <span className="text-xs text-muted-foreground">av {entry.by}</span>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString("sv-SE")}</div>
                {entry.details && <div className="text-xs text-muted-foreground mt-0.5">{entry.details}</div>}
              </div>
            ))}
            {data.adminMessage && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>Meddelande från admin:</strong> {data.adminMessage}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Course Card (updated with actions) ──────────────────────────────────────
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
  status: string;
  adminMessage?: string | null;
  leaderMessage?: string | null;
  bookingInfo?: string | null;
};

function CourseCard({ row, showActions, isPending }: { row: CourseRow; showActions?: boolean; isPending?: boolean }) {
  const label = COURSE_TYPE_LABELS[row.courseType] ?? row.courseType;
  const langFlag = row.language === "sv" ? "🇸🇪" : "🇬🇧";
  const bookUrl = `https://api.leadconnectorhq.com/widget/booking/${row.ghlCalendarId}`;

  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const canCancel = row.status === "approved" || row.status === "pending_approval";
  const canReschedule = row.status === "approved";
  const canCopy = row.status === "approved" || row.status === "cancelled";

  return (
    <>
      <div className={`bg-card border border-border rounded-xl p-5 flex flex-col gap-3 ${row.status === "cancelled" ? "opacity-50" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[oklch(0.22_0.04_255)]/10 text-[oklch(0.22_0.04_255)] font-medium">
                {langFlag} {label}
              </span>
              <StatusBadge status={row.status} />
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
            <div className="text-xs text-muted-foreground">Max platser</div>
            <div className="text-lg font-bold text-foreground">{row.maxSeats}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span>{row.venueName ? `${row.venueName}, ` : ""}{row.city}, {row.country}</span>
        </div>
        {row.address && <div className="text-xs text-muted-foreground pl-5">{row.address}</div>}

        {/* Admin message for needs_revision */}
        {row.status === "needs_revision" && row.adminMessage && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-800">
            <strong>Admin:</strong> {row.adminMessage}
          </div>
        )}

        {/* Action buttons */}
        {showActions && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {row.status === "approved" && (
              <a href={bookUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[oklch(0.22_0.04_255)] hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> Bokningssida
              </a>
            )}
            {canCopy && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCopyOpen(true)}>
                <Copy className="h-3 w-3 mr-1" /> Kopiera
              </Button>
            )}
            {canReschedule && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setRescheduleOpen(true)}>
                <RefreshCw className="h-3 w-3 mr-1" /> Omboka
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
                <XCircle className="h-3 w-3 mr-1" /> Avboka
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLogOpen(true)}>
              <History className="h-3 w-3 mr-1" /> Logg
            </Button>
          </div>
        )}
      </div>

      <CancelDialog open={cancelOpen} onOpenChange={setCancelOpen} courseId={row.id} courseName={`${label} ${fmtDateShort(row.startDate)}`} />
      <RescheduleDialog open={rescheduleOpen} onOpenChange={setRescheduleOpen} course={row} />
      <CopyDialog open={copyOpen} onOpenChange={setCopyOpen} course={row} />
      <ChangeLogDialog open={logOpen} onOpenChange={setLogOpen} courseId={row.id} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MyCourses() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const { user } = useDashAuth();

  const { data: payoutData, isLoading: payoutLoading, error: payoutError } = trpc.courseLeader.myData.useQuery({ year, month });
  const { data: schedule, isLoading: scheduleLoading } = trpc.courseDates.myCourseSchedule.useQuery();
  const { data: calendars } = trpc.courseDates.getCalendars.useQuery();

  const calendarList = useMemo(() => (calendars ?? []) as CalendarInfo[], [calendars]);

  const historyToShow = showAllHistory ? (schedule?.past ?? []) : (schedule?.past ?? []).slice(0, 3);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Mina Kurser
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.name} — kursöversikt och utbetalningar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBatchOpen(true)}>
            <Layers className="h-4 w-4 mr-2" /> Batch-registrera
          </Button>
          <Button onClick={() => setRegisterOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Registrera kurs
          </Button>
        </div>
      </div>

      {/* ── Pending / Needs Attention ── */}
      {(schedule?.pending?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Kräver uppmärksamhet
            </h2>
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">{schedule?.pending?.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedule?.pending?.map((row) => (
              <CourseCard key={row.id} row={row as unknown as CourseRow} showActions isPending />
            ))}
          </div>
        </section>
      )}

      {/* ── Upcoming Courses ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Kommande kurser
          </h2>
        </div>

        {scheduleLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Laddar schema...
          </div>
        ) : !schedule?.upcoming.length ? (
          <div className="bg-muted/30 rounded-xl border border-border p-8 text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Inga kommande publicerade kurstillfällen.</p>
            <p className="text-xs mt-1">Klicka "Registrera kurs" ovan för att skapa ett nytt tillfälle.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedule.upcoming.map((row) => (
              <CourseCard key={row.id} row={row as unknown as CourseRow} showActions />
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
              Utbetalningsöversikt
            </h2>
          </div>
          <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        </div>

        {payoutLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : payoutError ? (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{payoutError.message}</div>
        ) : !payoutData?.courses.length ? (
          <div className="bg-muted/30 rounded-xl border border-border p-8 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Inga genomförda deltagare för denna period.</p>
            <p className="text-xs mt-1">Endast deltagare med status "Showed" ingår i avräkningar.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Users className="h-3.5 w-3.5" /> Deltagare totalt</div>
                <div className="text-2xl font-bold text-foreground">{payoutData.courses.reduce((s, c) => s + c.participants.length, 0)}</div>
              </div>
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><BookOpen className="h-3.5 w-3.5" /> Kurser denna period</div>
                <div className="text-2xl font-bold text-foreground">{payoutData.courses.length}</div>
              </div>
              <div className="bg-[oklch(0.22_0.04_255)] rounded-xl border border-[oklch(0.30_0.05_255)] p-5">
                <div className="flex items-center gap-1.5 text-xs text-[oklch(0.72_0.12_75)] mb-1"><TrendingUp className="h-3.5 w-3.5" /> Utbetalning (SEK)</div>
                <div className="text-2xl font-bold text-white">{fmt(payoutData.courses.filter(c => c.currency === "SEK").reduce((s, c) => s + c.totalPayout, 0), "SEK")}</div>
              </div>
              <div className="bg-[oklch(0.22_0.04_255)] rounded-xl border border-[oklch(0.30_0.05_255)] p-5">
                <div className="flex items-center gap-1.5 text-xs text-[oklch(0.72_0.12_75)] mb-1"><TrendingUp className="h-3.5 w-3.5" /> Utbetalning (EUR)</div>
                <div className="text-2xl font-bold text-white">{fmt(payoutData.courses.filter(c => c.currency === "EUR").reduce((s, c) => s + c.totalPayout, 0), "EUR")}</div>
              </div>
            </div>

            {/* Per-course breakdown */}
            {payoutData.courses.map((course, idx) => (
              <div key={idx} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-6 py-4 bg-muted/30 border-b border-border flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{course.calendarName}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[oklch(0.22_0.04_255)]/10 text-[oklch(0.22_0.04_255)] font-medium capitalize">{course.courseType}</span>
                      <span className="text-xs text-muted-foreground">{course.currency}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Total utbetalning</div>
                    <div className="text-lg font-bold text-[oklch(0.22_0.04_255)]">{fmt(course.totalPayout, course.currency)}</div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/20">
                      <tr>
                        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Deltagare</th>
                        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Betalt (inkl. moms)</th>
                        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Exkl. moms</th>
                        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Affiliatekod</th>
                        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Din utbetalning</th>
                        <th className="py-3 px-4 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.participants.map((p) => <ParticipantRow key={p.contactId} p={p} />)}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      <tr>
                        <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-foreground">Totalt</td>
                        <td className="py-3 px-4 text-sm text-right font-bold text-[oklch(0.22_0.04_255)]">{fmt(course.totalPayout, course.currency)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <strong>Obs:</strong> Utbetalning = Betalt belopp exkl. moms − 3,1% transaktionsavgift − FA-marginal − affiliatekommission (om tillämpligt).
              Fakturera Fascia Academy med 20 dagars betalningsvillkor.
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
              Kurshistorik
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyToShow.map((row) => (
              <CourseCard key={row.id} row={row as unknown as CourseRow} />
            ))}
          </div>
          {(schedule?.past?.length ?? 0) > 3 && (
            <button onClick={() => setShowAllHistory(!showAllHistory)}
              className="mt-4 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              {showAllHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showAllHistory ? "Visa färre" : `Visa alla ${schedule?.past?.length} tidigare kurser`}
            </button>
          )}
        </section>
      )}

      {/* Register dialogs */}
      <RegisterCourseDialog open={registerOpen} onOpenChange={setRegisterOpen} calendars={calendarList} />
      <RegisterCourseDialog open={batchOpen} onOpenChange={setBatchOpen} calendars={calendarList} isBatch />
    </div>
  );
}
