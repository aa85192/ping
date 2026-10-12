import { useEffect, useState } from 'react';
import { fetchOEmbed } from '../../lib/api';

/**
 * Threads / Instagram embeds run inside a sandboxed iframe (no same-origin),
 * so the third-party script can't touch the app.
 */
export function Embed({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchOEmbed(url).then((r) => {
      if (!alive) return;
      if (r.html) setHtml(r.html);
      else setError(r.error === 'no-api' ? '需要 API 服務才能預覽' : '這則貼文無法預覽（可能不是公開貼文）');
    });
    return () => {
      alive = false;
    };
  }, [url]);
  if (error) return <div className="tiny muted">{error}</div>;
  if (!html) return <div className="tiny muted">載入預覽中…</div>;
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;display:flex;justify-content:center;background:transparent}</style></head><body>${html}</body></html>`;
  return <iframe className="embed-frame" title="貼文預覽" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} style={{ height: 560 }} loading="lazy" />;
}
