/**
 * Course Leader: Home
 * Lightweight welcome page — DB-only, no GHL calls. Loads instantly.
 * Shows notifications, next course, and quick actions.
 */
import { trpc } from "@/lib/trpc";
import { useDashAuth } from "@/contexts/DashAuthContext";
import { useLocation } from "wouter";
import {
  Loader2,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  CalendarPlus,
  BookOpen,
  Banknote,
  BarChart3,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
}

function courseTypeLabel(t: string) {
  const map: Record<string, string> = {
    intro: "Introduction",
    diplo: "Qualified (Diplo)",
    cert: "Certified",
    vidare: "Advanced",
  };
  return map[t] || t;
}

export default function LeaderHome() {
  const { user } = useDashAuth();
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.courseLeader.homeData.useQuery(undefined, {
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const d = data!;
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hasNotifications = d.needsRevision.length > 0 || d.recentlyApproved.length > 0 || d.recentlyCancelled.length > 0 || d.pendingCount > 0;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Welcome */}
      <div>
        <h1
          className="text-2xl font-bold text-foreground"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Welcome back, {firstName}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here's what's happening with your courses.
        </p>
      </div>

      {/* Notifications */}
      {hasNotifications && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Notifications
          </h2>

          {/* Needs revision — most important */}
          {d.needsRevision.map((c) => (
            <div
              key={`rev-${c.id}`}
              className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-amber-100 transition-colors"
              onClick={() => navigate("/my-courses")}
            >
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Revision requested: {courseTypeLabel(c.courseType)} — {c.city}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(c.startDate)} · Please review and resubmit
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          ))}

          {/* Pending count */}
          {d.pendingCount > 0 && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <Clock className="h-5 w-5 text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {d.pendingCount} course{d.pendingCount > 1 ? "s" : ""} awaiting admin review
                </p>
                <p className="text-xs text-muted-foreground">
                  You'll be notified when a decision is made
                </p>
              </div>
            </div>
          )}

          {/* Recently approved */}
          {d.recentlyApproved.map((c) => (
            <div
              key={`app-${c.id}`}
              className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Approved: {courseTypeLabel(c.courseType)} — {c.city}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(c.startDate)}</p>
              </div>
            </div>
          ))}

          {/* Recently cancelled/rejected */}
          {d.recentlyCancelled.map((c) => (
            <div
              key={`can-${c.id}`}
              className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3"
            >
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Cancelled: {courseTypeLabel(c.courseType)} — {c.city}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(c.startDate)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Next Upcoming Course */}
      {d.nextCourse ? (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-lg font-semibold text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Your Next Course
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => navigate("/my-courses")}
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-start gap-4">
            <div className="bg-[oklch(0.72_0.12_75)]/10 rounded-lg p-3 shrink-0">
              <CalendarDays className="h-8 w-8 text-[oklch(0.72_0.12_75)]" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                {courseTypeLabel(d.nextCourse.courseType)}
              </p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {d.nextCourse.venueName ? `${d.nextCourse.venueName}, ${d.nextCourse.city}` : d.nextCourse.city}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDate(d.nextCourse.startDate)}
                {d.nextCourse.endDate && new Date(d.nextCourse.endDate).getTime() !== new Date(d.nextCourse.startDate).getTime()
                  ? ` — ${formatDate(d.nextCourse.endDate)}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground mb-1">No upcoming courses</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Register your first course to get started.
          </p>
          <Button
            size="sm"
            className="gap-2 bg-[oklch(0.72_0.12_75)] hover:bg-[oklch(0.65_0.12_75)] text-white"
            onClick={() => navigate("/my-courses?register=1")}
          >
            <CalendarPlus className="h-4 w-4" />
            Register New Course
          </Button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{d.upcomingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Upcoming</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{d.pastCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Completed</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{d.pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Pending</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => navigate("/my-courses?register=1")}
            className="flex flex-col items-center gap-2 bg-card rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors text-center"
          >
            <CalendarPlus className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
            <span className="text-xs font-medium text-foreground">Register Course</span>
          </button>
          <button
            onClick={() => navigate("/my-courses")}
            className="flex flex-col items-center gap-2 bg-card rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors text-center"
          >
            <BookOpen className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
            <span className="text-xs font-medium text-foreground">My Courses</span>
          </button>
          <button
            onClick={() => navigate("/my-settlements")}
            className="flex flex-col items-center gap-2 bg-card rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors text-center"
          >
            <Banknote className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
            <span className="text-xs font-medium text-foreground">My Settlements</span>
          </button>
          <button
            onClick={() => navigate("/my-statistics")}
            className="flex flex-col items-center gap-2 bg-card rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors text-center"
          >
            <BarChart3 className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
            <span className="text-xs font-medium text-foreground">My Statistics</span>
          </button>
        </div>
      </div>
    </div>
  );
}
