import { describe, expect, it, vi } from 'vitest';
import { handleApi } from './api';
import { expandUrl, resolvePlace } from './resolve';
import { computeRoute } from './route';
import { readOgTags } from './meta';

const PLACE_URL =
  'https://www.google.com/maps/place/%E9%80%9A%E5%A4%A9%E9%96%A3/@34.65,135.50,17z/data=!3m1!4b1!4m6!3m5!1s0x6000e7b3:0x1a2b!8m2!3d34.6524992!4d135.5063041';

function res(body: unknown, init: ResponseInit = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), init);
}

describe('expandUrl', () => {
  it('follows short-link redirects hop by hop', async () => {
    const f = vi.fn(async () => res('', { status: 302, headers: { Location: PLACE_URL } }));
    expect(await expandUrl('https://maps.app.goo.gl/abc', f as unknown as typeof fetch)).toBe(PLACE_URL);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('unwraps consent.google.com', async () => {
    const consent = `https://consent.google.com/m?continue=${encodeURIComponent(PLACE_URL)}`;
    const f = vi.fn(async () => res('', { status: 302, headers: { Location: consent } }));
    expect(await expandUrl('https://maps.app.goo.gl/abc', f as unknown as typeof fetch)).toBe(PLACE_URL);
  });
});

describe('resolvePlace', () => {
  it('returns a partial place from the URL when there is no API key', async () => {
    const r = await resolvePlace(PLACE_URL, undefined, vi.fn() as unknown as typeof fetch);
    expect(r.place).toMatchObject({ name: '通天閣', quality: 'partial', location: { lat: 34.6524992, lng: 135.5063041 } });
  });

  it('searches, picks the closest match and loads details', async () => {
    const f = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.endsWith('places:searchText')) {
        return res({
          places: [
            { id: 'far', displayName: { text: '通天閣' }, location: { latitude: 35.0, longitude: 135.9 } },
            { id: 'near', displayName: { text: '通天閣' }, location: { latitude: 34.6525, longitude: 135.5063 } },
          ],
        });
      }
      if (u.includes('/places/near?')) {
        return res({
          id: 'near',
          displayName: { text: '通天閣' },
          formattedAddress: '大阪市浪速區',
          location: { latitude: 34.6525, longitude: 135.5063 },
          googleMapsUri: 'https://maps.google.com/?cid=1',
          rating: 4.2,
          photos: [{ name: 'places/near/photos/p1' }],
        });
      }
      if (u.includes('/photos/p1/media')) return res({ photoUri: 'https://lh3.googleusercontent.com/x' });
      throw new Error(`unexpected ${u}`);
    });
    const r = await resolvePlace(PLACE_URL, 'KEY', f as unknown as typeof fetch);
    expect(r.place).toMatchObject({ placeId: 'near', quality: 'full', rating: 4.2, photoUrl: 'https://lh3.googleusercontent.com/x' });
  });

  it('rejects non-maps URLs', async () => {
    const r = await resolvePlace('https://example.com', 'KEY');
    expect(r.place).toBeNull();
  });
});

describe('computeRoute', () => {
  const a = { location: { lat: 34.6496, lng: 135.5013 } };
  const b = { location: { lat: 34.9858, lng: 135.7588 } };

  it('falls back to an estimate when the API has no transit route (e.g. Japan coverage gap)', async () => {
    const f = vi.fn(async () => res({}));
    const r = await computeRoute({ origin: a, destination: b, mode: 'TRANSIT' }, 'KEY', f as unknown as typeof fetch);
    expect(r.source).toBe('estimate');
    expect(r.durationSec).toBeGreaterThan(0);
    expect(r.error).toBe('no-route');
  });

  it('parses duration, distance and line names', async () => {
    const f = vi.fn(async () =>
      res({
        routes: [
          {
            duration: '2520s',
            distanceMeters: 45000,
            legs: [{ steps: [{ travelMode: 'WALK' }, { travelMode: 'TRANSIT', transitDetails: { transitLine: { nameShort: 'JR京都線' } } }] }],
          },
        ],
      }),
    );
    const r = await computeRoute({ origin: a, destination: b, mode: 'TRANSIT' }, 'KEY', f as unknown as typeof fetch);
    expect(r).toMatchObject({ durationSec: 2520, distanceM: 45000, summary: 'JR京都線', source: 'routes-api' });
  });
});

describe('readOgTags', () => {
  it('reads og tags in either attribute order', () => {
    const html = `<head><meta property="og:title" content="Apartment Hotel 11 &amp; Co"><meta content="https://img/x.jpg" property="og:image"></head>`;
    expect(readOgTags(html)).toMatchObject({ title: 'Apartment Hotel 11 & Co', image: 'https://img/x.jpg' });
  });
});

describe('handleApi', () => {
  const memCache = () => {
    const m = new Map<string, unknown>();
    return {
      store: m,
      async get<T>(k: string) {
        return (m.get(k) as T) ?? null;
      },
      async set(k: string, v: unknown) {
        m.set(k, v);
      },
    };
  };

  it('routes regardless of the path prefix and caches only real API results', async () => {
    const cache = memCache();
    const f = vi.fn(async () => res({ routes: [{ duration: '600s', distanceMeters: 800 }] }));
    const body = { origin: { placeId: 'A' }, destination: { placeId: 'B' }, mode: 'WALK' };
    const r1 = await handleApi({ method: 'POST', path: '/ping/asia-east1/api/api/route', query: {}, body }, { mapsKey: 'K', cache, fetchImpl: f as unknown as typeof fetch });
    expect(r1).toMatchObject({ status: 200, json: { durationSec: 600, source: 'routes-api' } });
    await handleApi({ method: 'POST', path: '/api/route', query: {}, body }, { mapsKey: 'K', cache, fetchImpl: f as unknown as typeof fetch });
    expect(f).toHaveBeenCalledTimes(1);

    const est = await handleApi(
      { method: 'POST', path: '/api/route', query: {}, body: { origin: { location: { lat: 34.6, lng: 135.5 } }, destination: { location: { lat: 34.7, lng: 135.5 } }, mode: 'WALK' } },
      { cache },
    );
    expect(est.json).toMatchObject({ source: 'estimate' });
    expect(cache.store.size).toBe(1);
  });

  it('validates input and 404s unknown routes', async () => {
    const cache = memCache();
    expect((await handleApi({ method: 'POST', path: '/api/resolve-place', query: {}, body: {} }, { cache })).status).toBe(400);
    expect((await handleApi({ method: 'GET', path: '/api/nope', query: {}, body: null }, { cache })).status).toBe(404);
  });
});
