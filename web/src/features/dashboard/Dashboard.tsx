import { mapsDirectionsUrl, mapsPlaceUrl, LINK_KIND_LABEL } from '@ping/shared';
import { BedDouble, CalendarClock, ChevronRight, Info, Pencil, Plane, Plus, Ticket, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LinkIcon, ModeIcon, StarMark, WeatherIcon } from '../../components/icons';
import type { Booking, BookingKind, DayInfo, Trip } from '../../data/model';
import { tripDates } from '../../data/model';
import type { TabId, WidgetId } from '../../lib/prefs';
import { usePrefs } from '../../lib/prefs';
import { dayAnchors } from '../../lib/lodging';
import { buildSchedule, isAnchorId, sortCards, toTarget } from '../../lib/schedule';
import { dayLabel, daysBetween, fromMinutes, shortDay, todayInTz, wallDate, wallTime } from '../../lib/time';
import { tripWeather, weatherLabel, type DayWeather } from '../../lib/weather';
import { useApp } from '../../store';
import { BookingSheet, emptyBooking, STATUS_LABEL } from '../booking/BookingSheet';

export function dayInfoFor(trip: Trip, date: string, lodging?: Booking): DayInfo {
  const d = trip.days[date];
  if (d) return d;
  const loc = lodging?.lodging?.location;
  return loc ? { city: '住宿', lat: loc.lat, lng: loc.lng } : { city: '大阪', lat: 34.6937, lng: 135.5023 };
}

function StatusChip({ b }: { b: Booking }) {
  const s = STATUS_LABEL[b.status];
  return <span className={`chip ${s.tone}`}>{s.label}</span>;
}

function money(b: Booking) {
  if (!b.amount) return null;
  const { amount, currency } = b.amount;
  return `${currency === 'JPY' ? '¥' : 'NT$'}${amount.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`;
}

function Countdown({ trip }: { trip: Trip }) {
  const today = todayInTz();
  const total = daysBetween(trip.startDate, trip.endDate) + 1;
  const toGo = daysBetween(today, trip.startDate);
  const dayN = daysBetween(trip.startDate, today) + 1;
  const members = Object.values(trip.memberProfiles ?? {});
  return (
    <div className="hero">
      <span className="sparkle">
        <StarMark size={96} face={false} fill="rgba(255,255,255,.45)" />
      </span>
      <div className="small" style={{ fontWeight: 700 }}>
        {trip.name}
      </div>
      {toGo > 0 ? (
        <div className="row" style={{ alignItems: 'baseline', marginTop: 6 }}>
          <span className="big num">{toGo}</span>
          <span>天後出發</span>
        </div>
      ) : dayN <= total ? (
        <div className="row" style={{ alignItems: 'baseline', marginTop: 6 }}>
          <span>Day</span>
          <span className="big num">{dayN}</span>
          <span>/ {total}</span>
        </div>
      ) : (
        <div className="big" style={{ fontSize: 28, marginTop: 6 }}>
          旅程結束，辛苦了！
        </div>
      )}
      <div className="small" style={{ marginTop: 6 }}>
        {dayLabel(trip.startDate)} – {dayLabel(trip.endDate)} · {trip.travelers} 人
        {members.length > 1 && ` · ${members.map((m) => m.name.split(' ')[0]).join('、')}`}
      </div>
    </div>
  );
}

function Today({ trip, onNavigate }: { trip: Trip; onNavigate: (t: TabId) => void }) {
  const { cards, bookings, legs, setPlanDay, setOpenCard } = useApp();
  const today = todayInTz();
  if (today < trip.startDate || today > trip.endDate) return null;
  const day = trip.days[today];
  const sched = buildSchedule(today, sortCards(cards, today), day, trip, legs, dayAnchors(today, trip, bookings));
  return (
    <section className="card">
      <div className="card-head">
        <CalendarClock size={18} className="icon" />
        <h2>今天 · {day?.title ?? dayLabel(today)}</h2>
        <div className="spacer" />
        <button
          className="btn sm ghost"
          onClick={() => {
            setPlanDay(today);
            onNavigate('plan');
          }}
        >
          全部 <ChevronRight size={14} />
        </button>
      </div>
      {sched.items.length === 0 && <div className="muted small">今天還沒有排景點</div>}
      <div className="list">
        {sched.items.map(({ card, arrive, leg }) => (
          <div key={card.id} className="list-item">
            <b className="num small" style={{ width: 44 }}>
              {fromMinutes(arrive)}
            </b>
            <button className="btn ghost ellipsis" style={{ padding: 0, justifyContent: 'flex-start', flex: 1 }} onClick={() => !isAnchorId(card.id) && setOpenCard(card.id)}>
              {isAnchorId(card.id) ? `🏠 ${card.name}` : card.name}
            </button>
            {leg && (
              <a className="btn sm" href={mapsDirectionsUrl(toTarget(leg.from), toTarget(leg.to), leg.mode)} target="_blank" rel="noreferrer" aria-label="導航到下一站">
                <ModeIcon mode={leg.mode} size={14} /> 下一站
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Flights({ list, onEdit }: { list: Booking[]; onEdit: (b: Booking) => void }) {
  return (
    <section className="card">
      <div className="card-head">
        <Plane size={18} className="icon" />
        <h2>航班</h2>
        <div className="spacer" />
        <button className="icon-btn" aria-label="新增航班" onClick={() => onEdit(emptyBooking('flight'))}>
          <Plus size={18} />
        </button>
      </div>
      {list.length === 0 && <div className="muted small">還沒有航班</div>}
      {list.map((b) => (
        <div key={b.id} className="flight" onClick={() => onEdit(b)} style={{ cursor: 'pointer' }}>
          <div className="row small" style={{ marginBottom: 6 }}>
            <b>{dayLabel(wallDate(b.start))}</b>
            <span className="muted">
              {b.flight?.airline} {b.flight?.no}
            </span>
            <div className="spacer" />
            <StatusChip b={b} />
          </div>
          <div className="boarding">
            <div>
              <div className="code">{b.flight?.from}</div>
              <div className="muted tiny">{b.flight?.fromName}</div>
              <div className="time num">{wallTime(b.start)}</div>
            </div>
            <div className="mid">
              <Plane size={18} style={{ color: 'var(--star-deep)' }} />
              <div>{b.flight?.durationText}</div>
            </div>
            <div className="end">
              <div className="code">{b.flight?.to}</div>
              <div className="muted tiny">{b.flight?.toName}</div>
              <div className="time num">{b.end ? wallTime(b.end) : ''}</div>
            </div>
          </div>
          {b.flight?.baggage && <div className="note" style={{ marginTop: 8 }}>🧳 {b.flight.baggage}</div>}
          {b.flight?.terminalNote && (
            <div className="note" style={{ marginTop: 4 }}>
              <Info size={14} /> {b.flight.terminalNote}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function Lodging({ list, onEdit }: { list: Booking[]; onEdit: (b: Booking) => void }) {
  return (
    <section className="card">
      <div className="card-head">
        <BedDouble size={18} className="icon" />
        <h2>住宿</h2>
        <div className="spacer" />
        <button className="icon-btn" aria-label="新增住宿" onClick={() => onEdit(emptyBooking('lodging'))}>
          <Plus size={18} />
        </button>
      </div>
      {list.length === 0 && <div className="muted small">還沒有住宿</div>}
      {list.map((b) => {
        const nights = b.end ? daysBetween(wallDate(b.start), wallDate(b.end)) : null;
        const links = [...b.links];
        if (!links.some((l) => l.kind === 'google-maps')) {
          links.unshift({ kind: 'google-maps', label: 'Google Map', url: mapsPlaceUrl({ name: b.title, placeId: b.lodging?.placeId ?? undefined, location: b.lodging?.location ?? undefined }) });
        }
        return (
          <div key={b.id} className="stack" style={{ gap: 8 }}>
            <div className="row">
              <h3 style={{ flex: 1 }}>{b.title}</h3>
              <StatusChip b={b} />
              <button className="icon-btn" aria-label="編輯住宿" onClick={() => onEdit(b)}>
                <Pencil size={16} />
              </button>
            </div>
            <div className="grid-2 small">
              <div>
                <div className="muted tiny">入住</div>
                <b>{dayLabel(wallDate(b.start))}</b> <span className="num">{wallTime(b.start)}</span>
              </div>
              <div>
                <div className="muted tiny">退房{nights ? ` · ${nights} 晚` : ''}</div>
                <b>{b.end ? dayLabel(wallDate(b.end)) : '—'}</b> <span className="num">{b.end ? wallTime(b.end) : ''}</span>
              </div>
            </div>
            {b.lodging?.address && <div className="note">📍 {b.lodging.address}</div>}
            {b.note && <div className="note">{b.note}</div>}
            <div className="row wrap">
              {links.map((l, i) => (
                <a key={i} className="btn sm" href={l.url} target="_blank" rel="noreferrer">
                  <LinkIcon kind={l.kind} size={14} /> {l.label || LINK_KIND_LABEL[l.kind]}
                </a>
              ))}
              {!b.links.some((l) => l.kind === 'agoda' || l.kind === 'airbnb') && (
                <button className="btn sm ghost muted" onClick={() => onEdit(b)}>
                  <Plus size={14} /> Agoda / Airbnb 連結
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Weather({ trip, lodging }: { trip: Trip; lodging?: Booking }) {
  const dates = useMemo(() => tripDates(trip), [trip]);
  const [data, setData] = useState<Map<string, DayWeather> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const daysKey = JSON.stringify(dates.map((d) => dayInfoFor(trip, d, lodging)));
  useEffect(() => {
    let alive = true;
    tripWeather(dates, (d) => dayInfoFor(trip, d, lodging))
      .then((m) => alive && setData(m))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey]);
  const anyClimate = data && [...data.values()].some((w) => w.kind === 'climate');
  return (
    <section className="card">
      <div className="card-head">
        <WeatherIcon code={1} size={18} className="icon" />
        <h2>當週天氣</h2>
      </div>
      {error && !data && <div className="muted small">天氣暫時讀不到（{error}）</div>}
      <div className="weather-strip">
        {dates.map((d) => {
          const w = data?.get(d);
          const { md, wd } = shortDay(d);
          return (
            <div key={d} className={`wx ${w?.kind === 'climate' ? 'climate' : ''}`} title={w ? weatherLabel(w.code) : ''}>
              <span className="d">
                {md} <span className="muted">{wd}</span>
              </span>
              <span className="city ellipsis">{dayInfoFor(trip, d, lodging).city}</span>
              {w ? <WeatherIcon code={w.code} size={24} /> : <span style={{ height: 24 }}>·</span>}
              <span className="t num">{w ? `${Math.round(w.tMax)}° / ${Math.round(w.tMin)}°` : '—'}</span>
              <span className="rain num">{w?.rainPct != null ? `☂ ${w.rainPct}%` : ''}</span>
            </div>
          );
        })}
      </div>
      {anyClimate && <div className="tiny muted" style={{ marginTop: 8 }}>灰底為「往年同日平均」（預報只到 16 天內），進入預報範圍後會自動換成預報。</div>}
    </section>
  );
}

function Tours({ list, onEdit }: { list: Booking[]; onEdit: (b: Booking) => void }) {
  const now = Date.now();
  return (
    <section className="card">
      <div className="card-head">
        <Ticket size={18} className="icon" />
        <h2>其他預訂</h2>
        <div className="spacer" />
        <button className="icon-btn" aria-label="新增預訂" onClick={() => onEdit(emptyBooking('tour'))}>
          <Plus size={18} />
        </button>
      </div>
      {list.length === 0 && <div className="muted small">一日遊、門票、新幹線等</div>}
      <div className="list">
        {list.map((b) => {
          const deadline = b.deadline ? Date.parse(b.deadline) : null;
          const soon = deadline && deadline > now && deadline - now < 3 * 86400_000;
          return (
            <button key={b.id} className="list-item btn ghost" style={{ justifyContent: 'flex-start', height: 'auto', borderRadius: 0, textAlign: 'left' }} onClick={() => onEdit(b)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row">
                  <b className="ellipsis">{b.title}</b>
                </div>
                <div className="tiny muted">
                  {b.start && `${dayLabel(wallDate(b.start))} ${wallTime(b.start)}`} {money(b) && `· ${money(b)}`}
                </div>
                {b.deadline && (
                  <div className={`tiny ${soon ? 'warn' : 'muted'}`}>
                    {soon && <TriangleAlert size={12} />} 截止 {dayLabel(wallDate(b.deadline))} {wallTime(b.deadline)}
                  </div>
                )}
              </div>
              <StatusChip b={b} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function Dashboard({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  const trip = useApp((s) => s.trip)!;
  const bookings = useApp((s) => s.bookings);
  const widgets = usePrefs((s) => s.widgets);
  const [editing, setEditing] = useState<Booking | null>(null);
  const byKind = (k: BookingKind[]) => bookings.filter((b) => k.includes(b.kind)).sort((a, b) => a.start.localeCompare(b.start));
  const lodging = byKind(['lodging']);

  const render: Record<WidgetId, () => ReactNode> = {
    countdown: () => <Countdown trip={trip} />,
    today: () => <Today trip={trip} onNavigate={onNavigate} />,
    flights: () => <Flights list={byKind(['flight'])} onEdit={setEditing} />,
    lodging: () => <Lodging list={lodging} onEdit={setEditing} />,
    weather: () => <Weather trip={trip} lodging={lodging[0]} />,
    tours: () => <Tours list={byKind(['tour', 'rail'])} onEdit={setEditing} />,
  };

  return (
    <>
      <header className="topbar">
        <StarMark size={30} />
        <div className="title">
          <h1 className="ellipsis">總覽</h1>
        </div>
      </header>
      <main className="page">
        {widgets.filter((w) => w.visible).map((w) => (
          <div key={w.id}>{render[w.id]()}</div>
        ))}
      </main>
      {editing && <BookingSheet booking={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
