import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ThemeOverrides } from '../theme/tokens';

export type TabId = 'home' | 'plan' | 'map' | 'inbox' | 'settings';
export type WidgetId = 'countdown' | 'today' | 'flights' | 'lodging' | 'weather' | 'tours';
export type CardField = 'photo' | 'rating' | 'hours' | 'address' | 'time' | 'memos' | 'tags';
export type ThemeMode = 'system' | 'light' | 'dark';

export const TAB_LABEL: Record<TabId, string> = {
  home: '總覽',
  plan: '行程',
  map: '地圖',
  inbox: '收集箱',
  settings: '設定',
};

export const WIDGET_LABEL: Record<WidgetId, string> = {
  countdown: '出發倒數',
  today: '今日行程',
  flights: '航班',
  lodging: '住宿',
  weather: '當週天氣',
  tours: '其他預訂',
};

export const CARD_FIELD_LABEL: Record<CardField, string> = {
  photo: '照片',
  rating: '評分',
  hours: '營業時間提醒',
  address: '地址',
  time: '時間與停留',
  memos: 'Memo 數',
  tags: '標籤',
};

export interface Toggle<T> {
  id: T;
  visible: boolean;
}

interface PrefsState {
  themeMode: ThemeMode;
  overrides: ThemeOverrides;
  tabs: Toggle<TabId>[];
  widgets: Toggle<WidgetId>[];
  cardFields: Record<CardField, boolean>;
  activeTripId: string | null;
  set: (p: Partial<Omit<PrefsState, 'set'>>) => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    localStorage.setItem('ping:probe', '1');
    localStorage.removeItem('ping:probe');
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      overrides: {},
      tabs: (['home', 'plan', 'map', 'inbox', 'settings'] as TabId[]).map((id) => ({ id, visible: true })),
      widgets: (['countdown', 'today', 'flights', 'lodging', 'weather', 'tours'] as WidgetId[]).map((id) => ({ id, visible: true })),
      cardFields: { photo: true, rating: true, hours: true, address: false, time: true, memos: true, tags: true },
      activeTripId: null,
      set: (p) => set(p),
    }),
    { name: 'ping:prefs', storage: safeStorage, version: 1 },
  ),
);
