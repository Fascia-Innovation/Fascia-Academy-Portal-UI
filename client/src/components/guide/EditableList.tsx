/**
 * EditableList — inline editable bullet list for Guide presentations.
 *
 * In edit mode: shows a textarea where each line = one bullet item.
 * In view mode: renders as a styled list using the children render prop.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type EditableListProps = {
  /** Current items array */
  items: string[];
  /** Called when user saves new items */
  onSave: (newItems: string[]) => Promise<void>;
  /** Whether edit mode is active */
  editMode: boolean;
  /** Tailwind classes for the container */
  className?: string;
  /** Render function — receives the items array and returns JSX */
  children: (items: string[]) => React.ReactNode;
};

export function EditableList({
  items,
  onSave,
  editMode,
  className,
  children,
}: EditableListProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(items.join("\n"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(items.join("\n"));
  }, [items, editing]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  const handleSave = useCallback(async () => {
    const newItems = draft
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      await onSave(newItems);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, onSave]);

  const handleCancel = () => {
    setDraft(items.join("\n"));
    setEditing(false);
  };

  if (!editing) {
    return (
      <span
        className={cn(
          "relative group block",
          editMode && "cursor-pointer rounded hover:ring-1 hover:ring-[oklch(0.72_0.12_75)]/60 hover:bg-[oklch(0.72_0.12_75)]/5 transition-all",
          className
        )}
        onClick={() => editMode && setEditing(true)}
        title={editMode ? "Klicka för att redigera listan" : undefined}
      >
        {children(items)}
        {editMode && (
          <span className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[oklch(0.72_0.12_75)] shadow-sm">
              <Pencil className="h-2.5 w-2.5 text-[oklch(0.17_0.04_255)]" />
            </span>
          </span>
        )}
        {saved && (
          <span className="absolute top-0 right-0">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-500 shadow-sm">
              <Check className="h-2.5 w-2.5 text-white" />
            </span>
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={cn("relative block w-full", className)}>
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") handleCancel();
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); }
        }}
        rows={Math.max(4, draft.split("\n").length + 2)}
        className="w-full bg-[oklch(0.14_0.04_255)] text-white border border-[oklch(0.72_0.12_75)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.12_75)]"
        placeholder="En punkt per rad..."
      />
      <span className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-[oklch(0.45_0.03_250)] flex-1">En punkt per rad · Ctrl+Enter för att spara · Esc för att avbryta</span>
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 text-[oklch(0.72_0.12_75)] animate-spin" />
        ) : (
          <>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 text-[10px] transition-colors"
            >
              <Check className="h-3 w-3" /> Spara
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleCancel(); }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 text-[10px] transition-colors"
            >
              <X className="h-3 w-3" /> Avbryt
            </button>
          </>
        )}
      </span>
    </span>
  );
}
