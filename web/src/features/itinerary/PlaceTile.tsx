import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, GripVertical, MapPinOff, MessageSquareText, Star, TriangleAlert } from 'lucide-react';
import { StarMark } from '../../components/icons';
import type { PlaceCard, TagDef } from '../../data/model';
import { checkHours } from '../../lib/hours';
import { usePrefs } from '../../lib/prefs';
import { formatShortDuration, fromMinutes } from '../../lib/time';
import { DEFAULT_STAY } from '../../lib/schedule';

export function TagChips({ ids, tags }: { ids: string[]; tags: TagDef[] }) {
  return (
    <>
      {ids.map((id) => {
        const t = tags.find((x) => x.id === id);
        if (!t) return null;
        return (
          <span key={id} className="chip" style={{ background: `color-mix(in srgb, ${t.color} 26%, var(--surface))` }}>
            {t.label}
          </span>
        );
      })}
    </>
  );
}

export function PlaceTileBody({ card, date, arrive, lateBy, tags }: { card: PlaceCard; date: string | null; arrive?: number; lateBy?: number; tags: TagDef[] }) {
  const f = usePrefs((s) => s.cardFields);
  const hours = date && f.hours ? checkHours(card.openingPeriods, date, arrive != null ? fromMinutes(arrive) : card.plannedStart) : null;
  return (
    <>
      {f.photo &&
        (card.photoUrl ? (
          <img className="thumb" src={card.photoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="thumb">
            <StarMark size={30} face={false} />
          </div>
        ))}
      <div className="body">
        <div className="name">{card.name}</div>
        <div className="meta">
          {f.rating && card.rating != null && (
            <span className="row" style={{ gap: 2 }}>
              <Star size={12} fill="var(--star)" stroke="var(--star-deep)" /> {card.rating.toFixed(1)}
            </span>
          )}
          {f.time && date && (
            <span className="row num" style={{ gap: 2 }}>
              <Clock size={12} /> 停留 {formatShortDuration(card.stayMinutes ?? DEFAULT_STAY)}
            </span>
          )}
          {f.memos && card.memos.length > 0 && (
            <span className="row" style={{ gap: 2 }}>
              <MessageSquareText size={12} /> {card.memos.length}
            </span>
          )}
          {f.tags && <TagChips ids={card.tags} tags={tags} />}
        </div>
        {f.address && card.address && <div className="tiny muted ellipsis">{card.address}</div>}
        {hours?.kind === 'closed-day' && (
          <span className="tiny warn">
            <TriangleAlert size={12} /> 這天可能公休
          </span>
        )}
        {hours?.kind === 'outside' && (
          <span className="tiny warn">
            <TriangleAlert size={12} /> 抵達時可能未營業{hours.opens && `（${hours.opens} 開）`}
          </span>
        )}
        {lateBy ? (
          <span className="tiny warn">
            <TriangleAlert size={12} /> 預估晚到 {formatShortDuration(lateBy)}
          </span>
        ) : null}
        {card.resolveState !== 'pending' && !card.location && !card.placeId && (
          <span className="tiny warn">
            <MapPinOff size={12} /> 沒有座標，無法計算交通
          </span>
        )}
      </div>
    </>
  );
}

export function SortablePlace({
  card,
  date,
  arrive,
  lateBy,
  tags,
  onOpen,
}: {
  card: PlaceCard;
  date: string | null;
  arrive?: number;
  lateBy?: number;
  tags: TagDef[];
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const showTime = usePrefs((s) => s.cardFields.time);
  return (
    <div
      ref={setNodeRef}
      className={`place ${isDragging ? 'dragging' : ''} ${card.resolveState === 'pending' ? 'pending' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onOpen}
    >
      {date && showTime && (
        <div className="time-col num">
          <b>{arrive != null ? fromMinutes(arrive) : '—'}</b>
          {card.plannedStart ? '指定' : '預估'}
        </div>
      )}
      <PlaceTileBody card={card} date={date} arrive={arrive} lateBy={lateBy} tags={tags} />
      <button
        ref={setActivatorNodeRef}
        className="grip icon-btn"
        aria-label="拖曳排序"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={18} />
      </button>
    </div>
  );
}
