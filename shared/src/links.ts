import type { LatLng, LinkKind, TravelMode } from './types';
import { isGoogleMapsUrl } from './maps-url';

export function classifyLink(raw: string): LinkKind {
  let host = '';
  try {
    host = new URL(raw).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'web';
  }
  if (host === 'threads.net' || host === 'threads.com') return 'threads';
  if (host === 'instagram.com' || host === 'instagr.am') return 'instagram';
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') return 'youtube';
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'agoda.com' || host.endsWith('.agoda.com')) return 'agoda';
  if (/(^|\.)airbnb\.[a-z.]+$/.test(host)) return 'airbnb';
  if (isGoogleMapsUrl(raw)) return 'google-maps';
  return 'web';
}

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  threads: 'Threads',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  'google-maps': 'Google Maps',
  agoda: 'Agoda',
  airbnb: 'Airbnb',
  web: '網頁',
};

const MODE_PARAM: Record<TravelMode, string> = {
  WALK: 'walking',
  TRANSIT: 'transit',
  DRIVE: 'driving',
  BICYCLE: 'bicycling',
};

export interface MapsTarget {
  name?: string;
  placeId?: string;
  location?: LatLng;
}

function targetText(t: MapsTarget): string {
  if (t.location) return `${t.location.lat},${t.location.lng}`;
  return t.name ?? '';
}

/** Google Maps URLs (api=1): free, no key, opens the app on phones. */
export function mapsDirectionsUrl(origin: MapsTarget, destination: MapsTarget, mode: TravelMode): string {
  const p = new URLSearchParams({ api: '1', travelmode: MODE_PARAM[mode] });
  p.set('origin', targetText(origin));
  if (origin.placeId) p.set('origin_place_id', origin.placeId);
  p.set('destination', targetText(destination));
  if (destination.placeId) p.set('destination_place_id', destination.placeId);
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

export function mapsPlaceUrl(t: MapsTarget): string {
  const p = new URLSearchParams({ api: '1', query: t.name || targetText(t) });
  if (t.placeId) p.set('query_place_id', t.placeId);
  else if (t.location) p.set('query', targetText(t));
  return `https://www.google.com/maps/search/?${p.toString()}`;
}
