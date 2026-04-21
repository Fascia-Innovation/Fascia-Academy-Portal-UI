/**
 * EditableField — inline editable text for Guide presentations.
 *
 * In edit mode: clicking the text shows a textarea/input for editing.
 * Changes are saved on blur or Ctrl+Enter. A pencil icon appears on hover.
 *
 * In view mode: renders as plain text/children.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type EditableFieldProps = {
  /** Current value (from DB override or default) */
  value: string;
  /** Called when user saves a new value */
  onSave: (newValue: string) => Promise<void>;
  /** Whether edit mode is active (controlled by parent) */
  editMode: boolean;
  /** Render as textarea (multiline) or input (single line) */
  multiline?: boolean;
  /** Tailwind classes applied to the display element */
  className?: string;
  /** Placeholder shown when value is empty */
  placeholder?: string;
  /** Render function — receives the current value and returns JSX */
  children?: (value: string) => React.ReactNode;
};

export function EditableField({
  value,
  onSave,
  editMode,
  multiline = false,
  className,
  placeholder = "Klicka för att redigera...",
  children,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // Sync draft when value changes externally
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Focus on edit start
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const handleSave = useCallback(async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, value, onSave]);

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey || !multiline)) {
      e.preventDefault();
      handleSave();
    }
  };

  // View mode — not editing
  if (!editing) {
    return (
      <span
        className={cn(
          "relative group",
          editMode && "cursor-pointer rounded hover:ring-1 hover:ring-[oklch(0.72_0.12_75)]/60 hover:bg-[oklch(0.72_0.12_75)]/5 transition-all",
          className
        )}
        onClick={() => editMode && setEditing(true)}
        title={editMode ? "Klicka för att redigera" : undefined}
      >
        {children ? children(value) : (value || <span className="opacity-40 italic">{placeholder}</span>)}
        {editMode && (
          <span className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[oklch(0.72_0.12_75)] shadow-sm">
              <Pencil className="h-2.5 w-2.5 text-[oklch(0.17_0.04_255)]" />
            </span>
          </span>
        )}
        {saved && (
          <span className="absolute -top-1 -right-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-500 shadow-sm">
              <Check className="h-2.5 w-2.5 text-white" />
            </span>
          </span>
        )}
      </span>
    );
  }

  // Edit mode — textarea or input
  return (
    <span className={cn("relative inline-block w-full", className)}>
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          rows={Math.max(3, draft.split("\n").length + 1)}
          className="w-full bg-[oklch(0.14_0.04_255)] text-white border border-[oklch(0.72_0.12_75)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.12_75)] font-inherit"
          placeholder={placeholder}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full bg-[oklch(0.14_0.04_255)] text-white border border-[oklch(0.72_0.12_75)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.12_75)] font-inherit"
          placeholder={placeholder}
        />
      )}
      <span className="absolute right-2 top-2 flex items-center gap-1">
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 text-[oklch(0.72_0.12_75)] animate-spin" />
        ) : (
          <>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
              className="p-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/40 transition-colors"
              title="Spara (Ctrl+Enter)"
            >
              <Check className="h-3 w-3 text-emerald-400" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleCancel(); }}
              className="p-0.5 rounded bg-red-500/20 hover:bg-red-500/40 transition-colors"
              title="Avbryt (Esc)"
            >
              <X className="h-3 w-3 text-red-400" />
            </button>
          </>
        )}
      </span>
      <span className="text-[10px] text-[oklch(0.45_0.03_250)] mt-1 block">
        {multiline ? "Ctrl+Enter för att spara · Esc för att avbryta" : "Enter för att spara · Esc för att avbryta"}
      </span>
    </span>
  );
}
