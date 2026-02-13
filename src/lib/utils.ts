import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const MAX_DATE_RANGE_DAYS = 5 * 365; // 5 years

/** Parse a YYYY-MM-DD string to a Date, or null if invalid. */
export function parseDateParam(str: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(str + "T00:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

/** Validate that a from/to date range is within bounds. Returns error string or null. */
export function validateDateRange(from: string | null, to: string | null): string | null {
  if (from) {
    const d = parseDateParam(from);
    if (!d) return "Invalid 'from' date format (expected YYYY-MM-DD)";
  }
  if (to) {
    const d = parseDateParam(to);
    if (!d) return "Invalid 'to' date format (expected YYYY-MM-DD)";
  }
  if (from && to) {
    const f = parseDateParam(from)!;
    const t = parseDateParam(to)!;
    if (t < f) return "'to' date must be after 'from' date";
    const diffDays = (t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_DATE_RANGE_DAYS) return `Date range exceeds maximum of ${MAX_DATE_RANGE_DAYS} days`;
  }
  return null;
}
