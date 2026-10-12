import { AdvancedMarker, APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { StarMark } from '../../components/icons';
import type { PlaceCard } from '../../data/model';
import { tripDates } from '../../data/model';
import { legMode, sortCards } from '../../lib/schedule';
import { dayLabel, shortDay, todayInTz } from '../../lib/time';
import { useApp } from '../../store';

const BROWSER_KEY = (import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ?? '';
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || 'DEMO_MAP_ID';
const DAY_COLORS = ['#FFD23F', '#FF7A8A', '#7EB8F0', '#6FCFAE', '#B79CF2', '#FFA45C', '#5CC8D6', '#E58FD0'];

const MODE_PARAM = { WALK: 'walking', TRANSIT: 'transit', DRIVE: 'driving', BICYCLE: 'bicycling' } as const;

/** One Google Maps link with the whole day as waypoints (Maps URLs allow up to 9 stops in between). */
function dayRouteUrl(list: PlaceCard[], mode: keyof typeof MODE_PARAM): string | null {
  const pts = list.filter((c) => c.location);
  if (pts.length < 2) return null;
  const s = (c: PlaceCard) => `${c.location!.lat},${c.location!.lng}`;
  const p = new URLSearchParams({ api: '1', origin: s(pts[0]), destination: s(pts[pts.length - 1]), travelmode: MODE_PARAM[mode] });
  const mid = pts.slice(1, -1).slice(0, 9);
  if (mid.length) p.set('waypoints', mid.map(s).join('|'));
  return `https://www.google.com/maps/dir/?${p}`;
}

function Lines({ groups }: { groups: { color: string; cards: PlaceCard[] }[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const lines = groups.map(
      (g) =>
        new google.maps.Polyline({
          map,
          path: g.cards.filter((c) => c.location).map((c) => ({ lat: c.location!.lat, lng: c.location!.lng })),
          strokeOpacity: 0,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: g.color, strokeWeight: 3, scale: 3 }, offset: '0', repeat: '12px' }],
        }),
    );
    const bounds = new google.maps.LatLngBounds();
    groups.forEach((g) => g.cards.forEach((c) => c.location && bounds.extend(c.location)));
    if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
    return () => lines.forEach((l) => l.setMap(null));
  }, [map, groups]);
  return null;
}

export function MapView() {
  const { trip, cards, bookings, setOpenCard } = useApp();
  const dates = useMemo(() => tripDates(trip!), [trip]);
  const today = todayInTz();
  const [sel, setSel] = useState<string>(dates.includes(today) ? today : 'all');
  const lodging = bookings.find((b) => b.kind === 'lodging' && b.lodging?.location);

  const groups = useMemo(
    () =>
      dates
        .map((d, i) => ({ date: d, color: DAY_COLORS[i % DAY_COLORS.length], cards: sortCards(cards, d) }))
        .filter((g) => (sel === 'all' || g.date === sel) && g.cards.length),
    [dates, cards, sel],
  );
  const inbox = sel === 'all' ? sortCards(cards, null).filter((c) => c.location) : [];
  const selectedDay = sel !== 'all' ? sel : null;
  const routeUrl = selectedDay ? dayRouteUrl(sortCards(cards, selectedDay), sortCards(cards, selectedDay)[0] ? legMode(sortCards(cards, selectedDay)[0], trip!.days[selectedDay], trip!) : 'TRANSIT') : null;

  return (
    <>
      <header className="topbar">
        <StarMark size={30} />
        <div className="title" style={{ flex: 1 }}>
          <h1>地圖</h1>
          <div className="sub">{selectedDay ? `${dayLabel(selectedDay)} ${trip!.days[selectedDay]?.title ?? ''}` : '全部日期'}</div>
        </div>
        {routeUrl && (
          <a className="btn sm" href={routeUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> 當日路線
          </a>
        )}
      </header>
      <main className="page">
        <div className="day-pills" style={{ top: 60 }}>
          <button className="day-pill" aria-pressed={sel === 'all'} onClick={() => setSel('all')}>
            <span className="md">全部</span>
            <span className="wd">{cards.length} 站</span>
          </button>
          {dates.map((d, i) => {
            const { md, wd } = shortDay(d);
            return (
              <button key={d} className="day-pill" aria-pressed={sel === d} onClick={() => setSel(d)} style={{ boxShadow: `inset 0 -3px 0 ${DAY_COLORS[i % DAY_COLORS.length]}` }}>
                <span className="md num">{md}</span>
                <span className="wd">週{wd}</span>
              </button>
            );
          })}
        </div>

        {BROWSER_KEY ? (
          <div className="map-wrap">
            <APIProvider apiKey={BROWSER_KEY} language="zh-TW" region="JP">
              <Map mapId={MAP_ID} defaultCenter={{ lat: 34.6937, lng: 135.5023 }} defaultZoom={11} gestureHandling="greedy" disableDefaultUI clickableIcons={false}>
                {groups.flatMap((g) =>
                  g.cards
                    .filter((c) => c.location)
                    .map((c, i) => (
                      <AdvancedMarker key={c.id} position={c.location!} onClick={() => setOpenCard(c.id)} title={c.name}>
                        <div className="marker num" style={{ background: g.color }}>
                          {i + 1}
                        </div>
                      </AdvancedMarker>
                    )),
                )}
                {inbox.map((c) => (
                  <AdvancedMarker key={c.id} position={c.location!} onClick={() => setOpenCard(c.id)} title={c.name}>
                    <div className="marker" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>
                      ☆
                    </div>
                  </AdvancedMarker>
                ))}
                {lodging?.lodging?.location && (
                  <AdvancedMarker position={lodging.lodging.location} title={lodging.title}>
                    <div className="marker home">🏠</div>
                  </AdvancedMarker>
                )}
                <Lines groups={groups} />
              </Map>
            </APIProvider>
          </div>
        ) : (
          <div className="card stack">
            <div className="small muted">
              尚未設定 Google Maps 瀏覽器金鑰（VITE_GOOGLE_MAPS_BROWSER_KEY），先用清單顯示；每天都可以一鍵在 Google Maps 開啟整日路線。
            </div>
            {groups.map((g) => {
              const url = dayRouteUrl(g.cards, legMode(g.cards[0], trip!.days[g.date], trip!));
              return (
                <div key={g.date} className="stack" style={{ gap: 6 }}>
                  <div className="row">
                    <span className="marker" style={{ background: g.color, minWidth: 14, height: 14, padding: 0 }} />
                    <b>{dayLabel(g.date)}</b>
                    <span className="muted small">{trip!.days[g.date]?.title}</span>
                    <div className="spacer" />
                    {url && (
                      <a className="btn sm" href={url} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} /> 路線
                      </a>
                    )}
                  </div>
                  <div className="small">
                    {g.cards.map((c, i) => (
                      <button key={c.id} className="chip outline" style={{ margin: 2, cursor: 'pointer' }} onClick={() => setOpenCard(c.id)}>
                        {i + 1}. {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
