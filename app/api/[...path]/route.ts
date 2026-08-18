import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const baseUrl = process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3001";
  const target = new URL(`/api/${path.join("/")}${request.nextUrl.search}`, baseUrl);
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return Response.json({ error: "ApplyPilot API is unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const outgoing = new Headers();
  for (const name of ["content-type", "set-cookie", "ratelimit", "ratelimit-policy", "retry-after"]) {
    const value = response.headers.get(name);
    if (value) outgoing.set(name, value);
  }
  outgoing.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, headers: outgoing });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
