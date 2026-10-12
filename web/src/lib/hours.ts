import type { OpeningPeriod } from '@ping/shared';
import { toMinutes, weekday } from './time';

export type HoursCheck = { kind: 'ok' } | { kind: 'closed-day' } | { kind: 'outside'; opens: string } | { kind: 'unknown' };

const WEEK_MIN = 7 * 1440;

/** Is the place open at a given weekday/minute? Handles periods that cross midnight. */
function isOpenAt(periods: OpeningPeriod[], day: number, minute: number): boolean {
  // 24/7 places: a single period with no close.
  if (periods.length === 1 && !periods[0].close) return true;
  const t = day * 1440 + minute;
  return periods.some((p) => {
    if (!p.close) return false;
    const start = p.open.day * 1440 + p.open.hour * 60 + p.open.minute;
    let end = p.close.day * 1440 + p.close.hour * 60 + p.close.minute;
    if (end <= start) end += WEEK_MIN;
    return (t >= start && t < end) || (t + WEEK_MIN >= start && t + WEEK_MIN < end);
  });
}

export function checkHours(periods: OpeningPeriod[] | null | undefined, date: string, at: string | null | undefined): HoursCheck {
  if (!periods || periods.length === 0) return { kind: 'unknown' };
  if (periods.length === 1 && !periods[0].close) return { kind: 'ok' };
  const day = weekday(date);
  const opensToday = periods.filter((p) => p.open.day === day);
  const carriesOver = periods.some((p) => p.close && p.open.day !== day && isOpenAt([p], day, 0));
  if (opensToday.length === 0 && !carriesOver) return { kind: 'closed-day' };
  const minute = toMinutes(at);
  if (minute == null) return { kind: 'ok' };
  if (isOpenAt(periods, day, minute)) return { kind: 'ok' };
  const first = opensToday.sort((a, b) => a.open.hour * 60 + a.open.minute - (b.open.hour * 60 + b.open.minute))[0];
  const opens = first ? `${String(first.open.hour).padStart(2, '0')}:${String(first.open.minute).padStart(2, '0')}` : '';
  return { kind: 'outside', opens };
}

export function hoursForDay(periods: OpeningPeriod[] | null | undefined, date: string): string | null {
  if (!periods || periods.length === 0) return null;
  if (periods.length === 1 && !periods[0].close) return '24 小時營業';
  const day = weekday(date);
  const f = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const today = periods.filter((p) => p.open.day === day);
  if (!today.length) return '公休';
  return today.map((p) => `${f(p.open.hour, p.open.minute)}–${p.close ? f(p.close.hour, p.close.minute) : ''}`).join('、');
}
