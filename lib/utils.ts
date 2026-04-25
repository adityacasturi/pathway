import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

/** Merges Tailwind class lists, dropping conflicts in favor of the latter. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats an ISO date string ("YYYY-MM-DD") for human display. */
export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "MMM d, yyyy");
}
