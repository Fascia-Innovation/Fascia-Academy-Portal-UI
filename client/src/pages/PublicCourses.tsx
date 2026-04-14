/**
 * Public Course Booking Page — /courses
 * Bilingual (SE/EN via ?lang=sv|en), no login required.
 * Features:
 *  - Course leader cards with profile photos
 *  - Google Maps with city markers
 *  - Calendar view (alternative navigation)
 *  - Booking modal (GHL widget embedded, stays on page)
 *  - Filters: language / course type / course leader
 */
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import { format, isSameDay } from "date-fns";
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
} from "lucide-react";

// ─── i18n strings ─────────────────────────────────────────────────────────────
const T = {
  sv: {
    title: "Hitta en kurs nära dig",
    subtitle: "Välj kurstyp, stad eller kursledare och boka din plats direkt.",
    filterLanguage: "Språk",
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
    noResults: "Inga kurser hittades med dessa filter.",
    noResultsSub: "Prova att ändra filter eller välj ett annat språk.",
    upcomingDates: "Kommande datum",
    noDates: "Inga kommande datum",
    courseTypes: {
      intro: "Introduktionskurs",
      diplo: "Diplomerad Fasciaspecialist",
      cert: "Certifierad Fasciaspecialist",
      vidare: "Vidareutbildning",
    },
    languages: { sv: "Svenska", en: "Engelska" },
    bookingTitle: "Boka kurs",
    closeBooking: "Stäng",
    langSwitch: "English",
  },
  en: {
    title: "Find a course near you",
    subtitle: "Choose a course type, city or course leader and book your spot.",
    filterLanguage: "Language",
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
    noResults: "No courses found with these filters.",
    noResultsSub: "Try adjusting the filters or selecting a different language.",
    upcomingDates: "Upcoming dates",
    noDates: "No upcoming dates",
    courseTypes: {
      intro: "Introduction Course",
      diplo: "Qualified Fascia Specialist",
      cert: "Certified Fascia Specialist",
      vidare: "Advanced Training",
    },
    languages: { sv: "Swedish", en: "English" },
    bookingTitle: "Book course",
    closeBooking: "Close",
    langSwitch: "Svenska",
  },
};

type Lang = "sv" | "en";
type CourseType = "intro" | "diplo" | "cert" | "vidare";
type ViewMode = "leaders" | "calendar" | "map";

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
  // Try exact match first
  if (CITY_COORDS[city]) return CITY_COORDS[city];
  // Try partial match
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (city.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(city.toLowerCase())) {
      return coords;
    }
  }
  return null;
}

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
  // GHL booking widget URL — use calendar ID in the URL
  // Format: https://api.leadconnectorhq.com/widget/booking/{calendarId}
  const dateParam = format(startDate, "yyyy-MM-dd");
  const bookingUrl = `https://api.leadconnectorhq.com/widget/booking/${calendarId}?date=${dateParam}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
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
        {/* Booking widget iframe */}
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

// ─── Shared date type ─────────────────────────────────────────────────────────
type CourseEntry = {
  id: number;
  courseLeaderName: string;
  profilePhoto: string | null;
  courseType: CourseType;
  city: string;
  country: string;
  startDate: Date;
  endDate: Date;
  maxSeats: number;
  ghlCalendarId: string;
  language: Lang;
  [key: string]: unknown;
};

// ─── Course Leader Card ────────────────────────────────────────────────────────
function CourseLeaderCard({
  leaderName,
  profilePhoto,
  dates,
  lang,
  t,
  onBook,
}: {
  leaderName: string;
  profilePhoto: string | null;
  dates: CourseEntry[];
  lang: Lang;
  t: (typeof T)[Lang];
  onBook: (date: CourseEntry) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const locale = lang === "sv" ? sv : enUS;

  // Get unique course types for this leader
  const courseTypes = Array.from(new Set(dates.map((d) => d.courseType as CourseType)));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Leader header */}
      <div className="p-5 flex items-center gap-4">
        {profilePhoto ? (
          <img
            src={profilePhoto}
            alt={leaderName}
            className="h-16 w-16 rounded-full object-cover ring-2 ring-gray-100"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center ring-2 ring-gray-100">
            <User className="h-7 w-7 text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-lg truncate">{leaderName}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {courseTypes.map((ct) => (
              <span
                key={ct}
                className={`text-xs px-2 py-0.5 rounded-full border font-medium ${COURSE_TYPE_COLORS[ct]}`}
              >
                {(t.courseTypes as Record<string,string>)[ct]}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Dates list */}
      {expanded && (
        <div className="border-t border-gray-50">
          {dates.length === 0 ? (
            <div className="px-5 py-4 text-sm text-gray-400 text-center">{t.noDates}</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {dates.map((date) => (
                <div key={date.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                  {/* Color dot */}
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: COURSE_TYPE_ACCENT[date.courseType] }}
                  />
                  {/* Date info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">
                        {format(date.startDate, "d MMMM yyyy", { locale })}
                      </span>
                      <span className="text-xs text-gray-400">
                        {format(date.startDate, "HH:mm")}–{format(date.endDate, "HH:mm")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {date.city}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${COURSE_TYPE_COLORS[date.courseType]}`}>
                        {t.courseTypes[date.courseType]}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {date.maxSeats} {t.seats}
                      </span>
                    </div>
                  </div>
                  {/* Book button */}
                  <button
                    onClick={() => onBook(date)}
                    className="shrink-0 px-3.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    {t.book}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────
function CalendarView({
  dates,
  lang,
  t,
  onBook,
}: {
  dates: CourseEntry[];
  lang: Lang;
  t: (typeof T)[Lang];
  onBook: (date: CourseEntry) => void;
}) {
  const locale = lang === "sv" ? sv : enUS;

  // Group by month
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
            {monthDates.map((date) => (
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
                </div>
                {/* Divider */}
                <div
                  className="w-1 h-12 rounded-full shrink-0"
                  style={{ backgroundColor: COURSE_TYPE_ACCENT[date.courseType] }}
                />
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{(t.courseTypes as Record<string,string>)[date.courseType]}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${COURSE_TYPE_COLORS[date.courseType as CourseType]}`}>
                      {(t.courseTypes as Record<string,string>)[date.courseType]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {date.courseLeaderName}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {date.city}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {format(date.startDate, "HH:mm")}–{format(date.endDate, "HH:mm")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {date.maxSeats} {t.seats}
                    </span>
                  </div>
                </div>
                {/* Book */}
                <button
                  onClick={() => onBook(date)}
                  className="shrink-0 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                >
                  {t.book}
                </button>
              </div>
            ))}
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
}: {
  dates: CourseEntry[];
  lang: Lang;
  t: (typeof T)[Lang];
  onBook: (date: CourseEntry) => void;
}) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Group dates by city
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
      // Clear existing markers
      markersRef.current.forEach((m) => (m.map = null));
      markersRef.current = [];

      if (infoWindowRef.current) infoWindowRef.current.close();
      infoWindowRef.current = new google.maps.InfoWindow();

      for (const [city, cityDates] of Array.from(byCity.entries())) {
        const coords = getCityCoords(city);
        if (!coords) continue;

        // Create custom marker element
        const markerEl = document.createElement("div");
        markerEl.className = "cursor-pointer";
        markerEl.innerHTML = `
          <div style="
            background: #111827;
            color: white;
            padding: 6px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 5px;
          ">
            <span style="
              width: 8px; height: 8px; border-radius: 50%;
              background: #f59e0b; display: inline-block;
            "></span>
            ${city}
            <span style="
              background: rgba(255,255,255,0.2);
              padding: 1px 5px;
              border-radius: 10px;
              font-size: 11px;
            ">${cityDates.length}</span>
          </div>
        `;

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: coords,
          content: markerEl,
          title: city,
        });

        // Build info window content
        const locale = lang === "sv" ? "sv-SE" : "en-GB";
        const datesHtml = cityDates
          .slice(0, 4)
          .map(
            (d: CourseEntry) => {
              const accent = COURSE_TYPE_ACCENT[d.courseType as CourseType] ?? "#6b7280";
              const label = (t.courseTypes as Record<string, string>)[d.courseType] ?? d.courseType;
              const dateStr = new Date(d.startDate).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
              return `
            <div style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; gap: 8px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: ${accent}; flex-shrink: 0;"></div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 13px; color: #111827;">${dateStr}</div>
                <div style="font-size: 12px; color: #6b7280;">${d.courseLeaderName} · ${label}</div>
              </div>
              <button onclick="window.__bookCourse('${d.id}')" style="background: #111827; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 500;">${t.book}</button>
            </div>
          `;
            }
          )
          .join("");

        const infoContent = `
          <div style="font-family: system-ui, sans-serif; min-width: 260px; max-width: 320px;">
            <div style="font-weight: 700; font-size: 15px; color: #111827; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              ${city}
            </div>
            ${datesHtml}
            ${cityDates.length > 4 ? `<div style="text-align: center; font-size: 12px; color: #9ca3af; padding-top: 6px;">+${cityDates.length - 4} more</div>` : ""}
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

  // Expose booking callback to info window buttons
  useEffect(() => {
    (window as any).__bookCourse = (id: string) => {
      const date = dates.find((d) => String(d.id) === id);
      if (date) onBook(date);
      infoWindowRef.current?.close();
    };
    return () => {
      delete (window as any).__bookCourse;
    };
  }, [dates, onBook]);

  const handleMapReady = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      setupMarkers(map);
    },
    [setupMarkers]
  );

  // Re-setup markers when dates change
  useEffect(() => {
    if (mapRef.current) setupMarkers(mapRef.current);
  }, [setupMarkers]);

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <MapView
        initialCenter={{ lat: 62.0, lng: 15.0 }} // Center of Sweden
        initialZoom={5}
        className="h-[520px]"
        onMapReady={handleMapReady}
      />
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PublicCourses() {
  // Language from URL param
  const urlLang = (new URLSearchParams(window.location.search).get("lang") as Lang) || "sv";
  const [lang, setLang] = useState<Lang>(urlLang);
  const t = T[lang];
  const locale = lang === "sv" ? sv : enUS;

  const [viewMode, setViewMode] = useState<ViewMode>("leaders");
  const [filterType, setFilterType] = useState<CourseType | "all">("all");
  const [filterLeader, setFilterLeader] = useState<string>("all");
  const [bookingDate, setBookingDate] = useState<null | {
    calendarId: string;
    courseLeaderName: string;
    courseName: string;
    startDate: Date;
  }>(null);

  // Fetch course dates (public, no auth)
  const { data: rawDates = [], isLoading } = trpc.courseDates.listPublic.useQuery({
    language: lang,
  });

  // Parse dates
  const allDates = useMemo(
    () =>
      rawDates.map((d) => ({
        ...d,
        startDate: new Date(d.startDate),
        endDate: new Date(d.endDate),
        profilePhoto: (d as any).profilePhoto as string | null,
      })) as CourseEntry[],
    [rawDates]
  );

  // Apply filters
  const filteredDates = useMemo(() => {
    let result = allDates;
    if (filterType !== "all") result = result.filter((d) => d.courseType === filterType);
    if (filterLeader !== "all") result = result.filter((d) => d.courseLeaderName === filterLeader);
    return result;
  }, [allDates, filterType, filterLeader]);

  // Unique leaders
  const leaders = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ name: string; photo: string | null }> = [];
    for (const d of allDates) {
      if (!seen.has(d.courseLeaderName)) {
        seen.add(d.courseLeaderName);
        result.push({ name: d.courseLeaderName, photo: d.profilePhoto });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, "sv"));
  }, [allDates]);

  // Group by leader for leader view
  const byLeader = useMemo(() => {
    const map = new Map<string, { photo: string | null; dates: typeof filteredDates }>();
    for (const d of filteredDates) {
      if (!map.has(d.courseLeaderName)) {
        map.set(d.courseLeaderName, { photo: d.profilePhoto, dates: [] });
      }
      map.get(d.courseLeaderName)!.dates.push(d);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "sv"));
  }, [filteredDates]);

  function handleBook(date: CourseEntry) {
    setBookingDate({
      calendarId: date.ghlCalendarId,
      courseLeaderName: date.courseLeaderName,
      courseName: t.courseTypes[date.courseType],
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
              {/* Logo / brand */}
              <div className="flex items-center gap-2 mb-6">
                <div className="h-8 w-8 rounded-lg bg-[#c9a84c] flex items-center justify-center text-[#0f1a2e] font-bold text-sm">
                  FA
                </div>
                <span className="text-white/80 font-medium">Fascia Academy</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t.title}</h1>
              <p className="text-white/60 mt-2 text-lg max-w-xl">{t.subtitle}</p>
            </div>
            {/* Language switcher */}
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
            {/* Course type filter */}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as CourseType | "all")}
                className="appearance-none bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 pr-8 rounded-lg border border-white/20 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="all" className="text-gray-900">{t.allTypes}</option>
                <option value="intro" className="text-gray-900">{t.courseTypes.intro}</option>
                <option value="diplo" className="text-gray-900">{t.courseTypes.diplo}</option>
                <option value="cert" className="text-gray-900">{t.courseTypes.cert}</option>
                <option value="vidare" className="text-gray-900">{t.courseTypes.vidare}</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/60 pointer-events-none" />
            </div>

            {/* Leader filter */}
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

            {/* Clear filters */}
            {(filterType !== "all" || filterLeader !== "all") && (
              <button
                onClick={() => { setFilterType("all"); setFilterLeader("all"); }}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 py-2">
            {(["leaders", "calendar", "map"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {mode === "leaders" && <LayoutGrid className="h-4 w-4" />}
                {mode === "calendar" && <CalendarDays className="h-4 w-4" />}
                {mode === "map" && <MapPin className="h-4 w-4" />}
                {mode === "leaders" ? t.viewLeaders : mode === "calendar" ? t.viewCalendar : t.viewMap}
              </button>
            ))}
            <div className="ml-auto flex items-center text-sm text-gray-400">
              {filteredDates.length} {lang === "sv" ? "kurser" : "courses"}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : filteredDates.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t.noResults}</p>
            <p className="text-sm text-gray-400 mt-1">{t.noResultsSub}</p>
          </div>
        ) : viewMode === "leaders" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {byLeader.map(([leaderName, { photo, dates }]) => (
              <CourseLeaderCard
                key={leaderName}
                leaderName={leaderName}
                profilePhoto={photo}
                dates={dates}
                lang={lang}
                t={t}
                onBook={handleBook}
              />
            ))}
          </div>
        ) : viewMode === "calendar" ? (
          <CalendarView dates={filteredDates} lang={lang} t={t} onBook={handleBook} />
        ) : (
          <MapViewSection dates={filteredDates} lang={lang} t={t} onBook={handleBook} />
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
    </div>
  );
}
