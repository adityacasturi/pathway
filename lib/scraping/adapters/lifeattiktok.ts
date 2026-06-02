import type { ByteDanceJob } from "./bytedance.ts";
import { TIKTOK_CAREERS_ORIGIN } from "./bytedance-brand.ts";
import { fetchWithTimeout } from "./shared.ts";

const US_LOCATION_PATTERN =
  /\b(San Jose|San Francisco|Mountain View|Seattle|Los Angeles|New York|Austin|Chicago|Washington|Cambridge|Boston|United States|California|Washington,? D\.?C\.?)\b/i;

/**
 * Fetches a job visible on lifeattiktok.com when the ByteDance supplier search API
 * does not return it. Parses Next.js RSC flight payloads embedded in HTML.
 */
export async function fetchLifeAtTikTokJob(jobId: string): Promise<ByteDanceJob | null> {
  const url = `${TIKTOK_CAREERS_ORIGIN}/search/${jobId}`;
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      return null;
    }
    return parseLifeAtTikTokSearchHtml(jobId, await res.text());
  } catch {
    return null;
  }
}

export function parseLifeAtTikTokSearchHtml(jobId: string, html: string): ByteDanceJob | null {
  const title = parseLifeAtTikTokTitle(html);
  if (!title) {
    return null;
  }

  const rscText = decodeLifeAtTikTokRscPayload(html);
  const description = parseLifeAtTikTokDescription(rscText);
  const requirement = parseLifeAtTikTokRequirement(rscText);
  const locationLabel = parseLifeAtTikTokLocation(rscText, description, requirement);

  return {
    id: jobId,
    title,
    description: description ?? undefined,
    requirement: requirement ?? undefined,
    recruit_type: {
      en_name: /\bintern\b/i.test(title) ? "Intern" : undefined,
    },
    city_info: locationLabel
      ? {
          en_name: locationLabel,
          parent: { en_name: "United States of America" },
        }
      : null,
  };
}

function parseLifeAtTikTokTitle(html: string): string | null {
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1];
  if (ogTitle?.trim()) {
    return decodeHtmlEntities(ogTitle.trim());
  }

  const documentTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  if (documentTitle?.trim()) {
    return decodeHtmlEntities(documentTitle.trim().replace(/\s*[-|].*@?TikTok.*$/i, "").trim());
  }

  return null;
}

function decodeLifeAtTikTokRscPayload(html: string): string {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]/g)].map((match) => match[1]);
  return decodeRscString(chunks.join(""));
}

function decodeRscString(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\\\/g, "\\");
}

function parseLifeAtTikTokDescription(rscText: string): string | null {
  const intro = rscText.match(
    /Team Introduction:\s*([\s\S]*?)(?=Responsibilities:|We are looking|Minimum qualifications:|Minimum Qualifications:|$)/i,
  )?.[1];
  const looking = rscText.match(
    /We are looking for talented individuals[\s\S]*?(?=Responsibilities:|Minimum qualifications:|Minimum Qualifications:|Candidates can apply|$)/i,
  )?.[0];

  const parts = [intro?.trim(), looking?.trim()].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  return parts.join("\n\n");
}

function parseLifeAtTikTokRequirement(rscText: string): string | null {
  const block = rscText.match(
    /(Minimum qualifications:|Minimum Qualifications:)([\s\S]*?)(?=Preferred Qualification|Candidates can apply|$)/i,
  );
  if (!block) {
    return null;
  }
  return `${block[1]}\n${block[2].trim()}`;
}

function parseLifeAtTikTokLocation(
  rscText: string,
  description: string | null,
  requirement: string | null,
): string | null {
  const corpus = [rscText, description, requirement].filter(Boolean).join("\n");
  const match = corpus.match(US_LOCATION_PATTERN);
  return match?.[1] ?? null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
