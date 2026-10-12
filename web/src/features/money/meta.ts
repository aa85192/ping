import { BedDouble, CircleEllipsis, Pill, ShoppingBag, Ticket, TrainFront, Utensils, type LucideIcon } from 'lucide-react';
import type { Booking, ExpenseCategory, PayMethod, Trip } from '../../data/model';

export const CATEGORIES: { id: ExpenseCategory; label: string; icon: LucideIcon }[] = [
  { id: 'food', label: '餐飲', icon: Utensils },
  { id: 'transport', label: '交通', icon: TrainFront },
  { id: 'ticket', label: '門票', icon: Ticket },
  { id: 'shopping', label: '購物', icon: ShoppingBag },
  { id: 'drugstore', label: '藥妝', icon: Pill },
  { id: 'stay', label: '住宿', icon: BedDouble },
  { id: 'other', label: '其他', icon: CircleEllipsis },
];

export const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<ExpenseCategory, (typeof CATEGORIES)[number]>;

export const METHODS: { id: PayMethod; label: string }[] = [
  { id: 'cash', label: '現金' },
  { id: 'card', label: '信用卡' },
  { id: 'ic', label: 'IC 卡' },
  { id: 'mobile', label: '行動支付' },
];

export function bookingCategory(b: Booking): ExpenseCategory {
  if (b.kind === 'lodging') return 'stay';
  if (b.kind === 'tour') return 'ticket';
  return 'transport';
}

export interface Member {
  id: string;
  name: string;
}

/** Travellers who can pay. Single-device mode has just "我". */
export function membersOf(trip: Trip): Member[] {
  const profiles = trip.memberProfiles ?? {};
  const ids = trip.members?.length ? trip.members : Object.keys(profiles);
  if (!ids.length) return [{ id: 'me', name: '我' }];
  return ids.map((id) => ({ id, name: (profiles[id]?.name ?? '旅伴').split(' ')[0] }));
}

export function twd(n: number): string {
  return `NT$${Math.round(n).toLocaleString('zh-TW')}`;
}

export function jpy(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`;
}
