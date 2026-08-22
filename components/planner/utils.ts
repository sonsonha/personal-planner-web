/** Process accent colors — cycle by index; never invent scores. */
import { startOfProductWeek } from "@/lib/product-week";

export const PROCESS_ACCENTS = [
  { color: "#059669", light: "#D1FAE5" },
  { color: "#2563EB", light: "#DBEAFE" },
  { color: "#D97706", light: "#FEF3C7" },
  { color: "#7C3AED", light: "#EDE9FE" },
  { color: "#DB2777", light: "#FCE7F3" },
  { color: "#0891B2", light: "#E0F2FE" },
] as const;

export function processAccent(index: number) {
  return PROCESS_ACCENTS[index % PROCESS_ACCENTS.length]!;
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatHoursFromMinutes(minutes: number) {
  const hours = Math.round((minutes / 60) * 10) / 10;
  if (Number.isInteger(hours)) return `${hours}`;
  return String(hours);
}

export function weekRangeLabel(now: Date) {
  const start = startOfProductWeek(now);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)}–${end.toLocaleDateString("en-US", opts)}`;
}
