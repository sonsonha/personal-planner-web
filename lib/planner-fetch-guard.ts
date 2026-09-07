/** Decide whether a planner fetch response may replace Calendar state. */
export function shouldApplyPlannerFetch(options: {
  aborted: boolean;
  requestSeq: number;
  latestSeq: number;
}): boolean {
  if (options.aborted) return false;
  if (options.requestSeq !== options.latestSeq) return false;
  return true;
}
