import { classifyLink, LINK_KIND_LABEL, type LinkRef, type Status } from '@ping/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { LinkIcon } from '../../components/icons';
import type { Booking, BookingKind } from '../../data/model';
import { newId } from '../../data/model';
import { resolveFromText } from '../../lib/api';
import { useApp } from '../../store';

export const STATUS_LABEL: Record<Status, { label: string; tone: string }> = {
  paid: { label: '已付款', tone: 'mint' },
  confirmed: { label: '已確認', tone: 'mint' },
  booked: { label: '已訂', tone: 'sky' },
  todo: { label: '待辦', tone: 'cheek' },
  estimated: { label: '估計', tone: 'outline' },
  unverified: { label: '未查證', tone: 'outline' },
};

const KIND_LABEL: Record<BookingKind, string> = { flight: '機票', lodging: '住宿', tour: '行程 / 票券', rail: '交通' };

/** "2026-10-24T14:10:00+08:00" ⇄ { local: "2026-10-24T14:10", offset: "+08:00" } */
function splitIso(iso: string | null | undefined): { local: string; offset: string } {
  if (!iso) return { local: '', offset: '+09:00' };
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?(?::\d{2})?([+-]\d{2}:\d{2}|Z)?$/);
  if (!m) return { local: '', offset: '+09:00' };
  return { local: m[2] ? `${m[1]}T${m[2]}` : m[1], offset: m[3] && m[3] !== 'Z' ? m[3] : '+09:00' };
}

function joinIso(local: string, offset: string): string {
  if (!local) return '';
  return local.includes('T') ? `${local}:00${offset}` : local;
}

function DateTimeField({ label, value, onChange, allowDateOnly }: { label: string; value: string | null | undefined; onChange: (v: string) => void; allowDateOnly?: boolean }) {
  const { local, offset } = splitIso(value);
  const dateOnly = allowDateOnly && local.length === 10;
  return (
    <label className="field">
      <span>{label}</span>
      <div className="row">
        <input
          className="input"
          type={dateOnly ? 'date' : 'datetime-local'}
          value={local}
          onChange={(e) => onChange(joinIso(e.target.value, offset))}
        />
        {!dateOnly && (
          <select className="select" style={{ width: 96 }} value={offset} onChange={(e) => onChange(joinIso(local, e.target.value))} aria-label="時區">
            <option value="+08:00">台灣</option>
            <option value="+09:00">日本</option>
          </select>
        )}
      </div>
    </label>
  );
}

export function emptyBooking(kind: BookingKind): Booking {
  return {
    id: newId('bk_'),
    kind,
    title: '',
    status: 'booked',
    start: '',
    links: [],
    flight: kind === 'flight' ? { no: '', from: '', to: '' } : null,
    lodging: kind === 'lodging' ? {} : null,
  };
}

export function BookingSheet({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { putBooking, deleteBooking, bookings } = useApp();
  const isNew = !bookings.some((b) => b.id === booking.id);
  const [b, setB] = useState<Booking>(booking);
  const [newLink, setNewLink] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [locating, setLocating] = useState(false);
  const set = (p: Partial<Booking>) => setB((x) => ({ ...x, ...p }));
  const setFlight = (p: Partial<NonNullable<Booking['flight']>>) => set({ flight: { no: '', from: '', to: '', ...b.flight, ...p } });
  const setLodging = (p: Partial<NonNullable<Booking['lodging']>>) => set({ lodging: { ...b.lodging, ...p } });

  const addLink = () => {
    const url = newLink.trim();
    if (!/^https?:\/\//.test(url)) return;
    const kind = classifyLink(url);
    set({ links: [...b.links, { url, kind, label: LINK_KIND_LABEL[kind] }] });
    setNewLink('');
  };

  const locate = async () => {
    setLocating(true);
    const r = await resolveFromText(mapsLink);
    setLocating(false);
    if (r.place?.location) {
      setLodging({ location: r.place.location, placeId: r.place.placeId ?? null, address: b.lodging?.address || r.place.address });
      const gm: LinkRef = { url: r.place.googleMapsUri ?? mapsLink, kind: 'google-maps', label: 'Google Map' };
      set({ links: [...b.links.filter((l) => l.kind !== 'google-maps'), gm] });
      setMapsLink('');
    } else useApp.getState().showToast(r.note ?? '讀不到位置');
  };

  const save = async () => {
    await putBooking({ ...b, title: b.title || (b.flight?.no ? `${b.flight.airline ?? ''} ${b.flight.no}`.trim() : KIND_LABEL[b.kind]) });
    onClose();
  };

  return (
    <Sheet title={isNew ? `新增${KIND_LABEL[b.kind]}` : `編輯${KIND_LABEL[b.kind]}`} onClose={onClose}>
      <label className="field">
        <span>名稱</span>
        <input className="input" value={b.title} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <label className="field">
        <span>狀態</span>
        <select className="select" value={b.status} onChange={(e) => set({ status: e.target.value as Status })}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </label>

      {b.kind === 'flight' && (
        <>
          <div className="grid-2">
            <label className="field">
              <span>航空公司</span>
              <input className="input" value={b.flight?.airline ?? ''} onChange={(e) => setFlight({ airline: e.target.value })} />
            </label>
            <label className="field">
              <span>航班號</span>
              <input className="input" value={b.flight?.no ?? ''} onChange={(e) => setFlight({ no: e.target.value.toUpperCase() })} />
            </label>
            <label className="field">
              <span>出發機場代碼</span>
              <input className="input" value={b.flight?.from ?? ''} onChange={(e) => setFlight({ from: e.target.value.toUpperCase() })} />
            </label>
            <label className="field">
              <span>抵達機場代碼</span>
              <input className="input" value={b.flight?.to ?? ''} onChange={(e) => setFlight({ to: e.target.value.toUpperCase() })} />
            </label>
          </div>
          <DateTimeField label="起飛（當地）" value={b.start} onChange={(v) => set({ start: v })} />
          <DateTimeField label="抵達（當地）" value={b.end} onChange={(v) => set({ end: v })} />
          <label className="field">
            <span>行李</span>
            <input className="input" value={b.flight?.baggage ?? ''} onChange={(e) => setFlight({ baggage: e.target.value })} />
          </label>
          <label className="field">
            <span>航廈 / 交通提醒</span>
            <input className="input" value={b.flight?.terminalNote ?? ''} onChange={(e) => setFlight({ terminalNote: e.target.value })} />
          </label>
        </>
      )}

      {b.kind === 'lodging' && (
        <>
          <DateTimeField label="入住" value={b.start} onChange={(v) => set({ start: v })} allowDateOnly />
          <DateTimeField label="退房" value={b.end} onChange={(v) => set({ end: v })} allowDateOnly />
          <label className="field">
            <span>地址 / 位置描述</span>
            <input className="input" value={b.lodging?.address ?? ''} onChange={(e) => setLodging({ address: e.target.value })} />
          </label>
          <label className="field">
            <span>Google Maps 位置（貼上連結以設定地圖與天氣位置）</span>
            <div className="row">
              <input className="input" value={mapsLink} onChange={(e) => setMapsLink(e.target.value)} placeholder="https://maps.app.goo.gl/…" />
              <button className="btn sm" disabled={!mapsLink || locating} onClick={() => void locate()}>
                {locating ? '解析中' : '設定'}
              </button>
            </div>
            {b.lodging?.location && (
              <span className="tiny muted num">
                目前：{b.lodging.location.lat.toFixed(5)}, {b.lodging.location.lng.toFixed(5)}
              </span>
            )}
          </label>
        </>
      )}

      {(b.kind === 'tour' || b.kind === 'rail') && (
        <>
          <DateTimeField label="開始" value={b.start} onChange={(v) => set({ start: v })} />
          <DateTimeField label="免費取消 / 購買截止" value={b.deadline} onChange={(v) => set({ deadline: v || null })} />
        </>
      )}

      <div className="grid-2">
        <label className="field">
          <span>金額</span>
          <input
            className="input num"
            inputMode="decimal"
            value={b.amount?.amount ?? ''}
            onChange={(e) => set({ amount: e.target.value ? { amount: Number(e.target.value), currency: b.amount?.currency ?? 'TWD' } : null })}
          />
        </label>
        <label className="field">
          <span>幣別</span>
          <select className="select" value={b.amount?.currency ?? 'TWD'} onChange={(e) => set({ amount: { amount: b.amount?.amount ?? 0, currency: e.target.value } })}>
            <option>TWD</option>
            <option>JPY</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span>備註</span>
        <textarea className="textarea" value={b.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
      </label>

      <div className="field">
        <span>連結（Agoda、Airbnb、Google Map、官網…）</span>
        {b.links.map((l, i) => (
          <div key={i} className="row">
            <span className={`link-icon ${l.kind}`}>
              <LinkIcon kind={l.kind} size={16} />
            </span>
            <input
              className="input"
              value={l.label ?? ''}
              placeholder={LINK_KIND_LABEL[l.kind]}
              onChange={(e) => set({ links: b.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
            />
            <button className="icon-btn" aria-label="移除連結" onClick={() => set({ links: b.links.filter((_, j) => j !== i) })}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="row">
          <input className="input" value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="貼上網址" onKeyDown={(e) => e.key === 'Enter' && addLink()} />
          <button className="btn sm" onClick={addLink} disabled={!newLink}>
            <Plus size={14} /> 加入
          </button>
        </div>
      </div>

      <div className="row">
        {!isNew && (
          <button
            className="btn danger"
            onClick={() => {
              void deleteBooking(b.id);
              onClose();
            }}
          >
            <Trash2 size={16} /> 刪除
          </button>
        )}
        <div className="spacer" />
        <button className="btn primary" onClick={() => void save()}>
          儲存
        </button>
      </div>
    </Sheet>
  );
}
