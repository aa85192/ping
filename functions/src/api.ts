import type { RouteRequest } from '@ping/shared';
import { linkPreview, oembed } from './meta';
import { resolvePlace } from './resolve';
import { computeRoute } from './route';

const DAY = 86400;

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSec: number): Promise<void>;
}

export interface ApiDeps {
  mapsKey?: string;
  metaToken?: string;
  cache: Cache;
  fetchImpl?: typeof fetch;
}

export interface ApiRequest {
  method: string;
  /** Path as received; anything before "/api/" is ignored (hosting rewrite vs. direct function URL). */
  path: string;
  query: Record<string, string | undefined>;
  body: unknown;
}

export interface ApiResult {
  status: number;
  json: unknown;
}

async function cached<T>(cache: Cache, key: string, ttlSec: number, produce: () => Promise<T>, keep: (v: T) => boolean): Promise<T> {
  const hit = await cache.get<T>(key).catch(() => null);
  if (hit) return hit;
  const value = await produce();
  if (keep(value)) await cache.set(key, value, ttlSec).catch(() => {});
  return value;
}

export async function handleApi(req: ApiRequest, deps: ApiDeps): Promise<ApiResult> {
  const route = req.path.slice(Math.max(0, req.path.lastIndexOf('/api/')));
  const f = deps.fetchImpl ?? fetch;
  const body = (req.body ?? {}) as Record<string, unknown>;

  switch (route) {
    case '/api/health':
      return { status: 200, json: { ok: true, maps: Boolean(deps.mapsKey) } };

    case '/api/resolve-place': {
      if (req.method !== 'POST') break;
      const url = typeof body.url === 'string' ? body.url : '';
      if (!url) return { status: 400, json: { error: 'url required' } };
      const r = await cached(deps.cache, `resolve:${url}`, 30 * DAY, () => resolvePlace(url, deps.mapsKey, f), (v) => v.place?.quality === 'full');
      return { status: 200, json: r };
    }

    case '/api/route': {
      if (req.method !== 'POST') break;
      const r = body as unknown as RouteRequest;
      if (!r.origin || !r.destination || !r.mode) return { status: 400, json: { error: 'origin, destination, mode required' } };
      const hour = r.mode === 'TRANSIT' ? (r.departureTime ?? '').slice(0, 13) : '';
      const key = `route:${JSON.stringify([r.origin, r.destination, r.mode, hour])}`;
      const res = await cached(deps.cache, key, 7 * DAY, () => computeRoute(r, deps.mapsKey, f), (v) => v.source === 'routes-api');
      return { status: 200, json: res };
    }

    case '/api/oembed': {
      const url = req.query.url;
      if (!url) return { status: 400, json: { error: 'url required' } };
      const r = await cached(deps.cache, `oembed:${url}`, DAY, () => oembed(url, deps.metaToken, f), (v) => Boolean(v.html));
      return { status: 200, json: r };
    }

    case '/api/link-preview': {
      const url = req.query.url;
      if (!url) return { status: 400, json: { error: 'url required' } };
      const r = await cached(deps.cache, `preview:${url}`, 7 * DAY, () => linkPreview(url, f), (v) => Boolean(v.title));
      return { status: 200, json: r };
    }
  }
  return { status: 404, json: { error: 'not found' } };
}
