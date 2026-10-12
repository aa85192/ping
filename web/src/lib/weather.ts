import type { DayInfo } from '../data/model';
import { daysBetween, todayInTz } from './time';

export interface DayWeather {
  date: string;
  code: number;
  tMax: number;
  tMin: number;
  /** Forecast: max precipitation probability. Climate: share of past years with ≥1 mm rain. */
  rainPct: number | null;
  kind: 'forecast' | 'climate';
}

const FORECAST_DAYS = 16;
const CLIMATE_YEARS = 5;

function cacheGet<T>(key: string, maxAgeMs: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: T };
    return Date.now() - at < maxAgeMs ? data : null;
  } catch {
    return null;
  }
}

function cacheSet(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full or blocked: skip caching */
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  return (await res.json()) as T;
}

interface Daily {
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max?: (number | null)[];
    precipitation_sum?: (number | null)[];
  };
}

async function forecast(lat: number, lng: number): Promise<Map<string, DayWeather>> {
  const key = `ping:wx:f:${lat.toFixed(2)},${lng.toFixed(2)}`;
  let data = cacheGet<Daily>(key, 3 * 3600_000);
  if (!data) {
    const q = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'Asia/Tokyo',
      forecast_days: String(FORECAST_DAYS),
    });
    data = await getJson<Daily>(`https://api.open-meteo.com/v1/forecast?${q}`);
    cacheSet(key, data);
  }
  const m = new Map<string, DayWeather>();
  data.daily.time.forEach((date, i) =>
    m.set(date, {
      date,
      code: data!.daily.weather_code[i],
      tMax: data!.daily.temperature_2m_max[i],
      tMin: data!.daily.temperature_2m_min[i],
      rainPct: data!.daily.precipitation_probability_max?.[i] ?? null,
      kind: 'forecast',
    }),
  );
  return m;
}

/** Average of the same calendar dates over the last few years. */
async function climate(lat: number, lng: number, dates: string[]): Promise<Map<string, DayWeather>> {
  const out = new Map<string, DayWeather>();
  if (!dates.length) return out;
  const thisYear = Number(todayInTz().slice(0, 4));
  const mmdd = dates.map((d) => d.slice(5));
  const key = `ping:wx:c:${lat.toFixed(2)},${lng.toFixed(2)}:${mmdd[0]}:${mmdd[mmdd.length - 1]}`;
  let years = cacheGet<Daily[]>(key, 30 * 86400_000);
  if (!years) {
    years = await Promise.all(
      Array.from({ length: CLIMATE_YEARS }, (_, i) => thisYear - 1 - i).map((y) => {
        const q = new URLSearchParams({
          latitude: String(lat),
          longitude: String(lng),
          daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
          timezone: 'Asia/Tokyo',
          start_date: `${y}-${mmdd[0]}`,
          end_date: `${y}-${mmdd[mmdd.length - 1]}`,
        });
        return getJson<Daily>(`https://archive-api.open-meteo.com/v1/archive?${q}`);
      }),
    );
    cacheSet(key, years);
  }
  for (const date of dates) {
    const md = date.slice(5);
    const rows = years
      .map((y) => {
        const i = y.daily.time.findIndex((t) => t.slice(5) === md);
        return i < 0 ? null : { max: y.daily.temperature_2m_max[i], min: y.daily.temperature_2m_min[i], rain: y.daily.precipitation_sum?.[i] ?? 0 };
      })
      .filter((r): r is { max: number; min: number; rain: number } => r !== null && r.max != null);
    if (!rows.length) continue;
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const rainy = rows.filter((r) => (r.rain ?? 0) >= 1).length / rows.length;
    out.set(date, {
      date,
      code: rainy >= 0.5 ? 61 : rainy >= 0.25 ? 3 : 2,
      tMax: avg(rows.map((r) => r.max)),
      tMin: avg(rows.map((r) => r.min)),
      rainPct: Math.round(rainy * 100),
      kind: 'climate',
    });
  }
  return out;
}

export async function tripWeather(dates: string[], dayInfo: (date: string) => DayInfo): Promise<Map<string, DayWeather>> {
  const today = todayInTz();
  const byPlace = new Map<string, { lat: number; lng: number; dates: string[] }>();
  for (const d of dates) {
    const info = dayInfo(d);
    const k = `${info.lat.toFixed(2)},${info.lng.toFixed(2)}`;
    const g = byPlace.get(k) ?? { lat: info.lat, lng: info.lng, dates: [] };
    g.dates.push(d);
    byPlace.set(k, g);
  }
  const result = new Map<string, DayWeather>();
  await Promise.all(
    [...byPlace.values()].map(async (g) => {
      const inRange = g.dates.filter((d) => {
        const diff = daysBetween(today, d);
        return diff >= 0 && diff < FORECAST_DAYS;
      });
      const outOfRange = g.dates.filter((d) => !inRange.includes(d));
      const [f, c] = await Promise.all([
        inRange.length ? forecast(g.lat, g.lng) : Promise.resolve(new Map<string, DayWeather>()),
        outOfRange.length ? climate(g.lat, g.lng, outOfRange) : Promise.resolve(new Map<string, DayWeather>()),
      ]);
      for (const d of g.dates) {
        const w = f.get(d) ?? c.get(d);
        if (w) result.set(d, w);
      }
    }),
  );
  return result;
}

export function weatherLabel(code: number): string {
  if (code === 0) return '晴';
  if (code <= 2) return '晴時多雲';
  if (code === 3) return '陰';
  if (code === 45 || code === 48) return '霧';
  if (code >= 51 && code <= 57) return '毛毛雨';
  if (code >= 61 && code <= 67) return '雨';
  if (code >= 71 && code <= 77) return '雪';
  if (code >= 80 && code <= 82) return '陣雨';
  if (code >= 85 && code <= 86) return '陣雪';
  if (code >= 95) return '雷雨';
  return '—';
}
