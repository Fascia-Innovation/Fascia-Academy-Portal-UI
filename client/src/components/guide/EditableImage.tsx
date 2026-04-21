/**
 * EditableImage — inline image replacement for Guide presentations.
 *
 * In edit mode: shows an upload overlay on hover. Admin can click to pick a
 * new image file; it uploads to S3 via the server and the URL is saved to the
 * guide_content table (same as text fields).
 *
 * In view mode: renders the image (or a placeholder if none set yet).
 */
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

type EditableImageProps = {
  /** Presentation identifier (e.g. "del1") */
  presentationId: string;
  /** Slide identifier (e.g. "overview") */
  slideId: string;
  /** Field key (e.g. "screenshot_img") */
  fieldKey: string;
  /** Current image URL (from DB override or default) */
  src: string | null;
  /** Alt text for the image */
  alt?: string;
  /** Called when a new image URL is saved */
  onSave: (url: string) => Promise<void>;
  /** Whether edit mode is active */
  editMode: boolean;
  /** Tailwind classes for the outer container */
  className?: string;
  /** Tailwind classes for the <img> element */
  imgClassName?: string;
  /** Placeholder shown when no image is set */
  placeholder?: React.ReactNode;
};

export function EditableImage({
  presentationId,
  slideId,
  fieldKey,
  src,
  alt = "Guide image",
  onSave,
  editMode,
  className,
  imgClassName,
  placeholder,
}: EditableImageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = trpc.guide.uploadImage.useMutation();

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Välj en bildfil (JPG, PNG, WebP, GIF)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Bilden är för stor (max 10 MB)");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      // Convert to base64 for transport
      const base64 = await fileToBase64(file);
      const { url } = await uploadMutation.mutateAsync({
        presentationId,
        slideId,
        fieldKey,
        base64,
        mimeType: file.type,
        filename: file.name,
      });
      await onSave(url);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError("Uppladdning misslyckades — försök igen");
      console.error("[EditableImage] Upload error:", e);
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  return (
    <div
      className={cn("relative group", className)}
      onClick={() => editMode && !uploading && inputRef.current?.click()}
      title={editMode ? "Klicka för att byta bild" : undefined}
      style={{ cursor: editMode ? "pointer" : "default" }}
    >
      {/* Image or placeholder */}
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cn("w-full h-full object-contain", imgClassName)}
        />
      ) : (
        placeholder ?? (
          <div className="w-full h-40 flex items-center justify-center rounded-xl bg-[oklch(0.20_0.04_255)] border-2 border-dashed border-[oklch(0.30_0.04_255)]">
            <div className="text-center space-y-1">
              <ImagePlus className="h-8 w-8 text-[oklch(0.45_0.03_250)] mx-auto" />
              <p className="text-xs text-[oklch(0.45_0.03_250)]">Ingen bild</p>
            </div>
          </div>
        )
      )}

      {/* Edit overlay */}
      {editMode && (
        <div className={cn(
          "absolute inset-0 rounded-xl flex flex-col items-center justify-center transition-all",
          "bg-[oklch(0.14_0.04_255)]/70 opacity-0 group-hover:opacity-100",
          uploading && "opacity-100"
        )}>
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 text-[oklch(0.72_0.12_75)] animate-spin" />
              <span className="text-xs text-[oklch(0.72_0.12_75)]">Laddar upp...</span>
            </div>
          ) : saved ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs text-emerald-400">Sparad!</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[oklch(0.72_0.12_75)]/20 border border-[oklch(0.72_0.12_75)]/60 flex items-center justify-center">
                <ImagePlus className="h-5 w-5 text-[oklch(0.72_0.12_75)]" />
              </div>
              <span className="text-xs text-[oklch(0.72_0.12_75)] font-medium">Byt bild</span>
              <span className="text-[10px] text-[oklch(0.55_0.03_250)]">JPG, PNG, WebP · max 10 MB</span>
            </div>
          )}
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 bg-red-900/80 text-red-200 text-xs rounded-lg px-3 py-2">
          <X className="h-3 w-3 shrink-0" />
          {error}
          <button onClick={(e) => { e.stopPropagation(); setError(null); }} className="ml-auto text-red-300 hover:text-white">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix: "data:image/jpeg;base64,..."
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
