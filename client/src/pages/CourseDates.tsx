/**
 * Admin: Course Dates Management
 * Allows admin to add/edit/delete manually registered course dates.
 * These feed the public booking page (/courses).
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Pencil,
  Trash2,
  Globe,
  MapPin,
  Calendar,
  User,
  ExternalLink,
  Loader2,
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

type FormData = {
  ghlCalendarId: string;
  courseLeaderName: string;
  ghlUserId: string;
  courseType: "intro" | "diplo" | "cert" | "vidare";
  language: "sv" | "en";
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  maxSeats: string;
  notes: string;
  published: boolean;
};

const emptyForm = (): FormData => ({
  ghlCalendarId: "",
  courseLeaderName: "",
  ghlUserId: "",
  courseType: "intro",
  language: "sv",
  city: "",
  country: "Sweden",
  startDate: "",
  endDate: "",
  maxSeats: "12",
  notes: "",
  published: true,
});

export default function CourseDates() {
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

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

  // When a GHL calendar is selected, auto-fill course type, language, leader name
  const calendarMap = useMemo(
    () => new Map(ghlCalendars.map((c) => [c.id, c])),
    [ghlCalendars]
  );

  function handleCalendarSelect(calId: string) {
    const cal = calendarMap.get(calId);
    if (!cal) return;
    setForm((f) => ({
      ...f,
      ghlCalendarId: calId,
      courseLeaderName: cal.primaryUserName ?? f.courseLeaderName,
      ghlUserId: cal.primaryUserId ?? "",
      courseType: (cal.courseType as FormData["courseType"]) ?? f.courseType,
      language: (cal.language as FormData["language"]) ?? f.language,
    }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
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
      startDate: format(new Date(row.startDate), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(row.endDate), "yyyy-MM-dd'T'HH:mm"),
      maxSeats: String(row.maxSeats),
      notes: row.notes ?? "",
      published: row.published,
    });
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
              {[...upcoming, ...past].map((row, idx) => {
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
                        <span className="font-medium">{row.courseLeaderName}</span>
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
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{row.city}, {row.country}</span>
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
                          Hidden
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
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
            {/* Calendar selector (auto-fills most fields) */}
            <div className="space-y-1.5">
              <Label>GHL Calendar</Label>
              {calendarsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading calendars...
                </div>
              ) : (
                <Select
                  value={form.ghlCalendarId}
                  onValueChange={handleCalendarSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a GHL calendar..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {ghlCalendars.map((cal) => (
                      <SelectItem key={cal.id} value={cal.id}>
                        <span className="font-medium">{cal.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Selecting a calendar auto-fills course type, language, and course leader.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Course Leader Name */}
              <div className="space-y-1.5">
                <Label>Course Leader Name</Label>
                <Input
                  value={form.courseLeaderName}
                  onChange={(e) => setForm((f) => ({ ...f, courseLeaderName: e.target.value }))}
                  placeholder="e.g. Fredrik Kjellberg"
                />
              </div>
              {/* GHL User ID */}
              <div className="space-y-1.5">
                <Label>GHL User ID <span className="text-muted-foreground">(for profile photo)</span></Label>
                <Input
                  value={form.ghlUserId}
                  onChange={(e) => setForm((f) => ({ ...f, ghlUserId: e.target.value }))}
                  placeholder="auto-filled from calendar"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Course Type */}
              <div className="space-y-1.5">
                <Label>Course Type</Label>
                <Select
                  value={form.courseType}
                  onValueChange={(v) => setForm((f) => ({ ...f, courseType: v as FormData["courseType"] }))}
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
              {/* Language */}
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select
                  value={form.language}
                  onValueChange={(v) => setForm((f) => ({ ...f, language: v as FormData["language"] }))}
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

            <div className="grid grid-cols-2 gap-4">
              {/* Start Date */}
              <div className="space-y-1.5">
                <Label>Start Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              {/* End Date */}
              <div className="space-y-1.5">
                <Label>End Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* City */}
              <div className="space-y-1.5 col-span-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="e.g. Helsingborg"
                />
              </div>
              {/* Max Seats */}
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

            {/* Country */}
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder="Sweden"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Internal Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any internal notes..."
                rows={2}
              />
            </div>

            {/* Published toggle */}
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
