import { proxyPlannerRequest } from "@/lib/planner-backend";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  return proxyPlannerRequest({
    method: "DELETE",
    path: "/v2/integrations/google",
    request,
  });
}
