import { classifyLink, LINK_KIND_LABEL, mapsPlaceUrl } from '@ping/shared';
import { ChevronDown, ChevronUp, ExternalLink, Link2, MapPin, Pencil, RefreshCw, Star, StickyNote, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { LinkIcon } from '../../components/icons';
import { Sheet } from '../../components/Sheet';
import type { Memo, PlaceCard } from '../../data/model';
import { tripDates } from '../../data/model';
import { apiEnabled } from '../../lib/api';
import { hoursForDay } from '../../lib/hours';
import { DEFAULT_STAY } from '../../lib/schedule';
import { dayLabel, formatShortDuration } from '../../lib/time';
import { useApp } from '../../store';
import { Embed } from './Embed';

const STAY_PRESETS = [30, 60, 90, 120, 180, 240];

/** Notes support "- [ ]" / "- [x]" checklist lines; everything else is plain text. */
function NoteBody({ text, onToggle }: { text: string; onToggle: (lineIndex: number) => void }) {
  return (
    <div>
      {text.split('\n').map((line, i) => {
        const m = line.match(/^\s*[-*] \[( |x|X)\] (.*)$/);
        if (m)
          return (
            <label key={i} className="checkline">
              <input type="checkbox" checked={m[1] !== ' '} onChange={() => onToggle(i)} />
              <span style={{ textDecoration: m[1] !== ' ' ? 'line-through' : undefined }}>{m[2]}</span>
            </label>
          );
        return <div key={i}>{line || ' '}</div>;
      })}
    </div>
  );
}

function MemoItem({ card, memo }: { card: PlaceCard; memo: Memo }) {
  const { updateMemo, deleteMemo, trip } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo.type === 'note' ? memo.text : memo.title ?? '');
  const [showEmbed, setShowEmbed] = useState(false);
  const author = memo.by ? trip?.memberProfiles?.[memo.by]?.name?.split(' ')[0] : undefined;

  if (memo.type === 'note') {
    const toggle = (lineIndex: number) => {
      const lines = memo.text.split('\n');
      lines[lineIndex] = lines[lineIndex].replace(/\[( |x|X)\]/, (_, c: string) => (c === ' ' ? '[x]' : '[ ]'));
      void updateMemo(card.id, memo.id, { text: lines.join('\n') });
    };
    return (
      <div className="memo note">
        {editing ? (
          <div className="stack" style={{ gap: 8 }}>
            <textarea className="textarea" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <div className="row">
              <button className="btn sm danger" onClick={() => void deleteMemo(card.id, memo.id)}>
                <Trash2 size={14} /> 刪除
              </button>
              <div className="spacer" />
              <button className="btn sm" onClick={() => setEditing(false)}>
                取消
              </button>
              <button
                className="btn sm primary"
                onClick={() => {
                  void updateMemo(card.id, memo.id, { text: draft });
                  setEditing(false);
                }}
              >
                儲存
              </button>
            </div>
          </div>
        ) : (
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <NoteBody text={memo.text} onToggle={toggle} />
              {author && <div className="tiny muted">— {author}</div>}
            </div>
            <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="編輯筆記" onClick={() => setEditing(true)}>
              <Pencil size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  const embeddable = memo.kind === 'threads' || memo.kind === 'instagram';
  return (
    <div className="memo stack" style={{ gap: 8 }}>
      <div className="row">
        <a className="memo-link" href={memo.url} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
          <span className={`link-icon ${memo.kind}`}>
            <LinkIcon kind={memo.kind} />
          </span>
          <span style={{ minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 500 }}>
              {memo.title || LINK_KIND_LABEL[memo.kind]}
            </div>
            <div className="tiny muted ellipsis">{memo.url.replace(/^https?:\/\/(www\.)?/, '')}</div>
          </span>
        </a>
        {embeddable && (
          <button className="icon-btn" aria-label={showEmbed ? '收起預覽' : '展開預覽'} onClick={() => setShowEmbed(!showEmbed)}>
            {showEmbed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        )}
        <button className="icon-btn" aria-label="刪除連結" onClick={() => void deleteMemo(card.id, memo.id)}>
          <Trash2 size={16} />
        </button>
      </div>
      {showEmbed && <Embed url={memo.url} />}
    </div>
  );
}

function AddMemo({ cardId }: { cardId: string }) {
  const addMemo = useApp((s) => s.addMemo);
  const [type, setType] = useState<'note' | 'link'>('note');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const url = text.trim().match(/https?:\/\/\S+/)?.[0];
  const submit = () => {
    if (type === 'note' && text.trim()) void addMemo(cardId, { type: 'note', text: text.trim() });
    else if (type === 'link' && url) void addMemo(cardId, { type: 'link', url, title: title.trim() || undefined });
    else return;
    setText('');
    setTitle('');
  };
  return (
    <div className="card flat stack" style={{ gap: 8 }}>
      <div className="seg" role="group" aria-label="memo 類型">
        <button aria-pressed={type === 'note'} onClick={() => setType('note')}>
          <StickyNote size={14} /> 筆記
        </button>
        <button aria-pressed={type === 'link'} onClick={() => setType('link')}>
          <Link2 size={14} /> Threads / IG / 連結
        </button>
      </div>
      {type === 'note' ? (
        <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={'想吃什麼、注意事項…\n- [ ] 可以用這種格式做待辦'} />
      ) : (
        <>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://www.threads.com/@…/post/…" />
          {url && (
            <div className="row tiny muted">
              <LinkIcon kind={classifyLink(url)} size={14} /> {LINK_KIND_LABEL[classifyLink(url)]}
            </div>
          )}
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="標題（選填）：例如 必點的蟹肉丼" />
        </>
      )}
      <button className="btn primary" disabled={type === 'note' ? !text.trim() : !url} onClick={submit}>
        加入
      </button>
    </div>
  );
}

export function CardSheet({ cardId }: { cardId: string }) {
  const { trip, cards, setOpenCard, patchCard, moveCard, deleteCard, refreshCard } = useApp();
  const card = cards.find((c) => c.id === cardId);
  const [renaming, setRenaming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  if (!card || !trip) return null;
  const close = () => setOpenCard(null);
  const mapsUrl = card.googleMapsUri || mapsPlaceUrl({ name: card.name, placeId: card.placeId ?? undefined, location: card.location ?? undefined });
  const hours = card.day ? hoursForDay(card.openingPeriods, card.day) : null;
  const stay = card.stayMinutes ?? DEFAULT_STAY;

  return (
    <Sheet title={card.name} onClose={close}>
      {card.photoUrl && <img className="hero-photo" src={card.photoUrl} alt="" referrerPolicy="no-referrer" />}

      {renaming ? (
        <input
          className="input"
          defaultValue={card.name}
          autoFocus
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== card.name) void patchCard(card.id, { name: e.target.value.trim() });
            setRenaming(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }} className="stack">
            <div className="row wrap small">
              {card.rating != null && (
                <span className="row" style={{ gap: 3 }}>
                  <Star size={14} fill="var(--star)" stroke="var(--star-deep)" />
                  <b>{card.rating.toFixed(1)}</b>
                  <span className="muted">({card.userRatingCount ?? 0})</span>
                </span>
              )}
              {hours && <span className={`chip ${hours === '公休' ? 'cheek' : 'mint'}`}>{card.day && dayLabel(card.day)} {hours}</span>}
              {card.resolveState === 'partial' && <span className="chip outline">僅有網址資訊</span>}
            </div>
            {card.address && (
              <div className="small muted row" style={{ alignItems: 'flex-start', gap: 4 }}>
                <MapPin size={14} style={{ flex: 'none', marginTop: 3 }} /> {card.address}
              </div>
            )}
          </div>
          <button className="icon-btn" aria-label="改名稱" onClick={() => setRenaming(true)}>
            <Pencil size={16} />
          </button>
        </div>
      )}

      <div className="row">
        <a className="btn primary" style={{ flex: 1 }} href={mapsUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> 在 Google Maps 開啟
        </a>
        {apiEnabled && card.resolveState !== 'resolved' && (
          <button
            className="btn"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              await refreshCard(card.id);
              setRefreshing(false);
            }}
          >
            <RefreshCw size={16} /> {refreshing ? '更新中' : '取得 Google 資料'}
          </button>
        )}
      </div>

      <section className="card flat stack" style={{ gap: 10 }}>
        <label className="field">
          <span>日期</span>
          <select className="select" value={card.day ?? ''} onChange={(e) => void moveCard(card.id, e.target.value || null, 9999)}>
            <option value="">收集箱</option>
            {tripDates(trip).map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)} {trip.days[d]?.title ?? ''}
              </option>
            ))}
          </select>
        </label>
        <div className="grid-2">
          <label className="field">
            <span>指定抵達時間</span>
            <input className="input" type="time" value={card.plannedStart ?? ''} onChange={(e) => void patchCard(card.id, { plannedStart: e.target.value || null })} />
          </label>
          <label className="field">
            <span>停留（分鐘）</span>
            <input
              className="input num"
              type="number"
              min={0}
              step={15}
              key={stay}
              defaultValue={stay}
              onBlur={(e) => Number(e.target.value) !== stay && void patchCard(card.id, { stayMinutes: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        </div>
        <div className="row wrap">
          {STAY_PRESETS.map((m) => (
            <button key={m} className={`chip ${m === stay ? 'star' : 'outline'}`} style={{ cursor: 'pointer' }} onClick={() => void patchCard(card.id, { stayMinutes: m })}>
              {formatShortDuration(m)}
            </button>
          ))}
        </div>
        <div className="field">
          <span>標籤</span>
          <div className="row wrap">
            {trip.tags.map((t) => {
              const on = card.tags.includes(t.id);
              return (
                <button
                  key={t.id}
                  className="chip"
                  aria-pressed={on}
                  style={{
                    cursor: 'pointer',
                    background: on ? `color-mix(in srgb, ${t.color} 40%, var(--surface))` : 'transparent',
                    borderColor: on ? 'transparent' : 'var(--border)',
                  }}
                  onClick={() => void patchCard(card.id, { tags: on ? card.tags.filter((x) => x !== t.id) : [...card.tags, t.id] })}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <h3>Memo</h3>
      {card.memos.length === 0 && <div className="small muted">還沒有 memo。可以記筆記、貼 Threads 或 IG 貼文。</div>}
      {card.memos.map((m) => (
        <MemoItem key={m.id} card={card} memo={m} />
      ))}
      <AddMemo cardId={card.id} />

      <button className="btn danger" onClick={() => void deleteCard(card.id)}>
        <Trash2 size={16} /> 刪除這張卡片
      </button>
    </Sheet>
  );
}
