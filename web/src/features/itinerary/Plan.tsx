import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { mapsPlaceUrl } from '@ping/shared';
import { BedDouble, MapPinned, Plus, Settings2 } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { StarMark } from '../../components/icons';
import { tripDates } from '../../data/model';
import type { PlaceCard } from '../../data/model';
import { dayAnchors } from '../../lib/lodging';
import { buildSchedule, sortCards, toTarget, type ScheduledCard } from '../../lib/schedule';
import { dayLabel, formatShortDuration, fromMinutes, shortDay, todayInTz } from '../../lib/time';
import { useApp } from '../../store';
import { dayInfoFor } from '../dashboard/Dashboard';
import { AddPlaceSheet } from './AddPlaceSheet';
import { DaySheet } from './DaySheet';
import { LegRow } from './LegRow';
import { SortablePlace } from './PlaceTile';

export function usePasteToAdd(day: string | null) {
  const addFromText = useApp((s) => s.addFromText);
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const text = e.clipboardData?.getData('text') ?? '';
      if (/https?:\/\//.test(text)) {
        e.preventDefault();
        void addFromText(text, day);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [day, addFromText]);
}

export function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

function HotelTile({ item }: { item: ScheduledCard }) {
  const c: PlaceCard = item.card;
  const isStart = item.anchor === 'start';
  return (
    <a className="place hotel" href={mapsPlaceUrl(toTarget(c))} target="_blank" rel="noreferrer">
      <div className="time-col num">
        <b>{fromMinutes(isStart ? item.depart : item.arrive)}</b>
        {isStart ? '出發' : '回到'}
      </div>
      <div className="thumb hotel-thumb">
        <BedDouble size={22} />
      </div>
      <div className="body">
        <div className="tiny muted">{isStart ? '從住宿出發' : '回到住宿'}</div>
        <div className="name">{c.name}</div>
        {!c.location && !c.placeId && <span className="tiny warn">住宿還沒設定位置，到總覽編輯住宿貼上 Google Maps 連結</span>}
      </div>
    </a>
  );
}

/** Horizontal swipe on the page body changes day; ignores drags that start on scrollers or handles. */
function useSwipe(onSwipe: (dir: 1 | -1) => void, disabled: boolean) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onTouchStart: (e: TouchEvent) => {
      const el = e.target as HTMLElement;
      if (disabled || el.closest('.day-pills, .grip, input, textarea, select, .sheet')) {
        start.current = null;
        return;
      }
      const p = e.touches[0];
      start.current = { x: p.clientX, y: p.clientY, t: Date.now() };
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || disabled) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - s.x;
      const dy = p.clientY - s.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - s.t < 800) onSwipe(dx < 0 ? 1 : -1);
    },
  };
}

export function Plan() {
  const { trip, cards, bookings, legs, planDay, setPlanDay, setOpenCard, moveCard } = useApp();
  const dates = useMemo(() => tripDates(trip!), [trip]);
  const today = todayInTz();
  const date = planDay && dates.includes(planDay) ? planDay : dates.includes(today) ? today : dates[0];
  const lodging = bookings.find((b) => b.kind === 'lodging');
  const info = dayInfoFor(trip!, date, lodging);
  const ordered = sortCards(cards, date);
  const anchors = dayAnchors(date, trip!, bookings);
  const sched = buildSchedule(date, ordered, trip!.days[date], trip!, legs, anchors);
  const [adding, setAdding] = useState(false);
  const [editingDay, setEditingDay] = useState(false);
  const [dragging, setDragging] = useState(false);
  const sensors = useDragSensors();
  const pillsRef = useRef<HTMLDivElement>(null);
  usePasteToAdd(date);
  const [slide, setSlide] = useState<'left' | 'right' | null>(null);
  const goDay = (dir: 1 | -1) => {
    const next = dates[dates.indexOf(date) + dir];
    if (!next) return;
    setSlide(dir === 1 ? 'left' : 'right');
    setPlanDay(next);
  };
  const swipe = useSwipe(goDay, dragging);

  useEffect(() => {
    pillsRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [date]);

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(false);
    if (!e.over || e.active.id === e.over.id) return;
    const ids = ordered.map((c) => c.id);
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    void moveCard(String(e.active.id), date, next.indexOf(String(e.active.id)));
  };

  const span = sched.endMin - sched.startMin;
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    cards.forEach((c) => c.day && (m[c.day] = (m[c.day] ?? 0) + 1));
    return m;
  }, [cards]);

  return (
    <>
      <header className="topbar">
        <StarMark size={30} />
        <div className="title" style={{ flex: 1 }}>
          <h1 className="ellipsis">{info.title || dayLabel(date)}</h1>
          <div className="sub">
            {dayLabel(date)} · {info.city}
          </div>
        </div>
        <button className="icon-btn" aria-label="這天的設定" onClick={() => setEditingDay(true)}>
          <Settings2 size={20} />
        </button>
      </header>
      <main className="page" {...swipe} style={{ minHeight: 'calc(100dvh - 140px)', paddingBottom: 84 }}>
        <div className="day-pills" ref={pillsRef} role="tablist" aria-label="選擇日期">
          {dates.map((d) => {
            const { md, wd } = shortDay(d);
            return (
              <button key={d} className={`day-pill ${d === today ? 'today' : ''}`} aria-pressed={d === date} onClick={() => setPlanDay(d)}>
                <span className="md num">{md}</span>
                <span className="wd">週{wd}</span>
                <span className="count">{counts[d] ? `${counts[d]} 站` : '·'}</span>
              </button>
            );
          })}
        </div>

        <div key={date} className={`day-body ${slide ? `slide-${slide}` : ''}`}>
        {ordered.length > 0 && (
          <div className="stack" style={{ gap: 6, marginBottom: 14 }}>
            <div className="row small">
              <span className="num">
                {fromMinutes(sched.startMin)} – {fromMinutes(sched.endMin)}
              </span>
              <span className="muted num">
                · 停留 {formatShortDuration(sched.stayMin)} · 移動 {formatShortDuration(sched.travelMin)}
                {sched.incomplete ? '+' : ''}
              </span>
              <div className="spacer" />
              {sched.endMin > 22 * 60 && <span className="chip cheek">排太滿了</span>}
            </div>
            <div className="budget" aria-hidden="true">
              <div className="stay" style={{ width: `${span ? (sched.stayMin / span) * 100 : 0}%` }} />
              <div className="travel" style={{ width: `${span ? (sched.travelMin / span) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {ordered.length === 0 ? (
          <div className="empty">
            <MapPinned size={36} />
            <p>
              這天還沒有景點
              <br />
              <span className="small">從 Google Maps 複製連結，按右下「加入景點」</span>
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => setDragging(true)} onDragCancel={() => setDragging(false)} onDragEnd={onDragEnd}>
            <SortableContext items={ordered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="timeline" style={{ gap: dragging ? 10 : 0 }}>
                {sched.items.map((it) => (
                  <Fragment key={it.card.id}>
                    {it.anchor ? (
                      <HotelTile item={it} />
                    ) : (
                      <SortablePlace card={it.card} date={date} arrive={it.arrive} lateBy={it.lateBy} tags={trip!.tags} onOpen={() => setOpenCard(it.card.id)} />
                    )}
                    {!dragging && it.leg && <LegRow leg={it.leg} departMin={it.depart} date={date} />}
                    {!dragging && !it.leg && it !== sched.items[sched.items.length - 1] && <div style={{ height: 10 }} />}
                  </Fragment>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        </div>
      </main>
      <button className="fab" onClick={() => setAdding(true)}>
        <Plus size={20} /> 加入景點
      </button>
      {adding && <AddPlaceSheet defaultDay={date} onClose={() => setAdding(false)} />}
      {editingDay && <DaySheet date={date} info={info} onClose={() => setEditingDay(false)} />}
    </>
  );
}
