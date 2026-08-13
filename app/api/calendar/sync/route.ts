import { proxyPlannerRequest } from "@/lib/planner-backend";

export async function POST(request: Request) {
  return proxyPlannerRequest({ method: "POST", path: "/v2/calendar/sync", request });
}
