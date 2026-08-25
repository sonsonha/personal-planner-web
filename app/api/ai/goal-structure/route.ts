import { proxyPlannerRequest } from "@/lib/planner-backend";

/** Must exceed backend AI_TIMEOUT_MS (150s) for DeepSeek Goal Structuring. */
export const maxDuration = 180;

export async function POST(request: Request) {
  return proxyPlannerRequest({
    method: "POST",
    path: "/v2/ai/goal-structure",
    request,
    timeoutMs: 160_000,
  });
}
