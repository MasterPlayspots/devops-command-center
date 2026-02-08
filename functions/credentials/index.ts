/**
 * Credential Management — Pages Function
 *
 * Speichert und liest verschlüsselte Credentials aus KV.
 * Auth: X-API-Key Header (muss gegen api_keys in D1 geprüft werden).
 */

interface Env {
  CREDENTIALS_STORE: KVNamespace;
}

// GET /credentials — Credentials laden
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await env.CREDENTIALS_STORE.get(`user:${apiKey}:credentials`);
  return new Response(data || "{}", {
    headers: { "Content-Type": "application/json" },
  });
};

// PUT /credentials — Credentials speichern
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.text();

  // Validierung: muss gültiges JSON sein
  try {
    JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await env.CREDENTIALS_STORE.put(`user:${apiKey}:credentials`, body, {
    expirationTtl: 60 * 60 * 24 * 90, // 90 Tage TTL
  });

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// DELETE /credentials — Einzelnen Connector löschen
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const connector = url.searchParams.get("connector");

  if (!connector) {
    return new Response(JSON.stringify({ error: "Missing connector parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const existing = await env.CREDENTIALS_STORE.get(`user:${apiKey}:credentials`);
  if (existing) {
    const parsed = JSON.parse(existing);
    delete parsed[connector];
    await env.CREDENTIALS_STORE.put(
      `user:${apiKey}:credentials`,
      JSON.stringify(parsed)
    );
  }

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
