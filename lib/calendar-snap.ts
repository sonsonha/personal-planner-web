/** Fine grid for drag/move (Google Calendar–like). */
export const CALENDAR_SNAP_MINUTES = 5;
/** Round marks users aim for when creating (:00 / :30). */
export const CALENDAR_MAJOR_SNAP_MINUTES = 30;
/**
 * If a create click lands within this many minutes of an hour or half-hour,
 * pull onto that mark (e.g. 11:05 / 11:10 → 11:00).
 */
export const CALENDAR_MAJOR_SNAP_PULL_MINUTES = 10;

export function snapToFineGrid(rawMinutes: number, snap = CALENDAR_SNAP_MINUTES): number {
  return Math.round(rawMinutes / snap) * snap;
}

/**
 * Create-slot snap: fine grid, then magnet toward :00 / :30 when close.
 * Move/resize of existing blocks should keep using the fine grid only.
 */
export function snapMinutesForCreate(
  rawMinutes: number,
  opts?: {
    snap?: number;
    major?: number;
    pull?: number;
    min?: number;
    max?: number;
  },
): number {
  const snap = opts?.snap ?? CALENDAR_SNAP_MINUTES;
  const majorStep = opts?.major ?? CALENDAR_MAJOR_SNAP_MINUTES;
  const pull = opts?.pull ?? CALENDAR_MAJOR_SNAP_PULL_MINUTES;
  const min = opts?.min ?? 0;
  const max = opts?.max ?? 24 * 60 - snap;

  let fine = snapToFineGrid(rawMinutes, snap);
  fine = Math.max(min, Math.min(max, fine));

  const major = Math.round(fine / majorStep) * majorStep;
  const clampedMajor = Math.max(min, Math.min(max, major));
  if (Math.abs(fine - clampedMajor) <= pull) {
    return clampedMajor;
  }
  return fine;
}
