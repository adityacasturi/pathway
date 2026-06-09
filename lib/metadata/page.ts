import type { Metadata } from "next";

const DEFAULT_DESCRIPTION = "Internship application tracker.";

export function pageMetadata(
  title: string,
  description: string = DEFAULT_DESCRIPTION,
): Metadata {
  const fullTitle = `${title} · Pathway`;
  return {
    title,
    description,
    openGraph: {
      title: fullTitle,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}
