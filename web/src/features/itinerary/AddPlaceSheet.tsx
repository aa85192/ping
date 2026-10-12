import { ClipboardPaste } from 'lucide-react';
import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { tripDates } from '../../data/model';
import { dayLabel } from '../../lib/time';
import { apiEnabled } from '../../lib/api';
import { useApp } from '../../store';

export function AddPlaceSheet({ defaultDay, onClose }: { defaultDay: string | null; onClose: () => void }) {
  const trip = useApp((s) => s.trip)!;
  const addFromText = useApp((s) => s.addFromText);
  const [text, setText] = useState('');
  const [day, setDay] = useState<string | null>(defaultDay);
  const [busy, setBusy] = useState(false);

  const pasteFromClipboard = async () => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      useApp.getState().showToast('瀏覽器不允許讀取剪貼簿，請長按輸入框貼上');
    }
  };

  const submit = async () => {
    setBusy(true);
    const id = await addFromText(text, day);
    setBusy(false);
    if (id) onClose();
  };

  return (
    <Sheet title="加入景點" onClose={onClose}>
      <p className="small muted" style={{ margin: 0 }}>
        在 Google Maps 打開地點 →「分享」→「複製連結」，貼到這裡。也可以直接輸入地點名稱{apiEnabled ? '' : '（需要 API 服務才能搜尋名稱）'}。
      </p>
      <textarea
        className="textarea"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="https://maps.app.goo.gl/…"
        rows={3}
      />
      <button className="btn" onClick={() => void pasteFromClipboard()}>
        <ClipboardPaste size={16} /> 從剪貼簿貼上
      </button>
      <label className="field">
        <span>放到</span>
        <select className="select" value={day ?? ''} onChange={(e) => setDay(e.target.value || null)}>
          <option value="">收集箱（還沒決定哪天）</option>
          {tripDates(trip).map((d) => (
            <option key={d} value={d}>
              {dayLabel(d)} {trip.days[d]?.title ?? ''}
            </option>
          ))}
        </select>
      </label>
      <button className="btn primary block" disabled={!text.trim() || busy} onClick={() => void submit()}>
        {busy ? '解析中…' : '加入'}
      </button>
    </Sheet>
  );
}
