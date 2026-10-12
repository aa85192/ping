import type { Booking, PlaceCard, Trip } from '../data/model';
import type { DayAnchors } from './schedule';
import { addDays, wallDate } from './time';

/** The lodging you sleep in on the night of `night` (check-in ≤ night < check-out). */
export function lodgingForNight(bookings: Booking[], night: string): Booking | undefined {
  return bookings
    .filter((b) => b.kind === 'lodging' && b.start)
    .filter((b) => {
      const checkIn = wallDate(b.start);
      const checkOut = b.end ? wallDate(b.end) : addDays(checkIn, 1);
      return checkIn <= night && night < checkOut;
    })
    // A one-night hotel (e.g. 舞濱) wins over the long stay that overlaps it.
    .sort((a, b) => nights(a) - nights(b))[0];
}

function nights(b: Booking): number {
  const checkIn = wallDate(b.start);
  const checkOut = b.end ? wallDate(b.end) : addDays(checkIn, 1);
  return Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000);
}

function toAnchor(b: Booking, date: string, role: 'start' | 'end', trip: Trip): PlaceCard {
  return {
    id: `lodging:${b.id}:${role}`,
    day: date,
    order: role === 'start' ? -Infinity : Infinity,
    sourceUrl: '',
    name: b.title,
    placeId: b.lodging?.placeId ?? null,
    location: b.lodging?.location ?? null,
    address: b.lodging?.address ?? null,
    tags: [],
    memos: [],
    stayMinutes: 0,
    legMode: role === 'start' ? trip.days[date]?.startLegMode ?? null : null,
    resolveState: 'resolved',
  };
}

/** Where the day starts (last night's lodging) and ends (tonight's lodging). */
export function dayAnchors(date: string, trip: Trip, bookings: Booking[]): DayAnchors {
  const day = trip.days[date];
  const start = day?.startAtLodging === false ? undefined : lodgingForNight(bookings, addDays(date, -1));
  const end = day?.endAtLodging === false ? undefined : lodgingForNight(bookings, date);
  return {
    start: start ? toAnchor(start, date, 'start', trip) : undefined,
    end: end ? toAnchor(end, date, 'end', trip) : undefined,
  };
}
