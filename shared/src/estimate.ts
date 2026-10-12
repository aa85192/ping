import type { LatLng, TravelMode } from './types';

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Straight-line distance × detour factor ÷ typical urban speed, plus fixed overhead.
const PROFILE: Record<TravelMode, { kmh: number; detour: number; overheadMin: number }> = {
  WALK: { kmh: 4.5, detour: 1.3, overheadMin: 0 },
  BICYCLE: { kmh: 13, detour: 1.3, overheadMin: 2 },
  DRIVE: { kmh: 25, detour: 1.4, overheadMin: 5 },
  // Japanese urban rail incl. walking to/from stations and one transfer.
  TRANSIT: { kmh: 28, detour: 1.25, overheadMin: 14 },
};

export function estimateLeg(a: LatLng, b: LatLng, mode: TravelMode): { durationSec: number; distanceM: number } {
  const straight = haversineM(a, b);
  // Very short hops are faster on foot than waiting for a train.
  if (mode === 'TRANSIT' && straight < 800) return estimateLeg(a, b, 'WALK');
  const p = PROFILE[mode];
  const distanceM = straight * p.detour;
  const minutes = (distanceM / 1000 / p.kmh) * 60 + p.overheadMin;
  return { durationSec: Math.round(minutes * 60), distanceM: Math.round(distanceM) };
}
