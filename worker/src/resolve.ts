import {
  haversineM,
  isGoogleMapsUrl,
  isShortMapsUrl,
  parseMapsUrl,
  type OpeningPeriod,
  type ParsedMapsUrl,
  type ResolvedPlace,
  type ResolvePlaceResponse,
} from '@ping/shared';

type Fetch = typeof fetch;

const PLACES = 'https://places.googleapis.com/v1';
const DETAIL_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'googleMapsUri',
  'rating',
  'userRatingCount',
  'primaryType',
  'regularOpeningHours.periods',
  'photos',
].join(',');

/** Follow redirects by hand so we can see (and stop at) each hop. */
export async function expandUrl(url: string, fetchImpl: Fetch = fetch, maxHops = 6): Promise<string> {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    if (!isShortMapsUrl(current) && !current.includes('consent.google.')) break;
    const u = new URL(current);
    if (u.hostname.startsWith('consent.google.')) {
      const cont = u.searchParams.get('continue');
      if (!cont) break;
      current = cont;
      continue;
    }
    const res = await fetchImpl(current, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 PingTripBot' } });
    const loc = res.headers.get('Location');
    if (!loc) break;
    current = new URL(loc, current).href;
  }
  return current;
}

function similarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-・·,，、()（）]/g, '');
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.8;
  const setY = new Set(y);
  let common = 0;
  for (const ch of new Set(x)) if (setY.has(ch)) common++;
  return common / Math.max(new Set(x).size, setY.size);
}

interface PlacesTextResult {
  places?: { id: string; displayName?: { text: string }; location?: { latitude: number; longitude: number } }[];
}

async function findPlaceId(parsed: ParsedMapsUrl, key: string, fetchImpl: Fetch): Promise<string | undefined> {
  const textQuery = parsed.name ?? parsed.query;
  if (!textQuery) return undefined;
  const body: Record<string, unknown> = { textQuery, languageCode: 'zh-TW', pageSize: 5 };
  if (parsed.location) {
    body.locationBias = {
      circle: { center: { latitude: parsed.location.lat, longitude: parsed.location.lng }, radius: 500 },
    };
  }
  const res = await fetchImpl(`${PLACES}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`searchText ${res.status}`);
  const data = (await res.json()) as PlacesTextResult;
  const candidates = data.places ?? [];
  if (!candidates.length) return undefined;
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const c of candidates) {
    let score = similarity(textQuery, c.displayName?.text ?? '');
    if (parsed.location && c.location) {
      const d = haversineM(parsed.location, { lat: c.location.latitude, lng: c.location.longitude });
      score += d < 100 ? 1 : d < 500 ? 0.5 : d < 2000 ? 0 : -1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best.id;
}

interface PlaceDetails {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  regularOpeningHours?: { periods?: OpeningPeriod[] };
  photos?: { name: string }[];
}

async function getDetails(placeId: string, key: string, fetchImpl: Fetch): Promise<ResolvedPlace> {
  const res = await fetchImpl(`${PLACES}/places/${encodeURIComponent(placeId)}?languageCode=zh-TW`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': DETAIL_FIELDS },
  });
  if (!res.ok) throw new Error(`details ${res.status}`);
  const d = (await res.json()) as PlaceDetails;
  let photoUrl: string | undefined;
  const photo = d.photos?.[0];
  if (photo) {
    // skipHttpRedirect returns a googleusercontent URL that carries no API key.
    const p = await fetchImpl(`${PLACES}/${photo.name}/media?maxWidthPx=640&skipHttpRedirect=true`, {
      headers: { 'X-Goog-Api-Key': key },
    });
    if (p.ok) photoUrl = ((await p.json()) as { photoUri?: string }).photoUri;
  }
  return {
    placeId: d.id,
    name: d.displayName?.text ?? '',
    address: d.formattedAddress,
    location: d.location ? { lat: d.location.latitude, lng: d.location.longitude } : undefined,
    googleMapsUri: d.googleMapsUri,
    photoUrl,
    rating: d.rating,
    userRatingCount: d.userRatingCount,
    primaryType: d.primaryType,
    openingPeriods: d.regularOpeningHours?.periods,
    quality: 'full',
  };
}

function partial(parsed: ParsedMapsUrl, expandedUrl: string): ResolvedPlace | null {
  if (!parsed.name && !parsed.location) return null;
  return {
    placeId: parsed.placeId,
    name: parsed.name ?? '已釘選的位置',
    location: parsed.location,
    googleMapsUri: expandedUrl,
    quality: 'partial',
  };
}

export async function resolvePlace(url: string, key: string | undefined, fetchImpl: Fetch = fetch): Promise<ResolvePlaceResponse> {
  if (!isGoogleMapsUrl(url)) return { expandedUrl: url, place: null, error: '不是 Google Maps 網址' };
  const expandedUrl = await expandUrl(url, fetchImpl);
  const parsed = parseMapsUrl(expandedUrl);
  if (!key) return { expandedUrl, place: partial(parsed, expandedUrl), error: 'no-api-key' };
  try {
    const placeId = parsed.placeId ?? (await findPlaceId(parsed, key, fetchImpl));
    if (!placeId) return { expandedUrl, place: partial(parsed, expandedUrl), error: 'not-found' };
    return { expandedUrl, place: await getDetails(placeId, key, fetchImpl) };
  } catch (e) {
    return { expandedUrl, place: partial(parsed, expandedUrl), error: String(e) };
  }
}
