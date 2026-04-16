/**
 * Admin: Students
 * Aggregated participant data from GHL appointments + certificates.
 * Shows: name, email, booked courses, completed courses + dates, certificates, course leader, total spend.
 * No export functionality. Exam pass/fail NOT shown.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, GraduationCap, Search, ChevronDown, ChevronUp, Award, BookOpen, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const COURSE_TYPE_LABELS: Record<string, string> = {
  intro: "Intro",
  diplo: "Diploma",
  cert: "Certification",
  vidare: "Advanced",
};

const COURSE_TYPE_COLORS: Record<string, string> = {
  intro: "bg-blue-100 text-blue-800",
  diplo: "bg-purple-100 text-purple-800",
  cert: "bg-amber-100 text-amber-800",
  vidare: "bg-emerald-100 text-emerald-800",
};

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-SE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

type Student = {
  contactId: string;
  name: string;
  email: string;
  bookedCourses: Array<{ courseType: string; date: string; courseLeader: string }>;
  completedCourses: Array<{ courseType: string; date: string; courseLeader: string }>;
  certificates: Array<{ courseType: string; issuedAt: string | null }>;
  totalSpend: number;
  currency: string;
};

function StudentRow({ student }: { student: Student }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <button className="text-muted-foreground">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <div>
              <div className="text-sm font-medium text-foreground">{student.name}</div>
              <div className="text-xs text-muted-foreground">{student.email}</div>
            </div>
          </div>
        </td>
        <td className="py-3 px-4 text-sm text-center">
          {student.bookedCourses.length > 0 ? (
            <span className="text-blue-600 font-medium">{student.bookedCourses.length}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>
        <td className="py-3 px-4 text-sm text-center">
          {student.completedCourses.length > 0 ? (
            <span className="text-emerald-600 font-medium">{student.completedCourses.length}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>
        <td className="py-3 px-4 text-sm text-center">
          {student.certificates.length > 0 ? (
            <div className="flex items-center justify-center gap-1">
              <Award className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-medium">{student.certificates.length}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>
        <td className="py-3 px-4 text-sm text-right font-medium text-foreground">
          {student.totalSpend > 0 ? fmt(student.totalSpend, student.currency) : "-"}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={5} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pl-8">
              {/* Booked Courses */}
              {student.bookedCourses.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Calendar className="h-3.5 w-3.5" />
                    Upcoming Bookings
                  </div>
                  <div className="space-y-1.5">
                    {student.bookedCourses.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className={`text-xs ${COURSE_TYPE_COLORS[c.courseType] ?? ""}`}>
                          {COURSE_TYPE_LABELS[c.courseType] ?? c.courseType}
                        </Badge>
                        <span className="text-muted-foreground">{formatDate(c.date)}</span>
                        <span className="text-xs text-muted-foreground">({c.courseLeader})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Courses */}
              {student.completedCourses.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <BookOpen className="h-3.5 w-3.5" />
                    Completed Courses
                  </div>
                  <div className="space-y-1.5">
                    {student.completedCourses.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className={`text-xs ${COURSE_TYPE_COLORS[c.courseType] ?? ""}`}>
                          {COURSE_TYPE_LABELS[c.courseType] ?? c.courseType}
                        </Badge>
                        <span className="text-muted-foreground">{formatDate(c.date)}</span>
                        <span className="text-xs text-muted-foreground">({c.courseLeader})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Certificates */}
              {student.certificates.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Award className="h-3.5 w-3.5" />
                    Certificates
                  </div>
                  <div className="space-y-1.5">
                    {student.certificates.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className={`text-xs ${COURSE_TYPE_COLORS[c.courseType] ?? ""}`}>
                          {COURSE_TYPE_LABELS[c.courseType] ?? c.courseType}
                        </Badge>
                        {c.issuedAt && (
                          <span className="text-muted-foreground">{formatDate(c.issuedAt)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Students() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  function handleSearch(val: string) {
    setSearch(val);
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => setDebouncedSearch(val), 400);
    setTimer(t);
  }

  const { data, isLoading, error } = trpc.admin.students.useQuery(
    { search: debouncedSearch || undefined },
    { staleTime: 60_000 }
  );

  const stats = useMemo(() => {
    if (!data) return { total: 0, withCerts: 0, totalSpend: 0 };
    return {
      total: data.length,
      withCerts: data.filter((s) => s.certificates.length > 0).length,
      totalSpend: data.reduce((sum, s) => sum + s.totalSpend, 0),
    };
  }, [data]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Students
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Participant overview - booked and completed courses, certificates, and spend
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground font-medium mb-1">Total Students</div>
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground font-medium mb-1">With Certificates</div>
          <div className="text-2xl font-bold text-foreground">{stats.withCerts}</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground font-medium mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-foreground">{fmt(stats.totalSpend, "SEK")}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{error.message}</div>
      ) : !data?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No students found.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Student</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-center">Booked</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-center">Completed</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-center">Certificates</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {data.map((student) => (
                  <StudentRow key={student.contactId} student={student as Student} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
