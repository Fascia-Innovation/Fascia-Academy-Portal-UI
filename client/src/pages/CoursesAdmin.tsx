/**
 * Admin: Courses Hub
 * Merges Course Calendar, Upcoming Bookings, and Course Dates Management into a single tabbed view.
 */
import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { BookOpen } from "lucide-react";
import CourseCalendar from "./CourseCalendar";
import UpcomingCourses from "./UpcomingCourses";
import CourseDates from "./CourseDates";

type Tab = "calendar" | "upcoming" | "manage";

const TABS: { key: Tab; label: string }[] = [
  { key: "calendar", label: "Course Calendar" },
  { key: "upcoming", label: "Upcoming Bookings" },
  { key: "manage", label: "Manage Dates" },
];

export default function CoursesAdmin() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const tabParam = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(tabParam && TABS.some(t => t.key === tabParam) ? tabParam : "calendar");

  // Sync tab from URL when navigating with ?tab=
  useEffect(() => {
    if (tabParam && TABS.some(t => t.key === tabParam)) {
      setTab(tabParam);
    }
  }, [tabParam]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
          Courses
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Calendar overview, upcoming bookings, and course date management
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 mb-8 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content - render inline without the page wrapper padding/header */}
      <div>
        {tab === "calendar" && <CourseCalendarInline />}
        {tab === "upcoming" && <UpcomingCoursesInline />}
        {tab === "manage" && <CourseDatesInline />}
      </div>
    </div>
  );
}

// Thin wrappers that render the existing components in embedded mode (no page-level padding/header)
function CourseCalendarInline() {
  return <CourseCalendar embedded />;
}

function UpcomingCoursesInline() {
  return <UpcomingCourses embedded />;
}

function CourseDatesInline() {
  return <CourseDates embedded />;
}
