import { estimateLeg, type RouteEndpoint, type RouteRequest, type RouteResponse } from '@ping/shared';

type Fetch = typeof fetch;

const FIELDS = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.transitDetails.transitLine.nameShort',
  'routes.legs.steps.transitDetails.transitLine.name',
].join(',');

function waypoint(e: RouteEndpoint) {
  if (e.placeId) return { placeId: e.placeId };
  if (e.location) return { location: { latLng: { latitude: e.location.lat, longitude: e.location.lng } } };
  throw new Error('endpoint needs placeId or location');
}

function fallback(req: RouteRequest, error: string): RouteResponse {
  if (req.origin.location && req.destination.location) {
    const est = estimateLeg(req.origin.location, req.destination.location, req.mode);
    return { ...est, source: 'estimate', error };
  }
  return { durationSec: null, distanceM: null, source: 'estimate', error };
}

interface RoutesResult {
  routes?: {
    duration?: string;
    distanceMeters?: number;
    legs?: { steps?: { travelMode?: string; transitDetails?: { transitLine?: { name?: string; nameShort?: string } } }[] }[];
  }[];
}

export async function computeRoute(req: RouteRequest, key: string | undefined, fetchImpl: Fetch = fetch): Promise<RouteResponse> {
  if (!key) return fallback(req, 'no-api-key');
  const body: Record<string, unknown> = {
    origin: waypoint(req.origin),
    destination: waypoint(req.destination),
    travelMode: req.mode,
    languageCode: 'zh-TW',
    units: 'METRIC',
  };
  if (req.mode === 'TRANSIT' && req.departureTime && Date.parse(req.departureTime) > Date.now()) {
    body.departureTime = req.departureTime;
  }
  try {
    const res = await fetchImpl('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify(body),
    });
    if (!res.ok) return fallback(req, `routes ${res.status}`);
    const data = (await res.json()) as RoutesResult;
    const route = data.routes?.[0];
    if (!route?.duration) return fallback(req, 'no-route');
    const lines = (route.legs ?? [])
      .flatMap((l) => l.steps ?? [])
      .filter((s) => s.travelMode === 'TRANSIT')
      .map((s) => s.transitDetails?.transitLine?.nameShort || s.transitDetails?.transitLine?.name)
      .filter((x): x is string => Boolean(x));
    const summary = [...new Set(lines)].join(' → ') || undefined;
    return {
      durationSec: Number.parseInt(route.duration, 10),
      distanceM: route.distanceMeters ?? null,
      summary,
      source: 'routes-api',
    };
  } catch (e) {
    return fallback(req, String(e));
  }
}
