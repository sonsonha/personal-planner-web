import { proxyPlannerRequest } from "@/lib/planner-backend";

/** DeepSeek Goal Structuring can take ~60–90s; must exceed backend AI_TIMEOUT_MS. */
export const maxDuration = 120;

export async function POST(request: Request) {
  return proxyPlannerRequest({
    method: "POST",
    path: "/v2/ai/goal-structure",
    request,
    timeoutMs: 100_000,
  });
}
