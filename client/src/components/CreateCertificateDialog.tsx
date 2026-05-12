/**
 * Dialog for manually creating and optionally sending a certificate.
 * Used from the IssuedCertificates admin page.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Award, Send, Save, RefreshCw } from "lucide-react";

const COURSE_TYPES = [
  { value: "intro", label: "Introduktionskurs Fascia" },
  { value: "diplo", label: "Diplomerad Fasciaspecialist" },
  { value: "cert", label: "Certifierad Fasciaspecialist" },
  { value: "vidare", label: "Vidareutbildning" },
] as const;

const LANGUAGES = [
  { value: "sv", label: "Svenska" },
  { value: "en", label: "English" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateCertificateDialog({ open, onOpenChange, onCreated }: Props) {
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [courseType, setCourseType] = useState<"intro" | "diplo" | "cert" | "vidare">("intro");
  const [language, setLanguage] = useState<"sv" | "en">("sv");
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().slice(0, 10));

  const createMutation = trpc.certificates.createManual.useMutation({
    onSuccess: (res) => {
      toast.success(`Intyg skapat (${res.verificationCode})`);
      resetForm();
      onOpenChange(false);
      onCreated();
    },
    onError: (e) => toast.error("Misslyckades: " + e.message),
  });

  const createAndSendMutation = trpc.certificates.createAndSend.useMutation({
    onSuccess: (res) => {
      toast.success(`Intyg skapat och skickat till ${contactEmail} (${res.verificationCode})`);
      resetForm();
      onOpenChange(false);
      onCreated();
    },
    onError: (e) => toast.error("Misslyckades: " + e.message),
  });

  const isPending = createMutation.isPending || createAndSendMutation.isPending;

  const resetForm = () => {
    setContactName("");
    setContactEmail("");
    setCourseType("intro");
    setLanguage("sv");
    setIssuedAt(new Date().toISOString().slice(0, 10));
  };

  const handleCreateDraft = () => {
    if (!contactName.trim()) {
      toast.error("Ange deltagarens namn");
      return;
    }
    createMutation.mutate({
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim() || undefined,
      courseType,
      language,
      issuedAt: issuedAt + "T12:00:00+02:00",
    });
  };

  const handleCreateAndSend = () => {
    if (!contactName.trim()) {
      toast.error("Ange deltagarens namn");
      return;
    }
    if (!contactEmail.trim()) {
      toast.error("E-postadress krävs för att skicka intyget");
      return;
    }
    createAndSendMutation.mutate({
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      courseType,
      language,
      issuedAt: issuedAt + "T12:00:00+02:00",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-600" />
            Skapa intyg manuellt
          </DialogTitle>
          <DialogDescription>
            Fyll i deltagarens uppgifter. Du kan spara som utkast eller skapa och skicka direkt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="cert-name">Namn *</Label>
            <Input
              id="cert-name"
              placeholder="Förnamn Efternamn"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="cert-email">E-post</Label>
            <Input
              id="cert-email"
              type="email"
              placeholder="namn@example.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">Krävs om du vill skicka intyget direkt</p>
          </div>

          {/* Course type + Language row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kurstyp *</Label>
              <Select value={courseType} onValueChange={(v) => setCourseType(v as typeof courseType)} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Språk</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as typeof language)} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="cert-date">Datum</Label>
            <Input
              id="cert-date"
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">Datum som visas på intyget</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleCreateDraft}
            disabled={isPending}
          >
            {createMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Spara som utkast
          </Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleCreateAndSend}
            disabled={isPending}
          >
            {createAndSendMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Skapa & skicka
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
