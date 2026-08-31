import { istToday } from "@/lib/utils/month";

export type ExpiryState = "valid" | "expiring" | "expired" | "missing";

/**
 * Whole calendar days from today (IST) to an expiry date. Negative = already expired.
 *
 * Both ends are anchored to UTC midnight of their own YYYY-MM-DD, so the
 * subtraction is an exact multiple of a day and the answer doesn't depend on where
 * this runs. "Today" comes from the IST clock like the rest of the app.
 *
 * The previous version parsed the date with no zone and compared it to the
 * runtime's local midnight. On Vercel (TZ=UTC) that made every countdown a day
 * long between 00:00 and 05:30 IST — a document that expired yesterday still read
 * "Expires today" and getExpiryState returned "expiring" instead of "expired", so
 * /alerts dropped it from the expired list. It also disagreed with the browser
 * whenever the viewer wasn't in UTC.
 */
export function daysUntil(date: string | null | undefined) {
  if (!date) return null;
  const target = Date.parse(`${date}T00:00:00Z`);
  const today = Date.parse(`${istToday()}T00:00:00Z`);
  return Math.round((target - today) / 86400000);
}

export function getExpiryState(date: string | null | undefined, threshold = 30): ExpiryState {
  const days = daysUntil(date);
  if (days === null) return "missing";
  if (days < 0) return "expired";
  if (days <= threshold) return "expiring";
  return "valid";
}

export function getWorstDocumentState(dates: Array<string | null | undefined>, threshold = 30): ExpiryState {
  const states = dates.map((date) => getExpiryState(date, threshold));
  if (states.includes("expired")) return "expired";
  if (states.includes("expiring")) return "expiring";
  if (states.every((state) => state === "missing")) return "missing";
  return "valid";
}

export function formatExpiry(date: string | null | undefined) {
  const days = daysUntil(date);
  if (!date || days === null) return "Not uploaded";
  if (days < 0) return `${Math.abs(days)} days expired`;
  if (days === 0) return "Expires today";
  return `${days} days left`;
}

