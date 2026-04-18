/**
 * Admin: Issued Certificates list
 * Shows all issued certificates with ability to resend email.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Mail, ExternalLink, RefreshCw, Award } from "lucide-react";

const COURSE_TYPE_LABELS: Record<string, string> = {
  intro: "Intro",
  diplo: "Diplom",
  cert: "Cert",
  vidare: "Vidare",
};

const COURSE_TYPE_COLORS: Record<string, string> = {
  intro: "bg-blue-100 text-blue-800",
  diplo: "bg-amber-100 text-amber-800",
  cert: "bg-purple-100 text-purple-800",
  vidare: "bg-green-100 text-green-800",
};

export default function IssuedCertificates() {
  const [search, setSearch] = useState("");
  const { data: certs, isLoading, refetch } = trpc.certificates.listAll.useQuery({ limit: 200 });
  const resendMutation = trpc.certificates.resendEmail.useMutation({
    onSuccess: () => {
      toast.success("Email sent!");
      refetch();
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  const filtered = (certs ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.contactName.toLowerCase().includes(q) ||
      (c.contactEmail ?? "").toLowerCase().includes(q) ||
      c.courseType.includes(q)
    );
  });

  const origin = window.location.origin;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Issued Certificates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {certs?.length ?? 0} certificates issued
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <Award className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No certificates found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Participant</th>
                <th className="text-left px-4 py-3 font-medium">Course</th>
                <th className="text-left px-4 py-3 font-medium">Language</th>
                <th className="text-left px-4 py-3 font-medium">Issued</th>
                <th className="text-left px-4 py-3 font-medium">Email Sent</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((cert) => (
                <tr key={cert.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{cert.contactName}</div>
                    {cert.contactEmail && (
                      <div className="text-xs text-muted-foreground">{cert.contactEmail}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        COURSE_TYPE_COLORS[cert.courseType] ?? "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {COURSE_TYPE_LABELS[cert.courseType] ?? cert.courseType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {cert.language.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(cert.issuedAt).toLocaleDateString("sv-SE")}
                  </td>
                  <td className="px-4 py-3">
                    {cert.emailSentAt ? (
                      <span className="text-green-600 text-xs">
                        ✓ {new Date(cert.emailSentAt).toLocaleDateString("sv-SE")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Not sent</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-7 px-2"
                      >
                        <a
                          href={`${origin}/certificate/${cert.uuid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      {cert.contactEmail && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          disabled={resendMutation.isPending}
                          onClick={() => resendMutation.mutate({ certificateId: cert.id })}
                          title="Resend certificate email"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
