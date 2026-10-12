import { describe, expect, it, vi } from 'vitest';
import { handleApi } from './api';
import { askTransitAi, buildPrompt, extractJson, plausible } from './transitAi';

const req = {
  origin: { name: '新今宮駅', location: { lat: 34.6496, lng: 135.5013 } },
  destination: { name: '伏見稲荷大社', location: { lat: 34.9671, lng: 135.7727 } },
  mode: 'TRANSIT' as const,
  departureTime: '2026-10-26T22:30:00.000Z', // 07:30 JST on 10/27
};

const gemini = (text: string, chunks: { uri: string; title: string }[] = []) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, groundingMetadata: { groundingChunks: chunks.map((web) => ({ web })) } }] }));

describe('transit AI', () => {
  it('builds a prompt with names, coordinates and JST departure', () => {
    const p = buildPrompt(req);
    expect(p).toContain('新今宮駅');
    expect(p).toContain('34.96710, 135.77270');
    expect(p).toContain('2026-10-27 07:30 JST');
    expect(p).toContain('新今宮駅 伏見稲荷大社 乗換');
    expect(p.length).toBeLessThan(1200); // keep it short
  });

  it('extracts JSON wrapped in prose or fences', () => {
    expect(extractJson('結果如下：\n```json\n{"durationMin": 58}\n```')).toEqual({ durationMin: 58 });
    expect(extractJson('沒有資料')).toBeNull();
  });

  it('parses a grounded answer with sources', async () => {
    const f = vi.fn(async () =>
      gemini('{"durationMin": 58, "fareYen": 580, "transfers": 2, "summary": "JR大阪環状線 → JR京都線 → JR奈良線", "confident": true}', [
        { uri: 'https://transit.yahoo.co.jp/x', title: 'Yahoo!路線情報' },
      ]),
    );
    const r = await askTransitAi(req, { kind: 'vertex', project: 'p1', token: async () => 'T' }, 'gemini-test', f as unknown as typeof fetch);
    expect(r).toMatchObject({ durationSec: 3480, fareYen: 580, transfers: 2, source: 'ai', sources: [{ title: 'Yahoo!路線情報' }] });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://aiplatform.googleapis.com/v1/projects/p1/locations/global/publishers/google/models/gemini-test:generateContent');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer T');
  });

  it('asks for low thinking and retries without it when the model rejects the option', async () => {
    const bodies: string[] = [];
    const f = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return bodies.length === 1 ? new Response('bad', { status: 400 }) : gemini('{"durationMin": 30, "confident": true}');
    });
    const r = await askTransitAi(req, { kind: 'key', key: 'K' }, undefined, f as unknown as typeof fetch);
    expect(r?.durationSec).toBe(1800);
    expect(bodies[0]).toContain('thinkingLevel');
    expect(bodies[1]).not.toContain('thinkingLevel');
  });

  it('rejects physically impossible durations', () => {
    expect(plausible(req, 3)).toBe(false); // 43 km in 3 min
    expect(plausible(req, 60)).toBe(true);
    expect(plausible(req, 600)).toBe(false); // 10 h for a 1 h trip
  });

  it('rejects unconfident or nonsense answers', async () => {
    const f1 = vi.fn(async () => gemini('{"durationMin": 60, "confident": false}'));
    expect(await askTransitAi(req, { kind: 'key', key: 'K' }, undefined, f1 as unknown as typeof fetch)).toBeNull();
    const f2 = vi.fn(async () => gemini('{"durationMin": "很久"}'));
    expect(await askTransitAi(req, { kind: 'key', key: 'K' }, undefined, f2 as unknown as typeof fetch)).toBeNull();
  });

  it('API falls back Routes → Gemini → estimate, and caches the AI answer', async () => {
    const m = new Map<string, unknown>();
    const cache = { get: async <T,>(k: string) => (m.get(k) as T) ?? null, set: async (k: string, v: unknown) => void m.set(k, v) };
    const f = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes('routes.googleapis.com') ? new Response('{}') : gemini('{"durationMin": 58, "confident": true}'),
    );
    const call = () => handleApi({ method: 'POST', path: '/api/route', query: {}, body: req }, { mapsKey: 'K', gemini: { kind: 'key', key: 'K' }, cache, fetchImpl: f as unknown as typeof fetch });
    expect((await call()).json).toMatchObject({ source: 'ai', durationSec: 3480 });
    await call();
    expect(f).toHaveBeenCalledTimes(2); // routes + gemini once; second call served from cache

    const bad = vi.fn(async (url: RequestInfo | URL) => (String(url).includes('routes.googleapis.com') ? new Response('{}') : new Response('err', { status: 500 })));
    const r = await handleApi({ method: 'POST', path: '/api/route', query: {}, body: { ...req, departureTime: '2026-10-28T05:00:00Z' } }, { mapsKey: 'K', gemini: { kind: 'key', key: 'K' }, cache, fetchImpl: bad as unknown as typeof fetch });
    expect(r.json).toMatchObject({ source: 'estimate', error: 'no-route' });
  });
});
