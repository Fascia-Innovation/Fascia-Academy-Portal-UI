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
import { ClipboardCheck, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";

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
};

export default function ExamQueue() {
  const utils = trpc.useUtils();
  const { data: pending = [], isLoading, refetch } = trpc.exams.listPending.useQuery();
  const { data: all = [] } = trpc.exams.listAll.useQuery({ limit: 100 });

  const [gradeDialog, setGradeDialog] = useState<{ exam: Exam; result: "passed" | "failed" } | null>(null);
  const [notes, setNotes] = useState("");

  const markPassed = trpc.exams.markPassed.useMutation({
    onSuccess: (data) => {
      toast.success("Prov godkänt! Bevis genererat.", { description: data.pdfUrl ? "PDF klar för nedladdning." : "PDF-generering misslyckades, försök igen." });
      utils.exams.listPending.invalidate();
      utils.exams.listAll.invalidate();
      utils.exams.listCertificates.invalidate();
      setGradeDialog(null);
      setNotes("");
    },
    onError: (e) => toast.error("Fel: " + e.message),
  });

  const markFailed = trpc.exams.markFailed.useMutation({
    onSuccess: () => {
      toast.success("Prov markerat som underkänt.");
      utils.exams.listPending.invalidate();
      utils.exams.listAll.invalidate();
      setGradeDialog(null);
      setNotes("");
    },
    onError: (e) => toast.error("Fel: " + e.message),
  });

  function openGrade(exam: Exam, result: "passed" | "failed") {
    setNotes("");
    setGradeDialog({ exam, result });
  }

  function confirmGrade() {
    if (!gradeDialog) return;
    if (gradeDialog.result === "passed") {
      markPassed.mutate({ examId: gradeDialog.exam.id, notes });
    } else {
      markFailed.mutate({ examId: gradeDialog.exam.id, notes });
    }
  }

  const graded = all.filter((e: Exam) => e.status !== "pending");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[oklch(0.72_0.12_75)]/20 flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Provkö
            </h1>
            <p className="text-sm text-muted-foreground">Rätta inkomna prov för Diplo och Cert</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Uppdatera
        </Button>
      </div>

      {/* Pending exams */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-amber-500" />
          <h2 className="text-lg font-semibold">Väntande prov</h2>
          {pending.length > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
              {pending.length} väntande
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-sm py-8 text-center">Laddar...</div>
        ) : pending.length === 0 ? (
          <div className="border rounded-xl p-10 text-center text-muted-foreground bg-muted/30">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500 opacity-60" />
            <p className="font-medium">Inga väntande prov</p>
            <p className="text-sm mt-1">Alla prov är rättade.</p>
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Deltagare</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead>Kurstyp</TableHead>
                  <TableHead>Språk</TableHead>
                  <TableHead>Inkom</TableHead>
                  <TableHead className="text-right">Åtgärd</TableHead>
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
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => openGrade(exam, "passed")}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Godkänd
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => openGrade(exam, "failed")}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Underkänd
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
          <h2 className="text-lg font-semibold mb-3">Nyligen rättade</h2>
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Deltagare</TableHead>
                  <TableHead>Kurstyp</TableHead>
                  <TableHead>Resultat</TableHead>
                  <TableHead>Rättat</TableHead>
                  <TableHead>Kommentar</TableHead>
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
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Godkänd</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-red-200">Underkänd</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {exam.examinedAt ? new Date(exam.examinedAt).toLocaleDateString("sv-SE") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {exam.notes ?? "—"}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {gradeDialog?.result === "passed" ? "✅ Godkänn prov" : "❌ Underkänn prov"}
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
                <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
                  Beviset genereras automatiskt som PDF och syns under Bevis-sidan.
                  Taggen <strong>exam-passed-{gradeDialog.exam.courseType === "cert" ? "certified" : "qualified"}-fs</strong> sätts i GHL.
                </p>
              )}
              {gradeDialog.result === "failed" && (
                <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">
                  Deltagaren behöver kontaktas manuellt och informeras om omtagning.
                </p>
              )}
              <div className="space-y-2">
                <Label>Kommentar (valfri)</Label>
                <Textarea
                  placeholder="Anteckningar om provet..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeDialog(null)}>Avbryt</Button>
            <Button
              onClick={confirmGrade}
              disabled={markPassed.isPending || markFailed.isPending}
              className={gradeDialog?.result === "passed" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
            >
              {markPassed.isPending || markFailed.isPending ? "Sparar..." : gradeDialog?.result === "passed" ? "Bekräfta godkänd" : "Bekräfta underkänd"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
