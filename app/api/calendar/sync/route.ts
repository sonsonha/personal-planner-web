import { proxyPlannerRequest } from "@/lib/planner-backend";

/**
 * First-connect sync can create the Personal OS write calendar and list every
 * selected Google calendar — often >12s. Default proxy timeout was aborting
 * before push (retryCalendarSync), so new accounts looked "stuck syncing"
 * and never got true two-way sync.
 */
export const maxDuration = 90;

export async function POST(request: Request) {
  return proxyPlannerRequest({
    method: "POST",
    path: "/v2/calendar/sync",
    request,
    timeoutMs: 75_000,
  });
}
