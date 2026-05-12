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
  ariaLabel?: string;
}

export function InlineEdit({
  value,
  onSave,
  className,
  placeholder,
  allowEmpty = false,
  ariaLabel,
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
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-md border border-transparent bg-transparent px-1.5 outline-none",
        "hover:border-foreground/15 hover:bg-muted",
        "focus:border-ring/40 focus:bg-muted focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_14%,transparent)]",
        "transition-[background-color,border-color,box-shadow] duration-150",
        className,
      )}
    />
  );
}
