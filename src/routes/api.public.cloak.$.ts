import { createFileRoute } from "@tanstack/react-router";

const CLOAK_DEVNET_RELAY = "https://api.devnet.cloak.ag";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin",
};

async function proxyToCloak({
  request,
  params,
}: {
  request: Request;
  params: { _splat?: string };
}) {
  const path = params._splat ?? "";
  if (path.includes("..")) {
    return Response.json({ error: "Invalid relay path" }, { status: 400 });
  }

  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${CLOAK_DEVNET_RELAY}/${path}`);
  targetUrl.search = sourceUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");
  const authorization = request.headers.get("authorization");
  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  if (authorization) headers.set("authorization", authorization);

  const body = request.method === "GET" ? undefined : await request.arrayBuffer();
  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  const responseHeaders = new Headers(corsHeaders);
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) responseHeaders.set("content-type", upstreamType);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const Route = createFileRoute("/api/public/cloak/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: proxyToCloak,
      POST: proxyToCloak,
    },
  },
});