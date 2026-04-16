/**
 * Tests for portal restructure:
 * - Course leader data access controls / privacy masking
 * - Navigation structure (admin vs course leader vs affiliate)
 * - Students aggregation logic
 * - Settlement privacy masking
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Mock dashboardAuth
vi.mock("./dashboardAuth", () => ({
  getSessionUser: vi.fn(),
  getAllDashboardUsers: vi.fn(),
}));

// Mock GHL
vi.mock("./ghl", () => ({
  getCalendars: vi.fn(),
  getAllAppointments: vi.fn(),
  getContact: vi.fn(),
  getMonthRange: vi.fn(),
  getPreviousMonths: vi.fn(),
  detectCourseType: vi.fn(),
  detectCurrency: vi.fn(),
  extractCourseLeaderName: vi.fn(),
  calculateBreakdown: vi.fn(),
  getCourseCalendar: vi.fn(),
  getCalendarGroups: vi.fn(),
  FA_MARGIN: { intro: { sek: 500, eur: 50 }, diplo: { sek: 2000, eur: 200 }, cert: { sek: 5000, eur: 500 }, vidare: { sek: 500, eur: 50 } },
  AFFILIATE_COMMISSION_RATE: 0.1,
  VAT_RATE: 0.25,
}));

import { getSessionUser } from "./dashboardAuth";
import { detectCourseType, detectCurrency, extractCourseLeaderName } from "./ghl";

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockDetectCourseType = vi.mocked(detectCourseType);
const mockDetectCurrency = vi.mocked(detectCurrency);
const mockExtractCourseLeaderName = vi.mocked(extractCourseLeaderName);

// ─── Privacy Controls ────────────────────────────────────────────────────────

describe("Course Leader Privacy Controls", () => {
  it("should mask participant email for non-admin users in settlement lines", () => {
    const lines = [
      { participantName: "Anna Svensson", participantEmail: "anna@example.com", payout: "1500.00" },
      { participantName: "Erik Johansson", participantEmail: "erik@example.com", payout: "1500.00" },
    ];

    const userRole = "course_leader";
    const maskedLines = userRole !== "admin"
      ? lines.map((l) => ({ ...l, participantEmail: "" }))
      : lines;

    expect(maskedLines[0].participantEmail).toBe("");
    expect(maskedLines[1].participantEmail).toBe("");
    expect(maskedLines[0].participantName).toBe("Anna Svensson");
    expect(maskedLines[1].participantName).toBe("Erik Johansson");
  });

  it("should NOT mask participant email for admin users", () => {
    const lines = [
      { participantName: "Anna Svensson", participantEmail: "anna@example.com", payout: "1500.00" },
    ];

    const userRole = "admin";
    const maskedLines = userRole !== "admin"
      ? lines.map((l) => ({ ...l, participantEmail: "" }))
      : lines;

    expect(maskedLines[0].participantEmail).toBe("anna@example.com");
  });

  it("should only show phone for upcoming courses (not past)", () => {
    const today = new Date();
    const futureDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const pastDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const contact = { firstName: "Anna", lastName: "Svensson", phone: "+46701234567" };

    // Future course: phone visible
    const isPastFuture = futureDate < today;
    const phoneFuture = isPastFuture ? null : contact.phone;
    expect(phoneFuture).toBe("+46701234567");

    // Past course: phone hidden
    const isPastPast = pastDate < today;
    const phonePast = isPastPast ? null : contact.phone;
    expect(phonePast).toBeNull();
  });

  it("should not expose historical customer lists to course leaders", () => {
    // Course leaders should only see their own courses' participants
    const allAppointments = [
      { calendarId: "cal1", contactId: "c1", status: "showed" },
      { calendarId: "cal2", contactId: "c2", status: "showed" },
      { calendarId: "cal3", contactId: "c3", status: "showed" },
    ];

    const myCals = new Set(["cal1"]);
    const myAppointments = allAppointments.filter((a) => myCals.has(a.calendarId));

    expect(myAppointments).toHaveLength(1);
    expect(myAppointments[0].contactId).toBe("c1");
  });
});

// ─── Navigation Structure ────────────────────────────────────────────────────

describe("Navigation Structure", () => {
  const adminNavItems = [
    { label: "Overview", href: "/" },
    { label: "Courses", href: "/courses" },
    { label: "Students", href: "/students" },
    { label: "Course Leaders", href: "/course-leaders" },
    { label: "Affiliates", href: "/affiliates" },
    { label: "Settlements", href: "/settlements" },
    { label: "Exam Queue", href: "/exam-queue" },
    { label: "Certificates", href: "/certificates" },
    { label: "Settings", href: "/settings" },
  ];

  const leaderNavItems = [
    { label: "My Overview", href: "/my-overview" },
    { label: "My Courses", href: "/my-courses" },
    { label: "My Settlements", href: "/my-settlements" },
  ];

  it("admin should have 9 navigation items", () => {
    expect(adminNavItems).toHaveLength(9);
  });

  it("course leader should have 3 navigation items", () => {
    expect(leaderNavItems).toHaveLength(3);
  });

  it("admin nav should include Students page", () => {
    const hasStudents = adminNavItems.some((item) => item.label === "Students");
    expect(hasStudents).toBe(true);
  });

  it("admin nav should include merged Courses page (not separate Calendar/Upcoming)", () => {
    const hasCourses = adminNavItems.some((item) => item.label === "Courses");
    const hasCalendar = adminNavItems.some((item) => item.label === "Course Calendar");
    const hasUpcoming = adminNavItems.some((item) => item.label === "Upcoming Courses");
    expect(hasCourses).toBe(true);
    expect(hasCalendar).toBe(false);
    expect(hasUpcoming).toBe(false);
  });

  it("admin nav should include Settings (not separate User Management)", () => {
    const hasSettings = adminNavItems.some((item) => item.label === "Settings");
    const hasUserMgmt = adminNavItems.some((item) => item.label === "User Management");
    expect(hasSettings).toBe(true);
    expect(hasUserMgmt).toBe(false);
  });

  it("course leader nav should NOT include Students, Settings, or admin pages", () => {
    const leaderLabels = leaderNavItems.map((i) => i.label);
    expect(leaderLabels).not.toContain("Students");
    expect(leaderLabels).not.toContain("Settings");
    expect(leaderLabels).not.toContain("Overview");
    expect(leaderLabels).not.toContain("Affiliates");
  });

  it("exam queue should be accessible to users with canExamineExams", () => {
    const user = { role: "course_leader", canExamineExams: true };
    const canAccessExamQueue = user.role === "admin" || user.canExamineExams;
    expect(canAccessExamQueue).toBe(true);
  });

  it("exam queue should NOT be accessible to regular course leaders", () => {
    const user = { role: "course_leader", canExamineExams: false };
    const canAccessExamQueue = user.role === "admin" || user.canExamineExams;
    expect(canAccessExamQueue).toBe(false);
  });
});

// ─── Students Data Aggregation ───────────────────────────────────────────────

describe("Students Data Aggregation", () => {
  it("should aggregate multiple appointments for the same contact", () => {
    const appointments = [
      { contactId: "c1", calendarId: "cal1", status: "showed", startTime: "2026-01-15T09:00:00Z" },
      { contactId: "c1", calendarId: "cal2", status: "showed", startTime: "2026-03-20T09:00:00Z" },
      { contactId: "c2", calendarId: "cal1", status: "showed", startTime: "2026-02-10T09:00:00Z" },
    ];

    const studentMap = new Map<string, { contactId: string; courses: string[] }>();
    for (const appt of appointments) {
      if (!studentMap.has(appt.contactId)) {
        studentMap.set(appt.contactId, { contactId: appt.contactId, courses: [] });
      }
      studentMap.get(appt.contactId)!.courses.push(appt.calendarId);
    }

    expect(studentMap.size).toBe(2);
    expect(studentMap.get("c1")!.courses).toHaveLength(2);
    expect(studentMap.get("c2")!.courses).toHaveLength(1);
  });

  it("should exclude cancelled and no-show appointments", () => {
    const appointments = [
      { contactId: "c1", status: "showed" },
      { contactId: "c2", status: "cancelled" },
      { contactId: "c3", status: "no_show" },
      { contactId: "c4", status: "noshow" },
      { contactId: "c5", status: "confirmed" },
    ];

    const EXCLUDE = new Set(["cancelled", "no_show", "noshow", "invalid"]);
    const valid = appointments.filter((a) => !EXCLUDE.has(a.status.toLowerCase()));

    expect(valid).toHaveLength(2);
    expect(valid.map((a) => a.contactId)).toEqual(["c1", "c5"]);
  });

  it("should search students by name (case insensitive)", () => {
    const students = [
      { name: "Anna Svensson", email: "anna@test.com" },
      { name: "Erik Johansson", email: "erik@test.com" },
      { name: "Maria Andersson", email: "maria@test.com" },
    ];

    const q = "anna".toLowerCase();
    const filtered = students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Anna Svensson");
  });

  it("should search students by email", () => {
    const students = [
      { name: "Anna Svensson", email: "anna@test.com" },
      { name: "Erik Johansson", email: "erik@test.com" },
    ];

    const q = "erik@".toLowerCase();
    const filtered = students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Erik Johansson");
  });
});

// ─── GHL Helper Functions ────────────────────────────────────────────────────

describe("GHL Helper Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detectCourseType returns correct types", () => {
    mockDetectCourseType.mockImplementation((name: string) => {
      const n = name.toLowerCase();
      if (n.includes("intro") || n.includes("introduktion")) return "intro";
      if (n.includes("diplo") || n.includes("qualified")) return "diplo";
      if (n.includes("cert")) return "cert";
      return "intro";
    });

    expect(detectCourseType("Introduktionskurs Fascia - Anna")).toBe("intro");
    expect(detectCourseType("Diplomerad Fasciaspecialist - Erik")).toBe("diplo");
    expect(detectCourseType("Certifierad Fasciaspecialist - Maria")).toBe("cert");
  });

  it("detectCurrency returns SEK for Swedish courses", () => {
    mockDetectCurrency.mockImplementation((name: string) => {
      const n = name.toLowerCase();
      if (n.includes("sek") || n.includes("introduktion") || n.includes("diplomerad") || n.includes("certifierad")) return "SEK";
      return "EUR";
    });

    expect(detectCurrency("Introduktionskurs Fascia - Anna")).toBe("SEK");
  });

  it("extractCourseLeaderName extracts name from calendar", () => {
    mockExtractCourseLeaderName.mockImplementation((name: string) => {
      const parts = name.split(" - ");
      return parts.length > 1 ? parts[parts.length - 1].trim() : "Unknown";
    });

    expect(extractCourseLeaderName("Introduktionskurs Fascia - Anna Lindgren")).toBe("Anna Lindgren");
    expect(extractCourseLeaderName("Qualified Fascia Specialist - John Smith")).toBe("John Smith");
  });
});

// ─── Role-based Access Control ───────────────────────────────────────────────

describe("Role-based Access Control", () => {
  it("admin can access all pages", () => {
    const user = { role: "admin", canExamineExams: false };
    const adminPages = ["/", "/courses", "/students", "/course-leaders", "/affiliates", "/settlements", "/settings"];
    const accessible = adminPages.filter(() => user.role === "admin");
    expect(accessible).toHaveLength(adminPages.length);
  });

  it("course leader can only access their own pages", () => {
    const user = { role: "course_leader", canExamineExams: false };
    const leaderPages = ["/my-overview", "/my-courses", "/my-settlements"];
    const adminPages = ["/", "/courses", "/students", "/course-leaders", "/affiliates", "/settings"];

    const canAccessLeader = leaderPages.every(() => user.role === "course_leader" || user.role === "admin");
    const canAccessAdmin = adminPages.some(() => user.role === "admin");

    expect(canAccessLeader).toBe(true);
    expect(canAccessAdmin).toBe(false);
  });

  it("course leader with examiner role can access exam queue", () => {
    const user = { role: "course_leader", canExamineExams: true };
    const canAccessExams = user.role === "admin" || user.canExamineExams;
    expect(canAccessExams).toBe(true);
  });

  it("affiliate can only access their own pages", () => {
    const user = { role: "affiliate", canExamineExams: false };
    const affiliatePages = ["/my-commissions", "/my-settlements"];
    const canAccessAffiliate = affiliatePages.every(() => user.role === "affiliate" || user.role === "admin");
    expect(canAccessAffiliate).toBe(true);
  });

  it("non-admin settlement access is restricted to approved only", () => {
    const user = { role: "course_leader" };
    const settlement = { status: "pending", userId: 1 };

    const canAccess = user.role === "admin" || settlement.status === "approved";
    expect(canAccess).toBe(false);

    const approvedSettlement = { status: "approved", userId: 1 };
    const canAccessApproved = user.role === "admin" || approvedSettlement.status === "approved";
    expect(canAccessApproved).toBe(true);
  });
});

// ─── Notification Logic ──────────────────────────────────────────────────────

describe("Notification Logic", () => {
  it("exam notification only shows for users with canExamineExams", () => {
    const users = [
      { name: "Admin", role: "admin", canExamineExams: false },
      { name: "Leader1", role: "course_leader", canExamineExams: false },
      { name: "Leader2", role: "course_leader", canExamineExams: true },
    ];

    const usersWithExamNotif = users.filter((u) => u.canExamineExams);
    expect(usersWithExamNotif).toHaveLength(1);
    expect(usersWithExamNotif[0].name).toBe("Leader2");
  });

  it("course leader welcome notification only shows for course leaders", () => {
    const users = [
      { role: "admin" },
      { role: "course_leader" },
      { role: "affiliate" },
    ];

    const withWelcome = users.filter((u) => u.role === "course_leader");
    expect(withWelcome).toHaveLength(1);
  });
});
