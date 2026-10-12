import type { FlightStatus, LatLng, LinkRef, OpeningPeriod, Status, TravelMode } from '@ping/shared';

export interface DayInfo {
  city: string;
  lat: number;
  lng: number;
  /** 'HH:mm' local time the day starts, used for time estimates. */
  startTime?: string;
  defaultMode?: TravelMode | null;
  title?: string;
  /** Start / end the day at that night's lodging (default true). */
  startAtLodging?: boolean;
  endAtLodging?: boolean;
  /** Travel mode for the leg from the lodging to the first stop. */
  startLegMode?: TravelMode | null;
}

export interface TagDef {
  id: string;
  label: string;
  color: string;
}

export interface MemberProfile {
  name: string;
  email?: string;
  photoURL?: string;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  travelers: number;
  homeCurrency: string;
  localCurrency: string;
  fxRate: number;
  timezone: string;
  defaultMode: TravelMode;
  days: Record<string, DayInfo>;
  tags: TagDef[];
  ownerUid?: string;
  members?: string[];
  memberProfiles?: Record<string, MemberProfile>;
  inviteCode?: string;
  updatedAt?: number;
}

export type BookingKind = 'flight' | 'lodging' | 'tour' | 'rail';

export interface Money {
  amount: number;
  currency: string;
}

export interface FlightInfo {
  no: string;
  airline?: string;
  from: string;
  to: string;
  fromName?: string;
  toName?: string;
  durationText?: string;
  terminalNote?: string;
  baggage?: string;
  /** Latest AI-looked-up status (terminal, gate, baggage belt…), shared by both travellers. */
  live?: FlightStatus | null;
}

export interface LodgingInfo {
  address?: string;
  nearby?: string;
  location?: LatLng | null;
  placeId?: string | null;
}

export interface Booking {
  id: string;
  kind: BookingKind;
  title: string;
  status: Status;
  /** ISO with offset, e.g. 2026-10-24T14:10:00+08:00, or a plain date. */
  start: string;
  end?: string | null;
  flight?: FlightInfo | null;
  lodging?: LodgingInfo | null;
  links: LinkRef[];
  amount?: Money | null;
  note?: string | null;
  deadline?: string | null;
  updatedAt?: number;
}

export type Memo =
  | { id: string; type: 'note'; text: string; updatedAt: number; by?: string }
  | { id: string; type: 'link'; url: string; kind: LinkRef['kind']; title?: string; updatedAt: number; by?: string };

export type ResolveState = 'pending' | 'resolved' | 'partial' | 'failed';

export interface PlaceCard {
  id: string;
  /** 'YYYY-MM-DD', or null when the card sits in the inbox. */
  day: string | null;
  /** Fractional ordering inside a day; lets two people reorder without rewriting every card. */
  order: number;
  sourceUrl: string;
  placeId?: string | null;
  name: string;
  address?: string | null;
  location?: LatLng | null;
  googleMapsUri?: string | null;
  photoUrl?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  primaryType?: string | null;
  openingPeriods?: OpeningPeriod[] | null;
  tags: string[];
  /** 'HH:mm' */
  plannedStart?: string | null;
  stayMinutes?: number | null;
  /** Travel mode for the leg from this card to the next one. */
  legMode?: TravelMode | null;
  memos: Memo[];
  resolveState: ResolveState;
  createdBy?: string | null;
  updatedAt?: number;
}

export interface TripSnapshot {
  trip: Trip | null;
  cards: PlaceCard[];
  bookings: Booking[];
}

export function newId(prefix = ''): string {
  const rand = crypto.getRandomValues(new Uint32Array(2));
  return prefix + Date.now().toString(36) + rand[0].toString(36) + rand[1].toString(36).slice(0, 4);
}

export function tripDates(trip: Pick<Trip, 'startDate' | 'endDate'>): string[] {
  const out: string[] = [];
  const d = new Date(`${trip.startDate}T00:00:00Z`);
  const end = new Date(`${trip.endDate}T00:00:00Z`);
  while (d <= end && out.length < 60) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
