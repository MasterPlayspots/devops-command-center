/**
 * Global Middleware — Rate Limiting via KV
 *
 * Limitiert API-Requests auf 60/min pro IP.
 * Chat-Endpoint strenger: 20/min.
 */

interface Env {
  RATE_LIMIT_KV: KVNamespace;
  API_UPSTREAM: string;
}

const LIMITS: Record<string, { requests: number; window: number }> = {
  "/api/chat": { requests: 20, window: 60 },
  "/api/": { requests: 60, window: 60 },
};

function getLimit(pathname: string): { requests: number; window: number } {
  // Spezifischere Route zuerst prüfen
  if (pathname === "/api/chat" || pathname === "/api/chat/stream") {
    return LIMITS["/api/chat"];
  }
  if (pathname.startsWith("/api/")) {
    return LIMITS["/api/"];
  }
  // Kein Limit für nicht-API-Routes
  return { requests: Infinity, window: 60 };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Nur API-Routes limitieren
  if (!url.pathname.startsWith("/api/")) {
    return next();
  }

  // KV nicht verfügbar → ohne Limit durchlassen
  if (!env.RATE_LIMIT_KV) {
    return next();
  }

  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown";

  const { requests: limit, window } = getLimit(url.pathname);

  if (limit === Infinity) {
    return next();
  }

  const windowKey = Math.floor(Date.now() / (window * 1000));
  const key = `rl:${ip}:${url.pathname.startsWith("/api/chat") ? "chat" : "api"}:${windowKey}`;

  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || "0");

  if (current >= limit) {
    return new Response(
      JSON.stringify({
        error: "Too Many Requests",
        retryAfter: window,
        limit,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(window),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String((windowKey + 1) * window),
        },
      }
    );
  }

  // Counter erhöhen
  await env.RATE_LIMIT_KV.put(key, String(current + 1), {
    expirationTtl: window * 2, // Doppeltes Fenster als TTL
  });

  // Request durchlassen
  const response = await next();

  // Rate-Limit Headers anhängen
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("X-RateLimit-Limit", String(limit));
  newResponse.headers.set("X-RateLimit-Remaining", String(limit - current - 1));
  newResponse.headers.set("X-RateLimit-Reset", String((windowKey + 1) * window));

  return newResponse;
};
