import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClipboardCheck, CheckCircle2, XCircle, Clock, RefreshCw, Mail, ExternalLink, Trash2, User } from "lucide-react";

const COURSE_LABELS: Record<string, string> = {
  diplo: "Diplomerad Fasciaspecialist",
  cert: "Certifierad Fasciaspecialist",
};

const LANG_LABELS: Record<string, string> = {
  sv: "Svenska",
  en: "English",
};

type Exam = {
  id: number;
  ghlContactId: string;
  contactName: string;
  contactEmail?: string | null;
  courseType: string;
  language: string;
  status: string;
  notes?: string | null;
  createdAt: Date;
  examinedAt?: Date | null;
  examinedBy?: number | null;
  examinedByName?: string | null;
};

export default function ExamQueue() {
  const utils = trpc.useUtils();
  const { data: pending = [], isLoading, refetch } = trpc.exams.listPending.useQuery();
  const { data: all = [] } = trpc.exams.listAll.useQuery({ limit: 100 });

  const [gradeDialog, setGradeDialog] = useState<{ exam: Exam; result: "passed" | "failed" } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Exam | null>(null);

  const markPassed = trpc.exams.markPassed.useMutation({
    onSuccess: () => {
      toast.success("Exam approved!", {
        description: "Result email sent to student. Issue the certificate in GHL Certificates.",
      });
      utils.exams.listPending.invalidate();
      utils.exams.listAll.invalidate();
      utils.exams.listCertificates.invalidate();
      setGradeDialog(null);
      setFeedback("");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const markFailed = trpc.exams.markFailed.useMutation({
    onSuccess: () => {
      toast.success("Exam marked as not approved. Result email sent to student.");
      utils.exams.listPending.invalidate();
      utils.exams.listAll.invalidate();
      setGradeDialog(null);
      setFeedback("");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const deleteExam = trpc.exams.deleteExam.useMutation({
    onSuccess: () => {
      toast.success("Exam deleted.");
      utils.exams.listPending.invalidate();
      utils.exams.listAll.invalidate();
      setDeleteConfirm(null);
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  function openGrade(exam: Exam, result: "passed" | "failed") {
    setFeedback("");
    setGradeDialog({ exam, result });
  }

  function confirmGrade() {
    if (!gradeDialog) return;
    if (gradeDialog.result === "passed") {
      markPassed.mutate({ examId: gradeDialog.exam.id, notes: feedback || undefined });
    } else {
      markFailed.mutate({ examId: gradeDialog.exam.id, notes: feedback || undefined });
    }
  }

  const graded = all.filter((e: Exam) => e.status !== "pending");

  function LogCell({ exam }: { exam: Exam }) {
    if (!exam.examinedAt) return <span className="text-muted-foreground/50 text-xs italic">—</span>;
    return (
      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <User className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div>
          <span className="font-medium text-foreground">{exam.examinedByName ?? "Unknown"}</span>
          <br />
          <span>{new Date(exam.examinedAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[oklch(0.72_0.12_75)]/20 flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Exam Queue
            </h1>
            <p className="text-sm text-muted-foreground">Grade submitted exams for Diplo and Cert courses</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Pending exams */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-amber-500" />
          <h2 className="text-lg font-semibold">Pending Exams</h2>
          {pending.length > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
              {pending.length} pending
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-sm py-8 text-center">Loading...</div>
        ) : pending.length === 0 ? (
          <div className="border rounded-xl p-10 text-center text-muted-foreground bg-muted/30">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500 opacity-60" />
            <p className="font-medium">No pending exams</p>
            <p className="text-sm mt-1">All exams have been graded.</p>
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Participant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Log</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pending as Exam[]).map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.contactName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{exam.contactEmail ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {COURSE_LABELS[exam.courseType] ?? exam.courseType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{LANG_LABELS[exam.language] ?? exam.language}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(exam.createdAt).toLocaleDateString("sv-SE")}
                    </TableCell>
                    <TableCell>
                      <LogCell exam={exam} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => openGrade(exam, "passed")}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => openGrade(exam, "failed")}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Not Approved
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
                          onClick={() => setDeleteConfirm(exam)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Recently graded */}
      {graded.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Recently Graded</h2>
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Participant</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Feedback sent to student</TableHead>
                  <TableHead>Log</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(graded as Exam[]).slice(0, 20).map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.contactName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {COURSE_LABELS[exam.courseType] ?? exam.courseType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {exam.status === "passed" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Approved</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-red-200">Not Approved</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {exam.notes ?? <span className="italic opacity-60">No feedback</span>}
                    </TableCell>
                    <TableCell>
                      <LogCell exam={exam} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
                        onClick={() => setDeleteConfirm(exam)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Grade confirmation dialog */}
      <Dialog open={!!gradeDialog} onOpenChange={(open) => !open && setGradeDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {gradeDialog?.result === "passed" ? "✅ Approve Exam" : "❌ Mark as Not Approved"}
            </DialogTitle>
          </DialogHeader>
          {gradeDialog && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 rounded-lg p-4 space-y-1">
                <p className="font-medium">{gradeDialog.exam.contactName}</p>
                <p className="text-sm text-muted-foreground">{COURSE_LABELS[gradeDialog.exam.courseType]}</p>
                {gradeDialog.exam.contactEmail && (
                  <p className="text-sm text-muted-foreground">{gradeDialog.exam.contactEmail}</p>
                )}
              </div>
              {gradeDialog.result === "passed" && (
                <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 space-y-2">
                  <p>A result email will be sent to the student. The GHL tag <strong>exam-passed-{gradeDialog.exam.courseType === "cert" ? "certified" : "qualified"}-fs</strong> will be set on the contact.</p>
                  <div className="flex items-start gap-2 bg-emerald-100 rounded-md p-2">
                    <ExternalLink className="h-4 w-4 mt-0.5 shrink-0" />
                    <p><strong>Remember:</strong> After confirming, go to <strong>GHL Certificates</strong> and issue the certificate manually for this student.</p>
                  </div>
                </div>
              )}
              {gradeDialog.result === "failed" && (
                <div className="text-sm text-red-700 bg-red-50 rounded-lg p-3">
                  <p>The student will be notified that their exam needs supplementation. Use the feedback field below to explain what needs to be improved.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Feedback to student
                  <span className="text-xs text-muted-foreground font-normal">(optional — included in the result email)</span>
                </Label>
                <Textarea
                  placeholder={
                    gradeDialog.result === "passed"
                      ? "Add a personal note or encouragement for the student..."
                      : "Explain what needs to be supplemented or improved..."
                  }
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {gradeDialog.result === "passed"
                    ? "The student will receive a congratulations email saying the certificate arrives shortly."
                    : "The student will receive an email explaining that supplementation is required, along with your feedback."}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeDialog(null)}>Cancel</Button>
            <Button
              onClick={confirmGrade}
              disabled={markPassed.isPending || markFailed.isPending}
              className={gradeDialog?.result === "passed"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"}
            >
              {markPassed.isPending || markFailed.isPending
                ? "Saving..."
                : gradeDialog?.result === "passed"
                  ? "Confirm Approval"
                  : "Confirm — Not Approved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete exam?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteConfirm?.contactName}</strong>'s exam from the queue. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteConfirm && deleteExam.mutate({ examId: deleteConfirm.id })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
