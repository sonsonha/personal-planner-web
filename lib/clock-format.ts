export type ClockFormat = "12h" | "24h";

const STORAGE_KEY = "pos-clock-format";

export function readClockFormat(): ClockFormat {
  if (typeof window === "undefined") return "24h";
  return window.localStorage.getItem(STORAGE_KEY) === "12h" ? "12h" : "24h";
}

export function writeClockFormat(format: ClockFormat) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, format);
}

/** Format minutes-from-midnight (may exceed 24h) for calendar UI. */
export function formatMinutesOfDay(totalMinutes: number, format: ClockFormat = "24h") {
  const day = ((Math.floor(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(day / 60);
  const mins = day % 60;
  const mm = String(mins).padStart(2, "0");
  if (format === "24h") {
    return `${String(hours).padStart(2, "0")}:${mm}`;
  }
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelve = hours % 12 || 12;
  return `${twelve}:${mm} ${suffix}`;
}

/** Hour gutter label: `13` or `1 PM`. */
export function formatHourGutter(hour: number, format: ClockFormat = "24h") {
  const normalized = ((hour % 24) + 24) % 24;
  if (format === "24h") return String(normalized).padStart(2, "0");
  if (normalized === 0) return "12 AM";
  if (normalized === 12) return "12 PM";
  return normalized > 12 ? `${normalized - 12} PM` : `${normalized} AM`;
}

export function formatMinuteRange(
  start: number,
  duration: number,
  format: ClockFormat = "24h",
) {
  return `${formatMinutesOfDay(start, format)} – ${formatMinutesOfDay(start + duration, format)}`;
}
