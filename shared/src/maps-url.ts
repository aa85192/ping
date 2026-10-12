import type { LatLng } from './types';

export interface ParsedMapsUrl {
  name?: string;
  location?: LatLng;
  placeId?: string;
  /** Feature id, e.g. "0x6001...:0x9a2..." */
  ftid?: string;
  /** Decimal customer id derived from ftid or ?cid= */
  cid?: string;
  /** Free-text query from ?q= / ?query= / /search/ */
  query?: string;
}

const SHORT_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co', 'share.google'];

function safeUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim());
  } catch {
    return null;
  }
}

/** Pull the first http(s) URL out of text such as "伏見稻荷大社 https://maps.app.goo.gl/xyz". */
export function extractFirstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"'）)]+/);
  return m ? m[0] : null;
}

export function isGoogleMapsUrl(raw: string): boolean {
  const u = safeUrl(raw);
  if (!u) return false;
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'maps.app.goo.gl' || host === 'share.google') return true;
  if (host === 'goo.gl' && u.pathname.startsWith('/maps')) return true;
  if (host === 'g.co' && u.pathname.startsWith('/kgs')) return true;
  if (/^maps\.google\.[a-z.]+$/.test(host)) return true;
  if (/^google\.[a-z.]+$/.test(host) && (u.pathname.startsWith('/maps') || u.searchParams.has('cid'))) return true;
  return false;
}

/** Short links need a server-side redirect follow before they can be parsed. */
export function isShortMapsUrl(raw: string): boolean {
  const u = safeUrl(raw);
  if (!u) return false;
  const host = u.hostname.replace(/^www\./, '');
  return SHORT_HOSTS.includes(host) && isGoogleMapsUrl(raw);
}

function decodeSegment(seg: string): string {
  try {
    return decodeURIComponent(seg.replace(/\+/g, ' ')).trim();
  } catch {
    return seg.replace(/\+/g, ' ').trim();
  }
}

function parseLatLng(text: string | null | undefined): LatLng | undefined {
  if (!text) return undefined;
  const m = text.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}

export function ftidToCid(ftid: string): string | undefined {
  const m = ftid.match(/^0x[0-9a-f]+:(0x[0-9a-f]+)$/i);
  if (!m) return undefined;
  try {
    return BigInt(m[1]).toString(10);
  } catch {
    return undefined;
  }
}

export function parseMapsUrl(raw: string): ParsedMapsUrl {
  const out: ParsedMapsUrl = {};
  const u = safeUrl(raw);
  if (!u) return out;

  const path = u.pathname;
  const full = u.href;

  // /maps/place/<name>/@lat,lng,zoom/data=...
  const placeMatch = path.match(/\/maps\/place\/([^/]+)/);
  if (placeMatch) {
    const name = decodeSegment(placeMatch[1]);
    const asLatLng = parseLatLng(name);
    if (asLatLng) out.location = asLatLng;
    else out.name = name;
  }

  // /maps/search/<query>/...
  const searchMatch = path.match(/\/maps\/search\/([^/]+)/);
  if (searchMatch) {
    const q = decodeSegment(searchMatch[1]);
    const asLatLng = parseLatLng(q);
    if (asLatLng) out.location ??= asLatLng;
    else out.query = q;
  }

  // Pin coordinates inside data= are the place itself; @ is only the viewport centre.
  const pin = full.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) {
    out.location = { lat: Number(pin[1]), lng: Number(pin[2]) };
  } else {
    const at = path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at && !out.location) out.location = { lat: Number(at[1]), lng: Number(at[2]) };
  }

  const ftidInData = full.match(/!1s(0x[0-9a-f]+(?::|%3A)0x[0-9a-f]+)/i);
  if (ftidInData) out.ftid = ftidInData[1].replace(/%3A/i, ':');

  const placeIdInData = full.match(/!19s(ChIJ[\w-]+)/);
  if (placeIdInData) out.placeId = placeIdInData[1];

  const sp = u.searchParams;
  const qpPlaceId = sp.get('query_place_id') ?? sp.get('place_id') ?? sp.get('destination_place_id');
  if (qpPlaceId) out.placeId = qpPlaceId;

  const ftidParam = sp.get('ftid');
  if (ftidParam) out.ftid = ftidParam;

  const cidParam = sp.get('cid');
  if (cidParam && /^\d+$/.test(cidParam)) out.cid = cidParam;
  if (!out.cid && out.ftid) out.cid = ftidToCid(out.ftid);

  for (const key of ['q', 'query', 'destination', 'daddr']) {
    const v = sp.get(key);
    if (!v) continue;
    if (v.startsWith('place_id:')) {
      out.placeId ??= v.slice('place_id:'.length);
      continue;
    }
    const ll = parseLatLng(v);
    if (ll) out.location ??= ll;
    else out.query ??= v.trim();
  }

  const ll = parseLatLng(sp.get('ll') ?? sp.get('center'));
  if (ll) out.location ??= ll;

  if (!out.name && out.query) out.name = out.query;
  return out;
}

export function hasUsefulData(p: ParsedMapsUrl): boolean {
  return Boolean(p.placeId || p.name || p.location || p.cid);
}
