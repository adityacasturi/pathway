"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Link as LinkIcon, Pencil, X } from "lucide-react";
import { APPLICATION_SEASONS, ApplicationSeason } from "@/types/application";
import { displayUrl, normalizeUrl, safeExternalHref } from "@/lib/url";
import { cn } from "@/lib/utils";

type FieldVariant = "default" | "inline";

const FIELD_INPUT_CLASS =
  "h-8 w-full min-w-0 rounded-md border border-border bg-background px-2.5 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/50 focus:border-[color-mix(in_oklab,var(--foreground)_22%,var(--border))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_12%,transparent)]";

const FIELD_INPUT_INLINE_CLASS =
  "h-7 max-w-[16rem] min-w-[8rem] rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/50 focus:border-[color-mix(in_oklab,var(--foreground)_22%,var(--border))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_12%,transparent)]";

function FieldPlaceholder({
  children,
  onClick,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  variant?: FieldVariant;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border border-transparent text-left transition-colors duration-150",
        variant === "inline"
          ? "inline-flex w-auto items-center px-1 py-0.5 text-sm text-muted-foreground/60 hover:bg-muted/50 hover:text-muted-foreground"
          : "w-full px-1.5 py-0.5 text-sm text-muted-foreground/55 hover:border-foreground/12 hover:bg-muted/50 hover:text-muted-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function FieldValueButton({
  children,
  onClick,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  variant?: FieldVariant;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border border-transparent text-left text-foreground transition-colors duration-150",
        variant === "inline"
          ? "inline-flex w-auto max-w-full px-1 py-0.5 text-sm hover:bg-muted/50"
          : "w-full px-1.5 py-0.5 text-sm hover:border-foreground/12 hover:bg-muted/50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LocationField({
  value,
  onSave,
  variant = "default",
}: {
  value: string | null;
  onSave: (next: string | null) => void;
  variant?: FieldVariant;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value ?? "");
  }, [value]);

  function save() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed !== (value ?? "")) onSave(trimmed || null);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
        placeholder="City, remote, etc."
        className={variant === "inline" ? FIELD_INPUT_INLINE_CLASS : FIELD_INPUT_CLASS}
      />
    );
  }

  if (!value) {
    return (
      <FieldPlaceholder onClick={() => setEditing(true)} variant={variant}>
        Add location
      </FieldPlaceholder>
    );
  }

  return (
    <FieldValueButton
      onClick={() => setEditing(true)}
      variant={variant}
      className={cn(variant === "inline" ? "truncate" : "whitespace-normal leading-snug line-clamp-3")}
    >
      {value}
    </FieldValueButton>
  );
}

function nextSeason(current: ApplicationSeason | null): ApplicationSeason | null {
  if (current === null) return APPLICATION_SEASONS[0] ?? null;
  const index = APPLICATION_SEASONS.indexOf(current);
  if (index < 0 || index === APPLICATION_SEASONS.length - 1) return null;
  return APPLICATION_SEASONS[index + 1] ?? null;
}

export function SeasonField({
  value,
  onSave,
  variant = "default",
}: {
  value: ApplicationSeason | null;
  onSave: (next: ApplicationSeason | null) => void;
  variant?: FieldVariant;
}) {
  const label = value ?? "Add season";

  return (
    <button
      type="button"
      onClick={() => onSave(nextSeason(value))}
      aria-pressed={value !== null}
      className={cn(
        "inline-flex items-center rounded-md border font-medium capitalize transition-colors duration-150",
        variant === "inline" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
        value
          ? "border-[var(--selection-border)] bg-[var(--selection-bg)] text-[var(--selection-fg)]"
          : "border-border bg-background text-muted-foreground hover:bg-muted/45 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function PostingUrlField({
  value,
  onSave,
  variant = "default",
}: {
  value: string | null;
  onSave: (next: string | null) => void;
  variant?: FieldVariant;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value ?? "");
  }, [value]);

  function save() {
    const normalized = normalizeUrl(draft);
    setEditing(false);
    if (normalized !== value) onSave(normalized);
  }

  const inputClass = variant === "inline" ? FIELD_INPUT_INLINE_CLASS : FIELD_INPUT_CLASS;

  if (editing) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              setDraft(value ?? "");
              setEditing(false);
            }
          }}
          placeholder="https://..."
          className={inputClass}
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setEditing(false);
              onSave(null);
            }}
            title="Remove link"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove posting link"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    );
  }

  if (!value) {
    return (
      <FieldPlaceholder
        onClick={() => setEditing(true)}
        variant={variant}
        className="inline-flex items-center gap-1.5"
      >
        <LinkIcon className="size-3.5 shrink-0 opacity-60" aria-hidden />
        Add link
      </FieldPlaceholder>
    );
  }

  const safeHref = safeExternalHref(value);

  return (
    <div className="group inline-flex min-w-0 max-w-full items-center gap-0.5">
      {safeHref ? (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 max-w-full items-center gap-1 truncate rounded-md px-1 py-0.5 text-sm text-foreground transition-colors duration-150 hover:bg-muted/50 hover:underline"
          title={value}
        >
          <span className="truncate">{displayUrl(value)}</span>
          <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        </a>
      ) : (
        <span className="min-w-0 truncate px-1 py-0.5 text-sm text-muted-foreground" title={value}>
          Invalid URL
        </span>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Edit posting link"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[opacity,background-color] duration-150 hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
      >
        <Pencil className="size-3" aria-hidden />
      </button>
    </div>
  );
}
