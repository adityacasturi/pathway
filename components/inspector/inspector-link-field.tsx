"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { InspectorHoverPencil } from "@/components/inspector/inspector-hover-pencil";
import { INSPECTOR_HOVER_ROW_CLASS } from "@/components/inspector/inspector-field-styles";
import { displayUrl, safeExternalHref } from "@/lib/url";
import { cn } from "@/lib/utils";

const INPUT_CLASS =
  "w-auto max-w-full min-w-[4ch] rounded-md border border-border bg-background px-2.5 text-sm text-foreground outline-none transition-colors duration-150 [field-sizing:content] placeholder:text-muted-foreground/45 focus:border-[color-mix(in_oklab,var(--foreground)_22%,var(--border))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_12%,transparent)]";

export function InspectorLinkField({
  value,
  onSave,
  placeholder = "Add posting link",
  ariaLabel,
  className,
}: {
  value: string;
  onSave: (next: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value);
  }, [value]);

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function save() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed !== value.trim()) onSave(trimmed);
  }

  if (editing) {
    const fitChars = Math.max(draft.length, placeholder.length, 12);

    return (
      <input
        autoFocus
        value={draft}
        aria-label={ariaLabel}
        placeholder={placeholder}
        size={fitChars}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        className={cn(INPUT_CLASS, className)}
      />
    );
  }

  const isEmpty = !value.trim();
  const safeHref = safeExternalHref(value);

  if (isEmpty) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setEditing(true);
          }
        }}
        className={cn(
          INSPECTOR_HOVER_ROW_CLASS,
          "cursor-pointer border-dashed border-border/40 py-px hover:border-border/70",
          className,
        )}
      >
        <span className="min-w-0 text-sm text-muted-foreground/55">{placeholder}</span>
        <InspectorHoverPencil />
      </div>
    );
  }

  return (
    <div className={cn(INSPECTOR_HOVER_ROW_CLASS, "py-px", className)}>
      {safeHref ? (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          title={value}
          onClick={(event) => event.stopPropagation()}
          className="min-w-0 truncate text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground hover:underline"
        >
          {displayUrl(value)}
        </a>
      ) : (
        <span className="min-w-0 truncate text-sm text-muted-foreground" title={value}>
          Invalid URL
        </span>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Edit posting link"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[opacity,background-color] duration-150 hover:bg-muted hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <Pencil size={13} strokeWidth={1.75} />
      </button>
    </div>
  );
}
