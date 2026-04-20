/**
 * Admin: Issued Certificates list
 * Features: bulk select, Send Selected / Send All Pending, status badges, resend, verification code.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Search, Mail, ExternalLink, RefreshCw, Award, Send, CheckSquare, Square,
} from "lucide-react";

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
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: certs, isLoading, refetch } = trpc.certificates.listAll.useQuery({ limit: 200 });

  const resendMutation = trpc.certificates.resendEmail.useMutation({
    onSuccess: () => { toast.success("E-post skickad!"); refetch(); },
    onError: (e) => toast.error("Misslyckades: " + e.message),
  });

  const sendMutation = trpc.certificates.sendCertificates.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.sent} intyg skickade${res.failed > 0 ? `, ${res.failed} misslyckades` : ""}`);
      setSelected(new Set());
      refetch();
    },
    onError: (e) => toast.error("Fel: " + e.message),
  });

  const filtered = (certs ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.contactName.toLowerCase().includes(q) ||
      (c.contactEmail ?? "").toLowerCase().includes(q) ||
      c.courseType.includes(q) ||
      (c.verificationCode ?? "").toLowerCase().includes(q)
    );
  });

  const draftCount = filtered.filter((c) => c.status === "draft").length;
  const allDraftIds = filtered.filter((c) => c.status === "draft").map((c) => c.id);
  const allFilteredIds = filtered.map((c) => c.id);
  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allFilteredIds));
    }
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendSelected = () => {
    if (selected.size === 0) return;
    sendMutation.mutate({ certificateIds: Array.from(selected) });
  };

  const handleSendAllDrafts = () => {
    sendMutation.mutate({ certificateIds: [] });
  };

  const origin = window.location.origin;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Issued Certificates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {certs?.length ?? 0} intyg totalt
            {draftCount > 0 && (
              <span className="ml-2 text-amber-600 font-medium">· {draftCount} väntar på utskick</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={sendMutation.isPending}
              onClick={handleSendSelected}
            >
              <Send className="h-4 w-4 mr-2" />
              Skicka valda ({selected.size})
            </Button>
          )}
          {draftCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={sendMutation.isPending}
              onClick={handleSendAllDrafts}
            >
              <Send className="h-4 w-4 mr-2" />
              Skicka alla väntande ({draftCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Uppdatera
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Sök på namn, e-post, kurskod eller verifikationsnummer..."
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
          <p className="text-muted-foreground">Inga intyg hittades</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Välj alla"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium">Deltagare</th>
                <th className="text-left px-4 py-3 font-medium">Kurs</th>
                <th className="text-left px-4 py-3 font-medium">Språk</th>
                <th className="text-left px-4 py-3 font-medium">Utfärdat</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Verifikation</th>
                <th className="text-right px-4 py-3 font-medium">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((cert) => {
                const isDraft = cert.status === "draft";
                return (
                  <tr
                    key={cert.id}
                    className={`hover:bg-muted/20 transition-colors ${isDraft ? "bg-amber-50/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selected.has(cert.id)}
                        onCheckedChange={() => toggleOne(cert.id)}
                        aria-label={`Välj ${cert.contactName}`}
                      />
                    </td>
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
                      {isDraft ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          Väntar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          ✓ Skickat {cert.sentAt ? new Date(cert.sentAt).toLocaleDateString("sv-SE") : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {cert.verificationCode ? (
                        <span className="text-xs font-mono text-muted-foreground">
                          {cert.verificationCode}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* View certificate */}
                        <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                          <a
                            href={`${origin}/certificate/${cert.uuid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Visa intyg"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        {/* Send / Resend */}
                        {cert.contactEmail && (
                          <Button
                            variant={isDraft ? "default" : "ghost"}
                            size="sm"
                            className={`h-7 px-2 ${isDraft ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                            disabled={resendMutation.isPending || sendMutation.isPending}
                            onClick={() => resendMutation.mutate({ certificateId: cert.id })}
                            title={isDraft ? "Skicka intyg" : "Skicka om"}
                          >
                            {isDraft ? (
                              <Send className="h-3.5 w-3.5" />
                            ) : (
                              <Mail className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
