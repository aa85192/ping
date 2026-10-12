import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import type { Booking, Expense, PlaceCard, Trip, TripSnapshot } from './model';
import type { Repo } from './repo';
import { stripUndefined } from './repo';

/** Recursively turn `null` into deleteField() so patches can clear values. */
function toPatch(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v === null) out[k] = deleteField();
    else if (typeof v === 'object' && !Array.isArray(v)) out[k] = toPatch(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

function withoutNulls<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (v === null ? undefined : v))) as T;
}

export async function createCloudRepo(): Promise<Repo> {
  const { app, auth } = await getFirebase();
  const db: Firestore = initializeFirestore(app, {
    // Offline-first: reads come from the on-device cache, writes queue while offline.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });
  const uid = () => {
    const u = auth.currentUser;
    if (!u) throw new Error('not signed in');
    return u.uid;
  };
  const tripRef = (id: string) => doc(db, 'trips', id);
  const cardRef = (t: string, id: string) => doc(db, 'trips', t, 'cards', id);
  const bookingRef = (t: string, id: string) => doc(db, 'trips', t, 'bookings', id);
  const expenseRef = (t: string, id: string) => doc(db, 'trips', t, 'expenses', id);

  return {
    kind: 'cloud',
    async listTrips() {
      const snap = await getDocs(query(collection(db, 'trips'), where('members', 'array-contains', uid())));
      return snap.docs.map((d) => {
        const t = d.data() as Trip;
        return { id: d.id, name: t.name, startDate: t.startDate, endDate: t.endDate };
      });
    },
    async createTrip({ trip, cards, bookings, expenses = [] }) {
      const me = auth.currentUser!;
      const full: Trip = {
        ...trip,
        ownerUid: me.uid,
        members: [me.uid],
        memberProfiles: { [me.uid]: { name: me.displayName ?? '我', email: me.email ?? undefined, photoURL: me.photoURL ?? undefined } },
        inviteCode: Math.random().toString(36).slice(2, 10),
      };
      // The trip doc must exist before rules let us write its subcollections.
      await setDoc(tripRef(trip.id), withoutNulls(stripUndefined(full)));
      const batch = writeBatch(db);
      for (const c of cards) batch.set(cardRef(trip.id, c.id), withoutNulls(stripUndefined(c)));
      for (const b of bookings) batch.set(bookingRef(trip.id, b.id), withoutNulls(stripUndefined(b)));
      for (const e of expenses) batch.set(expenseRef(trip.id, e.id), withoutNulls(stripUndefined(e)));
      await batch.commit();
      return trip.id;
    },
    async joinTrip(tripId, code, profile) {
      await updateDoc(tripRef(tripId), {
        members: arrayUnion(uid()),
        lastJoinCode: code,
        [`memberProfiles.${uid()}`]: stripUndefined(profile),
      });
    },
    subscribe(tripId, cb, onError) {
      const state: TripSnapshot = { trip: null, cards: [], bookings: [], expenses: [] };
      let ready = 0;
      let tripReady = false;
      const push = () => ready >= 4 && cb({ ...state });
      const err = (e: Error) => onError?.(e);
      const u1 = onSnapshot(
        tripRef(tripId),
        (d) => {
          state.trip = d.exists() ? ({ ...(d.data() as Trip), id: d.id } as Trip) : null;
          if (!tripReady) {
            tripReady = true;
            ready++;
          }
          push();
        },
        err,
      );
      let cardsReady = false;
      const u2 = onSnapshot(
        collection(db, 'trips', tripId, 'cards'),
        (s) => {
          state.cards = s.docs.map((d) => ({ ...(d.data() as PlaceCard), id: d.id }));
          if (!cardsReady) {
            cardsReady = true;
            ready++;
          }
          push();
        },
        err,
      );
      let bookingsReady = false;
      const u3 = onSnapshot(
        collection(db, 'trips', tripId, 'bookings'),
        (s) => {
          state.bookings = s.docs.map((d) => ({ ...(d.data() as Booking), id: d.id }));
          if (!bookingsReady) {
            bookingsReady = true;
            ready++;
          }
          push();
        },
        err,
      );
      let expensesReady = false;
      const u4 = onSnapshot(
        collection(db, 'trips', tripId, 'expenses'),
        (s) => {
          state.expenses = s.docs.map((d) => ({ ...(d.data() as Expense), id: d.id }));
          if (!expensesReady) {
            expensesReady = true;
            ready++;
          }
          push();
        },
        err,
      );
      return () => {
        u1();
        u2();
        u3();
        u4();
      };
    },
    async patchTrip(tripId, patch) {
      await setDoc(tripRef(tripId), toPatch({ ...patch, updatedAt: Date.now() }), { merge: true });
    },
    async putCard(tripId, card) {
      await setDoc(cardRef(tripId, card.id), withoutNulls(stripUndefined({ ...card, createdBy: card.createdBy ?? uid(), updatedAt: Date.now() })));
    },
    async patchCard(tripId, id, patch) {
      await setDoc(cardRef(tripId, id), toPatch({ ...patch, updatedAt: Date.now() }), { merge: true });
    },
    async deleteCard(tripId, id) {
      await deleteDoc(cardRef(tripId, id));
    },
    async putBooking(tripId, booking) {
      await setDoc(bookingRef(tripId, booking.id), withoutNulls(stripUndefined({ ...booking, updatedAt: Date.now() })));
    },
    async deleteBooking(tripId, id) {
      await deleteDoc(bookingRef(tripId, id));
    },
    async putExpense(tripId, expense) {
      await setDoc(expenseRef(tripId, expense.id), withoutNulls(stripUndefined({ ...expense, updatedAt: Date.now() })));
    },
    async deleteExpense(tripId, id) {
      await deleteDoc(expenseRef(tripId, id));
    },
    async deleteTrip(tripId) {
      const batch = writeBatch(db);
      for (const sub of ['cards', 'bookings', 'expenses']) {
        const s = await getDocs(collection(db, 'trips', tripId, sub));
        s.docs.forEach((d) => batch.delete(d.ref));
      }
      await batch.commit();
      await deleteDoc(tripRef(tripId));
    },
  };
}
