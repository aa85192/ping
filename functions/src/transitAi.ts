import type { RouteRequest, RouteResponse, RouteSource } from '@ping/shared';

type Fetch = typeof fetch;

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

function jstText(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short' }).format(d);
}

function describe(e: RouteRequest['origin']): string {
  const loc = e.location ? `（緯度經度 ${e.location.lat.toFixed(5)}, ${e.location.lng.toFixed(5)}）` : '';
  return `${e.name ?? '指定地點'}${loc}`;
}

export function buildPrompt(req: RouteRequest): string {
  return [
    '你是日本大眾運輸查詢助手。請用 Google 搜尋查詢以下路線，優先參考 Yahoo!路線情報、ジョルダン、NAVITIME、駅探 的轉乘結果。',
    `出發：${describe(req.origin)}`,
    `目的地：${describe(req.destination)}`,
    `出發時間（日本時間）：${jstText(req.departureTime)}`,
    '選最一般遊客會搭的路線（不含計程車），時間包含頭尾步行。',
    '只輸出一個 JSON 物件，不要其他文字：',
    '{"durationMin": 數字, "fareYen": 數字或 null, "transfers": 數字, "summary": "繁體中文，車站與路線名保留日文漢字，例如：步行 5 分 → JR大阪環状線 新今宮→大阪 → JR京都線 新快速 大阪→京都 → JR奈良線 京都→稲荷 → 步行 2 分", "confident": true 或 false}',
    '查不到可靠資料時 confident 設為 false。',
  ].join('\n');
}

/** Pull the first {...} block out of a model reply (it may wrap JSON in prose or ```json fences). */
export function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface GeminiReply {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
  }[];
}

/**
 * Vertex AI is billed through Cloud Billing (where the Google Cloud credits are);
 * the AI Studio Gemini API key route uses a separate prepaid balance.
 */
export type GeminiAuth = { kind: 'vertex'; project: string; token: () => Promise<string> } | { kind: 'key'; key: string };

/**
 * Ask Gemini (grounded with Google Search) for a transit route. Returns null when
 * the answer is missing, unparseable or the model says it isn't confident.
 */
export async function askTransitAi(req: RouteRequest, auth: GeminiAuth, model = DEFAULT_GEMINI_MODEL, fetchImpl: Fetch = fetch): Promise<RouteResponse | null> {
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: buildPrompt(req) }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.1 },
  });
  const res =
    auth.kind === 'vertex'
      ? await fetchImpl(`https://aiplatform.googleapis.com/v1/projects/${auth.project}/locations/global/publishers/google/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.token()}` },
          body,
        })
      : await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': auth.key },
          body,
        });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = (await res.json()) as GeminiReply;
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  const j = extractJson(text);
  const minutes = Number(j?.durationMin);
  if (!j || j.confident === false || !Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) return null;
  const sources: RouteSource[] = [];
  for (const c of cand?.groundingMetadata?.groundingChunks ?? []) {
    if (c.web?.uri && sources.length < 4) sources.push({ title: c.web.title ?? c.web.uri, url: c.web.uri });
  }
  const fare = Number(j.fareYen);
  const transfers = Number(j.transfers);
  return {
    durationSec: Math.round(minutes * 60),
    distanceM: null,
    summary: typeof j.summary === 'string' ? j.summary.slice(0, 300) : undefined,
    fareYen: Number.isFinite(fare) && fare > 0 ? Math.round(fare) : null,
    transfers: Number.isFinite(transfers) ? transfers : null,
    sources,
    source: 'ai',
  };
}
