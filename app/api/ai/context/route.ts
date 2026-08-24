import { proxyPlannerRequest } from "@/lib/planner-backend";

export async function GET(request: Request) {
  return proxyPlannerRequest({ method: "GET", path: "/v2/ai/context", request });
}

export async function PUT(request: Request) {
  return proxyPlannerRequest({ method: "PUT", path: "/v2/ai/context", request });
}
