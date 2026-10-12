import { mapsDirectionsUrl, TRAVEL_MODES, type RouteResponse, type TravelMode } from '@ping/shared';
import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MODE_LABEL, ModeIcon } from '../../components/icons';
import { Sheet } from '../../components/Sheet';
import { jstIso } from '../../lib/time';
import { formatDistance, formatDuration } from '../../lib/time';
import { isAnchorId, legKey, toTarget, type LegPlan } from '../../lib/schedule';
import { dayInfoFor } from '../dashboard/Dashboard';
import { useApp } from '../../store';

function LegSheet({ leg, departMin, date, onClose }: { leg: LegPlan; departMin: number; date: string; onClose: () => void }) {
  const { legs, ensureLeg, patchCard, patchTrip, trip, bookings } = useApp();
  const setMode = (mode: TravelMode) => {
    // The hotel → first stop leg belongs to the day, not to a card.
    if (isAnchorId(leg.from.id)) void patchTrip({ days: { [date]: { ...dayInfoFor(trip!, date, bookings.find((b) => b.kind === 'lodging')), startLegMode: mode } } });
    else void patchCard(leg.from.id, { legMode: mode });
  };
  const options = TRAVEL_MODES.map((mode) => {
    const key = legKey(leg.from, leg.to, mode, jstIso(date, departMin));
    return { mode, key, req: { ...leg.req, mode } };
  });
  useEffect(() => {
    options.forEach((o) => ensureLeg(o.key, o.req));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leg.key]);
  const current = legs[leg.key];
  const r = typeof current === 'object' ? current : null;
  return (
    <Sheet title={`${leg.from.name} → ${leg.to.name}`} onClose={onClose}>
      <div className="mode-picker">
        {options.map((o) => {
          const v = legs[o.key];
          const res = typeof v === 'object' ? v : null;
          return (
            <button
              key={o.mode}
              className="mode-opt"
              aria-pressed={o.mode === leg.mode}
              onClick={() => setMode(o.mode)}
            >
              <span className={`leg-pill mode-${o.mode}`} style={{ border: 0, padding: 6 }}>
                <ModeIcon mode={o.mode} size={18} />
              </span>
              {MODE_LABEL[o.mode]}
              <span className="num">{v === 'loading' ? '…' : res ? formatDuration(res.durationSec) : '—'}</span>
              {res?.source === 'estimate' && <span className="tiny muted">估算</span>}
            </button>
          );
        })}
      </div>
      {r && (
        <div className="card flat stack" style={{ gap: 6 }}>
          <div className="row">
            <b className="num">{formatDuration(r.durationSec)}</b>
            <span className="muted num">{formatDistance(r.distanceM)}</span>
          </div>
          {r.summary && <div className="small">🚃 {r.summary}</div>}
          {r.source === 'estimate' && (
            <div className="tiny muted">
              這是依直線距離推估的時間{r.error === 'no-route' ? '（Google 沒有回傳這段路線，日本的大眾運輸常見這種情況）' : ''}。實際請以 Google Maps 為準。
            </div>
          )}
        </div>
      )}
      <a className="btn primary block" href={mapsDirectionsUrl(toTarget(leg.from), toTarget(leg.to), leg.mode)} target="_blank" rel="noreferrer">
        <ExternalLink size={16} /> 在 Google Maps 開啟{MODE_LABEL[leg.mode]}路線
      </a>
    </Sheet>
  );
}

export function LegRow({ leg, departMin, date }: { leg: LegPlan; departMin: number; date: string }) {
  const result = useApp((s) => s.legs[leg.key]);
  const ensureLeg = useApp((s) => s.ensureLeg);
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => ensureLeg(leg.key, leg.req), [leg.key]);
  const r: RouteResponse | null = typeof result === 'object' ? result : null;
  return (
    <div className="leg">
      <button className="leg-pill" onClick={() => setOpen(true)} aria-label={`交通方式：${MODE_LABEL[leg.mode]}，點擊切換`}>
        <span className={`mode mode-${leg.mode}`}>
          <ModeIcon mode={leg.mode} size={14} />
        </span>
        <span className="num">{result === 'loading' || !result ? '計算中…' : formatDuration(r?.durationSec)}</span>
        {r?.distanceM != null && <span className="muted num tiny">{formatDistance(r.distanceM)}</span>}
        {r?.source === 'estimate' && <span className="est">估</span>}
      </button>
      <a
        className="icon-btn"
        href={mapsDirectionsUrl(toTarget(leg.from), toTarget(leg.to), leg.mode as TravelMode)}
        target="_blank"
        rel="noreferrer"
        aria-label="在 Google Maps 開啟路線"
      >
        <ExternalLink size={16} />
      </a>
      {open && <LegSheet leg={leg} departMin={departMin} date={date} onClose={() => setOpen(false)} />}
    </div>
  );
}
