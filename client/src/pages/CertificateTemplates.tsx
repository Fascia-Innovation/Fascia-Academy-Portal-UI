/**
 * Admin: Certificate Template Designer
 * Allows admins to edit certificate templates for each course type + language.
 * Shows a live preview of the certificate on the right side.
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Plus, Trash2, RefreshCw, Eye, Mail, Settings } from "lucide-react";

const GOLD = "#C8A96A";
const DARK = "#1A1A2E";

const COURSE_TYPE_LABELS: Record<string, string> = {
  intro: "Introduktionskurs",
  diplo: "Diplomerad",
  cert: "Certifierad",
  vidare: "Vidareutbildning",
};

type Template = {
  id: number;
  courseType: "intro" | "diplo" | "cert" | "vidare";
  language: "sv" | "en";
  title: string;
  courseLabel: string;
  bodyText: string;
  bulletPoints?: string | null;
  instructorName: string;
  instructorTitle: string;
  faLogoUrl?: string | null;
  atlasLogoUrl?: string | null;
  emailSubject: string;
  emailBody: string;
};

function CertificatePreview({ tmpl }: { tmpl: Template }) {
  const bullets: string[] = (() => {
    try {
      return tmpl.bulletPoints ? JSON.parse(tmpl.bulletPoints) : [];
    } catch {
      return [];
    }
  })();

  return (
    <div
      style={{
        background: GOLD,
        padding: "20px",
        borderRadius: "6px",
        fontFamily: "'Georgia', serif",
        fontSize: "11px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "4px",
          padding: "28px 32px",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "22px", fontWeight: "bold", color: GOLD, letterSpacing: "3px", margin: "0 0 14px 0" }}>
          {tmpl.title || "INTYG"}
        </h1>
        <div style={{ borderBottom: `1px solid ${DARK}`, marginBottom: "6px", paddingBottom: "2px" }}>
          <p style={{ fontSize: "16px", fontStyle: "italic", color: DARK, margin: 0, fontFamily: "cursive" }}>
            Förnamn Efternamn
          </p>
        </div>
        <h2 style={{ fontSize: "14px", fontWeight: "bold", color: DARK, margin: "10px 0 2px 0" }}>
          {tmpl.courseLabel || "Kursnamn"}
        </h2>
        <p style={{ fontSize: "10px", color: "#555", margin: "0 0 12px 0" }}>By Fascia Academy</p>
        {tmpl.bodyText && (
          <p style={{ fontSize: "10px", color: DARK, lineHeight: "1.5", margin: "0 0 10px 0", textAlign: "left" }}>
            {tmpl.bodyText}
          </p>
        )}
        {bullets.length > 0 && (
          <div style={{ textAlign: "left", marginBottom: "10px" }}>
            <p style={{ fontSize: "10px", fontWeight: "bold", color: DARK, margin: "0 0 4px 0" }}>
              {tmpl.language === "sv" ? "En godkänd elev:" : "A qualified graduate:"}
            </p>
            <ul style={{ paddingLeft: "14px", margin: 0 }}>
              {bullets.map((b, i) => (
                <li key={i} style={{ fontSize: "10px", color: DARK, lineHeight: "1.5", marginBottom: "2px" }}>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ textAlign: "left", marginBottom: "12px" }}>
          <p style={{ fontSize: "10px", color: DARK, margin: 0 }}>
            <strong>{tmpl.language === "sv" ? "Datum" : "Date"}</strong>{" "}
            <span style={{ borderBottom: `1px solid ${DARK}`, fontStyle: "italic" }}>
              {new Date().toLocaleDateString(tmpl.language === "sv" ? "sv-SE" : "en-GB")}
            </span>
          </p>
        </div>
        <div style={{ textAlign: "left", borderBottom: `1px solid ${DARK}`, paddingBottom: "2px", marginBottom: "2px", maxWidth: "120px" }}>
          <p style={{ fontSize: "13px", fontStyle: "italic", color: DARK, margin: 0, fontFamily: "cursive" }}>
            {tmpl.instructorName}
          </p>
        </div>
        <p style={{ fontSize: "9px", fontWeight: "bold", color: DARK, margin: "0 0 16px 0", textAlign: "left" }}>
          {tmpl.instructorTitle}
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "10px" }}>
        <img src={tmpl.faLogoUrl ?? "/manus-storage/fa-logo_9f3873fa.png"} alt="FA" style={{ height: "28px", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
        <img src={tmpl.atlasLogoUrl ?? "/manus-storage/atlasbalans-logo_3f37aa31.png"} alt="Atlas" style={{ height: "28px", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
      </div>
    </div>
  );
}

function TemplateEditor({ tmpl, onSaved }: { tmpl: Template; onSaved: () => void }) {
  const [form, setForm] = useState<Template>({ ...tmpl });
  const [bulletsText, setBulletsText] = useState<string>(() => {
    try {
      const arr = tmpl.bulletPoints ? JSON.parse(tmpl.bulletPoints) : [];
      return arr.join("\n");
    } catch {
      return "";
    }
  });
  const [activeTab, setActiveTab] = useState("design");

  const utils = trpc.useUtils();
  const updateMutation = trpc.certificates.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template saved!");
      utils.certificates.listTemplates.invalidate();
      onSaved();
    },
    onError: (e) => toast.error("Save failed: " + e.message),
  });

  const handleSave = () => {
    const bullets = bulletsText
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
    updateMutation.mutate({
      id: form.id,
      title: form.title,
      courseLabel: form.courseLabel,
      bodyText: form.bodyText,
      bulletPoints: bullets,
      instructorName: form.instructorName,
      instructorTitle: form.instructorTitle,
      faLogoUrl: form.faLogoUrl ?? undefined,
      atlasLogoUrl: form.atlasLogoUrl ?? undefined,
      emailSubject: form.emailSubject,
      emailBody: form.emailBody,
    });
  };

  // Sync bullets into form for preview
  const previewTmpl: Template = {
    ...form,
    bulletPoints: JSON.stringify(
      bulletsText.split("\n").map((b) => b.trim()).filter(Boolean)
    ),
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Editor */}
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="design" className="flex-1">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Design
            </TabsTrigger>
            <TabsTrigger value="email" className="flex-1">
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="design" className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Title (e.g. DIPLOM)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Course Label</Label>
                <Input
                  value={form.courseLabel}
                  onChange={(e) => setForm((f) => ({ ...f, courseLabel: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Body Text</Label>
              <Textarea
                value={form.bodyText}
                onChange={(e) => setForm((f) => ({ ...f, bodyText: e.target.value }))}
                rows={3}
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Bullet Points (one per line)</Label>
              <Textarea
                value={bulletsText}
                onChange={(e) => setBulletsText(e.target.value)}
                rows={5}
                className="mt-1 text-sm font-mono"
                placeholder="Har grundläggande kunskap om...&#10;Kan observera hållning..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Instructor Name</Label>
                <Input
                  value={form.instructorName}
                  onChange={(e) => setForm((f) => ({ ...f, instructorName: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Instructor Title</Label>
                <Input
                  value={form.instructorTitle}
                  onChange={(e) => setForm((f) => ({ ...f, instructorTitle: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-4 pt-2">
            <div>
              <Label className="text-xs">Email Subject</Label>
              <Input
                value={form.emailSubject}
                onChange={(e) => setForm((f) => ({ ...f, emailSubject: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">
                Email Body (HTML — use{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{participant_name}}"}</code> and{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{certificate_url}}"}</code>)
              </Label>
              <Textarea
                value={form.emailBody}
                onChange={(e) => setForm((f) => ({ ...f, emailBody: e.target.value }))}
                rows={10}
                className="mt-1 text-xs font-mono"
              />
            </div>
            {/* Email preview */}
            <div>
              <Label className="text-xs text-muted-foreground">Email Preview</Label>
              <div
                className="mt-1 border rounded p-3 bg-white text-sm"
                dangerouslySetInnerHTML={{
                  __html: form.emailBody
                    .replace(/\{\{participant_name\}\}/g, "Förnamn Efternamn")
                    .replace(
                      /\{\{certificate_url\}\}/g,
                      "#certificate-link"
                    ),
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="w-full bg-amber-600 hover:bg-amber-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? "Saving..." : "Save Template"}
        </Button>
      </div>

      {/* Preview */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Live Preview</span>
        </div>
        <CertificatePreview tmpl={previewTmpl} />
      </div>
    </div>
  );
}

export default function CertificateTemplates() {
  const { data: templates, isLoading, refetch } = trpc.certificates.listTemplates.useQuery();
  const seedMutation = trpc.certificates.seedTemplates.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      refetch();
    },
    onError: (e) => toast.error("Seed failed: " + e.message),
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (templates && templates.length > 0 && selectedId === null) {
      setSelectedId(templates[0].id);
    }
  }, [templates, selectedId]);

  const selectedTemplate = templates?.find((t) => t.id === selectedId) ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Certificate Templates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Design certificate templates for each course type and language
          </p>
        </div>
        {(!templates || templates.length === 0) && (
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            {seedMutation.isPending ? "Creating..." : "Create Default Templates"}
          </Button>
        )}
      </div>

      {!templates || templates.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground mb-4">No templates yet.</p>
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Default Templates
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Template selector */}
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedId === t.id
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-background text-foreground border-border hover:border-amber-400"
                }`}
              >
                {COURSE_TYPE_LABELS[t.courseType] ?? t.courseType}
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-xs px-1 py-0"
                >
                  {t.language.toUpperCase()}
                </Badge>
              </button>
            ))}
          </div>

          {/* Editor */}
          {selectedTemplate && (
            <TemplateEditor
              key={selectedTemplate.id}
              tmpl={selectedTemplate as Template}
              onSaved={() => refetch()}
            />
          )}
        </div>
      )}
    </div>
  );
}
