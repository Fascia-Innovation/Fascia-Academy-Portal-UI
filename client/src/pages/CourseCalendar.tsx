import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, CalendarDays, MapPin, User, Users, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const COURSE_TYPE_LABELS: Record<string, string> = {
  intro: "Introduktionskurs Fascia",
  diplo: "Diplomerad Fasciaspecialist",
  cert: "Certifierad Fasciaspecialist",
  vidare: "Vidareutbildning Fasciaspecialist",
};

const COURSE_TYPE_COLORS: Record<string, string> = {
  intro: "bg-blue-100 text-blue-800 border-blue-200",
  diplo: "bg-purple-100 text-purple-800 border-purple-200",
  cert: "bg-amber-100 text-amber-800 border-amber-200",
  vidare: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function detectType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("diplo") || n.includes("diploma")) return "diplo";
  if (n.includes("cert")) return "cert";
  if (n.includes("vidare") || n.includes("advanced") || n.includes("specialist")) return "vidare";
  return "intro";
}

function detectLang(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("introduction") || n.includes("qualified") || n.includes("certified") || n.includes("diploma")) return "EN";
  return "SE";
}

function formatSlotDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatSlotTime(iso: string) {
  return new Date(iso).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Slot = {
  date: string;
  slotTime: string;
  calendarId: string;
  calendarName: string;
  courseLeader: string;
  location: string;
  maxSeats: number;
  bookedSeats: number;
  availableSeats: number;
  participants: Array<{ id: string; name: string; email: string; status: string }>;
};

function SlotCard({ slot }: { slot: Slot }) {
  const [expanded, setExpanded] = useState(false);
  const type = detectType(slot.calendarName);
  const lang = detectLang(slot.calendarName);
  const pct = slot.maxSeats > 0 ? (slot.bookedSeats / slot.maxSeats) * 100 : 0;
  const isFull = slot.availableSeats === 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${COURSE_TYPE_COLORS[type] ?? COURSE_TYPE_COLORS.intro}`}>
                {COURSE_TYPE_LABELS[type] ?? type}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                {lang}
              </span>
              {isFull && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                  Fully Booked
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>{formatSlotDate(slot.slotTime)} · {formatSlotTime(slot.slotTime)}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {slot.courseLeader}
              </span>
              {slot.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {slot.location}
                </span>
              )}
            </div>
          </div>

          {/* Seats */}
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5 justify-end mb-1">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold">
                {slot.bookedSeats}/{slot.maxSeats}
              </span>
            </div>
            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isFull ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {slot.availableSeats} left
            </p>
          </div>
        </div>

        {/* Expand button */}
        {slot.participants.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : "Show"} {slot.participants.length} participants
          </button>
        )}
      </div>

      {/* Participant list */}
      {expanded && slot.participants.length > 0 && (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          <div className="space-y-1.5">
            {slot.participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{p.name || p.id}</span>
                <div className="flex items-center gap-2">
                  {p.email && <span className="text-muted-foreground text-xs">{p.email}</span>}
                  <Badge variant="outline" className="text-xs capitalize">{p.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CourseCalendar({ embedded = false }: { embedded?: boolean } = {}) {
  const [windowStart, setWindowStart] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const [filterType, setFilterType] = useState<string>("all");
  const [filterLang, setFilterLang] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");

  const windowEnd = windowStart + 30 * 24 * 60 * 60 * 1000;

  const { data, isLoading, error } = trpc.admin.courseCalendar.useQuery(
    { startMs: windowStart, endMs: windowEnd }
  );

  const slots = data?.slots ?? [];

  // Derive filter options from data
  const locations = useMemo(() => {
    const locs = new Set(slots.map(s => s.location).filter(Boolean));
    return Array.from(locs).sort();
  }, [slots]);

  const courseTypes = useMemo(() => {
    const types = new Set(slots.map(s => detectType(s.calendarName)));
    return Array.from(types).sort();
  }, [slots]);

  // Apply filters
  const filtered = useMemo(() => {
    return slots.filter(s => {
      if (filterType !== "all" && detectType(s.calendarName) !== filterType) return false;
      if (filterLang !== "all" && detectLang(s.calendarName) !== filterLang) return false;
      if (filterLocation !== "all" && s.location !== filterLocation) return false;
      return true;
    });
  }, [slots, filterType, filterLang, filterLocation]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of filtered) {
      const existing = map.get(slot.date) ?? [];
      existing.push(slot);
      map.set(slot.date, existing);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const windowLabel = `${new Date(windowStart).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })} – ${new Date(windowEnd).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className={embedded ? "" : "p-8 max-w-5xl mx-auto"}>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Course Calendar
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Available course dates across all calendars — free slots and bookings
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Date window navigation */}
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setWindowStart(w => w - 30 * 24 * 60 * 60 * 1000)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[160px] text-center">{windowLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setWindowStart(w => w + 30 * 24 * 60 * 60 * 1000)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5 text-foreground"
        >
          <option value="all">All course types</option>
          {courseTypes.map(t => (
            <option key={t} value={t}>{COURSE_TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>

        {/* Language filter */}
        <select
          value={filterLang}
          onChange={e => setFilterLang(e.target.value)}
          className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5 text-foreground"
        >
          <option value="all">All languages</option>
          <option value="SE">Swedish (SE)</option>
          <option value="EN">English (EN)</option>
        </select>

        {/* Location filter */}
        {locations.length > 0 && (
          <select
            value={filterLocation}
            onChange={e => setFilterLocation(e.target.value)}
            className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5 text-foreground"
          >
            <option value="all">All locations</option>
            {locations.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        )}

        {/* Summary */}
        {!isLoading && (
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} slot{filtered.length !== 1 ? "s" : ""} found
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Could not load course calendar: {error.message}</span>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
          <CalendarDays className="h-10 w-10 opacity-30" />
          <p className="text-sm">No course dates found for this period.</p>
          <p className="text-xs opacity-70">Try navigating to a different date range or adjusting the filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([date, daySlots]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" />
                {new Date(date + "T12:00:00").toLocaleDateString("sv-SE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <div className="space-y-3">
                {daySlots.map((slot, i) => (
                  <SlotCard key={`${slot.calendarId}-${slot.slotTime}-${i}`} slot={slot} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
