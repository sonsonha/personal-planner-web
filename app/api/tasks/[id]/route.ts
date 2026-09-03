import { proxyPlannerRequest, routeId } from "@/lib/planner-backend";

type Context = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(request: Request, context: Context) {
  const id = await routeId(context.params);
  if (!id) return Response.json({ error: { code: "INVALID_ID" } }, { status: 400 });
  return proxyPlannerRequest({ method: "PATCH", path: `/v2/tasks/${id}`, request });
}

export async function DELETE(request: Request, context: Context) {
  const id = await routeId(context.params);
  if (!id) return Response.json({ error: { code: "INVALID_ID" } }, { status: 400 });
  const url = new URL(request.url);
  const seriesScope = url.searchParams.get("seriesScope");
  const query = seriesScope ? `?seriesScope=${encodeURIComponent(seriesScope)}` : "";
  return proxyPlannerRequest({ method: "DELETE", path: `/v2/tasks/${id}${query}`, request });
}
