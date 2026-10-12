import { Sparkles, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { StarMark } from '../../components/icons';
import { cloudEnabled } from '../../data/firebase';
import { blankTripSeed, osakaTripSeed } from '../../data/seed';
import { importTripJson } from '../../lib/backup';
import { useApp } from '../../store';

export function SignIn() {
  const signIn = useApp((s) => s.signIn);
  return (
    <div className="center-screen">
      <StarMark size={88} />
      <h1>Ping 旅行手帳</h1>
      <p className="muted">兩人共編行程、景點卡片、交通時間。<br />用 Google 帳號登入後即可同步。</p>
      <button className="btn primary" onClick={() => void signIn()}>
        使用 Google 登入
      </button>
      {new URLSearchParams(location.search).has('join') || sessionStorage.getItem('ping:join') ? (
        <p className="chip star">登入後會自動加入旅伴分享的行程</p>
      ) : null}
    </div>
  );
}

export function PickTrip() {
  const { trips, createTrip, openTrip } = useApp();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="page" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 32px)' }}>
        <div className="row">
          <StarMark size={44} />
          <div>
            <h1>開始一趟旅程</h1>
            <div className="muted small">{cloudEnabled ? '行程會同步給你邀請的旅伴' : '單機模式：資料只存在這台裝置'}</div>
          </div>
        </div>

        {trips.length > 0 && (
          <div className="card">
            <div className="card-head">
              <h2>我的行程</h2>
            </div>
            <div className="list">
              {trips.map((t) => (
                <button key={t.id} className="list-item btn ghost" style={{ justifyContent: 'flex-start' }} onClick={() => openTrip(t.id)}>
                  {t.name} <span className="muted small">{t.startDate} – {t.endDate}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="hero">
          <div className="row">
            <Sparkles size={18} />
            <b>大阪 × 東京迪士尼 2026</b>
          </div>
          <p className="small" style={{ margin: '6px 0 12px' }}>
            載入交接文件中已知的資料：去回程航班、新今宮住宿、海之京都一日遊與每日預定的景點卡片。
          </p>
          <button className="btn block" disabled={busy} onClick={() => run(() => createTrip(osakaTripSeed()))}>
            載入這趟行程
          </button>
        </div>

        <div className="card stack">
          <h2>建立空白行程</h2>
          <label className="field">
            <span>名稱</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：京都賞楓" />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>出發</span>
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="field">
              <span>回程</span>
              <input className="input" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <button className="btn primary" disabled={busy || !name || !start || !end || end < start} onClick={() => run(() => createTrip(blankTripSeed(name, start, end)))}>
            建立
          </button>
        </div>

        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> 從備份檔匯入
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void run(async () => createTrip(await importTripJson(f)));
          }}
        />
      </div>
    </div>
  );
}
