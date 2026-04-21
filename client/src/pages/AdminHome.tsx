import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Receipt,
  Calendar,
  MapPin,
  Users,
  TrendingUp,
  Activity,
  ChevronRight,
  ArrowRight,
  BookOpen,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COURSE_LABELS: Record<string, string> = {
  intro: "Intro",
  diplo: "Diplo",
  cert: "Cert",
  vidare: "Vidare",
};

function fmtDate(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function fmtTime(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - dt.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function daysUntil(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  const diff = dt.getTime() - Date.now();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

// ─── Activity icon + color ────────────────────────────────────────────────────

type ActivityType =
  | "course_submitted"
  | "course_approved"
  | "course_cancelled"
  | "course_pending_cancel"
  | "course_needs_revision"
  | "settlement_generated"
  | "settlement_approved"
  | "message_submitted"
  | "message_approved"
  | "message_rejected";

function activityMeta(type: ActivityType): { icon: React.ReactNode; color: string } {
  switch (type) {
    case "course_submitted":
      return { icon: <BookOpen className="h-3.5 w-3.5" />, color: "text-blue-500 bg-blue-50 border-blue-100" };
    case "course_approved":
      return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
    case "course_cancelled":
      return { icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-red-500 bg-red-50 border-red-100" };
    case "course_pending_cancel":
      return { icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-orange-500 bg-orange-50 border-orange-100" };
    case "course_needs_revision":
      return { icon: <FileText className="h-3.5 w-3.5" />, color: "text-yellow-600 bg-yellow-50 border-yellow-100" };
    case "settlement_generated":
      return { icon: <Receipt className="h-3.5 w-3.5" />, color: "text-purple-500 bg-purple-50 border-purple-100" };
    case "settlement_approved":
      return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
    case "message_submitted":
      return { icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-blue-500 bg-blue-50 border-blue-100" };
    case "message_approved":
      return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
    case "message_rejected":
      return { icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-red-500 bg-red-50 border-red-100" };
    default:
      return { icon: <CircleDot className="h-3.5 w-3.5" />, color: "text-muted-foreground bg-muted border-border" };
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminHome() {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = trpc.adminHome.summary.useQuery(undefined, {
    refetchInterval: 60_000, // refresh every minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive gap-2">
        <AlertCircle className="h-5 w-5" />
        <span>Failed to load home data</span>
      </div>
    );
  }

  const { pendingTasks, upcomingCourses, monthlyOverview, activityLog, currentMonth, currentYear } = data;
  const monthName = new Date(currentYear, currentMonth - 1, 1).toLocaleString("en-GB", { month: "long" });

  return (
    <div className="max-w-6xl mx-auto px-1 py-6 space-y-8">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Home</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* ── Section 1: Pending Tasks ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Pending Tasks</h2>
          {pendingTasks.total > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
              {pendingTasks.total}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Course Submissions */}
          <button
            onClick={() => setLocation("/pending-actions")}
            className="group flex items-center gap-4 rounded-xl border bg-card p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className={`flex-shrink-0 p-2.5 rounded-lg ${pendingTasks.courseSubmissions > 0 ? "bg-orange-100 text-orange-600" : "bg-muted text-muted-foreground"}`}>
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">Course Submissions</div>
              <div className={`text-2xl font-bold ${pendingTasks.courseSubmissions > 0 ? "text-orange-600" : "text-foreground"}`}>
                {pendingTasks.courseSubmissions}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
          </button>

          {/* Pending Settlements */}
          <button
            onClick={() => setLocation("/settlements")}
            className="group flex items-center gap-4 rounded-xl border bg-card p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className={`flex-shrink-0 p-2.5 rounded-lg ${pendingTasks.settlements > 0 ? "bg-purple-100 text-purple-600" : "bg-muted text-muted-foreground"}`}>
              <Receipt className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">Pending Settlements</div>
              <div className={`text-2xl font-bold ${pendingTasks.settlements > 0 ? "text-purple-600" : "text-foreground"}`}>
                {pendingTasks.settlements}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
          </button>

          {/* Pending Messages */}
          <button
            onClick={() => setLocation("/pending-actions")}
            className="group flex items-center gap-4 rounded-xl border bg-card p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className={`flex-shrink-0 p-2.5 rounded-lg ${pendingTasks.messages > 0 ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground"}`}>
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">Pending Messages</div>
              <div className={`text-2xl font-bold ${pendingTasks.messages > 0 ? "text-blue-600" : "text-foreground"}`}>
                {pendingTasks.messages}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
          </button>
        </div>

        {pendingTasks.total === 0 && (
          <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            All caught up — no pending tasks
          </p>
        )}
      </section>

      {/* ── Section 2 + 3: Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Section 2: Upcoming Courses (3/5 width) ── */}
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Upcoming Courses — Next 7 Days</h2>
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setLocation("/course-dates")}>
              View all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {upcomingCourses.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No courses scheduled in the next 7 days
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingCourses.map((course) => {
                const seatsLeft = course.maxSeats - course.bookedSeats;
                const seatsPercent = Math.round((course.bookedSeats / course.maxSeats) * 100);
                const isFull = seatsLeft <= 0;
                const isAlmostFull = seatsLeft <= 2 && seatsLeft > 0;
                return (
                  <div
                    key={course.id}
                    className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:border-primary/30 transition-colors"
                  >
                    {/* Date badge */}
                    <div className="flex-shrink-0 text-center w-12">
                      <div className="text-xs font-semibold text-primary uppercase">
                        {new Date(course.startDate).toLocaleString("en-GB", { month: "short" })}
                      </div>
                      <div className="text-xl font-bold text-foreground leading-tight">
                        {new Date(course.startDate).getDate()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {daysUntil(course.startDate)}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-10 bg-border flex-shrink-0" />

                    {/* Course info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-primary">
                          {COURSE_LABELS[course.courseType] ?? course.courseType}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{course.language.toUpperCase()}</span>
                      </div>
                      <div className="text-sm font-medium text-foreground truncate">{course.courseLeaderName}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{course.city}</span>
                        <span>·</span>
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span>{fmtTime(course.startDate)}</span>
                      </div>
                    </div>

                    {/* Seats */}
                    <div className="flex-shrink-0 text-right">
                      <div className={`text-sm font-semibold ${isFull ? "text-red-500" : isAlmostFull ? "text-orange-500" : "text-foreground"}`}>
                        {isFull ? "Full" : `${seatsLeft} left`}
                      </div>
                      <div className="text-xs text-muted-foreground">{course.bookedSeats}/{course.maxSeats}</div>
                      {/* Mini progress bar */}
                      <div className="w-16 h-1 rounded-full bg-muted mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isFull ? "bg-red-500" : isAlmostFull ? "bg-orange-400" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(seatsPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Section 3: Monthly Overview (2/5 width) ── */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">{monthName} Overview</h2>
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setLocation("/statistics")}>
              Statistics <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-4">
            <StatRow
              icon={<Calendar className="h-4 w-4" />}
              label="Courses this month"
              value={String(monthlyOverview.coursesThisMonth)}
            />
            <StatRow
              icon={<Users className="h-4 w-4" />}
              label="Active course leaders"
              value={String(monthlyOverview.activeLeaders)}
            />
            <StatRow
              icon={<Users className="h-4 w-4" />}
              label="Total participants"
              value={String(monthlyOverview.totalParticipants)}
            />
            <div className="border-t pt-3 space-y-3">
              <StatRow
                icon={<Receipt className="h-4 w-4" />}
                label="Settlements generated"
                value={`${monthlyOverview.settlementsGenerated}`}
                sub={`${monthlyOverview.settlementsApproved} approved`}
              />
              {monthlyOverview.totalPayoutSEK > 0 && (
                <StatRow
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Total payout (SEK)"
                  value={`${monthlyOverview.totalPayoutSEK.toLocaleString("sv-SE")} kr`}
                />
              )}
              {monthlyOverview.totalPayoutEUR > 0 && (
                <StatRow
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Total payout (EUR)"
                  value={`€${monthlyOverview.totalPayoutEUR.toLocaleString("en-GB")}`}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ── Section 4: Activity Log ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Recent Activity</h2>
        </div>

        {activityLog.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            No recent activity
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {activityLog.map((entry) => {
              const meta = activityMeta(entry.type as ActivityType);
              return (
                <button
                  key={entry.id}
                  onClick={() => setLocation(entry.href)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <div className={`flex-shrink-0 p-1.5 rounded-md border ${meta.color}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{entry.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{entry.subtitle}</div>
                  </div>
                  <div className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(entry.timestamp)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── StatRow helper ───────────────────────────────────────────────────────────

function StatRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-foreground">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}
