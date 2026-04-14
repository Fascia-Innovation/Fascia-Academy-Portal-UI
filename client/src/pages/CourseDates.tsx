/**
 * Admin: Course Dates Management
 * Allows admin to add/edit/delete/duplicate manually registered course dates.
 * These feed the public booking page (/courses).
 */
import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus,
  Pencil,
  Trash2,
  Globe,
  MapPin,
  Calendar,
  User,
  ExternalLink,
  Loader2,
  ChevronsUpDown,
  Check,
  Phone,
  Building2,
  Eye,
  ChevronDown,
  ChevronUp,
  Copy,
  Pencil as PencilIcon,
} from "lucide-react";
import { format } from "date-fns";

const COURSE_TYPE_LABELS: Record<string, string> = {
  intro: "Intro",
  diplo: "Diplo",
  cert: "Cert",
  vidare: "Vidare",
};

const COURSE_TYPE_COLORS: Record<string, string> = {
  intro: "bg-blue-100 text-blue-800",
  diplo: "bg-purple-100 text-purple-800",
  cert: "bg-amber-100 text-amber-800",
  vidare: "bg-green-100 text-green-800",
};

// ─── Course description templates ────────────────────────────────────────────
const DESCRIPTION_TEMPLATES: Record<string, Record<string, string>> = {
  sv: {
    intro: `**{title}**
*1 dag (10.00-17.00) + digitalt material*

**Om kursen**
Introduktionskurs Fascia ger en grundläggande och praktisk förståelse för vad fascia är, hur den fungerar och hur fasciabehandling används. Kursen kombinerar teori med praktisk behandling.

Genom att både arbeta med och uppleva behandling får du en konkret förståelse för hur fasciabehandling fungerar och hur den påverkar kroppen.

**Första steget i Fascia Academys utbildningssystem**
Introduktionskursen är det första steget i Fascia Academys sammanhållna utbildningssystem.
Efter genomförd kurs har du:
- En grundläggande förståelse för fascia och dess roll i kroppen
- En praktisk introduktion till fasciabehandling
- Möjlighet att fortsätta utbildning till Diplomerad och Certifierad Fasciaspecialist

Kursen är fristående men utgör också den gemensamma grund som används vidare i Fascia Academys utbildningsresa.

**För vem**
Kursen är öppen för alla som vill lära sig mer om fascia - både privat och professionellt.
Du behöver inga förkunskaper eller tidigare utbildning.
Kursen passar dig som:
- Är nyfiken på hur fascia påverkar kroppen
- Vill förstå kroppen ur ett mer helhetsbaserat perspektiv
- Arbetar inom hälsa, vård, friskvård, träning eller kroppsterapi och vill bredda din kompetens
- Vill uppleva fasciabehandling i praktiken
- Överväger vidare utbildning inom Fascia Academy

**Upplägg för dagen**
10.00-12.00 - Teoretisk introduktion: fascia, kroppen och grundläggande begrepp
12.00-13.00 - Lunchpaus (lunch ingår ej)
13.00-17.00 - Praktisk del: grundläggande fasciabehandling med maskin

**Praktiskt genomförande**
All fasciabehandling under kursen utförs utanpå kläder.
Du behöver inte ta med någon egen utrustning till kursen. Allt som används under kursdagen finns på plats.

**Digitalt kursmaterial**
Det digitala materialet ingår i kursen och finns tillgängligt direkt vid köp. Materialet används både som förberedelse inför kursdagen och som repetition efteråt.

**Detta ingår**
- Digitalt kursmaterial för förberedelse och repetition
- Tillgång till FasciaVibes Open (kostnadsfritt), med inspelade webinar, digitala kurser och material
- Löpande information inför kursstart
- Fysisk kursdag enligt kursplan
- Digitalt deltagarintyg efter genomförd kurs

**Pris och villkor**
Pris: 2 800 kr exkl. moms (3 500 kr inkl. moms)
Betalning sker i samband med anmälan.
Digitalt material ingår och tillgängliggörs direkt vid köp.

**Villkor för anmälan**
- Anmälan är bindande
- Ombokning till annat datum kan göras kostnadsfritt fram till 5 dagar innan kursstart
- För ombokning: kontakta info@fasciaacademy.com
- Eftersom digitalt material ges direkt vid köp är återbetalning inte möjlig
- Vid uteblivet deltagande utan ombokning återbetalas inte kursavgiften

**Inför kursen**
Du får ett mail med praktisk information inför kursstart.

**Har du frågor om kursen är du välkommen att kontakta kursledaren:**
Kursledare: {leaderName}
Telefonnummer: {phone}
Du kan också ställa dina frågor direkt i kommentarsfältet för eventet nedan.

**Plats**
{venueName}
{address}
{city}`,

    diplo: `**{title}**
*3 dagar + digitalt material*

**Om kursen**
Diplomerad Fasciaspecialist är nästa steg i Fascia Academys utbildningssystem och ger dig en fördjupad förståelse för fascians roll i kroppen samt praktiska färdigheter i avancerad fasciabehandling.

**Förutsättningar**
Genomförd Introduktionskurs Fascia krävs för deltagande.

**Detta ingår**
- Fördjupat digitalt kursmaterial
- 3 dagars intensiv utbildning med teori och praktik
- Tillgång till FasciaVibes Open
- Digitalt diplombevis efter genomförd kurs och godkänt prov

**Pris och villkor**
Pris: 12 000 kr exkl. moms (15 000 kr inkl. moms)
Betalning sker i samband med anmälan.

**Villkor för anmälan**
- Anmälan är bindande
- Ombokning kan göras kostnadsfritt fram till 5 dagar innan kursstart
- För ombokning: kontakta info@fasciaacademy.com

**Har du frågor om kursen är du välkommen att kontakta kursledaren:**
Kursledare: {leaderName}
Telefonnummer: {phone}

**Plats**
{venueName}
{address}
{city}`,

    cert: `**{title}**
*5 dagar + digitalt material*

**Om kursen**
Certifierad Fasciaspecialist är det avancerade steget i Fascia Academys utbildningssystem. Kursen ger dig djupgående kunskaper och certifiering som Fasciaspecialist.

**Förutsättningar**
Genomförd Diplomerad Fasciaspecialist krävs för deltagande.

**Detta ingår**
- Avancerat digitalt kursmaterial
- 5 dagars intensiv utbildning
- Certifieringsprov
- Digitalt certifikat efter godkänt prov

**Pris och villkor**
Pris: 40 000 kr exkl. moms (50 000 kr inkl. moms)
Betalning sker i samband med anmälan.

**Har du frågor om kursen är du välkommen att kontakta kursledaren:**
Kursledare: {leaderName}
Telefonnummer: {phone}

**Plats**
{venueName}
{address}
{city}`,

    vidare: `**{title}**
*Vidareutbildning + digitalt material*

**Om kursen**
Vidareutbildning Fasciaspecialist är en fördjupningskurs för dig som redan är certifierad och vill bredda din kompetens ytterligare.

**Förutsättningar**
Genomförd Certifierad Fasciaspecialist krävs för deltagande.

**Har du frågor om kursen är du välkommen att kontakta kursledaren:**
Kursledare: {leaderName}
Telefonnummer: {phone}

**Plats**
{venueName}
{address}
{city}`,
  },
  en: {
    intro: `**{title}**
*1 day (10:00-17:00) + digital material*

**About the course**
Introduction Course Fascia provides a fundamental and practical understanding of what fascia is, how it works, and how fascia treatment is applied. The course combines theory with hands-on treatment.

By both working with and experiencing treatment, you gain a concrete understanding of how fascia treatment works and how it affects the body.

**First step in Fascia Academy's training system**
The Introduction Course is the first step in Fascia Academy's comprehensive training system.
After completing the course, you will have:
- A fundamental understanding of fascia and its role in the body
- A practical introduction to fascia treatment
- The opportunity to continue training as a Qualified and Certified Fascia Specialist

**Who is it for?**
The course is open to everyone who wants to learn more about fascia - both privately and professionally.
No prior knowledge or training is required.
The course is suitable for you who:
- Are curious about how fascia affects the body
- Want to understand the body from a more holistic perspective
- Work in health, care, wellness, fitness, or body therapy and want to expand your skills
- Want to experience fascia treatment in practice
- Are considering further training within Fascia Academy

**Schedule for the day**
10:00-12:00 - Theoretical introduction: fascia, the body, and basic concepts
12:00-13:00 - Lunch break (lunch not included)
13:00-17:00 - Practical session: basic fascia treatment with machine

**Practical information**
All fascia treatment during the course is performed over clothing.
You do not need to bring any equipment. Everything needed is provided on-site.

**This is included**
- Digital course material for preparation and review
- Access to FasciaVibes Open (free), with recorded webinars, digital courses, and material
- Ongoing information before the course starts
- Physical course day according to the course plan
- Digital certificate of participation after completing the course

**Price and terms**
Price: 350 EUR (incl. VAT) / 3 500 SEK (incl. VAT)
Payment is made at the time of registration.
Digital material is included and made available immediately upon purchase.

**Registration terms**
- Registration is binding
- Rebooking to another date is free of charge up to 5 days before the course starts
- For rebooking: contact info@fasciaacademy.com
- Since digital material is provided immediately upon purchase, refunds are not possible
- No refund is given for non-attendance without rebooking

**Before the course**
You will receive an email with practical information before the course starts.

**If you have questions about the course, please contact the course leader:**
Course leader: {leaderName}
Phone: {phone}

**Location**
{venueName}
{address}
{city}`,

    diplo: `**{title}**
*3 days + digital material*

**About the course**
Qualified Fascia Specialist is the next step in Fascia Academy's training system, providing you with an in-depth understanding of fascia's role in the body and practical skills in advanced fascia treatment.

**Prerequisites**
Completed Introduction Course Fascia is required for participation.

**This is included**
- In-depth digital course material
- 3 days of intensive training with theory and practice
- Access to FasciaVibes Open
- Digital diploma after completing the course and passing the exam

**Price and terms**
Price: 1 500 EUR (incl. VAT) / 15 000 SEK (incl. VAT)
Payment is made at the time of registration.

**Registration terms**
- Registration is binding
- Rebooking is free of charge up to 5 days before the course starts
- For rebooking: contact info@fasciaacademy.com

**If you have questions about the course, please contact the course leader:**
Course leader: {leaderName}
Phone: {phone}

**Location**
{venueName}
{address}
{city}`,

    cert: `**{title}**
*5 days + digital material*

**About the course**
Certified Fascia Specialist is the advanced step in Fascia Academy's training system. The course provides you with in-depth knowledge and certification as a Fascia Specialist.

**Prerequisites**
Completed Qualified Fascia Specialist is required for participation.

**This is included**
- Advanced digital course material
- 5 days of intensive training
- Certification exam
- Digital certificate after passing the exam

**Price and terms**
Price: 5 000 EUR (incl. VAT) / 50 000 SEK (incl. VAT)
Payment is made at the time of registration.

**If you have questions about the course, please contact the course leader:**
Course leader: {leaderName}
Phone: {phone}

**Location**
{venueName}
{address}
{city}`,

    vidare: `**{title}**
*Advanced training + digital material*

**About the course**
Advanced Fascia Specialist is a continuing education course for those who are already certified and want to further expand their expertise.

**Prerequisites**
Completed Certified Fascia Specialist is required for participation.

**If you have questions about the course, please contact the course leader:**
Course leader: {leaderName}
Phone: {phone}

**Location**
{venueName}
{address}
{city}`,
  },
};

// Course title per type + language
const COURSE_TITLES: Record<string, Record<string, string>> = {
  sv: {
    intro: "Introduktionskurs Fascia by Fascia Academy",
    diplo: "Diplomerad Fasciaspecialist by Fascia Academy",
    cert: "Certifierad Fasciaspecialist by Fascia Academy",
    vidare: "Vidareutbildning Fasciaspecialist by Fascia Academy",
  },
  en: {
    intro: "Introduction Course Fascia by Fascia Academy",
    diplo: "Qualified Fascia Specialist by Fascia Academy",
    cert: "Certified Fascia Specialist by Fascia Academy",
    vidare: "Advanced Fascia Specialist by Fascia Academy",
  },
};

function buildDescription(
  courseType: string,
  language: string,
  leaderName: string,
  phone: string,
  venueName: string,
  address: string,
  city: string,
  startDate: string,
  customTemplate?: string
): string {
  const lang = language === "en" ? "en" : "sv";
  const type = courseType || "intro";
  const template = customTemplate ?? (DESCRIPTION_TEMPLATES[lang]?.[type] ?? "");

  const title = COURSE_TITLES[lang]?.[type] ?? "";
  const fullTitle = city
    ? `(${city}) ${title} - Kursledare: ${leaderName}`
    : `${title} - Kursledare: ${leaderName}`;

  let dateStr = "";
  if (startDate) {
    try {
      const d = new Date(startDate);
      dateStr = format(d, lang === "sv" ? "d MMMM yyyy" : "MMMM d, yyyy");
    } catch {}
  }

  return template
    .replace(/{title}/g, fullTitle)
    .replace(/{leaderName}/g, leaderName || "[Kursledarens namn]")
    .replace(/{phone}/g, phone || "[Telefonnummer]")
    .replace(/{venueName}/g, venueName || "[Lokal]")
    .replace(/{address}/g, address || "[Adress]")
    .replace(/{city}/g, city || "[Stad]")
    .replace(/{date}/g, dateStr || "[Datum]");
}

// Default start/end times for new forms
function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7); // next week as default
  d.setHours(10, 0, 0, 0);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}
function defaultEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(17, 0, 0, 0);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

type FormData = {
  ghlCalendarId: string;
  courseLeaderName: string;
  ghlUserId: string;
  courseType: "intro" | "diplo" | "cert" | "vidare";
  language: "sv" | "en";
  city: string;
  country: string;
  venueName: string;
  address: string;
  courseLeaderPhone: string;
  startDate: string;
  endDate: string;
  maxSeats: string;
  notes: string;
  published: boolean;
  customDescription: string; // editable template override
};

const emptyForm = (): FormData => ({
  ghlCalendarId: "",
  courseLeaderName: "",
  ghlUserId: "",
  courseType: "intro",
  language: "sv",
  city: "",
  country: "Sweden",
  venueName: "",
  address: "",
  courseLeaderPhone: "",
  startDate: defaultStartDate(),
  endDate: defaultEndDate(),
  maxSeats: "12",
  notes: "",
  published: true,
  customDescription: "",
});

export default function CourseDates() {
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [calPickerOpen, setCalPickerOpen] = useState(false);
  const [calSearch, setCalSearch] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(false);

  const { data: courseDates = [], isLoading } = trpc.courseDates.listAdmin.useQuery();
  const { data: ghlCalendars = [], isLoading: calendarsLoading } = trpc.courseDates.getCalendars.useQuery();

  const createMutation = trpc.courseDates.create.useMutation({
    onSuccess: () => {
      toast.success("Course date added");
      utils.courseDates.listAdmin.invalidate();
      utils.courseDates.listPublic.invalidate();
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.courseDates.update.useMutation({
    onSuccess: () => {
      toast.success("Course date updated");
      utils.courseDates.listAdmin.invalidate();
      utils.courseDates.listPublic.invalidate();
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.courseDates.delete.useMutation({
    onSuccess: () => {
      toast.success("Course date deleted");
      utils.courseDates.listAdmin.invalidate();
      utils.courseDates.listPublic.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const duplicateMutation = trpc.courseDates.duplicate.useMutation({
    onSuccess: () => {
      toast.success("Course date duplicated as draft — update the date and publish when ready");
      utils.courseDates.listAdmin.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Calendar map for quick lookup
  const calendarMap = useMemo(
    () => new Map(ghlCalendars.map((c) => [c.id, c])),
    [ghlCalendars]
  );

  // Strict search: filter calendars by course leader name OR calendar name
  const filteredCalendars = useMemo(() => {
    const q = calSearch.toLowerCase().trim();
    if (!q) return ghlCalendars;
    return ghlCalendars.filter((c) => {
      const leaderMatch = (c.primaryUserName ?? "").toLowerCase().includes(q);
      const nameMatch = c.name.toLowerCase().includes(q);
      return leaderMatch || nameMatch;
    });
  }, [ghlCalendars, calSearch]);

  function handleCalendarSelect(calId: string) {
    const cal = calendarMap.get(calId);
    if (!cal) return;
    setCalPickerOpen(false);
    setCalSearch("");
    setForm((f) => ({
      ...f,
      ghlCalendarId: calId,
      courseLeaderName: cal.primaryUserName ?? f.courseLeaderName,
      ghlUserId: cal.primaryUserId ?? "",
      courseType: (cal.courseType as FormData["courseType"]) ?? f.courseType,
      language: (cal.language as FormData["language"]) ?? f.language,
      // Auto-fill address/city from GHL meetingLocation if fields are empty
      venueName: f.venueName || ((cal as any).autoVenueName ?? ""),
      address: f.address || ((cal as any).autoAddress ?? ""),
      city: f.city || ((cal as any).autoCity ?? ""),
      // Reset custom description when calendar changes
      customDescription: "",
    }));
    setEditingTemplate(false);
  }

  // When start date changes, auto-set end date to same day at 17:00
  function handleStartDateChange(val: string) {
    setForm((f) => {
      // Only auto-update end date if it hasn't been manually changed from default
      const newEnd = val ? val.substring(0, 11) + "17:00" : f.endDate;
      return { ...f, startDate: val, endDate: newEnd };
    });
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowPreview(false);
    setEditingTemplate(false);
    setCalSearch("");
    setDialogOpen(true);
  }

  function openEdit(row: (typeof courseDates)[0]) {
    setEditingId(row.id);
    setForm({
      ghlCalendarId: row.ghlCalendarId,
      courseLeaderName: row.courseLeaderName,
      ghlUserId: row.ghlUserId ?? "",
      courseType: row.courseType,
      language: row.language,
      city: row.city,
      country: row.country,
      venueName: (row as any).venueName ?? "",
      address: (row as any).address ?? "",
      courseLeaderPhone: (row as any).courseLeaderPhone ?? "",
      startDate: format(new Date(row.startDate), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(row.endDate), "yyyy-MM-dd'T'HH:mm"),
      maxSeats: String(row.maxSeats),
      notes: row.notes ?? "",
      published: row.published,
      customDescription: "",
    });
    setShowPreview(false);
    setEditingTemplate(false);
    setCalSearch("");
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      ghlCalendarId: form.ghlCalendarId,
      courseLeaderName: form.courseLeaderName,
      ghlUserId: form.ghlUserId || undefined,
      courseType: form.courseType,
      language: form.language,
      city: form.city,
      country: form.country,
      venueName: form.venueName || undefined,
      address: form.address || undefined,
      courseLeaderPhone: form.courseLeaderPhone || undefined,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      maxSeats: parseInt(form.maxSeats, 10) || 12,
      notes: form.notes || undefined,
      published: form.published,
    };

    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Auto-generated description (uses custom template if set)
  const descriptionPreview = useMemo(
    () =>
      buildDescription(
        form.courseType,
        form.language,
        form.courseLeaderName,
        form.courseLeaderPhone,
        form.venueName,
        form.address,
        form.city,
        form.startDate,
        form.customDescription || undefined
      ),
    [form.courseType, form.language, form.courseLeaderName, form.courseLeaderPhone, form.venueName, form.address, form.city, form.startDate, form.customDescription]
  );

  // Initialize editable template from the auto-generated one
  function startEditingTemplate() {
    if (!form.customDescription) {
      setForm((f) => ({ ...f, customDescription: descriptionPreview }));
    }
    setEditingTemplate(true);
    setShowPreview(true);
  }

  function resetTemplate() {
    setForm((f) => ({ ...f, customDescription: "" }));
    setEditingTemplate(false);
  }

  // Selected calendar display name
  const selectedCalendarName = useMemo(
    () => ghlCalendars.find((c) => c.id === form.ghlCalendarId)?.name ?? "",
    [ghlCalendars, form.ghlCalendarId]
  );

  // Group by upcoming vs past
  const now = new Date();
  const upcoming = courseDates.filter((d) => new Date(d.startDate) >= now);
  const past = courseDates.filter((d) => new Date(d.startDate) < now);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Course Dates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manually register course dates for the public booking page.
            Each entry takes ~30 seconds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/courses"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            View public page
          </a>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Course Date
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-2xl font-bold text-foreground">{upcoming.length}</div>
          <div className="text-sm text-muted-foreground">Upcoming dates</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-2xl font-bold text-foreground">{past.length}</div>
          <div className="text-sm text-muted-foreground">Past dates</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-2xl font-bold text-foreground">
            {courseDates.filter((d) => d.published).length}
          </div>
          <div className="text-sm text-muted-foreground">Published</div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : courseDates.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-12 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No course dates yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Click "Add Course Date" to register the first one.
          </p>
          <Button onClick={openCreate} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Add Course Date
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Course Leader</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date & Time</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Seats</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {[...upcoming, ...past].map((row) => {
                const isPast = new Date(row.startDate) < now;
                return (
                  <tr
                    key={row.id}
                    className={`border-b last:border-0 transition-colors hover:bg-muted/20 ${isPast ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(row as any).profilePhoto ? (
                          <img
                            src={(row as any).profilePhoto}
                            alt={row.courseLeaderName}
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{row.courseLeaderName}</div>
                          {(row as any).courseLeaderPhone && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {(row as any).courseLeaderPhone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${COURSE_TYPE_COLORS[row.courseType]}`}>
                          {COURSE_TYPE_LABELS[row.courseType]}
                        </span>
                        <span className="text-xs text-muted-foreground uppercase">{row.language}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{format(new Date(row.startDate), "d MMM yyyy")}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(row.startDate), "HH:mm")} – {format(new Date(row.endDate), "HH:mm")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          {(row as any).venueName && (
                            <div className="font-medium text-xs">{(row as any).venueName}</div>
                          )}
                          <div className="text-xs text-muted-foreground">{row.city}, {row.country}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{row.maxSeats}</td>
                    <td className="px-4 py-3">
                      {row.published ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Duplicate as draft"
                          onClick={() => duplicateMutation.mutate({ id: row.id })}
                          disabled={duplicateMutation.isPending}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(row.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Edit Course Date" : "Add Course Date"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* ── Searchable calendar picker ── */}
            <div className="space-y-1.5">
              <Label>GHL Calendar</Label>
              {calendarsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading calendars...
                </div>
              ) : (
                <Popover open={calPickerOpen} onOpenChange={(open) => { setCalPickerOpen(open); if (!open) setCalSearch(""); }}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={calPickerOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate text-left">
                        {selectedCalendarName || "Select a GHL calendar..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <div className="flex items-center border-b px-3 gap-2">
                      <svg className="h-4 w-4 shrink-0 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                      <input
                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Search by course leader name..."
                        value={calSearch}
                        onChange={(e) => setCalSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-72 overflow-y-auto py-1">
                      {filteredCalendars.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">No calendars found.</div>
                      ) : (
                        filteredCalendars.map((cal) => (
                          <button
                            key={cal.id}
                            type="button"
                            onClick={() => handleCalendarSelect(cal.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors ${form.ghlCalendarId === cal.id ? "bg-accent/50" : ""}`}
                          >
                            <Check
                              className={`h-4 w-4 shrink-0 ${form.ghlCalendarId === cal.id ? "opacity-100" : "opacity-0"}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{cal.name}</div>
                              {cal.primaryUserName && (
                                <div className="text-xs text-muted-foreground">{cal.primaryUserName}</div>
                              )}
                            </div>
                            {cal.courseType && (
                              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${COURSE_TYPE_COLORS[cal.courseType]}`}>
                                {COURSE_TYPE_LABELS[cal.courseType]}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <p className="text-xs text-muted-foreground">
                Selecting a calendar auto-fills course type, language, course leader, and location.
              </p>
            </div>

            {/* ── Course Leader + Phone ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Course Leader Name</Label>
                <Input
                  value={form.courseLeaderName}
                  onChange={(e) => setForm((f) => ({ ...f, courseLeaderName: e.target.value }))}
                  placeholder="e.g. Fredrik Kjellberg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Phone <span className="text-muted-foreground font-normal">(for booking text)</span>
                </Label>
                <Input
                  value={form.courseLeaderPhone}
                  onChange={(e) => setForm((f) => ({ ...f, courseLeaderPhone: e.target.value }))}
                  placeholder="e.g. 073-056 62 75"
                />
              </div>
            </div>

            {/* ── Course Type + Language ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Course Type</Label>
                <Select
                  value={form.courseType}
                  onValueChange={(v) => setForm((f) => ({ ...f, courseType: v as FormData["courseType"], customDescription: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intro">Intro</SelectItem>
                    <SelectItem value="diplo">Diplo</SelectItem>
                    <SelectItem value="cert">Cert</SelectItem>
                    <SelectItem value="vidare">Vidare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select
                  value={form.language}
                  onValueChange={(v) => setForm((f) => ({ ...f, language: v as FormData["language"], customDescription: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sv">Swedish (SE)</SelectItem>
                    <SelectItem value="en">English (EN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Start + End Date ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date & Time <span className="text-muted-foreground font-normal text-xs">(first day)</span></Label>
                <Input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            {/* ── Venue + Address + City + Seats ── */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Venue Name <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                value={form.venueName}
                onChange={(e) => setForm((f) => ({ ...f, venueName: e.target.value }))}
                placeholder="e.g. Fasciaklinikerna Helsingborg"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                Address <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="e.g. Berga allé 1, 254 52 Helsingborg"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="e.g. Helsingborg"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Seats</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={form.maxSeats}
                  onChange={(e) => setForm((f) => ({ ...f, maxSeats: e.target.value }))}
                />
              </div>
            </div>

            {/* ── Internal Notes ── */}
            <div className="space-y-1.5">
              <Label>Internal Notes <span className="text-muted-foreground font-normal">(optional — not shown publicly)</span></Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Day 2 is 9:00–16:00, special venue instructions..."
                rows={2}
              />
            </div>

            {/* ── Published toggle ── */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium text-sm">Published</div>
                <div className="text-xs text-muted-foreground">Show on public booking page</div>
              </div>
              <Switch
                checked={form.published}
                onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))}
              />
            </div>

            {/* ── Course Description Preview / Edit ── */}
            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors"
                >
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Course description
                  <span className="text-xs text-muted-foreground font-normal">
                    {form.customDescription ? "(custom)" : "(auto-generated)"}
                  </span>
                  {showPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className="flex items-center gap-2">
                  {form.customDescription && (
                    <button
                      type="button"
                      onClick={resetTemplate}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Reset to auto
                    </button>
                  )}
                  {!editingTemplate ? (
                    <button
                      type="button"
                      onClick={startEditingTemplate}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <PencilIcon className="h-3 w-3" />
                      Edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingTemplate(false)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
              {showPreview && (
                <div className="p-4">
                  {editingTemplate ? (
                    <>
                      <Textarea
                        value={form.customDescription || descriptionPreview}
                        onChange={(e) => setForm((f) => ({ ...f, customDescription: e.target.value }))}
                        rows={20}
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Edit freely. Use placeholders: {"{leaderName}"}, {"{phone}"}, {"{venueName}"}, {"{address}"}, {"{city}"}, {"{date}"}
                      </p>
                    </>
                  ) : (
                    <>
                      <pre className="text-xs whitespace-pre-wrap font-mono text-foreground/80 leading-relaxed max-h-64 overflow-y-auto">
                        {descriptionPreview}
                      </pre>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-muted-foreground">
                          Copy and paste into Circle or your booking platform.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(descriptionPreview);
                            toast.success("Copied to clipboard");
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving || !form.ghlCalendarId || !form.city || !form.startDate || !form.endDate}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId !== null ? "Save Changes" : "Add Course Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Course Date?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove this course date from the public booking page. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId !== null && deleteMutation.mutate({ id: deleteConfirmId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
