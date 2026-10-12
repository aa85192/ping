import type { Booking, Expense, PlaceCard, Trip } from '../data/model';
import { newId } from '../data/model';

export function exportTripJson(trip: Trip, cards: PlaceCard[], bookings: Booking[], expenses: Expense[] = []) {
  const { members: _m, memberProfiles: _p, inviteCode: _i, ownerUid: _o, ...rest } = trip;
  const blob = new Blob([JSON.stringify({ app: 'ping', version: 1, trip: rest, cards, bookings, expenses }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${trip.name.replace(/[\\/:*?"<>|]/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Imports get fresh ids so a backup can be loaded next to the original. */
export async function importTripJson(file: File): Promise<{ trip: Trip; cards: PlaceCard[]; bookings: Booking[]; expenses: Expense[] }> {
  const data = JSON.parse(await file.text()) as { app?: string; trip?: Trip; cards?: PlaceCard[]; bookings?: Booking[]; expenses?: Expense[] };
  if (data.app !== 'ping' || !data.trip) throw new Error('不是 Ping 的備份檔');
  return {
    trip: { ...data.trip, id: newId('trip_'), updatedAt: Date.now() },
    cards: (data.cards ?? []).map((c) => ({ ...c, id: newId('pc_') })),
    bookings: (data.bookings ?? []).map((b) => ({ ...b, id: newId('bk_') })),
    expenses: (data.expenses ?? []).map((e) => ({ ...e, id: newId('ex_') })),
  };
}
