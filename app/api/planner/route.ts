import { proxyPlannerRequest } from "@/lib/planner-backend";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return proxyPlannerRequest({
    method: "GET",
    path: `/v2/planner${url.search}`,
    request,
  });
}
