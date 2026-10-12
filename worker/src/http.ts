import type { Env } from './env';

export function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : allowed[0] ?? '',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init.headers ?? {}) },
  });
}

/** Cache a JSON result under a synthetic GET key using the Workers Cache API. */
export async function cached<T>(key: string, ttlSec: number, produce: () => Promise<T>, shouldCache: (v: T) => boolean): Promise<T> {
  const cache = (caches as unknown as { default: Cache }).default;
  const req = new Request(`https://cache.ping.internal/${encodeURIComponent(key)}`);
  const hit = await cache.match(req);
  if (hit) return (await hit.json()) as T;
  const value = await produce();
  if (shouldCache(value)) {
    await cache.put(req, json(value, { headers: { 'Cache-Control': `public, max-age=${ttlSec}` } }));
  }
  return value;
}
