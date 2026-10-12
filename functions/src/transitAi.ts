import { estimateLeg, haversineM, type RouteRequest, type RouteResponse, type RouteSource } from '@ping/shared';

type Fetch = typeof fetch;

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

function jstText(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short' }).format(d);
}

function describe(e: RouteRequest['origin']): string {
  const loc = e.location ? ` (${e.location.lat.toFixed(5)}, ${e.location.lng.toFixed(5)})` : '';
  return `${e.name ?? 'pin'}${loc}`;
}

/** Short English instructions; facts must come from Japanese transit sites found by Google Search. */
export function buildPrompt(req: RouteRequest): string {
  const from = req.origin.name ?? '';
  const to = req.destination.name ?? '';
  return `Task: Japan public-transit route lookup via Google Search.
Search in Japanese, e.g. "${from} ${to} 乗換". Prefer result pages from transit.yahoo.co.jp, jorudan.co.jp, navitime.co.jp, ekitan.com.
From: ${describe(req.origin)}
To: ${describe(req.destination)}
Depart: ${jstText(req.departureTime)} JST
Rules:
- Route most tourists would take: train/subway/bus/walk only, no taxi.
- durationMin: door-to-door minutes incl. walking, waiting and transfers, for the first departure at/after Depart.
- fareYen: adult one-way IC fare in yen; for Shinkansen/limited express include the reserved-seat surcharge; null if not stated.
- Use only facts stated by a source. Never guess. If no source or sources disagree: confident=false.
Output ONLY this JSON, no other text:
{"durationMin":int,"fareYen":int|null,"transfers":int,"summary":"zh-TW, keep Japanese station/line names, e.g. 步行5分 → JR大阪環状線 新今宮→大阪 → JR京都線新快速 大阪→京都 → 步行3分","confident":bool}`;
}

/**
 * Reject answers that can't be right: faster than a Shinkansen in a straight line,
 * or several times slower than the distance-based estimate.
 */
export function plausible(req: RouteRequest, minutes: number): boolean {
  if (minutes <= 0 || minutes > 24 * 60) return false;
  const a = req.origin.location;
  const b = req.destination.location;
  if (!a || !b) return true;
  const km = haversineM(a, b) / 1000;
  const fastest = (km / 280) * 60;
  const slowest = estimateLeg(a, b, 'TRANSIT').durationSec / 60 * 3 + 30;
  return minutes >= fastest && minutes <= slowest;
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
  const payload = (fast: boolean) =>
    JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(req) }] }],
      tools: [{ googleSearch: {} }],
      // Little reasoning is needed to read a timetable off search results; it cuts latency a lot.
      generationConfig: fast ? { temperature: 0.1, thinkingConfig: { thinkingLevel: 'LOW' } } : { temperature: 0.1 },
    });
  async function call(body: string) {
    return auth.kind === 'vertex'
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
  }
  let res = await call(payload(true));
  if (res.status === 400) res = await call(payload(false)); // model without thinking levels
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = (await res.json()) as GeminiReply;
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  const j = extractJson(text);
  const minutes = Number(j?.durationMin);
  if (!j || j.confident === false || !Number.isFinite(minutes) || !plausible(req, minutes)) return null;
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
