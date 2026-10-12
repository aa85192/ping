import { TRAVEL_MODES, type TravelMode } from '@ping/shared';
import { useState } from 'react';
import { MODE_LABEL } from '../../components/icons';
import { Sheet, Toggle } from '../../components/Sheet';
import type { DayInfo } from '../../data/model';
import { resolveFromText } from '../../lib/api';
import { dayLabel } from '../../lib/time';
import { useApp } from '../../store';

export function DaySheet({ date, info, onClose }: { date: string; info: DayInfo; onClose: () => void }) {
  const patchTrip = useApp((s) => s.patchTrip);
  const [d, setD] = useState<DayInfo>(info);
  const [cityLink, setCityLink] = useState('');
  const [busy, setBusy] = useState(false);

  const locate = async () => {
    setBusy(true);
    const r = await resolveFromText(cityLink);
    setBusy(false);
    if (r.place?.location) {
      setD({ ...d, lat: r.place.location.lat, lng: r.place.location.lng, city: d.city || r.place.name });
      setCityLink('');
    } else useApp.getState().showToast(r.note ?? '讀不到位置');
  };

  const save = async () => {
    await patchTrip({ days: { [date]: { ...d, defaultMode: d.defaultMode ?? null } } });
    onClose();
  };

  return (
    <Sheet title={dayLabel(date)} onClose={onClose}>
      <label className="field">
        <span>這天的主題</span>
        <input className="input" value={d.title ?? ''} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="例如：京都" />
      </label>
      <div className="grid-2">
        <label className="field">
          <span>出發時間（離開住宿）</span>
          <input className="input" type="time" value={d.startTime ?? '09:00'} onChange={(e) => setD({ ...d, startTime: e.target.value })} />
        </label>
        <label className="field">
          <span>預設交通</span>
          <select className="select" value={d.defaultMode ?? ''} onChange={(e) => setD({ ...d, defaultMode: (e.target.value || null) as TravelMode | null })}>
            <option value="">跟隨行程預設</option>
            {TRAVEL_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>所在城市（天氣與地圖用）</span>
        <input className="input" value={d.city} onChange={(e) => setD({ ...d, city: e.target.value })} />
      </label>
      <label className="field">
        <span>城市位置：貼上該城市或飯店的 Google Maps 連結</span>
        <div className="row">
          <input className="input" value={cityLink} onChange={(e) => setCityLink(e.target.value)} placeholder="https://maps.app.goo.gl/…" />
          <button className="btn sm" disabled={!cityLink || busy} onClick={() => void locate()}>
            設定
          </button>
        </div>
        <span className="tiny muted num">
          {d.lat.toFixed(4)}, {d.lng.toFixed(4)}
        </span>
      </label>
      <div className="field">
        <span>住宿（依住宿的入住 / 退房日期自動判斷）</span>
        <div className="list">
          <div className="list-item">
            <span style={{ flex: 1 }}>從前一晚的住宿出發</span>
            <Toggle label="從住宿出發" checked={d.startAtLodging !== false} onChange={(v) => setD({ ...d, startAtLodging: v })} />
          </div>
          <div className="list-item">
            <span style={{ flex: 1 }}>最後回到當晚的住宿</span>
            <Toggle label="回到住宿" checked={d.endAtLodging !== false} onChange={(v) => setD({ ...d, endAtLodging: v })} />
          </div>
        </div>
      </div>
      <button className="btn primary block" onClick={() => void save()}>
        儲存
      </button>
    </Sheet>
  );
}
