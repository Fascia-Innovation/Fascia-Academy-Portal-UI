import { Link, useLocation } from "wouter";
import { useDashAuth } from "@/contexts/DashAuthContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Calendar,
  BarChart3,
  BookOpen,
  Award,
  LogOut,
  ChevronRight,
  Settings,
  Eye,
  ArrowLeftCircle,
  Loader2,
  Zap,
  FileText,
  ClipboardCheck,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"admin" | "course_leader" | "affiliate">;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, roles: ["admin"] },
  { label: "Course Leaders", href: "/course-leaders", icon: Users, roles: ["admin"] },
  { label: "Affiliates", href: "/affiliates", icon: Award, roles: ["admin"] },
  { label: "Monthly History", href: "/history", icon: BarChart3, roles: ["admin"] },
  { label: "Upcoming Bookings", href: "/upcoming", icon: Calendar, roles: ["admin"] },
  { label: "Course Calendar", href: "/course-calendar", icon: BookOpen, roles: ["admin"] },
  { label: "Course Dates", href: "/course-dates", icon: Calendar, roles: ["admin"] },
  { label: "User Management", href: "/users", icon: Settings, roles: ["admin"] },
  { label: "Quick Links", href: "/quick-links", icon: Zap, roles: ["admin"] },
  { label: "Settlements", href: "/settlements", icon: FileText, roles: ["admin"] },
  { label: "Exam Queue", href: "/exam-queue", icon: ClipboardCheck, roles: ["admin"] },
  { label: "Certificates", href: "/certificates", icon: ScrollText, roles: ["admin"] },
  { label: "My Courses", href: "/my-courses", icon: BookOpen, roles: ["course_leader"] },
  { label: "My Settlements", href: "/my-settlements", icon: FileText, roles: ["course_leader", "affiliate"] },
  { label: "Quick Links", href: "/leader-links", icon: Zap, roles: ["course_leader"] },
  { label: "My Commissions", href: "/my-commissions", icon: TrendingUp, roles: ["affiliate"] },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
          active
            ? "bg-[oklch(0.72_0.12_75)] text-[oklch(0.17_0.04_255)]"
            : "text-[oklch(0.75_0.02_250)] hover:bg-[oklch(0.25_0.05_255)] hover:text-white"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
        {active && <ChevronRight className="h-3 w-3 ml-auto" />}
      </div>
    </Link>
  );
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, isImpersonating, refetch } = useDashAuth();
  const utils = trpc.useUtils();

  const stopImpersonationMutation = trpc.admin.stopImpersonation.useMutation({
    onSuccess: () => {
      toast.success("Returned to admin view");
      utils.dashboard.me.invalidate();
      utils.admin.checkImpersonation.invalidate();
      refetch();
      setLocation("/users");
    },
    onError: () => toast.error("Could not restore admin session"),
  });

  const logoutMutation = trpc.dashboard.logout.useMutation({
    onSuccess: () => {
      utils.dashboard.me.invalidate();
      window.location.href = "/login";
    },
    onError: () => toast.error("Sign out failed"),
  });

  // For dual-role users (course_leader with isAffiliate=true), show affiliate nav items too
  // For canExamineExams users (any role), show exam queue and certificates
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!user) return false;
    if (item.roles.includes(user.role)) return true;
    // Show affiliate nav items if course_leader is also an affiliate
    if (user.role === "course_leader" && user.isAffiliate && item.roles.includes("affiliate")) return true;
    // Show exam queue/certificates if user has examiner capability
    if (user.canExamineExams && (item.href === "/exam-queue" || item.href === "/certificates")) return true;
    return false;
  });

  const roleLabel = user?.role === "admin" ? "Administrator" 
    : user?.role === "course_leader" && user?.isAffiliate ? "Course Leader & Affiliate"
    : user?.role === "course_leader" ? "Course Leader" 
    : "Affiliate";
  const roleBadgeColor = user?.role === "admin" ? "bg-[oklch(0.72_0.12_75)] text-[oklch(0.17_0.04_255)]" : user?.role === "course_leader" ? "bg-blue-500/20 text-blue-200" : "bg-emerald-500/20 text-emerald-200";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 flex flex-col bg-[oklch(0.17_0.04_255)] border-r border-[oklch(0.28_0.04_255)]">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[oklch(0.28_0.04_255)]">
          <div className="w-9 h-9 rounded-lg bg-[oklch(0.72_0.12_75)] flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-[oklch(0.17_0.04_255)]" style={{ fontFamily: "'Playfair Display', serif" }}>FA</span>
          </div>
          <div>
            <div className="text-white text-sm font-semibold leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>Fascia Academy</div>
            <div className="text-[oklch(0.55_0.03_250)] text-xs">Dashboard</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={location === item.href || (item.href !== "/" && location.startsWith(item.href))}
            />
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-[oklch(0.28_0.04_255)]">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-2">
            <div className="w-8 h-8 rounded-full bg-[oklch(0.25_0.05_255)] flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-white">{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">{user?.name}</div>
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", roleBadgeColor)}>{roleLabel}</span>
            </div>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[oklch(0.65_0.03_250)] hover:text-white hover:bg-[oklch(0.25_0.05_255)] rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
              Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Impersonation banner */}
        {isImpersonating && (
          <div className="flex items-center justify-between bg-amber-50 border-b border-amber-300 text-amber-800 px-6 py-2.5 shrink-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Eye className="h-4 w-4" />
              <span>Viewing as <strong>{user?.name}</strong> ({user?.role === "course_leader" ? "Course Leader" : user?.role === "affiliate" ? "Affiliate" : "Admin"})</span>
            </div>
            <button
              onClick={() => stopImpersonationMutation.mutate()}
              disabled={stopImpersonationMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded border border-amber-400 hover:bg-amber-100 transition-colors"
            >
              {stopImpersonationMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ArrowLeftCircle className="h-3.5 w-3.5" />
              )}
              Return to Admin View
            </button>
          </div>
        )}
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
