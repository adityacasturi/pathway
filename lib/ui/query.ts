"use client";

export interface ParsedCommandQuery {
  textTerms: string[];
  fieldTerms: Map<string, string[]>;
  flags: Set<string>;
}

const TOKEN_PATTERN = /"[^"]*"|'[^']*'|\S+/g;

function normalizeTokenValue(value: string) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseCommandQuery(input: string): ParsedCommandQuery {
  const textTerms: string[] = [];
  const fieldTerms = new Map<string, string[]>();
  const flags = new Set<string>();
  const parts = input.match(TOKEN_PATTERN) ?? [];

  for (const rawPart of parts) {
    const part = normalizeTokenValue(rawPart);
    const colonIndex = part.indexOf(":");

    if (colonIndex > 0) {
      const key = part.slice(0, colonIndex).toLowerCase();
      const value = normalizeTokenValue(part.slice(colonIndex + 1));
      if (!value) continue;
      const existing = fieldTerms.get(key) ?? [];
      existing.push(value);
      fieldTerms.set(key, existing);
      continue;
    }

    textTerms.push(part.toLowerCase());
  }

  return { textTerms, fieldTerms, flags };
}

export function getFieldTerms(parsed: ParsedCommandQuery, ...keys: string[]) {
  const out: string[] = [];
  for (const key of keys) {
    const values = parsed.fieldTerms.get(key);
    if (values) out.push(...values.map((value) => value.toLowerCase()));
  }
  return out;
}

export function getLastFieldTerm(parsed: ParsedCommandQuery, ...keys: string[]) {
  const values = getFieldTerms(parsed, ...keys);
  return values.at(-1) ?? null;
}

export function hasAnyFlag(parsed: ParsedCommandQuery, ...flags: string[]) {
  return flags.some((flag) => parsed.flags.has(flag) || parsed.textTerms.includes(flag));
}

export function replaceActiveToken(input: string, replacement: string) {
  const cursor = input.length;
  const beforeCursor = input.slice(0, cursor);
  const tokenStart = Math.max(beforeCursor.lastIndexOf(" "), beforeCursor.lastIndexOf("\n")) + 1;
  const prefix = input.slice(0, tokenStart);
  const suffix = input.slice(cursor);
  return `${prefix}${replacement}${suffix}`.trimStart();
}

export function getActiveToken(input: string) {
  const trimmedRight = input.replace(/\s+$/, "");
  const tokenStart = Math.max(trimmedRight.lastIndexOf(" "), trimmedRight.lastIndexOf("\n")) + 1;
  return trimmedRight.slice(tokenStart).toLowerCase();
}
