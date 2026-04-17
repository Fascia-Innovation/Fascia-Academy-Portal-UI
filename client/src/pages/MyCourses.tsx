import { useState, useCallback, useMemo } from "react";
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
  AlertTriangle, CheckCircle, MessageSquare, Layers, RotateCcw, Pencil,
  UserCheck, UserX, ListChecks,
} from "lucide-react";

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}
function fmtPrecise(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-SE", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}
function fmtDateShort(d: Date | string) {
  return new Date(d).toLocaleDateString("en-SE");
}

const COURSE_TYPE_LABELS: Record<string, string> = {
  intro: "Introduktionskurs",
  diplo: "Diplomerad Fasciaspecialist",
  cert: "Certifierad Fasciaspecialist",
  vidare: "Vidareutbildning",
};

const MIN_DAYS: Record<string, number> = { intro: 1, diplo: 4, cert: 6, vidare: 2 };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending_approval: { label: "Pending approval", color: "bg-amber-100 text-amber-800", icon: Clock },
  pending_cancellation: { label: "Cancellation requested", color: "bg-red-100 text-red-800", icon: XCircle },
  pending_reschedule: { label: "Reschedule requested", color: "bg-blue-100 text-blue-800", icon: RefreshCw },
  needs_revision: { label: "Needs revision", color: "bg-orange-100 text-orange-800", icon: AlertTriangle },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600", icon: XCircle },
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
  const langLabel = cal.language === "sv" ? "Swedish" : cal.language === "en" ? "English" : cal.language;
  const typeLabel = cal.courseType ? (COURSE_TYPE_LABELS[cal.courseType] ?? cal.courseType) : "—";
  return (
    <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <Lock className="h-3.5 w-3.5" /> Calendar Information
      </div>
      <p className="text-xs text-muted-foreground">
        The following details are pulled from your booking calendar and apply to all course dates in this calendar.
        To request changes, send a message to admin — note that changes affect all bookings in the calendar.
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        <div><span className="text-muted-foreground">Course leader:</span> <span className="font-medium">{cal.primaryUserName ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{cal.primaryUserPhone ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Course type:</span> <span className="font-medium">{typeLabel}</span></div>
        <div><span className="text-muted-foreground">Language:</span> <span className="font-medium">{langLabel ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Address:</span> <span className="font-medium">{cal.autoAddress ?? "—"}</span></div>
        <div><span className="text-muted-foreground">City:</span> <span className="font-medium">{cal.autoCity ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Max seats:</span> <span className="font-medium">{cal.maxSeats}</span></div>
      </div>
      <p className="text-xs text-muted-foreground italic">
        Need a new calendar with different settings? <span className="underline cursor-pointer">Request here</span> (coming soon)
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
          Additional course days
          {!isIntro && <span className="text-muted-foreground font-normal ml-1">(min {minAdditional} extra {minAdditional === 1 ? "day" : "days"})</span>}
        </Label>
        {!isIntro && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...days, { date: "", startTime: "09:00", endTime: "16:00" }])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add day
          </Button>
        )}
      </div>
      {isIntro && (
        <p className="text-xs text-muted-foreground">Introduction courses are always 1 day. No additional days can be added.</p>
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
          <span className="text-muted-foreground text-xs">–</span>
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => onChange(days.filter((_, j) => j !== i))}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Register Course Dialog ──────────────────────────────────────────────────
function RegisterCourseDialog({
  open, onOpenChange, calendars, isBatch = false,
  prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  calendars: CalendarInfo[];
  isBatch?: boolean;
  prefill?: { calendarId?: string; venueName?: string; bookingInfo?: string };
}) {
  const utils = trpc.useUtils();
  const registerMut = trpc.courseDates.leaderRegister.useMutation();

  const [calendarId, setCalendarId] = useState(prefill?.calendarId ?? "");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("17:00");
  const [venueName, setVenueName] = useState(prefill?.venueName ?? "");
  const [bookingInfo, setBookingInfo] = useState(prefill?.bookingInfo ?? "");
  const [leaderMessage, setLeaderMessage] = useState("");
  const [additionalDays, setAdditionalDays] = useState<AdditionalDay[]>([]);

  // Batch: multiple dates
  const [batchDates, setBatchDates] = useState<{ date: string; startTime: string; endTime: string }[]>([
    { date: "", startTime: "10:00", endTime: "17:00" },
  ]);

  const selectedCal = calendars.find((c) => c.id === calendarId);
  const courseType = selectedCal?.courseType ?? "intro";

  const handleSubmit = async () => {
    if (!calendarId) { toast.error("Please select a booking calendar"); return; }
    if (!isBatch && !startDate) { toast.error("Please select a start date"); return; }
    if (!venueName) { toast.error("Please enter a venue name"); return; }
    if (isBatch && batchDates.some((d) => !d.date)) { toast.error("Please fill in all dates"); return; }

    try {
      if (isBatch) {
        for (const bd of batchDates) {
          await registerMut.mutateAsync({
            ghlCalendarId: calendarId,
            startDate: `${bd.date}T${bd.startTime}:00`,
            endDate: `${bd.date}T${bd.endTime}:00`,
            venueName,
            bookingInfo: bookingInfo || undefined,
            leaderMessage: leaderMessage || undefined,
            additionalDays: additionalDays.length > 0 ? JSON.stringify(additionalDays) : undefined,
          });
        }
        toast.success(`${batchDates.length} courses submitted for approval`);
      } else {
        await registerMut.mutateAsync({
          ghlCalendarId: calendarId,
          startDate: `${startDate}T${startTime}:00`,
          endDate: `${startDate}T${endTime}:00`,
          venueName,
          bookingInfo: bookingInfo || undefined,
          leaderMessage: leaderMessage || undefined,
          additionalDays: additionalDays.length > 0 ? JSON.stringify(additionalDays) : undefined,
        });
        toast.success("Course submitted for approval");
      }
      utils.courseDates.myCourseSchedule.invalidate();
      onOpenChange(false);
      setCalendarId(prefill?.calendarId ?? ""); setStartDate(""); setVenueName(prefill?.venueName ?? "");
      setBookingInfo(prefill?.bookingInfo ?? ""); setLeaderMessage(""); setAdditionalDays([]);
      setBatchDates([{ date: "", startTime: "10:00", endTime: "17:00" }]);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBatch ? <><Layers className="h-5 w-5" /> Batch register courses</> : <><Plus className="h-5 w-5" /> Register new course</>}
          </DialogTitle>
          <DialogDescription>
            {isBatch
              ? "Register multiple course dates at once for the same calendar."
              : "Fill in the details below. The course will be sent to admin for approval."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Calendar selector */}
          <div>
            <Label>Booking calendar *</Label>
            <Select value={calendarId} onValueChange={setCalendarId}>
              <SelectTrigger>
                <SelectValue placeholder="Select calendar..." />
              </SelectTrigger>
              <SelectContent>
                {calendars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Calendar info (locked) */}
          {selectedCal && <CalendarInfoBox cal={selectedCal} />}

          {/* Dates */}
          {isBatch ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Course dates *</Label>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setBatchDates([...batchDates, { date: "", startTime: "10:00", endTime: "17:00" }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add date
                </Button>
              </div>
              {batchDates.map((bd, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="date" value={bd.date}
                    onChange={(e) => { const u = [...batchDates]; u[i] = { ...u[i], date: e.target.value }; setBatchDates(u); }}
                    className="flex-1" />
                  <Input type="time" value={bd.startTime}
                    onChange={(e) => { const u = [...batchDates]; u[i] = { ...u[i], startTime: e.target.value }; setBatchDates(u); }}
                    className="w-28" />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input type="time" value={bd.endTime}
                    onChange={(e) => { const u = [...batchDates]; u[i] = { ...u[i], endTime: e.target.value }; setBatchDates(u); }}
                    className="w-28" />
                  {batchDates.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive"
                      onClick={() => setBatchDates(batchDates.filter((_, j) => j !== i))}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Start date *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Start time (day 1)</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <Label>End time (day 1)</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          {/* Additional days (single mode only) */}
          {!isBatch && selectedCal && (
            <AdditionalDaysEditor days={additionalDays} onChange={setAdditionalDays} courseType={courseType} />
          )}

          {/* Venue */}
          <div>
            <Label>Venue *</Label>
            <Input value={venueName} onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g. Clinic name, address" />
          </div>

          {/* Booking info */}
          <div>
            <Label>Additional booking information <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={bookingInfo} onChange={(e) => setBookingInfo(e.target.value)}
              placeholder="e.g. parking, elevator code, entrance instructions..."
              rows={2} />
          </div>

          {/* Message to admin */}
          <div>
            <Label>Message to admin <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={leaderMessage} onChange={(e) => setLeaderMessage(e.target.value)}
              placeholder="Any notes for admin..."
              rows={2} />
          </div>

          {/* Admin fee notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Administration fee:</strong> A minimum fee of 1 000 kr / €100 per course date applies.
            The fee is deducted if your normal compensation falls below this amount.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={registerMut.isPending}>
            {registerMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isBatch ? "Submit all" : "Submit for approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit & Resubmit Dialog ─────────────────────────────────────────────────
function EditRevisionDialog({ open, onOpenChange, course, calendars }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  course: CourseRow;
  calendars: CalendarInfo[];
}) {
  const utils = trpc.useUtils();
  const resubmitMut = trpc.courseDates.leaderResubmit.useMutation();

  // Pre-fill from existing course
  const startD = course.startDate ? new Date(course.startDate) : new Date();
  const endD = course.endDate ? new Date(course.endDate) : new Date();
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
  const toTimeStr = (d: Date) => d.toTimeString().slice(0, 5);

  const [startDate, setStartDate] = useState(toDateStr(startD));
  const [startTime, setStartTime] = useState(toTimeStr(startD));
  const [endTime, setEndTime] = useState(toTimeStr(endD));
  const [venueName, setVenueName] = useState(course.venueName ?? "");
  const [bookingInfo, setBookingInfo] = useState(course.bookingInfo ?? "");
  const [leaderMessage, setLeaderMessage] = useState("");
  const [additionalDays, setAdditionalDays] = useState<AdditionalDay[]>([]);

  const selectedCal = calendars.find((c) => c.id === course.ghlCalendarId);

  const handleSubmit = async () => {
    if (!startDate) { toast.error("Please select a date"); return; }
    if (!venueName) { toast.error("Please enter a venue"); return; }
    try {
      await resubmitMut.mutateAsync({
        id: course.id,
        startDate: `${startDate}T${startTime}:00`,
        endDate: `${startDate}T${endTime}:00`,
        venueName,
        bookingInfo: bookingInfo || undefined,
        additionalDays: additionalDays.length > 0 ? JSON.stringify(additionalDays) : undefined,
        leaderMessage: leaderMessage || undefined,
      });
      toast.success("Revision submitted!", { description: "Admin will review your updated course." });
      utils.courseDates.myCourseSchedule.invalidate();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" /> Edit & Resubmit course
          </DialogTitle>
          <DialogDescription>
            Update the details below and resubmit for admin approval.
          </DialogDescription>
        </DialogHeader>

        {/* Admin message */}
        {course.adminMessage && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
            <strong>Admin notes:</strong> {course.adminMessage}
          </div>
        )}

        <div className="space-y-4">
          {/* Calendar (locked) */}
          <div>
            <Label>Booking calendar</Label>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border border-border text-sm text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              {selectedCal?.name ?? course.ghlCalendarId}
            </div>
          </div>

          {/* Calendar info */}
          {selectedCal && <CalendarInfoBox cal={selectedCal} />}

          {/* Date & time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Start date *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Start time (day 1)</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label>End time (day 1)</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Additional days */}
          {selectedCal && (
            <AdditionalDaysEditor days={additionalDays} onChange={setAdditionalDays} courseType={selectedCal.courseType ?? course.courseType} />
          )}

          {/* Venue */}
          <div>
            <Label>Venue *</Label>
            <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="e.g. Clinic name, address" />
          </div>

          {/* Booking info */}
          <div>
            <Label>Additional booking information <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={bookingInfo} onChange={(e) => setBookingInfo(e.target.value)} rows={2}
              placeholder="e.g. parking, elevator code, entrance instructions..." />
          </div>

          {/* Message to admin */}
          <div>
            <Label>Message to admin <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={leaderMessage} onChange={(e) => setLeaderMessage(e.target.value)} rows={2}
              placeholder="Describe what you changed..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={resubmitMut.isPending}>
            {resubmitMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Resubmit for approval
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
      toast.success("Cancellation requested", { description: "Admin will process your request." });
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
          <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-destructive" /> Cancel course</DialogTitle>
          <DialogDescription>Request cancellation of {courseName}. Admin must approve and handle any booked participants.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Note:</strong> A minimum fee of 1 000 kr / €100 applies on cancellation. Admin will handle the calendar availability change.
          </div>
          <div>
            <Label>Reason / Message <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Describe why you want to cancel..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Back</Button>
          <Button variant="destructive" onClick={handleCancel} disabled={cancelMut.isPending}>
            {cancelMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Request cancellation
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
      toast.error("Please select a new date");
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
      toast.success("Reschedule requested", { description: "Admin will process your request." });
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
          <DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Reschedule course</DialogTitle>
          <DialogDescription>
            Current date: {fmtDate(course.startDate)}. Enter the new desired date below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>New date *</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <Label>Start time</Label>
              <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
            </div>
            <div>
              <Label>End time</Label>
              <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
            </div>
          </div>
          {course.courseType !== "intro" && (
            <AdditionalDaysEditor days={newAdditionalDays} onChange={setNewAdditionalDays} courseType={course.courseType} />
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Note:</strong> Rescheduling always requires admin approval. A minimum fee of 1 000 kr / €100 applies.
          </div>
          <div>
            <Label>Message to admin <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Reason for rescheduling..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleReschedule} disabled={rescheduleMut.isPending || !newDate}>
            {rescheduleMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Request reschedule
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
      toast.error("Please fill in date and venue");
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
      toast.success("Course copied!", { description: "Awaiting admin approval." });
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
          <DialogTitle className="flex items-center gap-2"><Copy className="h-5 w-5" /> Copy course</DialogTitle>
          <DialogDescription>Create a new course date based on this course. Select a new date.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>New date *</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <Label>Start time</Label>
              <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
            </div>
            <div>
              <Label>End time</Label>
              <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
            </div>
          </div>
          {course.courseType !== "intro" && (
            <AdditionalDaysEditor days={newAdditionalDays} onChange={setNewAdditionalDays} courseType={course.courseType} />
          )}
          <div>
            <Label>Venue *</Label>
            <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} />
          </div>
          <div>
            <Label>Additional booking information <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={bookingInfo} onChange={(e) => setBookingInfo(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Message to admin <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCopy} disabled={copyMut.isPending || !newDate || !venueName}>
            {copyMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Copy and submit
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
    created: "Created",
    batch_created: "Batch created",
    approved: "Approved",
    cancellation_requested: "Cancellation requested",
    cancellation_approved: "Cancellation approved",
    cancellation_denied: "Cancellation denied",
    reschedule_requested: "Reschedule requested",
    reschedule_approved: "Reschedule approved",
    reschedule_denied: "Reschedule denied",
    revision_requested: "Revision requested",
    resubmitted: "Revision submitted",
    rejected: "Rejected",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Change log</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !data?.log?.length ? (
          <p className="text-sm text-muted-foreground py-4">No history available.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {data.log.map((entry: any, i: number) => (
              <div key={i} className="border-l-2 border-border pl-4 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                  <span className="text-xs text-muted-foreground">by {entry.by}</span>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString("en-SE")}</div>
                {entry.details && <div className="text-xs text-muted-foreground mt-0.5">{entry.details}</div>}
              </div>
            ))}
            {data.adminMessage && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>Message from admin:</strong> {data.adminMessage}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Participant Attendance List ─────────────────────────────────────────────
function ParticipantAttendanceList({ courseId, readOnly = false }: { courseId: number; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch } = trpc.courseDates.getCourseParticipants.useQuery(
    { courseDateId: courseId },
    { enabled: open }
  );

  const markMutation = trpc.courseDates.markParticipantShowed.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(variables.showed ? "Marked as showed" : "Status updated");
      refetch();
    },
    onError: (err) => {
      toast.error(`Failed to update: ${err.message}`);
    },
  });

  const handleMark = useCallback(
    (appointmentId: string, showed: boolean) => {
      markMutation.mutate({ courseDateId: courseId, appointmentId, showed });
    },
    [courseId, markMutation]
  );

  // Mark as no-show: sets GHL status to "noshow" via the backend (showed=false resets to confirmed, so we need a separate handler)
  const noShowMutation = trpc.courseDates.markParticipantNoShow.useMutation({
    onSuccess: () => {
      toast.success("Marked as no-show");
      refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(`Failed to update: ${err.message}`);
    },
  });

  const handleNoShow = useCallback(
    (appointmentId: string) => {
      noShowMutation.mutate({ courseDateId: courseId, appointmentId });
    },
    [courseId, noShowMutation]
  );

  const participants = data?.participants ?? [];
  const showedCount = participants.filter((p) => p.showed).length;
  const isMutating = markMutation.isPending || noShowMutation.isPending;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-[oklch(0.22_0.04_255)] hover:underline"
      >
        <ListChecks className="h-3.5 w-3.5" />
        {readOnly ? "Bookings" : "Participants"}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-3 border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : participants.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              No bookings found for this course date.
            </div>
          ) : (
            <>
              <div className="bg-muted/40 px-4 py-2 flex items-center justify-between border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {participants.length} booking{participants.length !== 1 ? "s" : ""}
                </span>
                {!readOnly && (
                  <span className="text-xs text-muted-foreground">
                    {showedCount}/{participants.length} marked as showed
                  </span>
                )}
              </div>
              <div className="divide-y divide-border">
                {participants.map((p) => (
                  <div key={p.appointmentId} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                        {p.showed && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                            <CheckCircle className="h-3 w-3" /> Showed
                          </span>
                        )}
                        {p.noShow && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                            <XCircle className="h-3 w-3" /> No-show
                          </span>
                        )}
                      </div>
                      {p.email && <div className="text-xs text-muted-foreground mt-0.5">{p.email}</div>}
                    </div>
                    {!readOnly && (
                      <div className="shrink-0 flex items-center gap-1.5">
                        {p.showed ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            disabled={isMutating}
                            onClick={() => handleMark(p.appointmentId, false)}
                          >
                            <UserX className="h-3 w-3" /> Undo
                          </Button>
                        ) : p.noShow ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            disabled={isMutating}
                            onClick={() => handleMark(p.appointmentId, false)}
                          >
                            <RotateCcw className="h-3 w-3" /> Reset
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={isMutating}
                              onClick={() => handleMark(p.appointmentId, true)}
                            >
                              <UserCheck className="h-3 w-3" /> Showed
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                              disabled={isMutating}
                              onClick={() => handleNoShow(p.appointmentId)}
                            >
                              <UserX className="h-3 w-3" /> No-show
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Course Card ─────────────────────────────────────────────────────────────
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

function CourseCard({ row, showActions, isPending, showRepeat, calendars }: { row: CourseRow; showActions?: boolean; isPending?: boolean; showRepeat?: boolean; calendars?: CalendarInfo[] }) {
  const label = COURSE_TYPE_LABELS[row.courseType] ?? row.courseType;
  const langFlag = row.language === "sv" ? "🇸🇪" : "🇬🇧";
  const bookUrl = `https://api.leadconnectorhq.com/widget/booking/${row.ghlCalendarId}`;

  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [editRevisionOpen, setEditRevisionOpen] = useState(false);

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
            <div className="text-xs text-muted-foreground">Max seats</div>
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
            <strong>Message from admin:</strong> {row.adminMessage}
          </div>
        )}

        {/* Action buttons */}
        {showActions && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Edit & Resubmit for needs_revision */}
            {row.status === "needs_revision" && (
              <Button size="sm" className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setEditRevisionOpen(true)}>
                <Pencil className="h-3 w-3 mr-1" /> Edit & Resubmit
              </Button>
            )}
            {row.status === "approved" && (
              <a href={bookUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[oklch(0.22_0.04_255)] hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> Booking page
              </a>
            )}
            {canCopy && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCopyOpen(true)}>
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
            )}
            {canReschedule && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setRescheduleOpen(true)}>
                <RefreshCw className="h-3 w-3 mr-1" /> Reschedule
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
                <XCircle className="h-3 w-3 mr-1" /> Cancel
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLogOpen(true)}>
              <History className="h-3 w-3 mr-1" /> Log
            </Button>
          </div>
        )}

        {/* Read-only participant list for upcoming approved courses */}
        {showActions && row.status === "approved" && (
          <ParticipantAttendanceList courseId={row.id} readOnly />
        )}

        {/* Repeat button + participant list for past courses */}
        {showRepeat && (
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setCopyOpen(true)}>
                <RotateCcw className="h-3 w-3" /> Repeat course
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLogOpen(true)}>
                <History className="h-3 w-3 mr-1" /> Log
              </Button>
            </div>
            <ParticipantAttendanceList courseId={row.id} />
          </div>
        )}
      </div>

      <CancelDialog open={cancelOpen} onOpenChange={setCancelOpen} courseId={row.id} courseName={`${label} ${fmtDateShort(row.startDate)}`} />
      <RescheduleDialog open={rescheduleOpen} onOpenChange={setRescheduleOpen} course={row} />
      <CopyDialog open={copyOpen} onOpenChange={setCopyOpen} course={row} />
      <ChangeLogDialog open={logOpen} onOpenChange={setLogOpen} courseId={row.id} />
      {calendars && <EditRevisionDialog open={editRevisionOpen} onOpenChange={setEditRevisionOpen} course={row} calendars={calendars} />}
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
            My Courses
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.name} — course overview and payouts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBatchOpen(true)}>
            <Layers className="h-4 w-4 mr-2" /> Batch register
          </Button>
          <Button onClick={() => setRegisterOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Register course
          </Button>
        </div>
      </div>

      {/* ── Pending / Needs Attention ── */}
      {(schedule?.pending?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Needs attention
            </h2>
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">{schedule?.pending?.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedule?.pending?.map((row) => (
              <CourseCard key={row.id} row={row as unknown as CourseRow} showActions isPending calendars={calendarList} />
            ))}
          </div>
        </section>
      )}

      {/* ── Upcoming Courses ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Upcoming courses
          </h2>
        </div>

        {scheduleLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading schedule...
          </div>
        ) : !schedule?.upcoming.length ? (
          <div className="bg-muted/30 rounded-xl border border-border p-8 text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No upcoming approved courses.</p>
            <p className="text-xs mt-1">Click "Register course" above to create a new date.</p>
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
              Payout overview
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
            <p className="text-sm">No confirmed participants for this period.</p>
            <p className="text-xs mt-1">Only participants with status "Showed" are included in payouts.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Users className="h-3.5 w-3.5" /> Total participants</div>
                <div className="text-2xl font-bold text-foreground">{payoutData.courses.reduce((s, c) => s + c.participants.length, 0)}</div>
              </div>
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><BookOpen className="h-3.5 w-3.5" /> Courses this period</div>
                <div className="text-2xl font-bold text-foreground">{payoutData.courses.length}</div>
              </div>
              <div className="bg-[oklch(0.22_0.04_255)] rounded-xl border border-[oklch(0.30_0.05_255)] p-5">
                <div className="flex items-center gap-1.5 text-xs text-[oklch(0.72_0.12_75)] mb-1"><TrendingUp className="h-3.5 w-3.5" /> Payout (SEK)</div>
                <div className="text-2xl font-bold text-white">{fmt(payoutData.courses.filter(c => c.currency === "SEK").reduce((s, c) => s + c.totalPayout, 0), "SEK")}</div>
              </div>
              <div className="bg-[oklch(0.22_0.04_255)] rounded-xl border border-[oklch(0.30_0.05_255)] p-5">
                <div className="flex items-center gap-1.5 text-xs text-[oklch(0.72_0.12_75)] mb-1"><TrendingUp className="h-3.5 w-3.5" /> Payout (EUR)</div>
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
                    <div className="text-xs text-muted-foreground">Total payout</div>
                    <div className="text-lg font-bold text-[oklch(0.22_0.04_255)]">{fmt(course.totalPayout, course.currency)}</div>
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
                      {course.participants.map((p) => <ParticipantRow key={p.contactId} p={p} />)}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      <tr>
                        <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-foreground">Total</td>
                        <td className="py-3 px-4 text-sm text-right font-bold text-[oklch(0.22_0.04_255)]">{fmt(course.totalPayout, course.currency)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <strong>Note:</strong> Payout = Amount paid excl. VAT − 3.1% transaction fee − FA margin − affiliate commission (if applicable).
              Invoice Fascia Academy with 20-day payment terms.
            </div>
          </div>
        )}
      </section>

      {/* ── Cancelled Courses ── */}
      {(schedule?.cancelled?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Cancelled courses
            </h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{schedule?.cancelled?.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedule?.cancelled?.map((row) => (
              <CourseCard key={row.id} row={row as unknown as CourseRow} showActions />
            ))}
          </div>
        </section>
      )}

      {/* ── Course History ── */}
      {(schedule?.past?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
            <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Course history
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyToShow.map((row) => (
              <CourseCard key={row.id} row={row as unknown as CourseRow} showRepeat />
            ))}
          </div>
          {(schedule?.past?.length ?? 0) > 3 && (
            <button onClick={() => setShowAllHistory(!showAllHistory)}
              className="mt-4 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              {showAllHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showAllHistory ? "Show less" : `Show all ${schedule?.past?.length} past courses`}
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
