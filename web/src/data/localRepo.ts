import type { Booking, PlaceCard, Trip, TripSnapshot } from './model';
import type { Repo, TripSummary } from './repo';
import { stripUndefined } from './repo';

/** Single-device store in localStorage. Same interface as the cloud repo so the UI doesn't care. */

const KEY = (id: string) => `ping:trip:${id}`;
const INDEX = 'ping:trips';

interface Stored {
  trip: Trip;
  cards: Record<string, PlaceCard>;
  bookings: Record<string, Booking>;
}

function readIndex(): string[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function read(id: string): Stored | null {
  try {
    const raw = localStorage.getItem(KEY(id));
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

const listeners = new Map<string, Set<(s: TripSnapshot) => void>>();

function toSnapshot(s: Stored | null): TripSnapshot {
  if (!s) return { trip: null, cards: [], bookings: [] };
  return { trip: s.trip, cards: Object.values(s.cards), bookings: Object.values(s.bookings) };
}

function emit(id: string) {
  const snap = toSnapshot(read(id));
  listeners.get(id)?.forEach((cb) => cb(snap));
}

function write(id: string, mutate: (s: Stored) => void) {
  const s = read(id);
  if (!s) throw new Error('trip not found');
  mutate(s);
  localStorage.setItem(KEY(id), JSON.stringify(s));
  emit(id);
}

/** Merge that treats null as "remove the field", like Firestore's deleteField(). */
function merge<T extends object>(base: T, patch: Partial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(stripUndefined(patch))) {
    if (v === null) delete out[k];
    else if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = merge(out[k] as object, v as object);
    } else out[k] = v;
  }
  return out as T;
}

window.addEventListener('storage', (e) => {
  if (e.key?.startsWith('ping:trip:')) emit(e.key.slice('ping:trip:'.length));
});

export const localRepo: Repo = {
  kind: 'local',
  async listTrips() {
    return readIndex()
      .map((id) => read(id)?.trip)
      .filter((t): t is Trip => Boolean(t))
      .map<TripSummary>((t) => ({ id: t.id, name: t.name, startDate: t.startDate, endDate: t.endDate }));
  },
  async createTrip({ trip, cards, bookings }) {
    const stored: Stored = {
      trip: stripUndefined(trip),
      cards: Object.fromEntries(cards.map((c) => [c.id, stripUndefined(c)])),
      bookings: Object.fromEntries(bookings.map((b) => [b.id, stripUndefined(b)])),
    };
    localStorage.setItem(KEY(trip.id), JSON.stringify(stored));
    localStorage.setItem(INDEX, JSON.stringify([...new Set([...readIndex(), trip.id])]));
    return trip.id;
  },
  async joinTrip() {
    throw new Error('單機模式無法加入共享行程，請先設定 Firebase');
  },
  subscribe(tripId, cb) {
    const set = listeners.get(tripId) ?? new Set();
    set.add(cb);
    listeners.set(tripId, set);
    cb(toSnapshot(read(tripId)));
    return () => set.delete(cb);
  },
  async patchTrip(tripId, patch) {
    write(tripId, (s) => (s.trip = merge(s.trip, { ...patch, updatedAt: Date.now() })));
  },
  async putCard(tripId, card) {
    write(tripId, (s) => (s.cards[card.id] = stripUndefined({ ...card, updatedAt: Date.now() })));
  },
  async patchCard(tripId, id, patch) {
    write(tripId, (s) => {
      if (s.cards[id]) s.cards[id] = merge(s.cards[id], { ...patch, updatedAt: Date.now() });
    });
  },
  async deleteCard(tripId, id) {
    write(tripId, (s) => delete s.cards[id]);
  },
  async putBooking(tripId, booking) {
    write(tripId, (s) => (s.bookings[booking.id] = stripUndefined({ ...booking, updatedAt: Date.now() })));
  },
  async deleteBooking(tripId, id) {
    write(tripId, (s) => delete s.bookings[id]);
  },
  async deleteTrip(tripId) {
    localStorage.removeItem(KEY(tripId));
    localStorage.setItem(INDEX, JSON.stringify(readIndex().filter((x) => x !== tripId)));
  },
};
