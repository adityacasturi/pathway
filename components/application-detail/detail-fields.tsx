"use client";

import { useEffect, useState } from "react";
import { Link as LinkIcon, X } from "lucide-react";
import { APPLICATION_SEASONS, ApplicationSeason } from "@/types/application";
import { displayUrl, normalizeUrl, safeExternalHref } from "@/lib/url";

const DETAIL_TEXT_INPUT_CLASS =
  "h-8 min-w-0 flex-1 rounded-lg border border-border/70 bg-background/80 px-2.5 text-xs text-foreground outline-none transition-colors duration-150 focus:border-foreground/30 focus:bg-background";
const DETAIL_SAVE_BUTTON_CLASS =
  "h-8 rounded-lg px-2 text-[10px] uppercase tracking-wider text-foreground hover:bg-muted";

export function LocationField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
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
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(value ?? "");
              setEditing(false);
            }
          }}
          placeholder="Add location..."
          className={DETAIL_TEXT_INPUT_CLASS}
        />
        <button type="button" onClick={save} className={DETAIL_SAVE_BUTTON_CLASS}>
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(value ?? "");
            setEditing(false);
          }}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Cancel location edit"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="group/location flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`min-w-0 truncate text-left transition-colors duration-150 hover:text-foreground ${
          value ? "" : "text-muted-foreground/50"
        }`}
      >
        {value || "Add location"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground/45 opacity-0 transition-colors duration-150 hover:text-foreground group-hover/location:opacity-100 focus:opacity-100"
      >
        Edit
      </button>
    </div>
  );
}

export function SeasonField({
  value,
  onSave,
}: {
  value: ApplicationSeason | null;
  onSave: (next: ApplicationSeason | null) => void;
}) {
  return (
    <div
      className="inline-flex items-center border"
      style={{ borderColor: "var(--rule)" }}
    >
      {APPLICATION_SEASONS.map((option, idx) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSave(active ? null : option)}
            aria-pressed={active}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150 ${
              idx > 0 ? "border-l" : ""
            } ${
              active
                ? "bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={idx > 0 ? { borderColor: "var(--rule)" } : undefined}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function PostingUrlField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
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

  if (editing) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <LinkIcon className="size-3 shrink-0 text-muted-foreground/60" />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
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
          className={DETAIL_TEXT_INPUT_CLASS}
        />
        <button type="button" onClick={save} className={DETAIL_SAVE_BUTTON_CLASS}>
          Save
        </button>
        {value && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setEditing(false);
              onSave(null);
            }}
            title="Remove link"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (!value) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground/50 transition-colors duration-150 hover:text-foreground"
      >
        <LinkIcon className="size-3" />
        Add posting link
      </button>
    );
  }

  const safeHref = safeExternalHref(value);
  return (
    <div className="group/link flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
      {safeHref ? (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 truncate transition-colors duration-150 hover:text-foreground"
          title={value}
        >
          {displayUrl(value)}
        </a>
      ) : (
        <span className="min-w-0 truncate text-muted-foreground/60" title={value}>
          Invalid posting URL
        </span>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground/45 opacity-0 transition-colors duration-150 hover:text-foreground group-hover/link:opacity-100 focus:opacity-100"
      >
        Edit
      </button>
    </div>
  );
}
