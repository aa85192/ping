import { create } from 'zustand';
import type { RouteRequest, RouteResponse } from '@ping/shared';
import { classifyLink } from '@ping/shared';
import { cloudEnabled, signInWithGoogle, signOutUser, watchUser } from './data/firebase';
import { localRepo } from './data/localRepo';
import type { Booking, Memo, PlaceCard, Trip } from './data/model';
import { newId } from './data/model';
import type { Repo, TripSummary } from './data/repo';
import { fetchRoute, resolveFromText } from './lib/api';
import { usePrefs } from './lib/prefs';
import { orderBetween, sortCards } from './lib/schedule';

export interface AppUser {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
}

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

type Phase = 'boot' | 'signin' | 'pick' | 'ready' | 'error';

interface AppState {
  phase: Phase;
  error: string | null;
  repo: Repo | null;
  user: AppUser | null;
  trips: TripSummary[];
  tripId: string | null;
  trip: Trip | null;
  cards: PlaceCard[];
  bookings: Booking[];
  legs: Record<string, RouteResponse | 'loading' | undefined>;
  toast: Toast | null;
  openCardId: string | null;
  planDay: string | null;

  boot: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  openTrip: (id: string) => void;
  createTrip: (seed: { trip: Trip; cards: PlaceCard[]; bookings: Booking[] }) => Promise<void>;
  showToast: (text: string, action?: Toast['action']) => void;
  setOpenCard: (id: string | null) => void;
  setPlanDay: (d: string | null) => void;

  patchTrip: (patch: Partial<Trip>) => Promise<void>;
  addFromText: (text: string, day: string | null) => Promise<string | null>;
  refreshCard: (id: string) => Promise<void>;
  patchCard: (id: string, patch: Partial<PlaceCard>) => Promise<void>;
  moveCard: (id: string, day: string | null, index: number) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  addMemo: (cardId: string, memo: { type: 'note'; text: string } | { type: 'link'; url: string; title?: string }) => Promise<void>;
  updateMemo: (cardId: string, memoId: string, patch: Partial<Memo>) => Promise<void>;
  deleteMemo: (cardId: string, memoId: string) => Promise<void>;
  putBooking: (b: Booking) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  ensureLeg: (key: string, req: RouteRequest) => void;
}

const LEG_CACHE = 'ping:legs';

function loadLegCache(): Record<string, RouteResponse> {
  try {
    return JSON.parse(localStorage.getItem(LEG_CACHE) ?? '{}') as Record<string, RouteResponse>;
  } catch {
    return {};
  }
}

function saveLegCache(legs: Record<string, RouteResponse | 'loading' | undefined>) {
  const entries = Object.entries(legs).filter((e): e is [string, RouteResponse] => typeof e[1] === 'object' && e[1] !== null && e[1].source === 'routes-api');
  try {
    localStorage.setItem(LEG_CACHE, JSON.stringify(Object.fromEntries(entries.slice(-600))));
  } catch {
    /* ignore */
  }
}

// Keep at most a few route requests in flight.
let inflight = 0;
const queue: (() => void)[] = [];
function limit<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      inflight++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          inflight--;
          queue.shift()?.();
        });
    };
    if (inflight < 3) run();
    else queue.push(run);
  });
}

let unsubscribeTrip: (() => void) | null = null;
let toastSeq = 0;

function pendingJoin(): { tripId: string; code: string } | null {
  const p = new URLSearchParams(location.search);
  const tripId = p.get('join');
  const code = p.get('code');
  if (tripId && code) {
    sessionStorage.setItem('ping:join', JSON.stringify({ tripId, code }));
    history.replaceState(null, '', location.pathname + location.hash);
  }
  try {
    return JSON.parse(sessionStorage.getItem('ping:join') ?? 'null');
  } catch {
    return null;
  }
}

export const useApp = create<AppState>()((set, get) => {
  const need = () => {
    const { repo, tripId, trip } = get();
    if (!repo || !tripId || !trip) throw new Error('no trip');
    return { repo, tripId, trip };
  };
  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      get().showToast(`儲存失敗：${(e as Error).message}`);
    }
  };

  async function afterRepo(repo: Repo) {
    const join = pendingJoin();
    const user = get().user;
    if (join && repo.kind === 'cloud' && user) {
      try {
        await repo.joinTrip(join.tripId, join.code, { name: user.name, email: user.email, photoURL: user.photoURL });
        usePrefs.getState().set({ activeTripId: join.tripId });
        get().showToast('已加入共享行程 ✨');
      } catch (e) {
        // Already a member, or a bad code: listing trips below sorts it out.
        console.warn('join failed', e);
      } finally {
        sessionStorage.removeItem('ping:join');
      }
    }
    const trips = await repo.listTrips();
    set({ trips });
    const preferred = usePrefs.getState().activeTripId;
    const pick = trips.find((t) => t.id === preferred) ?? trips[0];
    if (pick) get().openTrip(pick.id);
    else set({ phase: 'pick' });
  }

  return {
    phase: 'boot',
    error: null,
    repo: null,
    user: null,
    trips: [],
    tripId: null,
    trip: null,
    cards: [],
    bookings: [],
    legs: loadLegCache(),
    toast: null,
    openCardId: null,
    planDay: null,

    async boot() {
      if (!cloudEnabled) {
        set({ repo: localRepo });
        await afterRepo(localRepo);
        return;
      }
      pendingJoin();
      await watchUser(async (u) => {
        if (!u) {
          unsubscribeTrip?.();
          set({ user: null, repo: null, phase: 'signin', trip: null, tripId: null });
          return;
        }
        set({ user: { uid: u.uid, name: u.displayName ?? u.email ?? '旅伴', email: u.email ?? undefined, photoURL: u.photoURL ?? undefined } });
        try {
          const { createCloudRepo } = await import('./data/cloudRepo');
          const repo = get().repo ?? (await createCloudRepo());
          set({ repo });
          await afterRepo(repo);
        } catch (e) {
          set({ phase: 'error', error: (e as Error).message });
        }
      });
    },

    async signIn() {
      try {
        await signInWithGoogle();
      } catch (e) {
        get().showToast(`登入失敗：${(e as Error).message}`);
      }
    },

    async signOut() {
      await signOutUser();
    },

    openTrip(id) {
      const repo = get().repo;
      if (!repo) return;
      unsubscribeTrip?.();
      usePrefs.getState().set({ activeTripId: id });
      set({ tripId: id });
      unsubscribeTrip = repo.subscribe(
        id,
        (snap) => {
          if (!snap.trip) {
            set({ phase: 'pick', trip: null });
            return;
          }
          set({ trip: snap.trip, cards: snap.cards, bookings: snap.bookings, phase: 'ready' });
        },
        (e) => set({ phase: 'error', error: e.message }),
      );
    },

    async createTrip(seed) {
      const repo = get().repo;
      if (!repo) return;
      const id = await repo.createTrip(seed);
      set({ trips: await repo.listTrips() });
      get().openTrip(id);
    },

    showToast(text, action) {
      const id = ++toastSeq;
      set({ toast: { id, text, action } });
      setTimeout(() => get().toast?.id === id && set({ toast: null }), action ? 6000 : 3500);
    },

    setOpenCard: (id) => set({ openCardId: id }),
    setPlanDay: (d) => set({ planDay: d }),

    patchTrip: (patch) => guard(async () => {
      const { repo, tripId } = need();
      await repo.patchTrip(tripId, patch);
    }),

    async addFromText(text, day) {
      const { repo, tripId } = need();
      const list = sortCards(get().cards, day);
      const card: PlaceCard = {
        id: newId('pc_'),
        day,
        order: orderBetween(list[list.length - 1]?.order, undefined),
        sourceUrl: '',
        name: '解析中…',
        tags: [],
        memos: [],
        resolveState: 'pending',
        createdBy: get().user?.uid ?? null,
      };
      try {
        await repo.putCard(tripId, card);
        const r = await resolveFromText(text);
        if (!r.place) {
          await repo.deleteCard(tripId, card.id);
          get().showToast(r.note ?? '無法解析這個連結');
          return null;
        }
        const p = r.place;
        await repo.patchCard(tripId, card.id, {
          sourceUrl: r.sourceUrl,
          name: p.name,
          placeId: p.placeId ?? null,
          address: p.address ?? null,
          location: p.location ?? null,
          googleMapsUri: p.googleMapsUri ?? null,
          photoUrl: p.photoUrl ?? null,
          rating: p.rating ?? null,
          userRatingCount: p.userRatingCount ?? null,
          primaryType: p.primaryType ?? null,
          openingPeriods: p.openingPeriods ?? null,
          resolveState: p.quality === 'full' ? 'resolved' : 'partial',
        });
        get().showToast(r.note ?? `已加入「${p.name}」`);
        return card.id;
      } catch (e) {
        get().showToast(`加入失敗：${(e as Error).message}`);
        return null;
      }
    },

    refreshCard: (id) => guard(async () => {
      const { repo, tripId } = need();
      const c = get().cards.find((x) => x.id === id);
      if (!c) return;
      const src = c.sourceUrl || c.googleMapsUri || '';
      const r = await resolveFromText(`${c.name}\n${src}`);
      if (!r.place) {
        get().showToast(r.note ?? '無法更新');
        return;
      }
      const p = r.place;
      if (p.quality !== 'full') {
        get().showToast('沒有取得 Google 地點資料（需要 API 服務）');
        return;
      }
      await repo.patchCard(tripId, id, {
        name: p.name,
        placeId: p.placeId ?? null,
        address: p.address ?? null,
        location: p.location ?? c.location ?? null,
        googleMapsUri: p.googleMapsUri ?? null,
        photoUrl: p.photoUrl ?? null,
        rating: p.rating ?? null,
        userRatingCount: p.userRatingCount ?? null,
        primaryType: p.primaryType ?? null,
        openingPeriods: p.openingPeriods ?? null,
        resolveState: 'resolved',
      });
      get().showToast('已用 Google 資料更新');
    }),

    patchCard: (id, patch) => guard(async () => {
      const { repo, tripId } = need();
      await repo.patchCard(tripId, id, patch);
    }),

    moveCard: (id, day, index) => guard(async () => {
      const { repo, tripId } = need();
      const list = sortCards(get().cards, day).filter((c) => c.id !== id);
      const i = Math.max(0, Math.min(index, list.length));
      const order = orderBetween(list[i - 1]?.order, list[i]?.order);
      // Optimistic local update so drag & drop doesn't flicker.
      set({ cards: get().cards.map((c) => (c.id === id ? { ...c, day, order } : c)) });
      await repo.patchCard(tripId, id, { day, order });
    }),

    deleteCard: (id) => guard(async () => {
      const { repo, tripId } = need();
      const card = get().cards.find((c) => c.id === id);
      if (!card) return;
      await repo.deleteCard(tripId, id);
      if (get().openCardId === id) set({ openCardId: null });
      get().showToast(`已刪除「${card.name}」`, { label: '復原', run: () => void repo.putCard(tripId, card) });
    }),

    addMemo: (cardId, memo) => guard(async () => {
      const { repo, tripId } = need();
      const card = get().cards.find((c) => c.id === cardId);
      if (!card) return;
      const by = get().user?.uid;
      const m: Memo =
        memo.type === 'note'
          ? { id: newId('m_'), type: 'note', text: memo.text, updatedAt: Date.now(), by }
          : { id: newId('m_'), type: 'link', url: memo.url, kind: classifyLink(memo.url), title: memo.title, updatedAt: Date.now(), by };
      await repo.patchCard(tripId, cardId, { memos: [...card.memos, m] });
    }),

    updateMemo: (cardId, memoId, patch) => guard(async () => {
      const { repo, tripId } = need();
      const card = get().cards.find((c) => c.id === cardId);
      if (!card) return;
      const memos = card.memos.map((m) => (m.id === memoId ? ({ ...m, ...patch, updatedAt: Date.now() } as Memo) : m));
      await repo.patchCard(tripId, cardId, { memos });
    }),

    deleteMemo: (cardId, memoId) => guard(async () => {
      const { repo, tripId } = need();
      const card = get().cards.find((c) => c.id === cardId);
      if (!card) return;
      await repo.patchCard(tripId, cardId, { memos: card.memos.filter((m) => m.id !== memoId) });
    }),

    putBooking: (b) => guard(async () => {
      const { repo, tripId } = need();
      await repo.putBooking(tripId, b);
    }),

    deleteBooking: (id) => guard(async () => {
      const { repo, tripId } = need();
      const b = get().bookings.find((x) => x.id === id);
      await repo.deleteBooking(tripId, id);
      if (b) get().showToast(`已刪除「${b.title}」`, { label: '復原', run: () => void repo.putBooking(tripId, b) });
    }),

    ensureLeg(key, req) {
      if (get().legs[key]) return;
      set({ legs: { ...get().legs, [key]: 'loading' } });
      void limit(() => fetchRoute(req))
        .catch((): RouteResponse => ({ durationSec: null, distanceM: null, source: 'estimate', error: 'failed' }))
        .then((r) => {
          set({ legs: { ...get().legs, [key]: r } });
          saveLegCache(get().legs);
        });
    },
  };
});

export const useTrip = () => useApp((s) => s.trip);
