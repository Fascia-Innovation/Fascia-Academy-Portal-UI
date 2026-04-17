import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollText, RefreshCw, Search } from "lucide-react";

function getCourseLabel(courseType: string, language: string): string {
  const langLower = (language ?? "").toLowerCase();
  const isEn = langLower === "en" || langLower === "english";
  switch (courseType) {
    case "intro": return isEn ? "Introduction Course Fascia" : "Introduktionskurs Fascia";
    case "diplo": return isEn ? "Qualified Fascia Specialist" : "Diplomerad Fasciaspecialist";
    case "cert":  return isEn ? "Certified Fascia Specialist" : "Certifierad Fasciaspecialist";
    case "vidare": return isEn ? "Advanced Fascia Specialist" : "Vidareutbildning";
    default: return courseType;
  }
}

const CERT_TYPE_LABELS: Record<string, string> = {
  intro: "Certificate",
  diplo: "Diploma",
  cert: "Certification",
  vidare: "Certificate",
};

type Certificate = {
  id: number;
  ghlContactId: string;
  contactName: string;
  contactEmail?: string | null;
  courseType: string;
  language: string;
  pdfUrl?: string | null;
  issuedAt: Date;
  issuedBy?: number | null;
  issuerName?: string | null;
};

export default function Certificates() {
  const { data: certs = [], isLoading, refetch } = trpc.exams.listCertificates.useQuery({ limit: 200 });
  const [search, setSearch] = useState("");

  const filtered = (certs as Certificate[]).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.contactName.toLowerCase().includes(q) ||
      (c.contactEmail ?? "").toLowerCase().includes(q) ||
      getCourseLabel(c.courseType, c.language).toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[oklch(0.72_0.12_75)]/20 flex items-center justify-center">
            <ScrollText className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Issued Certificates
            </h1>
            <p className="text-sm text-muted-foreground">
              {certs.length} certificates issued in total
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email or course..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
          <div className="text-muted-foreground text-sm py-10 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="border rounded-xl p-10 text-center text-muted-foreground bg-muted/30">
          <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{search ? "No results found" : "No certificates issued yet"}</p>
          {!search && (
            <p className="text-sm mt-1">
              Certificates are created automatically when an exam is approved or when a course is marked as completed in GHL.
            </p>
          )}
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Participant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Course Type</TableHead>
                <TableHead>Certificate Type</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Graded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell className="font-medium">{cert.contactName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{cert.contactEmail ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {getCourseLabel(cert.courseType, cert.language)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        cert.courseType === "cert"
                          ? "bg-purple-100 text-purple-700 border-purple-200"
                          : cert.courseType === "diplo"
                          ? "bg-blue-100 text-blue-700 border-blue-200"
                          : "bg-emerald-100 text-emerald-700 border-emerald-200"
                      }
                    >
                      {CERT_TYPE_LABELS[cert.courseType] ?? "Certificate"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(cert.language ?? "").toLowerCase() === "en" || (cert.language ?? "").toLowerCase() === "english" ? "EN" : "SE"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                      {new Date(cert.issuedAt).toLocaleDateString("en-GB")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cert.issuerName ?? "—"}
                  </TableCell>

                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
