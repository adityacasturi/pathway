"use client";

import type { ReactNode } from "react";
import Link from "next/link";

const INTERNAL_PATH_PATTERN =
  /(\/(?:openings|applications|companies|alerts)(?:\?[^\s.,;:!?)]*)?)/g;

const INTERNAL_PATH_LABELS: Record<string, string> = {
  "/openings": "Openings",
  "/home": "Home",
  "/applications": "Applications",
  "/companies": "Companies",
  "/alerts": "Alerts",
};

function internalPathLabel(path: string): string {
  const pathname = path.split("?")[0] ?? path;
  return INTERNAL_PATH_LABELS[pathname] ?? pathname.slice(1);
}

function renderMarkdownSegment(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\*\*|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(...renderInternalPaths(text.slice(cursor, match.index), `${keyPrefix}-t${index}`));
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a
          key={`${keyPrefix}-bl-${index}`}
          href={match[3]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[var(--link)] underline-offset-2 hover:text-[var(--link-hover)] hover:underline"
        >
          {match[2]}
        </a>,
      );
    } else if (match[4]) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${index}`} className="font-medium text-foreground">
          {match[4]}
        </strong>,
      );
    } else if (match[5] && match[6]) {
      const href = match[6];
      const isInternal = href.startsWith("/");
      if (isInternal) {
        nodes.push(
          <Link
            key={`${keyPrefix}-il-${index}`}
            href={href}
            className="font-medium text-[var(--link)] underline-offset-2 hover:text-[var(--link-hover)] hover:underline"
          >
            {match[5]}
          </Link>,
        );
      } else {
        nodes.push(
          <a
            key={`${keyPrefix}-l-${index}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[var(--link)] underline-offset-2 hover:text-[var(--link-hover)] hover:underline"
          >
            {match[5]}
          </a>,
        );
      }
    }

    cursor = pattern.lastIndex;
    index += 1;
  }

  if (cursor < text.length) {
    nodes.push(...renderInternalPaths(text.slice(cursor), `${keyPrefix}-tail`));
  }

  return nodes;
}

function renderInternalPaths(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INTERNAL_PATH_PATTERN);
  if (parts.length === 1) {
    return text ? [text] : [];
  }

  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith("/")) {
      return (
        <Link
          key={`${keyPrefix}-p${index}`}
          href={part}
          className="font-medium text-[var(--link)] underline-offset-2 hover:text-[var(--link-hover)] hover:underline"
        >
          {internalPathLabel(part)}
        </Link>
      );
    }
    return <span key={`${keyPrefix}-s${index}`}>{part}</span>;
  }).filter(Boolean) as ReactNode[];
}

export function InlineMarkdownText({ text }: { text: string }) {
  return <>{renderMarkdownSegment(text, "root")}</>;
}
