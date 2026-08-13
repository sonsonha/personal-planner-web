import { proxyPlannerRequest } from "@/lib/planner-backend";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyPlannerRequest({
    method: "GET",
    path: "/v2/integrations/status",
    request,
  });
}
