import { proxyPlannerRequest } from "@/lib/planner-backend";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function proxyFinance(
  method: Method,
  request: Request,
  pathSegments: string[] = [],
) {
  const url = new URL(request.url);
  const suffix = pathSegments.length ? `/${pathSegments.map(encodeURIComponent).join("/")}` : "";
  const path = `/v2/finance${suffix}${url.search}`;
  return proxyPlannerRequest({ method, path, request });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxyFinance("GET", request, path);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxyFinance("POST", request, path);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxyFinance("PATCH", request, path);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxyFinance("PUT", request, path);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxyFinance("DELETE", request, path);
}
