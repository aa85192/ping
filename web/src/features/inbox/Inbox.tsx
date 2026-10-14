import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Inbox as InboxIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { StarMark } from '../../components/icons';
import { tripDates } from '../../data/model';
import { sortCards } from '../../lib/schedule';
import { dayLabel } from '../../lib/time';
import { useApp } from '../../store';
import { AddPlaceSheet } from '../itinerary/AddPlaceSheet';
import { usePasteToAdd, useDragSensors } from '../itinerary/Plan';
import { SortablePlace } from '../itinerary/PlaceTile';

export function Inbox() {
  const { trip, cards, setOpenCard, moveCard } = useApp();
  const list = sortCards(cards, null);
  const [adding, setAdding] = useState(false);
  const sensors = useDragSensors();
  usePasteToAdd(null);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = list.map((c) => c.id);
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    void moveCard(String(e.active.id), null, next.indexOf(String(e.active.id)));
  };

  return (
    <>
      <header className="topbar">
        <StarMark size={30} />
        <div className="title">
          <h1>收集箱</h1>
          <div className="sub">想去但還沒排進哪一天的地方</div>
        </div>
      </header>
      <main className="page">
        {list.length === 0 ? (
          <div className="empty">
            <InboxIcon size={36} />
            <p>
              收集箱是空的
              <br />
              <span className="small">Google Maps「分享」→ Ping（Android）或捷徑「加到 Ping」（iPhone）</span>
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="stack" style={{ gap: 10 }}>
                {list.map((c) => (
                  <div key={c.id} className="stack" style={{ gap: 4 }}>
                    <SortablePlace card={c} date={null} tags={trip!.tags} onOpen={() => setOpenCard(c.id)} />
                    <select
                      className="select small"
                      style={{ minHeight: 34, padding: '4px 10px' }}
                      value=""
                      aria-label={`把 ${c.name} 排到某天`}
                      onChange={(e) => e.target.value && void moveCard(c.id, e.target.value, 9999)}
                    >
                      <option value="">排到…</option>
                      {tripDates(trip!).map((d) => (
                        <option key={d} value={d}>
                          {dayLabel(d)} {trip!.days[d]?.title ?? ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
      <button className="fab" onClick={() => setAdding(true)}>
        <Plus size={20} /> 加入景點
      </button>
      {adding && <AddPlaceSheet defaultDay={null} onClose={() => setAdding(false)} />}
    </>
  );
}
