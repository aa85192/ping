import {
  estimateLeg,
  extractFirstUrl,
  isGoogleMapsUrl,
  isShortMapsUrl,
  mapsPlaceUrl,
  parseMapsUrl,
  type LinkPreviewResponse,
  type OEmbedResponse,
  type ResolvedPlace,
  type ResolvePlaceResponse,
  type RouteRequest,
  type RouteResponse,
} from '@ping/shared';
import { cloudEnabled, getIdToken } from '../data/firebase';

// With Firebase configured the API is same-origin (/api/* is rewritten to the
// Cloud Function by Firebase Hosting, and proxied to the emulator in dev).
const OVERRIDE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '');
const BASE = OVERRIDE ?? '';
export const apiEnabled = cloudEnabled || Boolean(OVERRIDE);

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

export interface PasteInput {
  url: string | null;
  /** A place name taken from share text such as "通天閣\nhttps://maps.app.goo.gl/…". */
  nameHint: string | null;
}

export function readPaste(text: string): PasteInput {
  const url = extractFirstUrl(text);
  const rest = (url ? text.replace(url, '') : text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^https?:/.test(l));
  return { url, nameHint: rest[0]?.slice(0, 80) ?? null };
}

export interface ResolveOutcome {
  place: ResolvedPlace | null;
  sourceUrl: string;
  note?: string;
}

/**
 * Turn pasted text into a place. Order of preference:
 * Worker + Places API → URL parsing in the browser → share-text name only.
 */
export async function resolveFromText(text: string): Promise<ResolveOutcome> {
  const { url, nameHint } = readPaste(text);
  const target = url && isGoogleMapsUrl(url) ? url : nameHint ? mapsPlaceUrl({ name: nameHint }) : null;
  if (!target) return { place: null, sourceUrl: url ?? '', note: '找不到 Google Maps 網址或地點名稱' };

  if (apiEnabled) {
    try {
      const r = await call<ResolvePlaceResponse>('/api/resolve-place', { method: 'POST', body: JSON.stringify({ url: target }) });
      if (r.place) {
        if (r.place.quality === 'partial' && nameHint && r.place.name === '已釘選的位置') r.place.name = nameHint;
        return { place: r.place, sourceUrl: url ?? target, note: r.place.quality === 'partial' ? 'Google 沒找到完全相符的地點，先用網址中的位置' : undefined };
      }
    } catch {
      /* fall through to local parsing */
    }
  }

  if (url && isShortMapsUrl(url)) {
    return {
      place: nameHint ? { name: nameHint, quality: 'partial', googleMapsUri: url } : null,
      sourceUrl: url,
      note: '短網址需要 API 服務才能解析座標；已先用名稱建立卡片',
    };
  }
  const parsed = parseMapsUrl(target);
  const name = parsed.name ?? nameHint;
  if (!name && !parsed.location) return { place: null, sourceUrl: target, note: '網址中沒有地點資訊' };
  return {
    place: { name: name ?? '已釘選的位置', location: parsed.location, placeId: parsed.placeId, googleMapsUri: url ?? target, quality: 'partial' },
    sourceUrl: url ?? target,
  };
}

export async function fetchRoute(req: RouteRequest): Promise<RouteResponse> {
  if (apiEnabled) {
    try {
      return await call<RouteResponse>('/api/route', { method: 'POST', body: JSON.stringify(req) });
    } catch {
      /* fall back to estimate */
    }
  }
  if (req.origin.location && req.destination.location) {
    return { ...estimateLeg(req.origin.location, req.destination.location, req.mode), source: 'estimate' };
  }
  return { durationSec: null, distanceM: null, source: 'estimate', error: 'no-location' };
}

export async function fetchOEmbed(url: string): Promise<OEmbedResponse> {
  if (!apiEnabled) return { error: 'no-api' };
  try {
    return await call<OEmbedResponse>(`/api/oembed?url=${encodeURIComponent(url)}`);
  } catch (e) {
    return { error: String(e) };
  }
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewResponse> {
  if (!apiEnabled) return { error: 'no-api' };
  try {
    return await call<LinkPreviewResponse>(`/api/link-preview?url=${encodeURIComponent(url)}`);
  } catch (e) {
    return { error: String(e) };
  }
}
