import { describe, expect, it, vi } from 'vitest';
import { handleApi } from './api';
import { askFlightStatus, buildFlightPrompt, flightCacheTtlSec } from './flightAi';

const req = { flightNo: 'MM32', airline: 'Peach', from: 'KHH', to: 'KIX', departure: '2026-10-24T14:10:00+08:00', arrival: '2026-10-24T18:15:00+09:00' };
const gemini = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://www.kansai-airport.or.jp/x', title: 'KIX' } }] } }] }));
const auth = { kind: 'key' as const, key: 'K' };

describe('flight status AI', () => {
  it('prompt names the flight, local times and airport sites', () => {
    const p = buildFlightPrompt(req);
    expect(p).toContain('MM32 (Peach), KHH → KIX');
    expect(p).toContain('dep 2026-10-24 14:10 (UTC+08:00)');
    expect(p).toContain('kansai-airport.or.jp');
  });

  it('keeps day-of details only when confident', async () => {
    const body = '{"status":"delayed","depTerminal":"國際線","depGate":"12","depEstimated":"14:40","arrTerminal":"T2","baggageBelt":"3","arrEstimated":"18:45","note":"延誤30分","confident":true}';
    const ok = await askFlightStatus(req, auth, undefined, vi.fn(async () => gemini(body)) as unknown as typeof fetch);
    expect(ok).toMatchObject({ status: 'delayed', depGate: '12', baggageBelt: '3', arrTerminal: 'T2', arrEstimated: '18:45', sources: [{ title: 'KIX' }] });

    const unsure = await askFlightStatus(req, auth, undefined, vi.fn(async () => gemini(body.replace('"confident":true', '"confident":false'))) as unknown as typeof fetch);
    expect(unsure).toMatchObject({ status: 'unknown', depGate: null, baggageBelt: null, arrTerminal: 'T2' });
  });

  it('caches 12 h far out and 10 min on the day', () => {
    expect(flightCacheTtlSec(req, Date.parse('2026-10-12T00:00:00Z'))).toBe(12 * 3600);
    expect(flightCacheTtlSec(req, Date.parse('2026-10-24T03:00:00Z'))).toBe(600);
  });

  it('API validates input and needs AI enabled', async () => {
    const cache = { get: async () => null, set: async () => {} };
    expect((await handleApi({ method: 'POST', path: '/api/flight-status', query: {}, body: {} }, { cache })).status).toBe(400);
    expect((await handleApi({ method: 'POST', path: '/api/flight-status', query: {}, body: req }, { cache })).status).toBe(503);
  });
});
