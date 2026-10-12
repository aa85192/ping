import type { FlightPhase, FlightStatus } from '@ping/shared';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Booking } from '../../data/model';
import { apiEnabled, fetchFlightStatus } from '../../lib/api';
import { useApp } from '../../store';

const PHASE: Record<FlightPhase, { label: string; tone: string }> = {
  scheduled: { label: '預定', tone: 'outline' },
  'on-time': { label: '準時', tone: 'mint' },
  delayed: { label: '延誤', tone: 'cheek' },
  boarding: { label: '登機中', tone: 'star' },
  departed: { label: '已起飛', tone: 'sky' },
  landed: { label: '已抵達', tone: 'mint' },
  cancelled: { label: '取消', tone: 'cheek' },
  unknown: { label: '狀態未知', tone: 'outline' },
};

const inFlight = new Set<string>();

/** How stale the stored status may be: every 15 min from 24 h before departure, otherwise twice a day. */
export function needsRefresh(b: Booking, now = Date.now()): boolean {
  const live = b.flight?.live;
  const dep = Date.parse(b.start);
  if (!Number.isFinite(dep)) return false;
  const arr = b.end ? Date.parse(b.end) : dep + 4 * 3600_000;
  if (now > arr + 3 * 3600_000) return !live;
  const age = now - (live?.fetchedAt ?? 0);
  return now >= dep - 24 * 3600_000 ? age > 15 * 60_000 : age > 12 * 3600_000;
}

async function refresh(b: Booking) {
  if (!b.flight || inFlight.has(b.id)) return;
  inFlight.add(b.id);
  try {
    const live = await fetchFlightStatus({
      flightNo: b.flight.no,
      airline: b.flight.airline,
      from: b.flight.from,
      to: b.flight.to,
      departure: b.start,
      arrival: b.end ?? undefined,
    });
    if (live) {
      const latest = useApp.getState().bookings.find((x) => x.id === b.id) ?? b;
      await useApp.getState().putBooking({ ...latest, flight: { ...latest.flight!, live } });
    }
  } finally {
    inFlight.delete(b.id);
  }
}

function ago(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} 小時前` : `${Math.round(h / 24)} 天前`;
}

function Cell({ label, value, pending }: { label: string; value: string | null; pending?: string }) {
  return (
    <div className="live-cell">
      <span className="tiny muted">{label}</span>
      <b className="num">{value ?? <span className="muted tiny">{pending ?? '—'}</span>}</b>
    </div>
  );
}

export function FlightLive({ b }: { b: Booking }) {
  const [busy, setBusy] = useState(false);
  const live: FlightStatus | null | undefined = b.flight?.live;
  useEffect(() => {
    if (apiEnabled && needsRefresh(b)) void refresh(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.id, live?.fetchedAt]);
  if (!apiEnabled || !b.flight) return null;
  const dayOf = Date.now() >= Date.parse(b.start) - 24 * 3600_000;
  const phase = live ? PHASE[live.status] : null;
  return (
    <div className="live" onClick={(e) => e.stopPropagation()}>
      <div className="live-grid">
        <Cell label={`${b.flight.from} 航廈`} value={live?.depTerminal ?? null} />
        <Cell label="登機口" value={live?.depGate ?? null} pending={dayOf ? '未公布' : '當天公布'} />
        <Cell label={`${b.flight.to} 航廈`} value={live?.arrTerminal ?? null} />
        <Cell label="行李轉盤" value={live?.baggageBelt ?? null} pending={dayOf ? '未公布' : '當天公布'} />
      </div>
      <div className="row wrap tiny muted live-meta">
        {phase && live?.status !== 'unknown' && <span className={`chip ${phase.tone}`}>{phase.label}</span>}
        {live?.depEstimated && <span className="num">預計起飛 {live.depEstimated}</span>}
        {live?.arrEstimated && <span className="num">預計抵達 {live.arrEstimated}</span>}
        <span className="spacer" />
        <span>{live ? `AI 查詢 · ${ago(live.fetchedAt)}` : busy ? '查詢中…' : '尚未查詢'}</span>
        <button
          className="icon-btn"
          style={{ width: 30, height: 30 }}
          aria-label="更新航班動態"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await refresh(b);
            setBusy(false);
          }}
        >
          <RefreshCw size={14} className={busy ? 'spin' : undefined} />
        </button>
      </div>
      {live?.note && <div className="tiny muted">{live.note}</div>}
      {live?.sources?.length ? (
        <div className="row wrap" style={{ gap: 4, marginTop: 4 }}>
          {live.sources.map((s) => (
            <a key={s.url} className="chip outline tiny" href={s.url} target="_blank" rel="noreferrer">
              {s.title.slice(0, 22)}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
