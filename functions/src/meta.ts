import { classifyLink, type LinkPreviewResponse, type OEmbedResponse } from '@ping/shared';

type Fetch = typeof fetch;

export async function oembed(url: string, token: string | undefined, fetchImpl: Fetch = fetch): Promise<OEmbedResponse> {
  const kind = classifyLink(url);
  let endpoint: string;
  if (kind === 'threads') endpoint = 'https://graph.threads.net/v1.0/oembed';
  else if (kind === 'instagram') endpoint = 'https://graph.facebook.com/instagram_oembed';
  else return { error: 'unsupported' };
  const q = new URLSearchParams({ url, omitscript: 'false' });
  if (token) q.set('access_token', token);
  const res = await fetchImpl(`${endpoint}?${q}`);
  if (!res.ok) return { error: `oembed ${res.status}` };
  const d = (await res.json()) as { html?: string; author_name?: string; title?: string; thumbnail_url?: string };
  return { html: d.html, authorName: d.author_name, title: d.title, thumbnailUrl: d.thumbnail_url };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function readOgTags(html: string): LinkPreviewResponse {
  const meta = (prop: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
      'i',
    );
    const m = html.match(re);
    const v = m?.[1] ?? m?.[2];
    return v ? decodeEntities(v) : undefined;
  };
  const title = meta('og:title') ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  return {
    title: title ? decodeEntities(title) : undefined,
    description: meta('og:description') ?? meta('description'),
    image: meta('og:image'),
    siteName: meta('og:site_name'),
  };
}

export async function linkPreview(url: string, fetchImpl: Fetch = fetch): Promise<LinkPreviewResponse> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { error: 'bad-url' };
  }
  if (u.protocol !== 'https:') return { error: 'https-only' };
  const res = await fetchImpl(u.href, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PingTripBot/1.0)', Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok || !res.body) return { error: `fetch ${res.status}` };
  // Only the <head> matters; stop after ~256 KB.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  while (html.length < 256_000) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    if (html.includes('</head>')) break;
  }
  await reader.cancel().catch(() => {});
  return readOgTags(html);
}
