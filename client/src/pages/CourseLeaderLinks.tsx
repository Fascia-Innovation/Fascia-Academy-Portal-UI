import { ExternalLink, FileText, MapPin, BookOpen, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

type QuickLink = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  accent: string;
};

const LEADER_LINKS: QuickLink[] = [
  {
    title: "Course Registration",
    description: "Register a new course booking for a participant",
    icon: <FileText className="h-5 w-5" />,
    href: "https://api.leadconnectorhq.com/widget/form/Qj23wxZoloZ66rUOiGfK",
    accent: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    title: "Course Cancellation",
    description: "Cancel an existing course booking",
    icon: <FileText className="h-5 w-5" />,
    href: "https://api.leadconnectorhq.com/widget/form/zu6l7hiLRwgBam9qhJA7",
    accent: "bg-red-50 text-red-700 border-red-200",
  },
  {
    title: "Request New Course Location",
    description: "Submit a request to add a new course location",
    icon: <MapPin className="h-5 w-5" />,
    href: "https://api.leadconnectorhq.com/widget/form/FPuy6eYkypRk4MpC7eF1",
    accent: "bg-green-50 text-green-700 border-green-200",
  },
  {
    title: "Course Leader Community",
    description: "Access the course leader community on FasciaVibes",
    icon: <Users className="h-5 w-5" />,
    href: "https://member.fasciavibes.com/c/course-leader-information/",
    accent: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    title: "Course Leader Handbook",
    description: "Read the course leader handbook and guidelines",
    icon: <BookOpen className="h-5 w-5" />,
    href: "https://member.fasciavibes.com/c/course-leader-handbook-fascia-academy/",
    accent: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    title: "Onboarding & Knowledge Base (SE)",
    description: "Swedish onboarding materials and knowledge base for course leaders",
    icon: <BookOpen className="h-5 w-5" />,
    href: "https://member.fasciavibes.com/c/se-onboarding-och-kunskapsbank-kursledare/",
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    title: "Onboarding & Knowledge Base (EN)",
    description: "English onboarding materials — coming soon",
    icon: <BookOpen className="h-5 w-5" />,
    href: "#",
    accent: "bg-gray-50 text-gray-400 border-gray-200",
  },
  {
    title: "Contact Fascia Academy",
    description: "Reach out to the Fascia Academy team",
    icon: <Phone className="h-5 w-5" />,
    href: "mailto:info@fasciaacademy.com",
    accent: "bg-teal-50 text-teal-700 border-teal-200",
  },
];

export default function CourseLeaderLinks() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
          Quick Links
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Shortcuts to forms, resources, and contacts for course leaders
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {LEADER_LINKS.map((link) => {
          const isDisabled = link.href === "#";
          return (
            <div
              key={link.title}
              className={`rounded-xl border p-5 flex flex-col gap-3 ${link.accent} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{link.icon}</div>
                <div>
                  <div className="font-semibold text-sm leading-tight">{link.title}</div>
                  <div className="text-xs mt-1 opacity-80">{link.description}</div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-auto w-full bg-white/60 border-current/30 hover:bg-white/80"
                onClick={() => !isDisabled && window.open(link.href, "_blank")}
                disabled={isDisabled}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                {isDisabled ? "Coming soon" : "Open"}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Contact section */}
      <div className="mt-10 rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold text-base mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
          Need help?
        </h2>
        <p className="text-sm text-muted-foreground">
          Contact Fascia Academy at{" "}
          <a href="mailto:info@fasciaacademy.com" className="text-foreground underline underline-offset-2 hover:no-underline">
            info@fasciaacademy.com
          </a>{" "}
          for questions about courses, settlements, or your account.
        </p>
      </div>
    </div>
  );
}
