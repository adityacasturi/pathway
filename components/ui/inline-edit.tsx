"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A text input styled to look like plain text. Hovering reveals a faint border
 * to signal editability; focus surfaces the active editor affordance.
 *
 * Commits the trimmed value on blur or Enter; reverts to the original value on
 * Escape. By default an empty trimmed value is treated as "no change" — set
 * `allowEmpty` to permit clearing the field.
 */
interface InlineEditProps {
  value: string;
  onSave: (next: string) => void;
  className?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}

export function InlineEdit({
  value,
  onSave,
  className,
  placeholder,
  allowEmpty = false,
}: InlineEditProps) {
  const [draft, setDraft] = useState(value);

  // Re-sync the local draft whenever the canonical value changes
  // (e.g. after an optimistic update reconciles with the server).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value);
  }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed !== value && (trimmed || allowEmpty)) onSave(trimmed);
    else setDraft(value);
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      placeholder={placeholder}
      className={cn(
        "w-full bg-transparent rounded-sm px-1.5 -mx-1.5 outline-none border border-transparent",
        "hover:border-foreground/15 hover:bg-muted",
        "focus:border-foreground/30 focus:bg-muted",
        "transition-colors duration-150",
        className,
      )}
    />
  );
}
