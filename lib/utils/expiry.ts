export type ExpiryState = "valid" | "expiring" | "expired" | "missing";

export function daysUntil(date: string | null | undefined) {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
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

