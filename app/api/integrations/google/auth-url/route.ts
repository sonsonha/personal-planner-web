import { proxyPlannerRequest } from "@/lib/planner-backend";

export async function GET(request: Request) {
  return proxyPlannerRequest({
    method: "GET",
    path: "/v2/integrations/google/auth-url",
    request,
  });
}
