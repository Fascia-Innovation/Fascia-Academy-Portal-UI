/**
 * Course Leader: Home
 * Lightweight welcome page — DB-only, no GHL calls. Loads instantly.
 * Shows action items (tasks), next course, quick stats, and quick actions.
 *
 * Two-tier notification system:
 *   - Notification Bell (DashboardShell) = feedback from FA (approvals, rejections, etc.)
 *   - This page = action items / tasks the course leader needs to do
 */
import { trpc } from "@/lib/trpc";
import { useDashAuth } from "@/contexts/DashAuthContext";
import { useLocation } from "wouter";
import {
  Loader2,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  CalendarPlus,
  BookOpen,
  Banknote,
  BarChart3,
  MapPin,
  FileText,
  TrendingUp,
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
  const { data: actionData, isLoading: actionsLoading } = trpc.courseLeader.leaderActionItems.useQuery(undefined, {
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
  const actionItems = actionData?.actionItems ?? [];
  const hasActions = actionItems.length > 0;

  // Icon map for action item types
  const ACTION_ICON_MAP: Record<string, typeof AlertCircle> = {
    revision: AlertCircle,
    invoice: FileText,
    invoice_affiliate: TrendingUp,
  };

  const ACTION_STYLE_MAP: Record<string, { bg: string; border: string; iconColor: string }> = {
    revision: { bg: "bg-amber-50", border: "border-amber-200", iconColor: "text-amber-600" },
    invoice: { bg: "bg-blue-50", border: "border-blue-200", iconColor: "text-blue-600" },
    invoice_affiliate: { bg: "bg-purple-50", border: "border-purple-200", iconColor: "text-purple-600" },
  };

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

      {/* Action Items — tasks the course leader needs to do */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Action Items
        </h2>

        {actionsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : hasActions ? (
          <>
            {actionItems.map((item) => {
              const Icon = ACTION_ICON_MAP[item.type] || AlertCircle;
              const style = ACTION_STYLE_MAP[item.type] || ACTION_STYLE_MAP.revision;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 ${style.bg} border ${style.border} rounded-lg px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => navigate(item.href)}
                >
                  <Icon className={`h-5 w-5 ${style.iconColor} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              );
            })}
          </>
        ) : (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">No action items</p>
              <p className="text-xs text-muted-foreground">You're all caught up!</p>
            </div>
          </div>
        )}

        {/* Informational: pending courses awaiting admin */}
        {d.pendingCount > 0 && (
          <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg px-4 py-3">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
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
      </div>

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
