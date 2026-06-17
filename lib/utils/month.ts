// Shared month helpers for the Fuel Dashboard / Fuel Log month navigator.
// yearMonth format: "YYYY-MM"

/**
 * Today's date as "YYYY-MM-DD" in IST, independent of the server's or browser's
 * timezone. (toISOString() is always UTC, which between midnight and 5:30 AM IST
 * returns the previous day — so we format in Asia/Kolkata instead.)
 */
export function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function currentYearMonth() {
  return istToday().slice(0, 7);
}

export function isValidYearMonth(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value));
}

export function monthLabel(yearMonth: string) {
  const [year, mon] = yearMonth.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function prevMonth(yearMonth: string) {
  const [year, mon] = yearMonth.split("-").map(Number);
  const d = new Date(year, mon - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function nextMonth(yearMonth: string) {
  const [year, mon] = yearMonth.split("-").map(Number);
  const d = new Date(year, mon, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
