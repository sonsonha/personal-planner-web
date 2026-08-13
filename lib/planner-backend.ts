import { getChatGPTUser } from "@/app/chatgpt-auth";

type ProxyOptions = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  request: Request;
};

function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function plannerConfig() {
  const baseUrl = process.env.PLANNER_API_BASE_URL?.trim().replace(/\/$/, "");
  const token = process.env.PLANNER_WEB_TOKEN?.trim();
  if (!baseUrl || !token) return null;

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return null;
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || token.length < 32) return null;
  return { baseUrl, token };
}

export async function proxyPlannerRequest({ method, path, request }: ProxyOptions) {
  const viewer = await getChatGPTUser();
  if (process.env.NODE_ENV === "production" && !viewer) {
    return jsonError(401, "UNAUTHORIZED", "Sign in to access your planner");
  }

  const config = plannerConfig();
  if (!config) {
    return jsonError(
      503,
      "PLANNER_NOT_CONFIGURED",
      "The planner backend connection has not been configured yet",
    );
  }

  const headers = new Headers({
    accept: "application/json",
    authorization: `Bearer ${config.token}`,
  });
  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "DELETE") {
    headers.set("content-type", "application/json");
    body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const responseHeaders = new Headers({
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    });
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return jsonError(
      502,
      "PLANNER_UNAVAILABLE",
      "The planner backend is temporarily unavailable",
    );
  }
}

export async function routeId(
  params: Promise<{ id: string }> | { id: string },
): Promise<string | null> {
  const { id } = await Promise.resolve(params);
  if (!id || id.length > 200) return null;
  return encodeURIComponent(id);
}
