import { proxyPlannerRequest, routeId } from "@/lib/planner-backend";

type Context = { params: Promise<{ id: string }> | { id: string } };

export async function GET(request: Request, context: Context) {
  const id = await routeId(context.params);
  if (!id) return Response.json({ error: { code: "INVALID_ID" } }, { status: 400 });
  return proxyPlannerRequest({ method: "GET", path: `/v2/tasks/${id}/time-blocks`, request });
}
