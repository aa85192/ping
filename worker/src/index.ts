import type { RouteRequest } from '@ping/shared';
import { checkAuth } from './auth';
import type { Env } from './env';
import { cached, corsHeaders, json } from './http';
import { linkPreview, oembed } from './meta';
import { resolvePlace } from './resolve';
import { computeRoute } from './route';

const DAY = 86400;

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const authError = await checkAuth(req, env);
  if (authError) return json({ error: authError }, { status: 401 });

  switch (url.pathname) {
    case '/api/health':
      return json({ ok: true, maps: Boolean(env.GOOGLE_MAPS_SERVER_KEY) });

    case '/api/resolve-place': {
      if (req.method !== 'POST') break;
      const { url: target } = (await req.json()) as { url?: string };
      if (!target) return json({ error: 'url required' }, { status: 400 });
      const result = await cached(`resolve:${target}`, 30 * DAY, () => resolvePlace(target, env.GOOGLE_MAPS_SERVER_KEY), (r) => r.place?.quality === 'full');
      return json(result);
    }

    case '/api/route': {
      if (req.method !== 'POST') break;
      const body = (await req.json()) as RouteRequest;
      const hour = body.departureTime?.slice(0, 13) ?? '';
      const key = `route:${JSON.stringify([body.origin, body.destination, body.mode, body.mode === 'TRANSIT' ? hour : ''])}`;
      const result = await cached(key, 7 * DAY, () => computeRoute(body, env.GOOGLE_MAPS_SERVER_KEY), (r) => r.source === 'routes-api');
      return json(result);
    }

    case '/api/oembed': {
      const target = url.searchParams.get('url');
      if (!target) return json({ error: 'url required' }, { status: 400 });
      const result = await cached(`oembed:${target}`, DAY, () => oembed(target, env.META_ACCESS_TOKEN), (r) => Boolean(r.html));
      return json(result);
    }

    case '/api/link-preview': {
      const target = url.searchParams.get('url');
      if (!target) return json({ error: 'url required' }, { status: 400 });
      const result = await cached(`preview:${target}`, 7 * DAY, () => linkPreview(target), (r) => Boolean(r.title));
      return json(result);
    }
  }
  return json({ error: 'not found' }, { status: 404 });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res: Response;
    try {
      res = await handle(req, env);
    } catch (e) {
      res = json({ error: String(e) }, { status: 500 });
    }
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
};
