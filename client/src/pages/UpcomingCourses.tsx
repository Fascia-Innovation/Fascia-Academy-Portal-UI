import { trpc } from "@/lib/trpc";
import { Loader2, Calendar, Users, Globe, MapPin } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  booked: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  showed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  noshow: "bg-gray-100 text-gray-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UpcomingCourses() {
  const { data, isLoading, error } = trpc.admin.upcomingCourses.useQuery();

  const courseTypeLabel: Record<string, string> = {
    intro: "Intro Course",
    diplo: "Diploma Course",
    cert: "Certification",
    vidare: "Advanced",
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
          Upcoming Courses
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Booked appointments across all calendars — next 90 days</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{error.message}</div>
      ) : !data?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No upcoming courses found in the next 90 days.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((course) => (
            <div key={course.calendarId} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Course header */}
              <div className="flex items-start justify-between px-6 py-4 bg-muted/30 border-b border-border">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[oklch(0.22_0.04_255)]/10 mt-0.5">
                    <Calendar className="h-4 w-4 text-[oklch(0.22_0.04_255)]" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {course.calendarName}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {course.courseLeader}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[oklch(0.22_0.04_255)]/10 text-[oklch(0.22_0.04_255)] font-medium">
                        {courseTypeLabel[course.courseType] ?? course.courseType}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {course.currency}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="font-medium text-foreground">{course.appointments.length}</span>
                  <span>booked</span>
                </div>
              </div>

              {/* Appointments list */}
              <div className="divide-y divide-border">
                {course.appointments.slice(0, 10).map((appt) => (
                  <div key={appt.id} className="flex items-center justify-between px-6 py-3">
                    <div className="text-sm text-foreground">{formatDate(appt.startTime)}</div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[appt.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {appt.status}
                    </span>
                  </div>
                ))}
                {course.appointments.length > 10 && (
                  <div className="px-6 py-3 text-xs text-muted-foreground">
                    +{course.appointments.length - 10} more appointments
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
