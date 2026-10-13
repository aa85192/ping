import { Download, FileText, Image as ImageIcon, Lock, Plus, Share2, Ticket, Trash2, Unlock } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, Toggle } from '../../components/Sheet';
import {
  ACCEPT,
  currentUid,
  deleteTripFile,
  loadFileBlob,
  renameFile,
  setFilePrivate,
  uploadTripFile,
  watchFiles,
  type TripFile,
} from '../../data/files';
import { idbKeys } from '../../lib/idb';
import { useApp } from '../../store';

const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const looksPrivate = (name: string) => /passport|護照|パスポート|visa|簽證|身分|身份|id[_-]?card/i.test(name);

function UploadSheet({ files, onClose }: { files: File[]; onClose: () => void }) {
  const tripId = useApp((s) => s.tripId)!;
  const showToast = useApp((s) => s.showToast);
  const [priv, setPriv] = useState(files.some((f) => looksPrivate(f.name)));
  const [progress, setProgress] = useState<number | null>(null);
  const upload = async () => {
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadTripFile(tripId, files[i], priv, (p) => setProgress(Math.round(((i + p / 100) / files.length) * 100)));
      }
      showToast(`已上傳 ${files.length} 個檔案`);
      onClose();
    } catch (e) {
      showToast(`上傳失敗：${(e as Error).message}`);
      setProgress(null);
    }
  };
  return (
    <Sheet title="上傳到票券夾" onClose={progress == null ? onClose : () => {}}>
      <div className="list">
        {files.map((f) => (
          <div key={f.name + f.size} className="list-item small">
            {f.type === 'application/pdf' ? <FileText size={18} /> : <ImageIcon size={18} />}
            <span className="ellipsis" style={{ flex: 1 }}>
              {f.name}
            </span>
            <span className="muted tiny">{size(f.size)}</span>
          </div>
        ))}
      </div>
      <div className="list-item">
        <Lock size={18} />
        <div style={{ flex: 1 }}>
          <div>只有我看得到</div>
          <div className="tiny muted">護照、證件建議開啟；旅伴看不到也打不開</div>
        </div>
        <Toggle label="只有我看得到" checked={priv} onChange={setPriv} />
      </div>
      {progress != null && (
        <div className="budget" aria-label={`上傳 ${progress}%`}>
          <div className="stay" style={{ width: `${progress}%` }} />
        </div>
      )}
      <button className="btn primary block" disabled={progress != null} onClick={() => void upload()}>
        {progress != null ? `上傳中 ${progress}%` : '上傳'}
      </button>
    </Sheet>
  );
}

function Viewer({ f, mine, onClose }: { f: TripFile; mine: boolean; onClose: () => void }) {
  const tripId = useApp((s) => s.tripId)!;
  const showToast = useApp((s) => s.showToast);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(f.name);
  const [note, setNote] = useState(f.note ?? '');
  useEffect(() => {
    let u: string | null = null;
    loadFileBlob(f)
      .then((b) => {
        setBlob(b);
        u = URL.createObjectURL(b);
        setUrl(u);
      })
      .catch((e: Error) => setError(navigator.onLine ? e.message : '沒有網路，而且這個檔案還沒存到這支手機'));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [f]);

  const share = async () => {
    if (!blob) return;
    const file = new File([blob], f.name, { type: f.contentType });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] }).catch(() => {});
    else if (url) window.open(url, '_blank');
  };

  return (
    <Sheet title={f.name} onClose={onClose}>
      {error && <div className="warn small">{error}</div>}
      {!url && !error && <div className="muted small">載入中…</div>}
      {url && f.contentType.startsWith('image/') && <img src={url} alt={f.name} style={{ width: '100%', borderRadius: 12, background: '#fff' }} />}
      {url && f.contentType === 'application/pdf' && <iframe src={url} title={f.name} style={{ width: '100%', height: '60dvh', border: 0, borderRadius: 12, background: '#fff' }} />}
      <div className="row">
        <span className="chip mint">已存到這支手機，離線可開</span>
        {f.private && (
          <span className="chip">
            <Lock size={12} /> 只有我
          </span>
        )}
      </div>
      <button className="btn" disabled={!blob} onClick={() => void share()}>
        <Share2 size={16} /> 分享 / 用其他 App 開啟
      </button>
      {mine && (
        <>
          <label className="field">
            <span>名稱</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== f.name && void renameFile(tripId, f, name || f.name, note || null)} />
          </label>
          <label className="field">
            <span>備註</span>
            <input className="input" value={note} placeholder="例如：10/26 USJ 入場用" onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (f.note ?? '') && void renameFile(tripId, f, name || f.name, note || null)} />
          </label>
          <div className="list-item">
            <span style={{ flex: 1 }}>只有我看得到</span>
            <Toggle
              label="只有我看得到"
              checked={f.private}
              onChange={(v) => void setFilePrivate(tripId, f, v).catch((e: Error) => showToast(`更新失敗：${e.message}`))}
            />
          </div>
          <button
            className="btn danger"
            onClick={async () => {
              if (!confirm(`刪除「${f.name}」？旅伴的手機上也會消失。`)) return;
              await deleteTripFile(tripId, f).catch((e: Error) => showToast(`刪除失敗：${e.message}`));
              onClose();
            }}
          >
            <Trash2 size={16} /> 刪除
          </button>
        </>
      )}
    </Sheet>
  );
}

export default function FilesWidget() {
  const tripId = useApp((s) => s.tripId)!;
  const showToast = useApp((s) => s.showToast);
  const [files, setFiles] = useState<TripFile[]>([]);
  const [uid, setUid] = useState('');
  const [offline, setOffline] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<File[] | null>(null);
  const [open, setOpen] = useState<TripFile | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void currentUid().then(setUid);
    return watchFiles(tripId, setFiles, (e) => showToast(`票券夾讀取失敗：${e.message}`));
  }, [tripId, showToast]);

  const refreshOffline = () => void idbKeys().then((k) => setOffline(new Set(k.map(String))));
  useEffect(refreshOffline, [files, open]);
  const missing = useMemo(() => files.filter((f) => !offline.has(f.id)), [files, offline]);

  const saveAll = async () => {
    setSaving(true);
    for (const f of missing) await loadFileBlob(f).catch(() => {});
    setSaving(false);
    refreshOffline();
    showToast('全部存到這支手機了，沒網路也能開');
  };

  return (
    <section className="card">
      <div className="card-head">
        <Ticket size={18} className="icon" />
        <h2>票券夾</h2>
        <div className="spacer" />
        <button className="icon-btn" aria-label="上傳檔案" onClick={() => input.current?.click()}>
          <Plus size={18} />
        </button>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const list = [...(e.target.files ?? [])];
            e.target.value = '';
            if (list.length) setPicked(list);
          }}
        />
      </div>
      {files.length === 0 && <div className="muted small">門票 QR、新幹線 e 票、入住指南截圖、PDF。只有你們兩個登入後看得到。</div>}
      <div className="list">
        {files.map((f) => (
          <button key={f.id} className="list-item btn ghost" style={{ justifyContent: 'flex-start', borderRadius: 0, height: 'auto', padding: '8px 0', textAlign: 'left' }} onClick={() => setOpen(f)}>
            <span className="link-icon">{f.contentType === 'application/pdf' ? <FileText size={16} /> : <ImageIcon size={16} />}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="ellipsis" style={{ display: 'block' }}>
                {f.name}
              </span>
              <span className="tiny muted">
                {f.note ? `${f.note} · ` : ''}
                {size(f.size)}
                {offline.has(f.id) ? ' · 離線可開' : ''}
              </span>
            </span>
            {f.private ? <Lock size={14} aria-label="只有我看得到" /> : <Unlock size={14} className="muted" aria-label="旅伴也看得到" />}
          </button>
        ))}
      </div>
      {missing.length > 0 && (
        <button className="btn sm" style={{ marginTop: 8 }} disabled={saving || !navigator.onLine} onClick={() => void saveAll()}>
          <Download size={14} /> {saving ? '下載中…' : `全部存到這支手機（${missing.length}）`}
        </button>
      )}
      {picked && <UploadSheet files={picked} onClose={() => setPicked(null)} />}
      {open && <Viewer f={files.find((x) => x.id === open.id) ?? open} mine={open.ownerUid === uid} onClose={() => setOpen(null)} />}
    </section>
  );
}
