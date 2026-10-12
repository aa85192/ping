import type { Booking, Expense, MemberProfile, PlaceCard, Trip, TripSnapshot } from './model';

export interface TripSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface Repo {
  kind: 'local' | 'cloud';
  listTrips(): Promise<TripSummary[]>;
  createTrip(seed: { trip: Trip; cards: PlaceCard[]; bookings: Booking[]; expenses?: Expense[] }): Promise<string>;
  /** Join a shared trip with its invite code (cloud only). */
  joinTrip(tripId: string, code: string, profile: MemberProfile): Promise<void>;
  subscribe(tripId: string, cb: (snap: TripSnapshot) => void, onError?: (e: Error) => void): () => void;
  patchTrip(tripId: string, patch: Partial<Trip>): Promise<void>;
  putCard(tripId: string, card: PlaceCard): Promise<void>;
  patchCard(tripId: string, id: string, patch: Partial<PlaceCard>): Promise<void>;
  deleteCard(tripId: string, id: string): Promise<void>;
  putBooking(tripId: string, booking: Booking): Promise<void>;
  deleteBooking(tripId: string, id: string): Promise<void>;
  putExpense(tripId: string, expense: Expense): Promise<void>;
  deleteExpense(tripId: string, id: string): Promise<void>;
  deleteTrip(tripId: string): Promise<void>;
}

/** Firestore rejects `undefined`; null clears a field in both stores. */
export function stripUndefined<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}
