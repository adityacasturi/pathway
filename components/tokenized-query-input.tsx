"use client";

import { useMemo, useRef } from "react";
import { TerminalSquare, X } from "lucide-react";
import { QueryAutocomplete, type QuerySuggestion } from "@/components/query-autocomplete";

const TOKEN_PATTERN = /"[^"]*"|'[^']*'|\S+/g;

function tokenize(value: string) {
  return value.match(TOKEN_PATTERN) ?? [];
}

function joinTokens(tokens: string[], active: string) {
  return [...tokens, active].filter(Boolean).join(" ");
}

function splitFilterToken(token: string) {
  const index = token.indexOf(":");
  if (index <= 0) return null;
  const key = token.slice(0, index);
  const value = token.slice(index + 1);
  return { key, value };
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  suggestions: QuerySuggestion[];
  placeholder: string;
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
}

export function TokenizedQueryInput({
  value,
  onChange,
  suggestions,
  placeholder,
  focused,
  onFocusChange,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasTrailingSpace = /\s$/.test(value);
  const parts = useMemo(() => tokenize(value), [value]);
  const activeToken = hasTrailingSpace ? "" : parts.at(-1) ?? "";
  const committedTokens = hasTrailingSpace ? parts : parts.slice(0, -1);
  const autocompleteQuery = joinTokens(committedTokens, activeToken);
  const activeFilter = splitFilterToken(activeToken);

  function focusInput() {
    inputRef.current?.focus();
  }

  function setActiveToken(nextActive: string) {
    onChange(joinTokens(committedTokens, nextActive));
  }

  function setActiveFilterValue(nextValue: string) {
    if (!activeFilter) return;
    setActiveToken(`${activeFilter.key}:${nextValue.replace(/\s/g, "")}`);
  }

  function removeToken(index: number) {
    const next = committedTokens.filter((_, i) => i !== index);
    onChange(joinTokens(next, activeToken));
    window.setTimeout(focusInput, 0);
  }

  function commitActiveToken() {
    const trimmed = activeToken.trim();
    if (!trimmed) return;
    onChange(`${joinTokens(committedTokens, trimmed)} `);
  }

  function pickSuggestion(next: string) {
    // Prefix suggestions such as `company:` should stay editable so the user
    // can immediately type the value. Complete suggestions become chips.
    onChange(next.endsWith(":") ? next : `${next} `);
    window.setTimeout(focusInput, 0);
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) event.preventDefault();
          focusInput();
        }}
        className={`flex min-h-12 w-full items-center gap-2 rounded-xl border bg-background/80 px-3 py-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition-[border-color,box-shadow] ${
          focused
            ? "border-ring shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-ring)_18%,transparent),inset_0_1px_0_rgb(255_255_255/0.08)]"
            : "border-border/70"
        }`}
      >
        <TerminalSquare className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {committedTokens.map((token, index) => {
            const filter = splitFilterToken(token);
            return (
              <span
                key={`${token}-${index}`}
                className="inline-flex h-8 max-w-full items-center overflow-hidden rounded-lg border border-border/80 bg-muted/45 text-xs text-muted-foreground"
              >
                {filter ? (
                  <>
                    <span className="flex h-full items-center border-r border-border/70 bg-foreground/5 px-2 font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {filter.key}
                    </span>
                    <span className="min-w-0 truncate px-2 text-foreground">
                      {filter.value || "Any"}
                    </span>
                  </>
                ) : (
                  <span className="min-w-0 truncate px-2 text-foreground">{token}</span>
                )}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeToken(index);
                  }}
                  className="mr-1 inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/70 hover:bg-foreground/8 hover:text-foreground"
                  aria-label={`Remove ${token}`}
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
          {activeFilter ? (
              <span className="inline-flex h-8 max-w-full items-center overflow-hidden rounded-lg border border-foreground/20 bg-background text-xs shadow-[0_10px_22px_-18px_rgb(15_23_42/0.45)]">
              <span className="flex h-full items-center border-r border-border/70 bg-foreground/5 px-2 font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {activeFilter.key}
              </span>
              <input
                ref={inputRef}
                value={activeFilter.value}
                onChange={(event) => setActiveFilterValue(event.target.value)}
                onFocus={() => onFocusChange(true)}
                onBlur={() => onFocusChange(false)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    onFocusChange(false);
                    event.currentTarget.blur();
                    return;
                  }
                  if (event.key === "Backspace" && !activeFilter.value) {
                    event.preventDefault();
                    onChange(committedTokens.join(" "));
                    return;
                  }
                  if ((event.key === "Enter" || event.key === " ") && activeFilter.value) {
                    event.preventDefault();
                    commitActiveToken();
                  }
                }}
                placeholder="value"
                className="h-full min-w-24 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/45"
              />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(committedTokens.join(" "));
                  window.setTimeout(focusInput, 0);
                }}
                className="mr-1 inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/70 hover:bg-foreground/8 hover:text-foreground"
                aria-label={`Remove ${activeFilter.key} filter`}
              >
                <X size={11} />
              </button>
            </span>
          ) : (
            <input
              ref={inputRef}
              value={activeToken}
              onChange={(event) => setActiveToken(event.target.value)}
              onFocus={() => onFocusChange(true)}
              onBlur={() => onFocusChange(false)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  onFocusChange(false);
                  event.currentTarget.blur();
                  return;
                }
                if (event.key === "Backspace" && !activeToken && committedTokens.length > 0) {
                  event.preventDefault();
                  onChange(committedTokens.slice(0, -1).join(" "));
                  return;
                }
              }}
              placeholder={committedTokens.length === 0 ? placeholder : ""}
              className="h-7 min-w-40 flex-1 bg-transparent px-1 text-base text-foreground outline-none placeholder:text-muted-foreground/55 md:text-sm"
            />
          )}
        </div>
      </div>
      <QueryAutocomplete
        anchorRef={rootRef}
        query={autocompleteQuery}
        suggestions={suggestions}
        onChange={pickSuggestion}
        onPick={focusInput}
        open={focused}
      />
    </div>
  );
}
