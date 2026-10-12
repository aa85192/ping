/** All trip times are shown in the destination time zone (JST). */
export const TZ = 'Asia/Tokyo';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function dayLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}（${WEEK[weekday(date)]}）`;
}

export function shortDay(date: string): { md: string; wd: string } {
  const [, m, d] = date.split('-').map(Number);
  return { md: `${m}/${d}`, wd: WEEK[weekday(date)] };
}

/** "YYYY-MM-DD" for now in the trip time zone. */
export function todayInTz(tz = TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** Format an ISO timestamp's wall-clock time as written (keeps the booking's own offset). */
export function wallTime(iso: string): string {
  const m = iso.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
}

export function wallDate(iso: string): string {
  return iso.slice(0, 10);
}

export function toMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function fromMinutes(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const extra = min >= 1440 ? '+1' : '';
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${extra}`;
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null) return '—';
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return `${min} 分`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} 小時 ${r} 分` : `${h} 小時`;
}

export function formatShortDuration(min: number): string {
  const h = Math.floor(min / 60);
  const r = Math.round(min % 60);
  if (!h) return `${r}m`;
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
}

export function formatDistance(m: number | null | undefined): string {
  if (m == null) return '';
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/** ISO timestamp for a local wall time on a trip day in JST. */
export function jstIso(date: string, minutes: number): string {
  const d = new Date(Date.parse(`${date}T00:00:00+09:00`) + minutes * 60000);
  return d.toISOString();
}
