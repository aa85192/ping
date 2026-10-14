import { TRAVEL_MODES, type TravelMode } from '@ping/shared';
import { ArrowDown, ArrowUp, Copy, Download, ImagePlus, LogOut, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { MODE_LABEL, StarMark } from '../../components/icons';
import { Toggle } from '../../components/Sheet';
import { cloudEnabled } from '../../data/firebase';
import { newId } from '../../data/model';
import { apiEnabled } from '../../lib/api';
import { exportTripJson } from '../../lib/backup';
import { extractPalette } from '../../lib/palette';
import { CARD_FIELD_LABEL, TAB_LABEL, usePrefs, WIDGET_LABEL, type CardField, type Toggle as ToggleItem } from '../../lib/prefs';
import { useSystemDark } from '../../lib/useTheme';
import { DAYLIGHT, NIGHT, SWATCHES } from '../../theme/tokens';
import { useApp } from '../../store';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function OrderList<T extends string>({ items, labels, locked, onChange }: { items: ToggleItem<T>[]; labels: Record<T, string>; locked?: T[]; onChange: (v: ToggleItem<T>[]) => void }) {
  const move = (i: number, d: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <div className="list">
      {items.map((it, i) => (
        <div key={it.id} className="list-item">
          <span style={{ flex: 1 }}>{labels[it.id]}</span>
          <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="往上">
            <ArrowUp size={16} />
          </button>
          <button className="icon-btn" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="往下">
            <ArrowDown size={16} />
          </button>
          <Toggle
            label={`顯示${labels[it.id]}`}
            checked={it.visible || Boolean(locked?.includes(it.id))}
            onChange={(v) => !locked?.includes(it.id) && onChange(items.map((x) => (x.id === it.id ? { ...x, visible: v } : x)))}
          />
        </div>
      ))}
    </div>
  );
}

function ColorRow({ label, value, fallback, onChange }: { label: string; value?: string; fallback: string; onChange: (v?: string) => void }) {
  const v = value ?? fallback;
  return (
    <div className="palette-row">
      <input type="color" className="swatch" value={v} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={label} />
      <div style={{ flex: 1 }}>
        <div>{label}</div>
        <div className="hex">{v.toUpperCase()}</div>
      </div>
      {value && (
        <button className="btn sm ghost" onClick={() => onChange(undefined)}>
          <RotateCcw size={14} /> 還原
        </button>
      )}
    </div>
  );
}

function ThemeSection() {
  const prefs = usePrefs();
  const systemDark = useSystemDark();
  const dark = prefs.themeMode === 'dark' || (prefs.themeMode === 'system' && systemDark);
  const base = dark ? NIGHT : DAYLIGHT;
  const [extracted, setExtracted] = useState<string[]>([]);
  const [target, setTarget] = useState<'star' | 'cheek' | 'sky'>('star');
  const fileRef = useRef<HTMLInputElement>(null);
  const setO = (p: Partial<typeof prefs.overrides>) => {
    const next = { ...prefs.overrides, ...p };
    (Object.keys(next) as (keyof typeof next)[]).forEach((k) => next[k] === undefined && delete next[k]);
    prefs.set({ overrides: next });
  };

  return (
    <Section title="外觀">
      <div className="seg" role="group" aria-label="主題">
        {(['system', 'light', 'dark'] as const).map((m) => (
          <button key={m} aria-pressed={prefs.themeMode === m} onClick={() => prefs.set({ themeMode: m })}>
            {m === 'system' ? '跟隨系統' : m === 'light' ? '白天' : '星夜'}
          </button>
        ))}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <div className="small muted">星星人色票（白天 / 星夜，取自官方插畫）</div>
        {SWATCHES.map((s) => (
          <div key={s.name} className="palette-row">
            <span className="swatch" style={{ background: s.light, cursor: 'default' }} />
            <span className="swatch" style={{ background: s.dark, cursor: 'default' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="small">
                <b>{s.name}</b> <span className="hex">{s.light} / {s.dark}</span>
              </div>
              <div className="tiny muted">{s.role}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div className="small muted">自訂顏色（只影響這台裝置）</div>
        <ColorRow label="主色・星星黃" value={prefs.overrides.star} fallback={base.star} onChange={(v) => setO({ star: v })} />
        <ColorRow label="強調・腮紅" value={prefs.overrides.cheek} fallback={base.cheek} onChange={(v) => setO({ cheek: v })} />
        <ColorRow label="輔助・標籤藍" value={prefs.overrides.sky} fallback={base.sky} onChange={(v) => setO({ sky: v })} />
        <label className="field">
          <span>圓角 {prefs.overrides.radius ?? 16}px</span>
          <input type="range" min={6} max={24} value={prefs.overrides.radius ?? 16} onChange={(e) => setO({ radius: Number(e.target.value) })} />
        </label>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={16} /> 從照片取色（拍你的星星人公仔）
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const colors = await extractPalette(f);
            setExtracted(colors);
            if (!colors.length) useApp.getState().showToast('照片裡找不到明顯的顏色，換一張背景單純的試試');
          }}
        />
        {extracted.length > 0 && (
          <>
            <div className="seg" role="group" aria-label="套用到">
              {(['star', 'cheek', 'sky'] as const).map((t) => (
                <button key={t} aria-pressed={target === t} onClick={() => setTarget(t)}>
                  {t === 'star' ? '主色' : t === 'cheek' ? '強調' : '輔助'}
                </button>
              ))}
            </div>
            <div className="swatch-row">
              {extracted.map((c) => (
                <button key={c} className="swatch" style={{ background: c }} title={c} aria-label={`套用 ${c}`} onClick={() => setO({ [target]: c })} />
              ))}
            </div>
            <div className="tiny muted">點一個色塊套用到「{target === 'star' ? '主色' : target === 'cheek' ? '強調' : '輔助'}」；文字顏色會自動調深以維持可讀性。</div>
          </>
        )}
      </div>
    </Section>
  );
}

function TripSection() {
  const { trip, patchTrip } = useApp();
  const [newTag, setNewTag] = useState('');
  if (!trip) return null;
  return (
    <Section title="行程">
      <label className="field">
        <span>名稱</span>
        <input className="input" defaultValue={trip.name} onBlur={(e) => e.target.value !== trip.name && void patchTrip({ name: e.target.value })} />
      </label>
      <div className="grid-2">
        <label className="field">
          <span>出發</span>
          <input className="input" type="date" defaultValue={trip.startDate} onBlur={(e) => e.target.value && e.target.value !== trip.startDate && void patchTrip({ startDate: e.target.value })} />
        </label>
        <label className="field">
          <span>回程</span>
          <input className="input" type="date" defaultValue={trip.endDate} onBlur={(e) => e.target.value && e.target.value !== trip.endDate && void patchTrip({ endDate: e.target.value })} />
        </label>
        <label className="field">
          <span>人數</span>
          <input className="input num" type="number" min={1} defaultValue={trip.travelers} onBlur={(e) => void patchTrip({ travelers: Number(e.target.value) || 1 })} />
        </label>
        <label className="field">
          <span>預算（NT$，兩人合計）</span>
          <input className="input num" type="number" min={0} step={1000} defaultValue={trip.budget ?? ''} placeholder="例如 82500" onBlur={(e) => void patchTrip({ budget: e.target.value ? Number(e.target.value) : null })} />
        </label>
        <label className="field">
          <span>匯率 ¥1 = NT$</span>
          <input className="input num" type="number" step="0.001" defaultValue={trip.fxRate} onBlur={(e) => void patchTrip({ fxRate: Number(e.target.value) || trip.fxRate })} />
        </label>
      </div>
      <label className="field">
        <span>預設交通工具</span>
        <select className="select" value={trip.defaultMode} onChange={(e) => void patchTrip({ defaultMode: e.target.value as TravelMode })}>
          {TRAVEL_MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        <span>標籤</span>
        {trip.tags.map((t, i) => (
          <div key={t.id} className="row">
            <input
              type="color"
              className="swatch"
              value={t.color}
              aria-label={`${t.label} 顏色`}
              onChange={(e) => void patchTrip({ tags: trip.tags.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)) })}
            />
            <input className="input" defaultValue={t.label} onBlur={(e) => void patchTrip({ tags: trip.tags.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <button className="icon-btn" aria-label={`刪除 ${t.label}`} onClick={() => void patchTrip({ tags: trip.tags.filter((x) => x.id !== t.id) })}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="row">
          <input className="input" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="新標籤，例如：甜點" />
          <button
            className="btn sm"
            disabled={!newTag.trim()}
            onClick={() => {
              void patchTrip({ tags: [...trip.tags, { id: newId('tag_'), label: newTag.trim(), color: '#AFAA45' }] });
              setNewTag('');
            }}
          >
            <Plus size={14} /> 加入
          </button>
        </div>
      </div>
    </Section>
  );
}

function SharingSection() {
  const { trip, user, signOut, showToast } = useApp();
  if (!cloudEnabled) {
    return (
      <Section title="共同編輯">
        <div className="small muted">
          目前是<b>單機模式</b>：資料只存在這台裝置的瀏覽器。設定 Firebase（見 README）後，就能用 Google 帳號登入、邀請旅伴一起編輯，離線時也能看。
        </div>
      </Section>
    );
  }
  const link = trip?.inviteCode ? `${location.origin}/?join=${trip.id}&code=${trip.inviteCode}` : '';
  const members = Object.entries(trip?.memberProfiles ?? {});
  return (
    <Section title="共同編輯">
      <div className="list">
        {members.map(([uid, m]) => (
          <div key={uid} className="list-item">
            {m.photoURL ? <img src={m.photoURL} alt="" width={32} height={32} style={{ borderRadius: 999 }} referrerPolicy="no-referrer" /> : <Users size={20} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>
                {m.name} {uid === user?.uid && <span className="chip star">我</span>} {uid === trip?.ownerUid && <span className="chip outline">建立者</span>}
              </div>
              <div className="tiny muted ellipsis">{m.email}</div>
            </div>
          </div>
        ))}
      </div>
      {link && (
        <>
          <div className="small muted">把邀請連結傳給旅伴，對方用 Google 登入後就會加入這趟行程。</div>
          <button
            className="btn primary"
            onClick={async () => {
              if (navigator.share) await navigator.share({ title: trip!.name, text: `一起編輯「${trip!.name}」`, url: link }).catch(() => {});
              else {
                await navigator.clipboard.writeText(link);
                showToast('已複製邀請連結');
              }
            }}
          >
            <Copy size={16} /> 分享邀請連結
          </button>
        </>
      )}
      <button className="btn" onClick={() => void signOut()}>
        <LogOut size={16} /> 登出 {user?.email}
      </button>
    </Section>
  );
}

export function Settings() {
  const prefs = usePrefs();
  const { trip, cards, bookings, expenses, trips, openTrip, repo } = useApp();
  return (
    <>
      <header className="topbar">
        <StarMark size={30} />
        <div className="title">
          <h1>設定</h1>
        </div>
      </header>
      <main className="page">
        <SharingSection />
        <TripSection />
        <ThemeSection />
        <Section title="底部分頁">
          <OrderList items={prefs.tabs} labels={TAB_LABEL} locked={['settings']} onChange={(tabs) => prefs.set({ tabs })} />
        </Section>
        <Section title="總覽小工具">
          <OrderList items={prefs.widgets} labels={WIDGET_LABEL} onChange={(widgets) => prefs.set({ widgets })} />
        </Section>
        <Section title="卡片顯示">
          <div className="list">
            {(Object.keys(CARD_FIELD_LABEL) as CardField[]).map((f) => (
              <div key={f} className="list-item">
                <span style={{ flex: 1 }}>{CARD_FIELD_LABEL[f]}</span>
                <Toggle label={CARD_FIELD_LABEL[f]} checked={prefs.cardFields[f]} onChange={(v) => prefs.set({ cardFields: { ...prefs.cardFields, [f]: v } })} />
              </div>
            ))}
          </div>
        </Section>
        <Section title="資料">
          {trips.length > 1 && (
            <label className="field">
              <span>切換行程</span>
              <select className="select" value={trip?.id} onChange={(e) => openTrip(e.target.value)}>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="btn" onClick={() => trip && exportTripJson(trip, cards, bookings, expenses)}>
            <Download size={16} /> 匯出備份（JSON）
          </button>
          <button className="btn" onClick={() => useApp.setState({ phase: 'pick' })}>
            <Plus size={16} /> 建立 / 匯入其他行程
          </button>
          <div className="tiny muted">
            儲存：{repo?.kind === 'cloud' ? 'Firebase 雲端（離線可用）' : '這台裝置'} · 地點與路線 API：{apiEnabled ? '已連線' : '未設定（交通時間為估算）'}
          </div>
        </Section>
      </main>
    </>
  );
}
