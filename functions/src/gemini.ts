import type { RouteSource } from '@ping/shared';

type Fetch = typeof fetch;

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/**
 * Vertex AI is billed through Cloud Billing (where the Google Cloud credits are);
 * the AI Studio Gemini API key route uses a separate prepaid balance.
 */
export type GeminiAuth = { kind: 'vertex'; project: string; token: () => Promise<string> } | { kind: 'key'; key: string };

interface GeminiReply {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
  }[];
}

/** One Gemini call grounded with Google Search; returns the reply text and the cited pages. */
export async function groundedGenerate(prompt: string, auth: GeminiAuth, model = DEFAULT_GEMINI_MODEL, fetchImpl: Fetch = fetch): Promise<{ text: string; sources: RouteSource[] }> {
  const payload = (fast: boolean) =>
    JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      // Reading facts off search results needs little reasoning; low thinking cuts latency a lot.
      generationConfig: fast ? { temperature: 0.1, thinkingConfig: { thinkingLevel: 'LOW' } } : { temperature: 0.1 },
    });
  const call = async (body: string) =>
    auth.kind === 'vertex'
      ? fetchImpl(`https://aiplatform.googleapis.com/v1/projects/${auth.project}/locations/global/publishers/google/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.token()}` },
          body,
        })
      : fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': auth.key },
          body,
        });
  let res = await call(payload(true));
  if (res.status === 400) res = await call(payload(false)); // model without thinking levels
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = (await res.json()) as GeminiReply;
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  const sources: RouteSource[] = [];
  for (const c of cand?.groundingMetadata?.groundingChunks ?? []) {
    if (c.web?.uri && sources.length < 4) sources.push({ title: c.web.title ?? c.web.uri, url: c.web.uri });
  }
  return { text, sources };
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
