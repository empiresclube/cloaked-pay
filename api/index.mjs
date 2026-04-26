/**
 * Vercel serverless entry — adapts the TanStack Start fetch handler
 * (Web Standard Request/Response) to the Vercel Node runtime.
 *
 * The TanStack Start build emits dist/server/server.js with a default
 * export shaped like { fetch(request: Request): Promise<Response> }.
 * Vercel's Node runtime gives us (req, res) so we bridge the two.
 */
// @ts-expect-error - resolved at build time, file exists in dist/server/
import server from "../dist/server/server.js";

export const config = {
  // Use Node runtime (TanStack Start uses node:async_hooks etc).
  runtime: "nodejs20.x",
};

function buildRequestUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}${req.url}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  try {
    const url = buildRequestUrl(req);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
      else if (v != null) headers.set(k, String(v));
    }

    const init = { method: req.method, headers };
    if (req.method && !["GET", "HEAD"].includes(req.method.toUpperCase())) {
      init.body = await readBody(req);
    }

    const request = new Request(url, init);
    const response = await server.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }
    res.end();
  } catch (err) {
    console.error("[vercel handler]", err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
}
