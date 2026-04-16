import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useDashAuth } from "@/contexts/DashAuthContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
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
  GraduationCap,
  ExternalLink,
  CalendarPlus,
  Globe,
  BarChart3,
  Calendar,
  ClipboardList,
  Phone,
  BookOpenCheck,
  Mail,
  Banknote,
  Bell,
  BookMarked,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"admin" | "course_leader" | "affiliate">;
  examinerOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  // Admin
  { label: "Overview", href: "/", icon: LayoutDashboard, roles: ["admin"] },
  { label: "Courses", href: "/courses-admin", icon: BookOpen, roles: ["admin"] },
  { label: "Students", href: "/students", icon: GraduationCap, roles: ["admin"] },
  { label: "Course Leaders", href: "/course-leaders", icon: Users, roles: ["admin"] },
  { label: "Affiliates", href: "/affiliates", icon: Award, roles: ["admin"] },
  { label: "Settlements", href: "/settlements", icon: FileText, roles: ["admin"] },
  { label: "Exam Queue", href: "/exam-queue", icon: ClipboardCheck, roles: ["admin"] },
  { label: "Certificates", href: "/certificates", icon: ScrollText, roles: ["admin"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
  // Course Leader
  { label: "My Overview", href: "/my-overview", icon: LayoutDashboard, roles: ["course_leader"] },
  { label: "My Courses", href: "/my-courses", icon: BookOpen, roles: ["course_leader"] },
  { label: "My Settlements", href: "/my-settlements", icon: FileText, roles: ["course_leader", "affiliate"] },
  // Examiner-only (any role with canExamineExams)
  { label: "Exam Queue", href: "/exam-queue", icon: ClipboardCheck, roles: [], examinerOnly: true },
  { label: "Certificates", href: "/certificates", icon: ScrollText, roles: [], examinerOnly: true },
  // Affiliate
  { label: "My Commissions", href: "/my-commissions", icon: TrendingUp, roles: ["affiliate"] },
];

// ─── Quick Links Data ─────────────────────────────────────────────────────────
type QuickLink = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action: "navigate" | "external";
  href: string;
};

const ADMIN_QUICK_LINKS: QuickLink[] = [
  { title: "Add Course Date", icon: CalendarPlus, action: "navigate", href: "/courses-admin?tab=manage" },
  { title: "Add / Edit User", icon: Users, action: "navigate", href: "/settings" },
  { title: "Public Booking Page (SE)", icon: Globe, action: "external", href: "/courses?lang=sv" },
  { title: "Public Booking Page (EN)", icon: Globe, action: "external", href: "/courses?lang=en" },
  { title: "GHL — Go to CRM", icon: ExternalLink, action: "external", href: "https://app.gohighlevel.com" },
  { title: "fasciaacademy.com", icon: Globe, action: "external", href: "https://www.fasciaacademy.com" },
  { title: "Course Leader Application Form", icon: ClipboardList, action: "external", href: "https://member.fasciavibes.com/checkout/course-leader-fascia-academy" },
];

const LEADER_QUICK_LINKS: QuickLink[] = [
  { title: "Course Registration", icon: CalendarPlus, action: "external", href: "https://api.leadconnectorhq.com/widget/form/Qj23wxZoloZ66rUOiGfK" },
  { title: "Course Cancellation", icon: Calendar, action: "external", href: "https://api.leadconnectorhq.com/widget/form/zu6l7hiLRwgBam9qhJA7" },
  { title: "Request New Location", icon: Globe, action: "external", href: "https://api.leadconnectorhq.com/widget/form/FPuy6eYkypRk4MpC7eF1" },
  { title: "Course Leader Community", icon: Users, action: "external", href: "https://member.fasciavibes.com/c/course-leader-information/" },
  { title: "Course Leader Handbook", icon: BookOpenCheck, action: "external", href: "https://member.fasciavibes.com/c/course-leader-handbook-fascia-academy/" },
  { title: "Onboarding (SE)", icon: BookOpen, action: "external", href: "https://member.fasciavibes.com/c/se-onboarding-och-kunskapsbank-kursledare/" },
  { title: "Contact Fascia Academy", icon: Mail, action: "external", href: "mailto:info@fasciaacademy.com" },
];

// ─── Notification Bell ────────────────────────────────────────────────────────
type NotifItem = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  time: string;
  href?: string;
};

function NotificationBell({ user, setLocation }: { user: ReturnType<typeof useDashAuth>["user"]; setLocation: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Build notification items based on role
  const notifications: NotifItem[] = [];

  // For course leaders: upcoming courses reminder
  if (user?.role === "course_leader") {
    notifications.push({
      id: "welcome",
      icon: CheckCircle2,
      title: "Welcome to your dashboard",
      subtitle: "Check My Overview for your latest stats",
      time: "Now",
      href: "/my-overview",
    });
  }

  // For examiners: exam queue reminder
  if (user?.canExamineExams) {
    notifications.push({
      id: "exams",
      icon: ClipboardCheck,
      title: "Exam Queue",
      subtitle: "Check for new exams to grade",
      time: "",
      href: "/exam-queue",
    });
  }

  // For admin: general reminder
  if (user?.role === "admin") {
    notifications.push({
      id: "admin-overview",
      icon: BarChart3,
      title: "Monthly overview ready",
      subtitle: "Review this month's performance",
      time: "",
      href: "/",
    });
  }

  const hasNotifications = notifications.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Bell className="h-4 w-4" />
        {hasNotifications && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[oklch(0.72_0.12_75)]" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-card border border-border rounded-xl shadow-lg z-50 py-2">
          <div className="px-4 py-2 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notifications</span>
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No new notifications
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = n.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpen(false);
                    if (n.href) setLocation(n.href);
                  }}
                  className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-muted transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[oklch(0.72_0.12_75)]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-[oklch(0.72_0.12_75)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{n.subtitle}</div>
                    {n.time && <div className="text-xs text-muted-foreground/60 mt-1">{n.time}</div>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function QuickLinksDropdown({ links, setLocation }: { links: QuickLink[]; setLocation: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleClick(link: QuickLink) {
    setOpen(false);
    if (link.action === "navigate") {
      setLocation(link.href);
    } else {
      window.open(link.href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Zap className="h-4 w-4" />
        Quick Links
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-card border border-border rounded-xl shadow-lg z-50 py-2 max-h-[400px] overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.title}
                onClick={() => handleClick(link)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{link.title}</span>
                {link.action === "external" && <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
      setLocation("/settings");
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

  // Build visible nav items based on role + capabilities
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!user) return false;
    // Examiner-only items: show for admin always, or for any role with canExamineExams
    if (item.examinerOnly) {
      if (user.role === "admin") return false; // admin already has these in their main nav
      return !!user.canExamineExams;
    }
    if (item.roles.includes(user.role)) return true;
    // Show affiliate nav items if course_leader is also an affiliate
    if (user.role === "course_leader" && user.isAffiliate && item.roles.includes("affiliate")) return true;
    return false;
  });

  const quickLinks = user?.role === "admin" ? ADMIN_QUICK_LINKS : LEADER_QUICK_LINKS;

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
              key={item.href + item.label}
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
        {/* Top bar with impersonation + quick links */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-background shrink-0">
          {isImpersonating ? (
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
              <Eye className="h-4 w-4" />
              <span>Viewing as <strong>{user?.name}</strong> ({user?.role === "course_leader" ? "Course Leader" : user?.role === "affiliate" ? "Affiliate" : "Admin"})</span>
              <button
                onClick={() => stopImpersonationMutation.mutate()}
                disabled={stopImpersonationMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded border border-amber-400 bg-amber-50 hover:bg-amber-100 transition-colors ml-2"
              >
                {stopImpersonationMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ArrowLeftCircle className="h-3.5 w-3.5" />
                )}
                Return to Admin
              </button>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <NotificationBell user={user} setLocation={setLocation} />
            <QuickLinksDropdown links={quickLinks} setLocation={setLocation} />
          </div>
        </div>
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
