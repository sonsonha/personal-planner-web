import { proxyPlannerRequest, routeId } from "@/lib/planner-backend";

type Context = { params: Promise<{ id: string }> | { id: string } };

export async function POST(request: Request, context: Context) {
  const id = await routeId(context.params);
  if (!id) return Response.json({ error: { code: "INVALID_ID" } }, { status: 400 });
  return proxyPlannerRequest({ method: "POST", path: `/v2/time-blocks/${id}/repeat`, request });
}
