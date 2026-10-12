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

// Straight-line distance × detour factor ÷ typical speed, plus fixed overhead.
const PROFILE: Record<Exclude<TravelMode, 'TRANSIT'>, { kmh: number; detour: number; overheadMin: number }> = {
  WALK: { kmh: 4.5, detour: 1.3, overheadMin: 0 },
  BICYCLE: { kmh: 13, detour: 1.3, overheadMin: 2 },
  DRIVE: { kmh: 25, detour: 1.4, overheadMin: 5 },
};

// Japanese rail by trip length: metro / JR rapid & private lines / Shinkansen.
// Overhead covers walking to the platform, waiting and one transfer.
const RAIL: { maxKm: number; kmh: number; detour: number; overheadMin: number }[] = [
  { maxKm: 15, kmh: 28, detour: 1.25, overheadMin: 14 },
  { maxKm: 150, kmh: 55, detour: 1.15, overheadMin: 20 },
  { maxKm: Infinity, kmh: 200, detour: 1.15, overheadMin: 40 },
];

export function estimateLeg(a: LatLng, b: LatLng, mode: TravelMode): { durationSec: number; distanceM: number } {
  const straight = haversineM(a, b);
  // Very short hops are faster on foot than waiting for a train.
  if (mode === 'TRANSIT' && straight < 800) return estimateLeg(a, b, 'WALK');
  const p = mode === 'TRANSIT' ? RAIL.find((r) => straight / 1000 <= r.maxKm)! : PROFILE[mode];
  const distanceM = straight * p.detour;
  const minutes = (distanceM / 1000 / p.kmh) * 60 + p.overheadMin;
  return { durationSec: Math.round(minutes * 60), distanceM: Math.round(distanceM) };
}
