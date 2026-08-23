import { proxyPlannerRequest } from "@/lib/planner-backend";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return proxyPlannerRequest({
    method: "POST",
    path: "/v2/auth/onboarding/complete",
    request,
  });
}
