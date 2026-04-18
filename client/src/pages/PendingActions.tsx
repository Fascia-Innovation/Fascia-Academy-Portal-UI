import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  CalendarDays, MapPin, Users, Clock, MessageSquare, History,
  ChevronDown, ChevronUp, FileEdit, Mail, Send, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PendingCourse = {
  id: number;
  ghlCalendarId: string;
  courseType: string;
  language: string;
  courseLeaderName: string;
  courseLeaderPhone: string | null;
  startDate: string | Date;
  endDate: string | Date;
  venueName: string | null;
  address: string | null;
  city: string | null;
  maxSeats: number;
  bookedSeats: number;
  additionalDays: string | null;
  bookingInfo: string | null;
  status: string;
  leaderMessage: string | null;
  adminMessage: string | null;
  submittedBy: string | null;
  rescheduleNewStart: string | Date | null;
  rescheduleNewEnd: string | Date | null;
  rescheduleNewAdditionalDays: string | null;
  changeLog: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending_approval: { label: "New registration", color: "bg-blue-100 text-blue-700 border-blue-200", icon: CalendarDays },
  pending_cancellation: { label: "Cancellation requested", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  pending_reschedule: { label: "Reschedule requested", color: "bg-amber-100 text-amber-700 border-amber-200", icon: RefreshCw },
  needs_revision: { label: "Revision requested", color: "bg-purple-100 text-purple-700 border-purple-200", icon: FileEdit },
};

function formatDate(d: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(d: string | Date | null) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function parseAdditionalDays(json: string | null): Array<{ date: string; startTime?: string; endTime?: string }> {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export default function PendingActions() {
  const { data: pending, isLoading, refetch } = trpc.courseDates.listPending.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    type: "approve" | "revision" | "reject";
    course: PendingCourse;
  } | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = (pending ?? []) as PendingCourse[];

  // Group by status
  const newRegistrations = items.filter((i) => i.status === "pending_approval");
  const cancellations = items.filter((i) => i.status === "pending_cancellation");
  const reschedules = items.filter((i) => i.status === "pending_reschedule");
  const revisions = items.filter((i) => i.status === "needs_revision");

  const totalCount = items.length;

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pending Actions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount === 0 ? "No pending items" : `${totalCount} item${totalCount > 1 ? "s" : ""} to review`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {totalCount === 0 && (
        <div className="bg-muted/30 rounded-xl p-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground">All clear!</p>
          <p className="text-sm text-muted-foreground mt-1">No pending approvals at the moment.</p>
        </div>
      )}

      {/* Summary badges */}
      {totalCount > 0 && (
        <div className="flex gap-3 flex-wrap">
          {newRegistrations.length > 0 && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-sm px-3 py-1">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> {newRegistrations.length} new registration{newRegistrations.length > 1 ? "s" : ""}
            </Badge>
          )}
          {cancellations.length > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-sm px-3 py-1">
              <XCircle className="h-3.5 w-3.5 mr-1.5" /> {cancellations.length} cancellation{cancellations.length > 1 ? "s" : ""}
            </Badge>
          )}
          {reschedules.length > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-sm px-3 py-1">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> {reschedules.length} reschedule{reschedules.length > 1 ? "s" : ""}
            </Badge>
          )}
          {revisions.length > 0 && (
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-sm px-3 py-1">
              <FileEdit className="h-3.5 w-3.5 mr-1.5" /> {revisions.length} awaiting revision
            </Badge>
          )}
        </div>
      )}

      {/* Pending items list */}
      <div className="space-y-3">
        {items.map((course) => {
          const config = STATUS_CONFIG[course.status] ?? STATUS_CONFIG.pending_approval;
          const StatusIcon = config.icon;
          const isExpanded = expandedId === course.id;
          const additionalDays = parseAdditionalDays(course.additionalDays);
          const rescheduleAdditionalDays = parseAdditionalDays(course.rescheduleNewAdditionalDays);

          return (
            <div key={course.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Header row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : course.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <StatusIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{course.courseType}</span>
                    <Badge variant="outline" className={cn("text-xs", config.color)}>{config.label}</Badge>
                    <span className="text-xs text-muted-foreground">#{course.id}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {course.courseLeaderName}</span>
                    <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(course.startDate)}</span>
                    {course.venueName && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {course.venueName}</span>}
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />}
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-border px-5 py-4 space-y-4">
                  {/* Course details grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs block mb-0.5">Course type</span>
                      <span className="font-medium">{course.courseType}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block mb-0.5">Language</span>
                      <span className="font-medium">{course.language || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block mb-0.5">Course leader</span>
                      <span className="font-medium">{course.courseLeaderName}</span>
                      {course.courseLeaderPhone && <span className="text-xs text-muted-foreground block">{course.courseLeaderPhone}</span>}
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block mb-0.5">Start date</span>
                      <span className="font-medium">{formatDate(course.startDate)} {formatTime(course.startDate)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block mb-0.5">End date (day 1)</span>
                      <span className="font-medium">{formatDate(course.endDate)} {formatTime(course.endDate)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block mb-0.5">Max seats</span>
                      <span className="font-medium">{course.maxSeats}</span>
                      {course.bookedSeats > 0 && <span className="text-xs text-muted-foreground block">{course.bookedSeats} booked</span>}
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block mb-0.5">Venue</span>
                      <span className="font-medium">{course.venueName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block mb-0.5">Address</span>
                      <span className="font-medium">{course.address || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block mb-0.5">City</span>
                      <span className="font-medium">{course.city || "—"}</span>
                    </div>
                  </div>

                  {/* Additional days */}
                  {additionalDays.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs block mb-1">Additional course days</span>
                      <div className="flex flex-wrap gap-2">
                        {additionalDays.map((d, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {d.date} {d.startTime && `${d.startTime}–${d.endTime}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Booking info */}
                  {course.bookingInfo && (
                    <div>
                      <span className="text-muted-foreground text-xs block mb-0.5">Booking information</span>
                      <p className="text-sm bg-muted/30 rounded-lg p-3">{course.bookingInfo}</p>
                    </div>
                  )}

                  {/* Reschedule info */}
                  {course.status === "pending_reschedule" && course.rescheduleNewStart && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <span className="text-xs font-semibold text-amber-700 block mb-2">Requested reschedule to:</span>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-amber-600 text-xs">New start date</span>
                          <span className="font-medium block">{formatDate(course.rescheduleNewStart)} {formatTime(course.rescheduleNewStart)}</span>
                        </div>
                        <div>
                          <span className="text-amber-600 text-xs">New end date (day 1)</span>
                          <span className="font-medium block">{formatDate(course.rescheduleNewEnd)} {formatTime(course.rescheduleNewEnd)}</span>
                        </div>
                      </div>
                      {rescheduleAdditionalDays.length > 0 && (
                        <div className="mt-2">
                          <span className="text-amber-600 text-xs">New additional days</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {rescheduleAdditionalDays.map((d, i) => (
                              <Badge key={i} variant="outline" className="text-xs border-amber-300">
                                {d.date} {d.startTime && `${d.startTime}–${d.endTime}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Messages */}
                  {course.leaderMessage && (
                    <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-blue-700">Message from course leader:</span>
                        <p className="text-sm text-blue-800 mt-0.5">{course.leaderMessage}</p>
                      </div>
                    </div>
                  )}

                  {course.adminMessage && (
                    <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <MessageSquare className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-purple-700">Admin message:</span>
                        <p className="text-sm text-purple-800 mt-0.5">{course.adminMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    {course.status !== "needs_revision" && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => setActionDialog({ type: "approve", course })}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        {course.status === "pending_cancellation" ? "Approve cancellation" : course.status === "pending_reschedule" ? "Approve reschedule" : "Approve"}
                      </Button>
                    )}
                    {course.status === "pending_approval" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-purple-600 border-purple-300 hover:bg-purple-50"
                        onClick={() => setActionDialog({ type: "revision", course })}
                      >
                        <FileEdit className="h-4 w-4 mr-1.5" /> Request revision
                      </Button>
                    )}
                    {course.status !== "needs_revision" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => setActionDialog({ type: "reject", course })}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        {course.status === "pending_cancellation" ? "Deny cancellation" : course.status === "pending_reschedule" ? "Deny reschedule" : "Reject"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action dialog */}
      {actionDialog && (
        <ActionDialog
          type={actionDialog.type}
          course={actionDialog.course}
          onClose={() => setActionDialog(null)}
          onSuccess={() => {
            setActionDialog(null);
            refetch();
          }}
        />
      )}

      {/* Pending messages from course leaders */}
      <PendingMessagesSection />
    </div>
  );
}

// ─── Pending Messages Section ────────────────────────────────────────────────
function PendingMessagesSection() {
  const { data: messages, isLoading, refetch } = trpc.courseDates.listPendingMessages.useQuery();
  const [reviewMsg, setReviewMsg] = useState<any | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [adminNote, setAdminNote] = useState("");

  const reviewMutation = trpc.courseDates.reviewMessage.useMutation({
    onSuccess: (data) => {
      toast.success(data.action === "approved" ? "Message approved and sent" : "Message rejected");
      setReviewMsg(null);
      refetch();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  if (isLoading || !messages || messages.length === 0) return null;

  const COURSE_LABELS: Record<string, string> = {
    intro: "Intro", diplo: "Diplo", cert: "Cert", vidare: "Vidare",
  };

  return (
    <div className="space-y-3 mt-6">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Mail className="h-5 w-5" /> Pending Messages ({messages.length})
      </h2>
      <p className="text-sm text-muted-foreground">
        Course leaders have submitted messages for review. Approved messages will be sent from info@fasciaacademy.com.
      </p>
      <div className="space-y-2">
        {messages.map((msg: any) => (
          <div key={msg.id} className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{msg.subject}</span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                    Awaiting approval
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From <strong>{msg.authorName}</strong> · {COURSE_LABELS[msg.courseType] || msg.courseType} {msg.courseCity}
                  {msg.courseDate && ` · ${new Date(msg.courseDate).toLocaleDateString("en-SE", { month: "short", day: "numeric" })}`}
                </p>
                <p className="text-sm text-foreground mt-2 whitespace-pre-wrap line-clamp-3">{msg.body}</p>
              </div>
              <div className="shrink-0 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  onClick={() => {
                    setReviewMsg(msg);
                    setEditedSubject(msg.subject);
                    setEditedBody(msg.body);
                    setAdminNote("");
                  }}
                >
                  <Eye className="h-3 w-3" /> Review
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Review dialog */}
      <Dialog open={!!reviewMsg} onOpenChange={(v) => !v && setReviewMsg(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Message</DialogTitle>
            <DialogDescription>
              From {reviewMsg?.authorName}. You can edit the message before approving. It will be sent from info@fasciaacademy.com.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Subject</label>
              <input
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Message body</label>
              <Textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={6}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Admin note (optional, visible to course leader)</label>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
                placeholder="Reason for rejection or feedback..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewMsg(null)}>Cancel</Button>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate({
                messageId: reviewMsg.id,
                action: "reject",
                adminNote: adminNote || undefined,
              })}
            >
              {reviewMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Reject
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={reviewMutation.isPending || !editedSubject.trim() || !editedBody.trim()}
              onClick={() => reviewMutation.mutate({
                messageId: reviewMsg.id,
                action: "approve",
                editedSubject: editedSubject !== reviewMsg.subject ? editedSubject : undefined,
                editedBody: editedBody !== reviewMsg.body ? editedBody : undefined,
                adminNote: adminNote || undefined,
              })}
            >
              {reviewMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              <Send className="h-3 w-3 mr-1" /> Approve & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Action Dialog (Approve / Revision / Reject) ────────────────────────────
function ActionDialog({ type, course, onClose, onSuccess }: {
  type: "approve" | "revision" | "reject";
  course: PendingCourse;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [message, setMessage] = useState("");
  const approveMut = trpc.courseDates.adminApprove.useMutation();
  const revisionMut = trpc.courseDates.adminRequestRevision.useMutation();
  const rejectMut = trpc.courseDates.adminReject.useMutation();

  const config = {
    approve: {
      title: course.status === "pending_cancellation" ? "Approve cancellation" : course.status === "pending_reschedule" ? "Approve reschedule" : "Approve course registration",
      description: course.status === "pending_cancellation"
        ? `Approve cancellation of ${course.courseType} on ${formatDate(course.startDate)}. ${course.bookedSeats > 0 ? `Note: ${course.bookedSeats} customer(s) are booked and must be moved.` : "No customers booked."}`
        : course.status === "pending_reschedule"
        ? `Approve reschedule of ${course.courseType} from ${formatDate(course.startDate)} to ${formatDate(course.rescheduleNewStart)}. Remember to update availability in the GHL calendar.`
        : `Approve ${course.courseLeaderName}'s registration of ${course.courseType} on ${formatDate(course.startDate)}. Remember to set availability in the GHL calendar.`,
      buttonText: "Approve",
      buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
      messageRequired: false,
    },
    revision: {
      title: "Request revision",
      description: `Ask ${course.courseLeaderName} to revise their registration of ${course.courseType}. The course leader will receive an email.`,
      buttonText: "Send revision request",
      buttonClass: "bg-purple-600 hover:bg-purple-700 text-white",
      messageRequired: true,
    },
    reject: {
      title: course.status === "pending_cancellation" ? "Deny cancellation" : course.status === "pending_reschedule" ? "Deny reschedule" : "Reject registration",
      description: course.status === "pending_cancellation"
        ? `Deny the cancellation of ${course.courseType}. The course keeps its current status.`
        : course.status === "pending_reschedule"
        ? `Deny the reschedule of ${course.courseType}. The course keeps its current date.`
        : `Reject ${course.courseLeaderName}'s registration of ${course.courseType}.`,
      buttonText: course.status === "pending_cancellation" ? "Deny cancellation" : course.status === "pending_reschedule" ? "Deny reschedule" : "Reject",
      buttonClass: "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
      messageRequired: false,
    },
  }[type];

  const handleSubmit = async () => {
    if (config.messageRequired && !message.trim()) {
      toast.error("Please provide a reason for the revision request");
      return;
    }
    try {
      if (type === "approve") {
        await approveMut.mutateAsync({ id: course.id, adminMessage: message || undefined });
        toast.success("Approved!", { description: "Remember to update availability in the GHL calendar." });
      } else if (type === "revision") {
        await revisionMut.mutateAsync({ id: course.id, adminMessage: message });
        toast.success("Revision request sent", { description: "The course leader has been notified by email." });
      } else {
        await rejectMut.mutateAsync({ id: course.id, adminMessage: message || undefined });
        toast.success("Action completed");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const isPending = approveMut.isPending || revisionMut.isPending || rejectMut.isPending;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        {/* Reminder for admin about GHL availability */}
        {type === "approve" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 inline mr-1.5" />
            <strong>Reminder:</strong> After approving, update availability in the course leader's GHL calendar for the start date.
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {type === "revision" ? "Reason for revision *" : "Message to course leader (optional)"}
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={type === "revision" ? "Describe what needs to be revised..." : "Optional message..."}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button className={config.buttonClass} onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {config.buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
