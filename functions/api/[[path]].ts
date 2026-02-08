/**
 * API Proxy — Pages Function
 *
 * Leitet alle /api/* Anfragen an den Backend-Worker weiter.
 * Die Worker-URL bleibt serverseitig (env.API_UPSTREAM) und
 * ist im Client-Bundle NICHT sichtbar.
 */

interface Env {
  API_UPSTREAM: string; // z.B. "cf-ai-workspace.ourark.workers.dev"
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;

  // Upstream-URL zusammenbauen
  const upstream = env.API_UPSTREAM || "cf-ai-workspace.ourark.workers.dev";
  const pathSegments = Array.isArray(params.path) ? params.path.join("/") : params.path || "";
  const url = new URL(request.url);
  const targetUrl = `https://${upstream}/${pathSegments}${url.search}`;

  // CORS Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": url.origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, CF-Access-Jwt-Assertion",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Request an Backend-Worker weiterleiten
  const headers = new Headers(request.headers);
  headers.set("X-Forwarded-Host", url.hostname);
  headers.delete("host");

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      // @ts-ignore — Cloudflare-spezifisch
      cf: { cacheTtl: 0 },
    });

    // Response klonen und Security-Headers setzen
    const response = new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: upstreamResponse.headers,
    });

    // CORS für gleiche Origin setzen
    response.headers.set("Access-Control-Allow-Origin", url.origin);
    response.headers.set("X-Proxied-By", "pages-function");

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown proxy error";
    return new Response(
      JSON.stringify({
        error: "Upstream unreachable",
        detail: message,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
