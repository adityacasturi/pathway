"use client";

import { useEffect, useState } from "react";
import { InspectorHoverPencil } from "@/components/inspector/inspector-hover-pencil";
import { INSPECTOR_HOVER_ROW_CLASS } from "@/components/inspector/inspector-field-styles";
import { cn } from "@/lib/utils";

const INPUT_CLASS =
  "w-auto max-w-full min-w-[4ch] rounded-md border border-border bg-background px-2.5 text-sm text-foreground outline-none transition-colors duration-150 [field-sizing:content] placeholder:text-muted-foreground/45 focus:border-[color-mix(in_oklab,var(--foreground)_22%,var(--border))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_12%,transparent)]";

type InspectorEditableFieldProps = {
  value: string;
  onSave: (next: string) => void;
  placeholder?: string;
  ariaLabel: string;
  variant?: "title" | "subtitle" | "meta";
  allowEmpty?: boolean;
  formatDisplay?: (value: string) => string;
  disabled?: boolean;
  className?: string;
};

export function InspectorEditableField({
  value,
  onSave,
  placeholder,
  ariaLabel,
  variant = "meta",
  allowEmpty = false,
  formatDisplay,
  disabled = false,
  className,
}: InspectorEditableFieldProps) {
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
    if (!allowEmpty && !trimmed) {
      cancel();
      return;
    }
    setEditing(false);
    if (trimmed !== value.trim()) onSave(trimmed);
  }

  const display = formatDisplay ? formatDisplay(value) : value;
  const isInteractive = !disabled;

  if (editing) {
    const fitChars = Math.max(
      draft.length,
      placeholder?.length ?? 0,
      variant === "title" ? 10 : 4,
    );

    return (
      <input
        autoFocus
        value={draft}
        disabled={disabled}
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
        className={cn(
          INPUT_CLASS,
          variant === "title" && "text-lg font-semibold tracking-tight",
          variant === "subtitle" && "text-sm leading-snug",
          className,
        )}
      />
    );
  }

  const isEmpty = !value.trim();

  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={() => {
        if (isInteractive) setEditing(true);
      }}
      onKeyDown={(event) => {
        if (!isInteractive) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setEditing(true);
        }
      }}
      className={cn(
        INSPECTOR_HOVER_ROW_CLASS,
        variant === "title" ? "py-0.5" : "py-px",
        isInteractive ? "cursor-pointer" : "border-transparent hover:border-transparent hover:bg-transparent",
        isEmpty && isInteractive && "border-dashed border-border/40 hover:border-border/70",
        className,
      )}
    >
      {isEmpty ? (
        <span
          className={cn(
            "min-w-0 text-muted-foreground/55",
            variant === "title" && "text-lg font-semibold tracking-tight",
            variant === "subtitle" && "text-sm leading-snug",
            variant === "meta" && "text-sm",
          )}
        >
          {placeholder}
        </span>
      ) : (
        <span
          className={cn(
            "min-w-0 truncate text-foreground",
            variant === "title" && "text-lg font-semibold leading-tight tracking-tight",
            variant === "subtitle" && "text-[15px] leading-snug text-muted-foreground",
            variant === "meta" && "text-sm text-muted-foreground",
          )}
          title={value}
        >
          {display}
        </span>
      )}
      {isInteractive ? <InspectorHoverPencil /> : null}
    </div>
  );
}
