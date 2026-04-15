/**
 * Public Course Booking Page — /courses
 * Bilingual (SE/EN via ?lang=sv|en), no login required.
 * Features:
 *  - Calendar view (default)
 *  - Google Maps with city markers
 *  - Course leader cards
 *  - "Mer info" modal with course description + unique details
 *  - Booking modal (GHL widget embedded, stays on page)
 *  - Prices per course type
 *  - Multi-day course support
 *  - "Om kursledaren" button linking to profileUrl
 */
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import { format } from "date-fns";
import { sv, enUS } from "date-fns/locale";
import {
  MapPin,
  Calendar,
  Users,
  ChevronDown,
  X,
  Globe,
  User,
  LayoutGrid,
  CalendarDays,
  ExternalLink,
  Loader2,
  Clock,
  Info,
  Phone,
  Building2,
  ArrowRight,
} from "lucide-react";

// ─── i18n strings ─────────────────────────────────────────────────────────────
const T = {
  sv: {
    title: "Hitta en kurs nära dig",
    subtitle: "Välj kurstyp, stad eller kursledare och boka din plats direkt.",
    filterType: "Kurstyp",
    filterLeader: "Kursledare",
    allLeaders: "Alla kursledare",
    allTypes: "Alla kurstyper",
    viewLeaders: "Kursledare",
    viewCalendar: "Kalender",
    viewMap: "Karta",
    book: "Boka",
    moreInfo: "Mer info",
    seats: "platser",
    seatsLeft: "platser kvar",
    noResults: "Inga kurser hittades med dessa filter.",
    noResultsSub: "Prova att ändra filter eller välj ett annat språk.",
    noDates: "Inga kommande datum",
    courseTypes: {
      intro: "Introduktionskurs Fascia",
      diplo: "Diplomerad Fasciaspecialist",
      cert: "Certifierad Fasciaspecialist",
      vidare: "Vidareutbildning för Certifierade Fasciaspecialister",
    },
    courseTypesShort: {
      intro: "Introduktionskurs",
      diplo: "Diplomerad",
      cert: "Certifierad",
      vidare: "Vidareutbildning",
    },
    prices: {
      intro: "3 500 kr inkl. moms",
      diplo: "15 000 kr inkl. moms",
      cert: "50 000 kr inkl. moms",
      vidare: "9 375 kr inkl. moms",
    },
    languages: { sv: "Svenska", en: "Engelska" },
    bookingTitle: "Boka kurs",
    closeBooking: "Stäng",
    langSwitch: "English",
    startDate: "Startdatum",
    courseLeader: "Kursledare",
    location: "Plats",
    time: "Tid",
    additionalDays: "Ytterligare kursdagar",
    bookingInfo: "Praktisk information",
    aboutLeader: "Om kursledaren",
    moreAboutCourses: "Mer om kurserna",
    learnMore: "Läs mer på fasciaacademy.com",
    day: "Dag",
    contact: "Kontakt",
    address: "Adress",
    close: "Stäng",
    courses: "kurser",
  },
  en: {
    title: "Find a course near you",
    subtitle: "Choose a course type, city or course leader and book your spot.",
    filterType: "Course type",
    filterLeader: "Course leader",
    allLeaders: "All leaders",
    allTypes: "All types",
    viewLeaders: "Leaders",
    viewCalendar: "Calendar",
    viewMap: "Map",
    book: "Book",
    moreInfo: "More info",
    seats: "seats",
    seatsLeft: "spots left",
    noResults: "No courses found with these filters.",
    noResultsSub: "Try adjusting the filters or selecting a different language.",
    noDates: "No upcoming dates",
    courseTypes: {
      intro: "Introduction Course Fascia",
      diplo: "Qualified Fascia Specialist",
      cert: "Certified Fascia Specialist",
      vidare: "Advanced Training for Certified Fascia Specialists",
    },
    courseTypesShort: {
      intro: "Introduction Course",
      diplo: "Qualified Specialist",
      cert: "Certified Specialist",
      vidare: "Advanced Training",
    },
    prices: {
      intro: "350 EUR incl. VAT",
      diplo: "1 500 EUR incl. VAT",
      cert: "5 000 EUR incl. VAT",
      vidare: "938 EUR incl. VAT",
    },
    languages: { sv: "Swedish", en: "English" },
    bookingTitle: "Book course",
    closeBooking: "Close",
    langSwitch: "Svenska",
    startDate: "Start date",
    courseLeader: "Course leader",
    location: "Location",
    time: "Time",
    additionalDays: "Additional course days",
    bookingInfo: "Practical information",
    aboutLeader: "About the course leader",
    moreAboutCourses: "More about the courses",
    learnMore: "Read more at fasciaacademy.com",
    day: "Day",
    contact: "Contact",
    address: "Address",
    close: "Close",
    courses: "courses",
  },
};

type Lang = "sv" | "en";
type CourseType = "intro" | "diplo" | "cert" | "vidare";
type ViewMode = "calendar" | "map" | "leaders";

const COURSE_TYPE_COLORS: Record<CourseType, string> = {
  intro: "bg-blue-100 text-blue-800 border-blue-200",
  diplo: "bg-purple-100 text-purple-800 border-purple-200",
  cert: "bg-amber-100 text-amber-800 border-amber-200",
  vidare: "bg-green-100 text-green-800 border-green-200",
};

const COURSE_TYPE_ACCENT: Record<CourseType, string> = {
  intro: "#3b82f6",
  diplo: "#8b5cf6",
  cert: "#f59e0b",
  vidare: "#10b981",
};

// Course info links — TODO: update URLs when fasciaacademy.com pages are ready
const COURSE_INFO_URLS: Record<CourseType, string> = {
  intro: "https://www.fasciaacademy.com",    // TODO: update to /kurser/introduktionskurs
  diplo: "https://www.fasciaacademy.com",    // TODO: update to /kurser/diplomerad
  cert: "https://www.fasciaacademy.com",     // TODO: update to /kurser/certifierad
  vidare: "https://www.fasciaacademy.com",   // TODO: update to /kurser/vidareutbildning
};

// Swedish city coordinates (approximate)
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "Stockholm": { lat: 59.3293, lng: 18.0686 },
  "Sollentuna": { lat: 59.4281, lng: 17.9506 },
  "Göteborg": { lat: 57.7089, lng: 11.9746 },
  "Malmö": { lat: 55.6050, lng: 13.0038 },
  "Helsingborg": { lat: 56.0465, lng: 12.6945 },
  "Uppsala": { lat: 59.8586, lng: 17.6389 },
  "Västerås": { lat: 59.6099, lng: 16.5448 },
  "Örebro": { lat: 59.2741, lng: 15.2066 },
  "Linköping": { lat: 58.4108, lng: 15.6214 },
  "Sundbyberg": { lat: 59.3617, lng: 17.9717 },
  "Borås": { lat: 57.7210, lng: 12.9401 },
  "Jönköping": { lat: 57.7826, lng: 14.1618 },
  "Halmstad": { lat: 56.6745, lng: 12.8578 },
  "Västervik": { lat: 57.7590, lng: 16.6380 },
  "Piteå": { lat: 65.3172, lng: 21.4793 },
  "Örnsköldsvik": { lat: 63.2909, lng: 18.7157 },
};

function getCityCoords(city: string): { lat: number; lng: number } | null {
  if (CITY_COORDS[city]) return CITY_COORDS[city];
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (city.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(city.toLowerCase())) {
      return coords;
    }
  }
  return null;
}

// ─── Shared course entry type ─────────────────────────────────────────────────
type AdditionalDay = { date: string; startTime: string; endTime: string };

type CourseEntry = {
  id: number;
  courseLeaderName: string;
  profilePhoto: string | null;
  courseType: CourseType;
  city: string;
  country: string;
  venueName: string | null;
  address: string | null;
  courseLeaderPhone: string | null;
  startDate: Date;
  endDate: Date;
  maxSeats: number;
  bookedSeats: number;
  ghlCalendarId: string;
  language: Lang;
  bookingInfo: string | null;
  additionalDays: AdditionalDay[];
  profileUrl: string | null;
  [key: string]: unknown;
};

// ─── Booking Modal ─────────────────────────────────────────────────────────────
function BookingModal({
  calendarId,
  courseLeaderName,
  courseName,
  startDate,
  lang,
  onClose,
  t,
}: {
  calendarId: string;
  courseLeaderName: string;
  courseName: string;
  startDate: Date;
  lang: Lang;
  onClose: () => void;
  t: (typeof T)[Lang];
}) {
  const dateParam = format(startDate, "yyyy-MM-dd");
  const bookingUrl = `https://api.leadconnectorhq.com/widget/booking/${calendarId}?date=${dateParam}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">{t.bookingTitle}</h2>
            <p className="text-sm text-gray-500">
              {courseName} · {courseLeaderName} · {format(startDate, "d MMMM yyyy", { locale: lang === "sv" ? sv : enUS })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <iframe
            src={bookingUrl}
            className="w-full h-full min-h-[500px] border-0"
            title={`Book ${courseName}`}
            allow="payment"
          />
        </div>
      </div>
    </div>
  );
}

// ─── More Info Modal ──────────────────────────────────────────────────────────
function MoreInfoModal({
  date,
  lang,
  t,
  onBook,
  onClose,
}: {
  date: CourseEntry;
  lang: Lang;
  t: (typeof T)[Lang];
  onBook: () => void;
  onClose: () => void;
}) {
  const locale = lang === "sv" ? sv : enUS;
  const isMultiDay = date.additionalDays && date.additionalDays.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div
              className="w-1 h-10 rounded-full shrink-0"
              style={{ backgroundColor: COURSE_TYPE_ACCENT[date.courseType] }}
            />
            <div>
              <h2 className="font-bold text-gray-900 text-lg leading-tight">
                {(t.courseTypes as Record<string, string>)[date.courseType]}
              </h2>
              <p className="text-sm text-gray-500">{date.city}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — two columns on md+ */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {/* Left: course description / template text */}
            <div className="p-6 space-y-4">
              {/* Price badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-semibold">
                {(t.prices as Record<string, string>)[date.courseType]}
              </div>

              {/* Course type description */}
              <div className="prose prose-sm max-w-none text-gray-700">
                <CourseDescription courseType={date.courseType} lang={lang} />
              </div>

              {/* Learn more link */}
              <a
                href={COURSE_INFO_URLS[date.courseType]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                {t.learnMore}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Right: unique course details */}
            <div className="p-6 space-y-5">
              {/* Dates */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {isMultiDay ? t.startDate : t.time}
                </h4>
                <div className="space-y-1.5">
                  {/* Day 1 */}
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="font-medium">
                      {isMultiDay && <span className="text-gray-400 mr-1">{t.day} 1 —</span>}
                      {format(date.startDate, "d MMMM yyyy", { locale })}
                    </span>
                    <span className="text-gray-400">
                      {format(date.startDate, "HH:mm")}–{format(date.endDate, "HH:mm")}
                    </span>
                  </div>
                  {/* Additional days */}
                  {date.additionalDays.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="font-medium">
                        <span className="text-gray-400 mr-1">{t.day} {i + 2} —</span>
                        {format(new Date(d.date), "d MMMM yyyy", { locale })}
                      </span>
                      <span className="text-gray-400">{d.startTime}–{d.endTime}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Course leader */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {t.courseLeader}
                </h4>
                <div className="flex items-center gap-3">
                  {date.profilePhoto ? (
                    <img
                      src={date.profilePhoto}
                      alt={date.courseLeaderName}
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-100 shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{date.courseLeaderName}</div>
                    {date.courseLeaderPhone && (
                      <a
                        href={`tel:${date.courseLeaderPhone}`}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mt-0.5"
                      >
                        <Phone className="h-3 w-3" />
                        {date.courseLeaderPhone}
                      </a>
                    )}
                    {date.profileUrl && (
                      <a
                        href={date.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-0.5"
                      >
                        {t.aboutLeader}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {t.location}
                </h4>
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    {date.venueName && (
                      <div className="font-medium">{date.venueName}</div>
                    )}
                    {date.address && (
                      <div className="text-gray-500">{date.address}</div>
                    )}
                    {!date.address && (
                      <div className="text-gray-500">{date.city}, {date.country}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Booking info (directions, parking, etc.) */}
              {date.bookingInfo && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {t.bookingInfo}
                  </h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{date.bookingInfo}</p>
                </div>
              )}

              {/* Seats */}
              {(() => {
                const booked = date.bookedSeats ?? 0;
                const max = date.maxSeats;
                const remaining = max - booked;
                const isFull = remaining <= 0;
                const isLow = remaining <= 3 && remaining > 0;
                return (
                  <div className={`flex items-center gap-2 text-sm font-medium ${
                    isFull ? "text-red-600" : isLow ? "text-orange-500" : "text-gray-500"
                  }`}>
                    <Users className="h-4 w-4" />
                    {isFull
                      ? (lang === "sv" ? "Fullbokad" : "Fully booked")
                      : `${remaining}/${max} ${t.seatsLeft}`
                    }
                    {isLow && !isFull && <span className="ml-0.5">⚡ {lang === "sv" ? "Få platser kvar!" : "Few spots left!"}</span>}
                  </div>
                );
              })()}

              {/* Book button */}
              <button
                onClick={() => { onBook(); onClose(); }}
                className="w-full py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                {t.book}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Course Description (template text per course type) ───────────────────────
function CourseDescription({ courseType, lang }: { courseType: CourseType; lang: Lang }) {
  const descriptions: Record<Lang, Record<CourseType, string>> = {
    sv: {
      intro: "Introduktionskurs Fascia ger en grundläggande och praktisk förståelse för vad fascia är, hur den fungerar och hur fasciabehandling används. Kursen kombinerar teori med praktisk behandling och är öppen för alla — inga förkunskaper krävs.\n\nEfter kursen har du en konkret förståelse för hur fasciabehandling fungerar och hur den påverkar kroppen. Introduktionskursen är det första steget i Fascia Academys utbildningssystem.",
      diplo: "Diplomerad Fasciaspecialist är nästa steg efter Introduktionskursen. Du fördjupar dina kunskaper i fasciabehandling och lär dig avancerade tekniker för att arbeta professionellt med fascia. Kursen avslutas med examination och ger dig titeln Diplomerad Fasciaspecialist.",
      cert: "Certifierad Fasciaspecialist är den högsta nivån i Fascia Academys utbildningssystem. Utbildningen ger dig en komplett och professionell kompetens för att arbeta som fasciaspecialist. Kursen avslutas med examination och ger dig titeln Certifierad Fasciaspecialist.",
      vidare: "Vidareutbildning för Certifierade Fasciaspecialister ger dig möjlighet att fördjupa och bredda dina kunskaper inom specifika områden. Kursen är exklusivt för dig som redan är Certifierad Fasciaspecialist.",
    },
    en: {
      intro: "Introduction Course Fascia provides a fundamental and practical understanding of what fascia is, how it works, and how fascia treatment is used. The course combines theory with hands-on practice and is open to everyone — no prior knowledge required.\n\nAfter the course, you will have a concrete understanding of how fascia treatment works and how it affects the body.",
      diplo: "Qualified Fascia Specialist is the next step after the Introduction Course. You deepen your knowledge in fascia treatment and learn advanced techniques for working professionally with fascia. The course ends with an examination and grants you the title of Qualified Fascia Specialist.",
      cert: "Certified Fascia Specialist is the highest level in Fascia Academy's training system. The program gives you complete and professional competence to work as a fascia specialist. The course ends with an examination and grants you the title of Certified Fascia Specialist.",
      vidare: "Advanced Training for Certified Fascia Specialists gives you the opportunity to deepen and broaden your knowledge in specific areas. The course is exclusively for those who are already Certified Fascia Specialists.",
    },
  };

  return (
    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
      {descriptions[lang][courseType]}
    </p>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────
function CalendarView({
  dates,
  lang,
  t,
  onBook,
  onMoreInfo,
}: {
  dates: CourseEntry[];
  lang: Lang;
  t: (typeof T)[Lang];
  onBook: (date: CourseEntry) => void;
  onMoreInfo: (date: CourseEntry) => void;
}) {
  const locale = lang === "sv" ? sv : enUS;

  const byMonth = useMemo(() => {
    const map = new Map<string, typeof dates>();
    for (const d of dates) {
      const key = format(d.startDate, "yyyy-MM");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "sv"));
  }, [dates]);

  if (dates.length === 0) {
    return (
      <div className="text-center py-16">
        <CalendarDays className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">{t.noResults}</p>
        <p className="text-sm text-gray-400 mt-1">{t.noResultsSub}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {byMonth.map(([monthKey, monthDates]) => (
        <div key={monthKey}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 capitalize">
            {format(new Date(monthKey + "-01"), "MMMM yyyy", { locale })}
          </h3>
          <div className="space-y-3">
            {monthDates.map((date) => {
              const isMultiDay = date.additionalDays && date.additionalDays.length > 0;
              return (
                <div
                  key={date.id}
                  className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow"
                >
                  {/* Date badge */}
                  <div className="shrink-0 text-center w-14">
                    <div className="text-2xl font-bold text-gray-900 leading-none">
                      {format(date.startDate, "d")}
                    </div>
                    <div className="text-xs text-gray-400 uppercase mt-0.5">
                      {format(date.startDate, "MMM", { locale })}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {format(date.startDate, "yyyy")}
                    </div>
                  </div>
                  {/* Color bar */}
                  <div
                    className="w-1 h-12 rounded-full shrink-0"
                    style={{ backgroundColor: COURSE_TYPE_ACCENT[date.courseType] }}
                  />
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">
                        {(t.courseTypes as Record<string, string>)[date.courseType]}
                      </span>
                      {/* Day count badge — unified neutral style */}
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                        {isMultiDay
                          ? `${date.additionalDays.length + 1} ${lang === "sv" ? "dagar" : "days"}`
                          : `1 ${lang === "sv" ? "dag" : "day"}`
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {date.courseLeaderName}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {date.city}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(date.startDate, "HH:mm")}–{format(date.endDate, "HH:mm")}
                      </span>
                      {/* Seats with FOMO */}
                      {(() => {
                        const booked = date.bookedSeats ?? 0;
                        const max = date.maxSeats;
                        const remaining = max - booked;
                        const isLow = remaining <= 3 && remaining > 0;
                        const isFull = remaining <= 0;
                        return (
                          <span className={`flex items-center gap-1 font-medium ${
                            isFull ? "text-red-600" : isLow ? "text-orange-600" : "text-gray-500"
                          }`}>
                            <Users className="h-3 w-3" />
                            {isFull
                              ? (lang === "sv" ? "Fullbokad" : "Fully booked")
                              : `${remaining}/${max} ${t.seatsLeft}`
                            }
                            {isLow && !isFull && (
                              <span className="ml-0.5 text-orange-500">⚡</span>
                            )}
                          </span>
                        );
                      })()}
                    </div>
                    {/* Price */}
                    <div className="mt-1 text-xs font-medium text-gray-600">
                      {(t.prices as Record<string, string>)[date.courseType]}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <button
                      onClick={() => onMoreInfo(date)}
                      className="px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <Info className="h-4 w-4" />
                      {t.moreInfo}
                    </button>
                    <button
                      onClick={() => onBook(date)}
                      className="px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-colors"
                    >
                      {t.book}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Map View ────────────────────────────────────────────────────────────────────
function MapViewSection({
  dates,
  lang,
  t,
  onBook,
  onMoreInfo,
}: {
  dates: CourseEntry[];
  lang: Lang;
  t: (typeof T)[Lang];
  onBook: (date: CourseEntry) => void;
  onMoreInfo: (date: CourseEntry) => void;
}) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const byCity = useMemo(() => {
    const map = new Map<string, typeof dates>();
    for (const d of dates) {
      if (!map.has(d.city)) map.set(d.city, []);
      map.get(d.city)!.push(d);
    }
    return map;
  }, [dates]);

  const setupMarkers = useCallback(
    (map: google.maps.Map) => {
      markersRef.current.forEach((m) => (m.map = null));
      markersRef.current = [];
      if (infoWindowRef.current) infoWindowRef.current.close();
      infoWindowRef.current = new google.maps.InfoWindow();

      for (const [city, cityDates] of Array.from(byCity.entries())) {
        const coords = getCityCoords(city);
        if (!coords) continue;

        const markerEl = document.createElement("div");
        markerEl.className = "cursor-pointer";
        markerEl.innerHTML = `
          <div style="background:#111827;color:white;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;gap:5px;">
            <span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>
            ${city}
            <span style="background:rgba(255,255,255,0.2);padding:1px 5px;border-radius:10px;font-size:11px;">${cityDates.length}</span>
          </div>
        `;

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: coords,
          content: markerEl,
          title: city,
        });

        const locale = lang === "sv" ? "sv-SE" : "en-GB";
        const datesHtml = cityDates
          .slice(0, 4)
          .map((d: CourseEntry) => {
            const accent = COURSE_TYPE_ACCENT[d.courseType as CourseType] ?? "#6b7280";
            const label = (t.courseTypes as Record<string, string>)[d.courseType] ?? d.courseType;
            const dateStr = new Date(d.startDate).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
            return `
              <div style="padding:8px 0;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:8px;">
                <div style="width:8px;height:8px;border-radius:50%;background:${accent};flex-shrink:0;"></div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:600;font-size:12px;color:#111827;">${label}</div>
                  <div style="font-size:11px;color:#6b7280;">${d.courseLeaderName} · ${dateStr}</div>
                </div>
                <div style="display:flex;gap:4px;">
                  <button onclick="window.__moreInfoCourse('${d.id}')" style="background:#f3f4f6;color:#374151;border:none;padding:3px 8px;border-radius:5px;font-size:11px;cursor:pointer;">ℹ</button>
                  <button onclick="window.__bookCourse('${d.id}')" style="background:#111827;color:white;border:none;padding:3px 8px;border-radius:5px;font-size:11px;cursor:pointer;">${t.book}</button>
                </div>
              </div>
            `;
          })
          .join("");

        const infoContent = `
          <div style="font-family:system-ui,sans-serif;min-width:280px;max-width:340px;">
            <div style="font-weight:700;font-size:14px;color:#111827;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${city}
            </div>
            ${datesHtml}
            ${cityDates.length > 4 ? `<div style="text-align:center;font-size:11px;color:#9ca3af;padding-top:6px;">+${cityDates.length - 4} more</div>` : ""}
          </div>
        `;

        marker.addListener("click", () => {
          infoWindowRef.current!.setContent(infoContent);
          infoWindowRef.current!.open({ map, anchor: marker });
        });

        markersRef.current.push(marker);
      }
    },
    [byCity, lang, t]
  );

  useEffect(() => {
    (window as any).__bookCourse = (id: string) => {
      const date = dates.find((d) => String(d.id) === id);
      if (date) onBook(date);
      infoWindowRef.current?.close();
    };
    (window as any).__moreInfoCourse = (id: string) => {
      const date = dates.find((d) => String(d.id) === id);
      if (date) onMoreInfo(date);
      infoWindowRef.current?.close();
    };
    return () => {
      delete (window as any).__bookCourse;
      delete (window as any).__moreInfoCourse;
    };
  }, [dates, onBook, onMoreInfo]);

  const handleMapReady = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      setupMarkers(map);
    },
    [setupMarkers]
  );

  useEffect(() => {
    if (mapRef.current) setupMarkers(mapRef.current);
  }, [setupMarkers]);

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <MapView
        initialCenter={{ lat: 62.0, lng: 15.0 }}
        initialZoom={5}
        className="h-[520px]"
        onMapReady={handleMapReady}
      />
    </div>
  );
}

// ─── Course Leader Card ────────────────────────────────────────────────────────
function CourseLeaderCard({
  leaderName,
  profilePhoto,
  profileUrl,
  dates,
  lang,
  t,
  onBook,
  onMoreInfo,
}: {
  leaderName: string;
  profilePhoto: string | null;
  profileUrl: string | null;
  dates: CourseEntry[];
  lang: Lang;
  t: (typeof T)[Lang];
  onBook: (date: CourseEntry) => void;
  onMoreInfo: (date: CourseEntry) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const locale = lang === "sv" ? sv : enUS;

  // Unique course types for this leader
  const courseTypes = Array.from(new Set(dates.map((d) => d.courseType as CourseType)));
  // Unique cities
  const cities = Array.from(new Set(dates.map((d) => d.city)));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Leader header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {profilePhoto ? (
            <img
              src={profilePhoto}
              alt={leaderName}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-gray-100 shrink-0"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center ring-2 ring-gray-100 shrink-0">
              <User className="h-7 w-7 text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base">{leaderName}</h3>
            {/* Cities */}
            <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{cities.join(", ")}</span>
            </div>
            {/* Profile link — now as a button */}
            {profileUrl && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
              >
                <User className="h-3 w-3" />
                {lang === "sv" ? "Mer info om kursledaren" : "More about the course leader"}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0 mt-0.5"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Dates list */}
      {expanded && (
        <div className="border-t border-gray-50">
          {dates.length === 0 ? (
            <div className="px-5 py-4 text-sm text-gray-400 text-center">{t.noDates}</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {dates.map((date) => {
                const isMultiDay = date.additionalDays && date.additionalDays.length > 0;
                return (
                  <div key={date.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COURSE_TYPE_ACCENT[date.courseType] }}
                    />
                    <div className="flex-1 min-w-0">
                      {/* Full course name */}
                      <div className="font-medium text-xs text-gray-900">
                        {(t.courseTypes as Record<string, string>)[date.courseType]}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {format(date.startDate, "d MMMM yyyy", { locale })}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {date.city}
                        </span>
                        <span className="text-xs font-medium text-gray-600">
                          {(t.prices as Record<string, string>)[date.courseType]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onMoreInfo(date)}
                        className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                      >
                        <Info className="h-3 w-3" />
                        {lang === "sv" ? "Mer info om kursen" : "More info about course"}
                      </button>
                      <button
                        onClick={() => onBook(date)}
                        className="px-3.5 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        {t.book}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── More About Courses Section ───────────────────────────────────────────────
const COURSE_STEPS: Record<Lang, Record<CourseType, { step: string; description: string }>> = {
  sv: {
    intro: {
      step: "Steg 1 — 1 dag",
      description: "Inga f\u00f6rkunskaper kr\u00e4vs. En dag d\u00e4r du f\u00e5r en praktisk och teoretisk f\u00f6rst\u00e5else f\u00f6r fascia och fasciabehandling. \u00d6ppet f\u00f6r alla.",
    },
    diplo: {
      step: "Steg 2",
      description: "F\u00f6r dig som genomf\u00f6rt Introduktionskursen. F\u00f6rdjupa dina kunskaper och l\u00e4r dig avancerade tekniker. Avslutas med examination.",
    },
    cert: {
      step: "Steg 3",
      description: "Den h\u00f6gsta niv\u00e5n. F\u00f6r dig som \u00e4r Diplomerad Fasciaspecialist. Komplett professionell kompetens. Avslutas med examination.",
    },
    vidare: {
      step: "Fortbildning",
      description: "Exklusivt f\u00f6r Certifierade Fasciaspecialister. F\u00f6rdjupa och bredda dina kunskaper inom specifika omr\u00e5den.",
    },
  },
  en: {
    intro: {
      step: "Step 1 \u2014 1 day",
      description: "No prior knowledge required. One day of practical and theoretical understanding of fascia and fascia treatment. Open to everyone.",
    },
    diplo: {
      step: "Step 2",
      description: "For those who completed the Introduction Course. Deepen your knowledge and learn advanced techniques. Ends with examination.",
    },
    cert: {
      step: "Step 3",
      description: "The highest level. For Qualified Fascia Specialists. Complete professional competence. Ends with examination.",
    },
    vidare: {
      step: "Continuing Education",
      description: "Exclusively for Certified Fascia Specialists. Deepen and broaden your knowledge in specific areas.",
    },
  },
};

function MoreAboutCourses({ lang, t }: { lang: Lang; t: (typeof T)[Lang] }) {
  const courseTypes: CourseType[] = ["intro", "diplo", "cert", "vidare"];

  return (
    <div className="mt-12 border-t pt-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{t.moreAboutCourses}</h2>
          <a
            href="https://www.fasciaacademy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            {lang === "sv" ? "L\u00e4s mer om varje kurstyp p\u00e5 fasciaacademy.com" : "Learn more about each course type at fasciaacademy.com"}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {courseTypes.map((ct, idx) => {
          const stepInfo = COURSE_STEPS[lang][ct];
          return (
            <a
              key={ct}
              href={COURSE_INFO_URLS[ct]}
              target="_blank"
              rel="noopener noreferrer"
              className="group block p-5 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all hover:border-gray-200 relative"
            >
              {/* Step number */}
              {ct !== "vidare" && (
                <div
                  className="absolute -top-3 left-5 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                  style={{ backgroundColor: COURSE_TYPE_ACCENT[ct] }}
                >
                  {idx + 1}
                </div>
              )}
              <div
                className="h-1 w-12 rounded-full mb-4 mt-1"
                style={{ backgroundColor: COURSE_TYPE_ACCENT[ct] }}
              />
              <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: COURSE_TYPE_ACCENT[ct] }}>
                {stepInfo.step}
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-2 leading-snug">
                {(t.courseTypes as Record<string, string>)[ct]}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">
                {stepInfo.description}
              </p>
              <div className="text-xs font-semibold text-gray-600 mb-3">
                {(t.prices as Record<string, string>)[ct]}
              </div>
              <div className="flex items-center gap-1 text-xs text-blue-600 group-hover:text-blue-800 transition-colors">
                {t.learnMore}
                <ExternalLink className="h-3 w-3" />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PublicCourses() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = (urlParams.get("lang") as Lang) || "sv";
  const urlLeader = urlParams.get("courseLeaderName") || "all";
  const [lang, setLang] = useState<Lang>(urlLang);
  const t = T[lang];

  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [filterType, setFilterType] = useState<CourseType | "all">("all");
  const [filterLeader, setFilterLeader] = useState<string>(urlLeader);

  const [bookingDate, setBookingDate] = useState<null | {
    calendarId: string;
    courseLeaderName: string;
    courseName: string;
    startDate: Date;
  }>(null);

  const [moreInfoDate, setMoreInfoDate] = useState<CourseEntry | null>(null);

  const { data: rawDates = [], isLoading } = trpc.courseDates.listPublic.useQuery({
    language: lang,
  });

  const allDates = useMemo(
    () =>
      rawDates.map((d) => {
        let additionalDays: AdditionalDay[] = [];
        try {
          const raw = (d as any).additionalDays;
          if (raw) additionalDays = JSON.parse(raw);
        } catch {}
        return {
          ...d,
          startDate: new Date(d.startDate),
          endDate: new Date(d.endDate),
          profilePhoto: (d as any).profilePhoto as string | null,
          venueName: (d as any).venueName as string | null,
          address: (d as any).address as string | null,
          courseLeaderPhone: (d as any).courseLeaderPhone as string | null,
          bookingInfo: (d as any).bookingInfo as string | null,
          profileUrl: (d as any).profileUrl as string | null,
          bookedSeats: (d as any).bookedSeats as number ?? 0,
          additionalDays,
        };
      }) as CourseEntry[],
    [rawDates]
  );

  const filteredDates = useMemo(() => {
    let result = allDates;
    if (filterType !== "all") result = result.filter((d) => d.courseType === filterType);
    if (filterLeader !== "all") result = result.filter((d) => d.courseLeaderName === filterLeader);
    return result;
  }, [allDates, filterType, filterLeader]);

  const leaders = useMemo(() => {
    const seen = new Map<string, { photo: string | null; profileUrl: string | null }>();
    for (const d of allDates) {
      if (!seen.has(d.courseLeaderName)) {
        seen.set(d.courseLeaderName, { photo: d.profilePhoto, profileUrl: d.profileUrl });
      }
    }
    return Array.from(seen.entries())
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => a.name.localeCompare(b.name, "sv"));
  }, [allDates]);

  const byLeader = useMemo(() => {
    const map = new Map<string, { photo: string | null; profileUrl: string | null; dates: typeof filteredDates }>();
    for (const d of filteredDates) {
      if (!map.has(d.courseLeaderName)) {
        map.set(d.courseLeaderName, { photo: d.profilePhoto, profileUrl: d.profileUrl, dates: [] });
      }
      map.get(d.courseLeaderName)!.dates.push(d);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "sv"));
  }, [filteredDates]);

  function handleBook(date: CourseEntry) {
    setBookingDate({
      calendarId: date.ghlCalendarId,
      courseLeaderName: date.courseLeaderName,
      courseName: (t.courseTypes as Record<string, string>)[date.courseType],
      startDate: date.startDate,
    });
  }

  function toggleLang() {
    const newLang: Lang = lang === "sv" ? "en" : "sv";
    setLang(newLang);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", newLang);
    window.history.replaceState({}, "", url.toString());
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero header */}
      <div className="bg-[#0f1a2e] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="h-8 w-8 rounded-lg bg-[#c9a84c] flex items-center justify-center text-[#0f1a2e] font-bold text-sm">
                  FA
                </div>
                <span className="text-white/80 font-medium">Fascia Academy</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t.title}</h1>
              <p className="text-white/60 mt-2 text-lg max-w-xl">{t.subtitle}</p>
            </div>
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors shrink-0"
            >
              <Globe className="h-3.5 w-3.5" />
              {t.langSwitch}
            </button>
          </div>

          {/* Filters */}
          <div className="mt-8 flex flex-wrap gap-3">
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as CourseType | "all")}
                className="appearance-none bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 pr-8 rounded-lg border border-white/20 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="all" className="text-gray-900">{t.allTypes}</option>
                <option value="intro" className="text-gray-900">{(t.courseTypes as Record<string,string>).intro}</option>
                <option value="diplo" className="text-gray-900">{(t.courseTypes as Record<string,string>).diplo}</option>
                <option value="cert" className="text-gray-900">{(t.courseTypes as Record<string,string>).cert}</option>
                <option value="vidare" className="text-gray-900">{(t.courseTypes as Record<string,string>).vidare}</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/60 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={filterLeader}
                onChange={(e) => setFilterLeader(e.target.value)}
                className="appearance-none bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 pr-8 rounded-lg border border-white/20 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="all" className="text-gray-900">{t.allLeaders}</option>
                {leaders.map((l) => (
                  <option key={l.name} value={l.name} className="text-gray-900">
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/60 pointer-events-none" />
            </div>

            {(filterType !== "all" || filterLeader !== "all") && (
              <button
                onClick={() => { setFilterType("all"); setFilterLeader("all"); }}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                {lang === "sv" ? "Rensa" : "Clear"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 py-2">
            {(["calendar", "map", "leaders"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {mode === "calendar" && <CalendarDays className="h-4 w-4" />}
                {mode === "map" && <MapPin className="h-4 w-4" />}
                {mode === "leaders" && <LayoutGrid className="h-4 w-4" />}
                {mode === "calendar" ? t.viewCalendar : mode === "map" ? t.viewMap : t.viewLeaders}
              </button>
            ))}
            <div className="ml-auto flex items-center text-sm text-gray-400">
              {filteredDates.length} {t.courses}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* More about courses section — shown above the course list */}
        <div className="mb-10">
          <MoreAboutCourses lang={lang} t={t} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : filteredDates.length === 0 && viewMode !== "map" ? (
          <div className="text-center py-16">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t.noResults}</p>
            <p className="text-sm text-gray-400 mt-1">{t.noResultsSub}</p>
          </div>
        ) : viewMode === "calendar" ? (
          <CalendarView
            dates={filteredDates}
            lang={lang}
            t={t}
            onBook={handleBook}
            onMoreInfo={setMoreInfoDate}
          />
        ) : viewMode === "map" ? (
          <MapViewSection
            dates={filteredDates}
            lang={lang}
            t={t}
            onBook={handleBook}
            onMoreInfo={setMoreInfoDate}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {byLeader.map(([leaderName, { photo, profileUrl, dates }]) => (
              <CourseLeaderCard
                key={leaderName}
                leaderName={leaderName}
                profilePhoto={photo}
                profileUrl={profileUrl}
                dates={dates}
                lang={lang}
                t={t}
                onBook={handleBook}
                onMoreInfo={setMoreInfoDate}
              />
            ))}
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="border-t bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between text-sm text-gray-400">
          <span>© {new Date().getFullYear()} Fascia Academy</span>
          <a
            href="https://www.fasciaacademy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-gray-600 transition-colors"
          >
            fasciaacademy.com
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Booking Modal */}
      {bookingDate && (
        <BookingModal
          calendarId={bookingDate.calendarId}
          courseLeaderName={bookingDate.courseLeaderName}
          courseName={bookingDate.courseName}
          startDate={bookingDate.startDate}
          lang={lang}
          t={t}
          onClose={() => setBookingDate(null)}
        />
      )}

      {/* More Info Modal */}
      {moreInfoDate && (
        <MoreInfoModal
          date={moreInfoDate}
          lang={lang}
          t={t}
          onBook={() => handleBook(moreInfoDate)}
          onClose={() => setMoreInfoDate(null)}
        />
      )}
    </div>
  );
}
