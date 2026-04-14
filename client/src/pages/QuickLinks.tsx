import { useLocation } from "wouter";
import {
  CalendarPlus, Users, Globe, BarChart3, BookOpen,
  Calendar, ExternalLink, ArrowRight, ClipboardList,
  TrendingUp, Settings,
} from "lucide-react";

type QuickLink = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: "navigate" | "external";
  href: string;
  accent?: string;
};

const QUICK_LINKS: QuickLink[] = [
  {
    title: "Add Course Date",
    description: "Publish a new course date to the public booking page",
    icon: CalendarPlus,
    action: "navigate",
    href: "/course-dates",
    accent: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    title: "Add / Edit User",
    description: "Create a new course leader, affiliate, or admin account",
    icon: Users,
    action: "navigate",
    href: "/users",
    accent: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    title: "Public Booking Page",
    description: "View the public course listing page (Swedish)",
    icon: Globe,
    action: "external",
    href: "/courses?lang=sv",
    accent: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  {
    title: "Public Booking Page (EN)",
    description: "View the public course listing page (English)",
    icon: Globe,
    action: "external",
    href: "/courses?lang=en",
    accent: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  {
    title: "Overview / Settlement",
    description: "Monthly revenue, payouts, and margin overview",
    icon: BarChart3,
    action: "navigate",
    href: "/",
    accent: "bg-purple-50 border-purple-200 text-purple-700",
  },
  {
    title: "Course Leader Ranking",
    description: "See which course leaders have the most participants",
    icon: TrendingUp,
    action: "navigate",
    href: "/course-leaders",
    accent: "bg-purple-50 border-purple-200 text-purple-700",
  },
  {
    title: "Upcoming Bookings",
    description: "All upcoming GHL appointments across all calendars",
    icon: Calendar,
    action: "navigate",
    href: "/upcoming",
    accent: "bg-slate-50 border-slate-200 text-slate-700",
  },
  {
    title: "Course Calendar",
    description: "Available slots and booked seats per calendar",
    icon: BookOpen,
    action: "navigate",
    href: "/course-calendar",
    accent: "bg-slate-50 border-slate-200 text-slate-700",
  },
  {
    title: "Monthly History",
    description: "Revenue and payout trends over the last 6 months",
    icon: BarChart3,
    action: "navigate",
    href: "/history",
    accent: "bg-slate-50 border-slate-200 text-slate-700",
  },
  {
    title: "GHL — Go to CRM",
    description: "Open GoHighLevel CRM in a new tab",
    icon: ExternalLink,
    action: "external",
    href: "https://app.gohighlevel.com",
    accent: "bg-orange-50 border-orange-200 text-orange-700",
  },
  {
    title: "fasciaacademy.com",
    description: "Open the main Fascia Academy website",
    icon: Globe,
    action: "external",
    href: "https://www.fasciaacademy.com",
    accent: "bg-orange-50 border-orange-200 text-orange-700",
  },
  {
    title: "Course Leader Application Form",
    description: "The registration form for new course leaders (SE)",
    icon: ClipboardList,
    action: "external",
    href: "https://member.fasciavibes.com/checkout/course-leader-fascia-academy",
    accent: "bg-orange-50 border-orange-200 text-orange-700",
  },
];

export default function QuickLinks() {
  const [, setLocation] = useLocation();

  function handleClick(link: QuickLink) {
    if (link.action === "navigate") {
      setLocation(link.href);
    } else {
      window.open(link.href, "_blank", "noopener,noreferrer");
    }
  }

  const primary = QUICK_LINKS.slice(0, 4);
  const secondary = QUICK_LINKS.slice(4, 9);
  const external = QUICK_LINKS.slice(9);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
          Quick Links
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Shortcuts to the most common admin actions
        </p>
      </div>

      {/* Primary actions */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Most Used
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {primary.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.href + link.title}
                onClick={() => handleClick(link)}
                className={`flex items-start gap-4 p-5 rounded-xl border text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${link.accent}`}
              >
                <div className="shrink-0 mt-0.5">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{link.title}</div>
                  <div className="text-xs opacity-75 mt-0.5 leading-relaxed">{link.description}</div>
                </div>
                {link.action === "external" ? (
                  <ExternalLink className="h-4 w-4 shrink-0 opacity-50 mt-0.5" />
                ) : (
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-50 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Dashboard pages */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Dashboard Pages
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {secondary.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.href + link.title}
                onClick={() => handleClick(link)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-sm hover:-translate-y-0.5 ${link.accent}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{link.title}</div>
                  <div className="text-xs opacity-70 truncate">{link.description}</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
              </button>
            );
          })}
        </div>
      </section>

      {/* External links */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          External
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {external.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.href + link.title}
                onClick={() => handleClick(link)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-sm hover:-translate-y-0.5 ${link.accent}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{link.title}</div>
                  <div className="text-xs opacity-70 truncate">{link.description}</div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-40" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
