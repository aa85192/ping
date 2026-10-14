import { mapsPlaceUrl } from '@ping/shared';
import type { Booking, PlaceCard, Trip } from './model';
import { newId } from './model';

/** 交接文件（2026-10-11）中已知、已訂的資料。不含姓名、訂單編號與卡號。 */

const OSAKA = { city: '大阪・新今宮', lat: 34.6496, lng: 135.5013 };

export function osakaTripSeed(): { trip: Trip; bookings: Booking[]; cards: PlaceCard[] } {
  const trip: Trip = {
    id: newId('trip_'),
    name: '大阪 × 東京迪士尼 2026',
    budget: 82500,
    startDate: '2026-10-24',
    endDate: '2026-10-31',
    travelers: 2,
    homeCurrency: 'TWD',
    localCurrency: 'JPY',
    fxRate: 0.2,
    timezone: 'Asia/Tokyo',
    defaultMode: 'TRANSIT',
    days: {
      '2026-10-24': { ...OSAKA, title: '抵達大阪', startTime: '18:15' },
      '2026-10-25': { city: '天橋立・伊根', lat: 35.5697, lng: 135.1914, title: '海之京都一日遊', startTime: '06:15' },
      '2026-10-26': { ...OSAKA, title: 'USJ', startTime: '07:30' },
      '2026-10-27': { city: '京都', lat: 35.0116, lng: 135.7681, title: '京都', startTime: '07:30' },
      '2026-10-28': { city: '舞濱', lat: 35.6329, lng: 139.8804, title: '東京迪士尼', startTime: '07:00' },
      '2026-10-29': { ...OSAKA, title: '舞濱 → 大阪', startTime: '09:00' },
      '2026-10-30': { ...OSAKA, title: '大阪購物日', startTime: '10:00' },
      '2026-10-31': { ...OSAKA, title: '返程', startTime: '09:00' },
    },
    tags: [
      { id: 'sight', label: '景點', color: '#0A4D76' },
      { id: 'food', label: '美食', color: '#F2633A' },
      { id: 'shop', label: '購物', color: '#FCD32C' },
      { id: 'park', label: '樂園', color: '#B1371C' },
      { id: 'move', label: '交通', color: '#AFAA45' },
    ],
    updatedAt: Date.now(),
  };

  const bookings: Booking[] = [
    {
      id: newId('bk_'),
      kind: 'flight',
      title: '去程 Peach MM32',
      status: 'paid',
      start: '2026-10-24T14:10:00+08:00',
      end: '2026-10-24T18:15:00+09:00',
      flight: {
        no: 'MM32',
        airline: 'Peach',
        from: 'KHH',
        to: 'KIX',
        fromName: '高雄',
        toName: '大阪關西',
        durationText: '3 小時 5 分',
        terminalNote: 'Peach 在 KIX 第 2 航廈，需搭接駁巴士到 T1 再轉南海線到新今宮',
        baggage: '手提每人 1 件 7kg（50×40×25cm 內）・託運每人 1 件 20kg',
      },
      links: [],
      amount: { amount: 14571.83, currency: 'TWD' },
      note: '兩位旅客合計',
    },
    {
      id: newId('bk_'),
      kind: 'flight',
      title: '回程 AirAsia AK171',
      status: 'paid',
      start: '2026-10-31T14:10:00+09:00',
      end: '2026-10-31T16:30:00+08:00',
      flight: {
        no: 'AK171',
        airline: 'AirAsia',
        from: 'KIX',
        to: 'KHH',
        fromName: '大阪關西',
        toName: '高雄',
        durationText: '3 小時 15 分',
        terminalNote: '10:45 前離開飯店前往 KIX',
        baggage: '手提每人 1 件 7kg・無免費託運，已加購 20kg',
      },
      links: [],
      amount: { amount: 13294.23, currency: 'TWD' },
      note: '兩位旅客合計；加購行李金額未確認是否已含',
    },
    {
      id: newId('bk_'),
      kind: 'lodging',
      title: 'Apartment Hotel 11 Shinimamiya 1',
      status: 'confirmed',
      start: '2026-10-24T16:00:00+09:00',
      end: '2026-10-31',
      lodging: {
        address: '大阪市西成區 恵美須西（新今宮站步行約 3 分）',
        nearby: '新今宮站 3 分・動物園前站約 10 分',
        location: { lat: 34.6489, lng: 135.5012 },
      },
      links: [
        {
          kind: 'google-maps',
          url: mapsPlaceUrl({ name: 'Apartment Hotel 11 Shinimamiya 1' }),
          label: 'Google Map',
        },
      ],
      amount: { amount: 62359, currency: 'JPY' },
      note: '1 房 7 晚；10/17 Visa 自動扣款；城市住宿稅入住時現場付',
    },
    {
      id: newId('bk_'),
      kind: 'tour',
      title: '海之京都一日遊（天橋立・伊根舟屋）',
      status: 'booked',
      start: '2026-10-25T07:00:00+09:00',
      links: [],
      amount: { amount: 2352, currency: 'TWD' },
      note: '07:00 蟹道樂道頓堀集合；中文導遊',
      deadline: '2026-10-23T23:59:00+09:00',
    },
  ];

  let order = 0;
  const card = (day: string | null, name: string, lat: number, lng: number, tags: string[], extra: Partial<PlaceCard> = {}): PlaceCard => ({
    id: newId('pc_'),
    day,
    order: (order += 1000),
    sourceUrl: mapsPlaceUrl({ name }),
    name,
    location: { lat, lng },
    tags,
    memos: [],
    resolveState: 'partial',
    ...extra,
  });

  const cards: PlaceCard[] = [
    card('2026-10-24', '關西國際機場 第2航廈', 34.4294, 135.2440, ['move'], { plannedStart: '18:15', stayMinutes: 60 }),
    card('2026-10-24', '新世界（通天閣）', 34.6525, 135.5063, ['food'], { stayMinutes: 90 }),
    card('2026-10-25', 'かに道楽 道頓堀本店（集合點）', 34.6688, 135.5017, ['move'], { plannedStart: '07:00', stayMinutes: 10 }),
    card('2026-10-25', '天橋立', 35.5697, 135.1914, ['sight'], { stayMinutes: 120 }),
    card('2026-10-25', '伊根の舟屋', 35.6750, 135.2855, ['sight'], { stayMinutes: 120 }),
    card('2026-10-26', '日本環球影城 USJ', 34.6654, 135.4323, ['park'], { plannedStart: '08:00', stayMinutes: 600 }),
    card('2026-10-27', '伏見稻荷大社', 34.9671, 135.7727, ['sight'], { plannedStart: '08:30', stayMinutes: 90 }),
    card('2026-10-27', '清水寺', 34.9949, 135.785, ['sight'], { stayMinutes: 120 }),
    card('2026-10-27', '二條城（NAKED meets 二條城）', 35.0142, 135.7481, ['sight'], { plannedStart: '18:00', stayMinutes: 90 }),
    card('2026-10-28', '新大阪站', 34.7334, 135.5001, ['move'], { plannedStart: '08:00', stayMinutes: 19 }),
    card('2026-10-28', '東京迪士尼樂園', 35.6329, 139.8804, ['park'], { plannedStart: '12:00', stayMinutes: 540 }),
    card('2026-10-29', 'IKSPIARI', 35.634, 139.884, ['shop'], { plannedStart: '09:30', stayMinutes: 60 }),
    card('2026-10-30', 'スギ薬局 天王寺駅前店', 34.6461, 135.5143, ['shop'], { stayMinutes: 60 }),
    card('2026-10-30', '心齋橋筋商店街', 34.6723, 135.5014, ['shop'], { stayMinutes: 150 }),
    card('2026-10-31', '關西國際機場 第1航廈', 34.4320, 135.2304, ['move'], { plannedStart: '12:00', stayMinutes: 120 }),
  ];
  cards[1].memos.push({ id: newId('m_'), type: 'note', text: '晚餐在新世界或天王寺，未定', updatedAt: Date.now() });
  cards[5].memos.push({ id: newId('m_'), type: 'note', text: '一早入園，先領馬力歐區整理券\n- [ ] 門票 ¥10,900 × 2 未購\n- [ ] Express Pass 未決定', updatedAt: Date.now() });
  cards[10].memos.push({ id: newId('m_'), type: 'note', text: '園區預設 Land（萬聖節遊行）；新大阪 8:19 Hikari 642 → 11:12 東京 → 京葉線到舞濱', updatedAt: Date.now() });
  return { trip, bookings, cards };
}

export function blankTripSeed(name: string, startDate: string, endDate: string): { trip: Trip; bookings: Booking[]; cards: PlaceCard[] } {
  const trip: Trip = {
    id: newId('trip_'),
    name,
    startDate,
    endDate,
    travelers: 2,
    homeCurrency: 'TWD',
    localCurrency: 'JPY',
    fxRate: 0.2,
    timezone: 'Asia/Tokyo',
    defaultMode: 'TRANSIT',
    days: {},
    tags: [
      { id: 'sight', label: '景點', color: '#0A4D76' },
      { id: 'food', label: '美食', color: '#F2633A' },
      { id: 'shop', label: '購物', color: '#FCD32C' },
    ],
    updatedAt: Date.now(),
  };
  return { trip, bookings: [], cards: [] };
}
