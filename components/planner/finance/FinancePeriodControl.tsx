"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  resolveTransactionsPeriod,
  type TransactionsGrain,
} from "@/lib/finance-api";

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(isoDate: string, days: number): string {
  const dt = parseIsoDate(isoDate);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatIsoDate(dt);
}

function startOfUtcMonth(isoDate: string): string {
  const dt = parseIsoDate(isoDate);
  return formatIsoDate(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1)));
}

function sameUtcDay(a: string, b: string): boolean {
  return a === b;
}

function mondayWeekStart(isoDate: string): string {
  return resolveTransactionsPeriod("week", isoDate).periodKey;
}

function weeksInMonth(monthIso: string): string[][] {
  const monthStart = parseIsoDate(startOfUtcMonth(monthIso));
  const y = monthStart.getUTCFullYear();
  const m = monthStart.getUTCMonth();
  const firstDow = monthStart.getUTCDay();
  const offsetToMon = firstDow === 0 ? -6 : 1 - firstDow;
  const gridStart = new Date(Date.UTC(y, m, 1 + offsetToMon));
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const week: string[] = [];
    for (let d = 0; d < 7; d += 1) {
      const day = new Date(gridStart);
      day.setUTCDate(gridStart.getUTCDate() + w * 7 + d);
      week.push(formatIsoDate(day));
    }
    weeks.push(week);
    if (parseIsoDate(week[6]!).getUTCMonth() !== m && w >= 3) break;
  }
  return weeks;
}

function FinanceWeekPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (weekStart: string) => void;
}) {
  const selectedStart = mondayWeekStart(value);
  const range = resolveTransactionsPeriod("week", selectedStart);
  const rangeText = `${parseIsoDate(range.start).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })} – ${parseIsoDate(range.end).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfUtcMonth(selectedStart));
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    setMonth(startOfUtcMonth(selectedStart));
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const height = 312;
      const top = rect.bottom + height > window.innerHeight - 12
        ? Math.max(12, rect.top - height - 6)
        : rect.bottom + 6;
      const left = Math.min(rect.left, window.innerWidth - 268);
      setCoords({ top, left: Math.max(12, left) });
    };
    place();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, selectedStart]);

  const weeks = weeksInMonth(month);
  const todayKey = resolveTransactionsPeriod("day").periodKey;
  const currentWeek = mondayWeekStart(todayKey);

  return (
    <div className="week-range-field" ref={rootRef}>
      <span className="sr-only">Week</span>
      <button
        ref={buttonRef}
        type="button"
        className={`week-range-control${open ? " open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Week ${rangeText}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="week-range-display">{rangeText}</span>
      </button>
      {open && (
        <div
          className="week-picker"
          role="dialog"
          aria-label="Choose a week"
          style={{ top: coords.top, left: coords.left }}
        >
          <div className="week-picker-header">
            <strong>
              {parseIsoDate(month).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </strong>
            <div className="pager">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => {
                  const dt = parseIsoDate(month);
                  setMonth(formatIsoDate(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() - 1, 1))));
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => {
                  const dt = parseIsoDate(month);
                  setMonth(formatIsoDate(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1))));
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="week-picker-weekdays" aria-hidden="true">
            {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
          <div className="week-picker-grid">
            {weeks.map((week) => {
              const start = week[0]!;
              const selected = start === selectedStart;
              const isCurrent = start === currentWeek;
              const monthNum = parseIsoDate(month).getUTCMonth();
              return (
                <button
                  key={start}
                  type="button"
                  className={`week-picker-row${selected ? " selected" : ""}${isCurrent ? " current" : ""}`}
                  onClick={() => {
                    onChange(start);
                    setOpen(false);
                  }}
                >
                  {week.map((day) => (
                    <span
                      key={day}
                      className={`week-picker-day${parseIsoDate(day).getUTCMonth() !== monthNum ? " muted" : ""}${sameUtcDay(day, todayKey) ? " today" : ""}`}
                    >
                      {parseIsoDate(day).getUTCDate()}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="week-picker-this"
            onClick={() => {
              onChange(currentWeek);
              setOpen(false);
            }}
          >
            This week
          </button>
        </div>
      )}
    </div>
  );
}

export function FinancePeriodControl({
  grain,
  periodKey,
  onChange,
}: {
  grain: TransactionsGrain;
  periodKey: string;
  onChange: (nextPeriodKey: string) => void;
}) {
  if (grain === "month") {
    return (
      <label className="pos-finance-period-field">
        <span className="sr-only">Month</span>
        <input
          type="month"
          value={periodKey}
          onChange={(event) => {
            if (!event.target.value) return;
            onChange(event.target.value);
          }}
        />
      </label>
    );
  }

  if (grain === "week") {
    return (
      <FinanceWeekPicker
        value={periodKey}
        onChange={onChange}
      />
    );
  }

  if (grain === "year") {
    const year = Number(periodKey);
    const years = Array.from({ length: 11 }, (_, i) => year - 5 + i);
    return (
      <label className="pos-finance-period-field">
        <span className="sr-only">Year</span>
        <select
          value={periodKey}
          onChange={(event) => onChange(event.target.value)}
        >
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="pos-finance-period-field">
      <span className="sr-only">Date</span>
      <input
        type="date"
        value={periodKey}
        onChange={(event) => {
          if (!event.target.value) return;
          onChange(event.target.value);
        }}
      />
    </label>
  );
}
