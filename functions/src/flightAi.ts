import type { FlightPhase, FlightStatus, FlightStatusRequest } from '@ping/shared';
import { DEFAULT_GEMINI_MODEL, extractJson, groundedGenerate, type GeminiAuth } from './gemini';

type Fetch = typeof fetch;

const PHASES: FlightPhase[] = ['scheduled', 'on-time', 'delayed', 'boarding', 'departed', 'landed', 'cancelled', 'unknown'];

const AIRPORT_SITES: Record<string, string> = {
  KIX: 'kansai-airport.or.jp',
  KHH: 'kia.gov.tw',
  TPE: 'taoyuan-airport.com',
  NRT: 'narita-airport.jp',
  HND: 'tokyo-haneda.com',
};

function local(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?([+-]\d{2}:\d{2})?/);
  return m ? `${m[1]} ${m[2]} (UTC${m[3] ?? ''})` : iso;
}

export function buildFlightPrompt(r: FlightStatusRequest): string {
  const sites = [AIRPORT_SITES[r.from], AIRPORT_SITES[r.to]].filter(Boolean).join(', ');
  return `Task: flight status lookup via Google Search.
Flight: ${r.flightNo}${r.airline ? ` (${r.airline})` : ''}, ${r.from} → ${r.to}
Scheduled: dep ${local(r.departure)}${r.arrival ? `, arr ${local(r.arrival)}` : ''}
Prefer official airport flight-info pages${sites ? ` (${sites})` : ''}, the airline's site, then FlightAware / Flightradar24.
Rules:
- Only facts a source states for THIS flight on THIS date. Never guess; unknown → null.
- Gates and baggage belts are usually published only on the day; if not yet published → null.
- Terminals: the airline's usual terminal at each airport is fine if a source states it (e.g. "T2", "國際線").
- Times are local "HH:mm".
Output ONLY this JSON, no other text:
{"status":"scheduled|on-time|delayed|boarding|departed|landed|cancelled|unknown","depTerminal":str|null,"depGate":str|null,"depEstimated":str|null,"arrTerminal":str|null,"baggageBelt":str|null,"arrEstimated":str|null,"note":"zh-TW, ≤40 chars, or null","confident":bool}`;
}

const short = (v: unknown, max = 16): string | null => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim().slice(0, max) : null);
const hhmm = (v: unknown): string | null => (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v.trim()) ? v.trim().padStart(5, '0') : null);

export async function askFlightStatus(r: FlightStatusRequest, auth: GeminiAuth, model = DEFAULT_GEMINI_MODEL, fetchImpl: Fetch = fetch): Promise<FlightStatus> {
  const { text, sources } = await groundedGenerate(buildFlightPrompt(r), auth, model, fetchImpl);
  const j = extractJson(text) ?? {};
  const confident = j.confident === true;
  const status = PHASES.includes(j.status as FlightPhase) ? (j.status as FlightPhase) : 'unknown';
  return {
    status: confident ? status : 'unknown',
    // Terminals rarely change and are widely published; day-of details need a confident answer.
    depTerminal: short(j.depTerminal),
    arrTerminal: short(j.arrTerminal),
    depGate: confident ? short(j.depGate, 8) : null,
    baggageBelt: confident ? short(j.baggageBelt, 8) : null,
    depEstimated: confident ? hhmm(j.depEstimated) : null,
    arrEstimated: confident ? hhmm(j.arrEstimated) : null,
    note: short(j.note, 60),
    confident,
    sources,
    fetchedAt: Date.now(),
  };
}

/** Far from the flight, status barely changes; on the day, gates and belts do. */
export function flightCacheTtlSec(r: FlightStatusRequest, now = Date.now()): number {
  const dep = Date.parse(r.departure);
  if (!Number.isFinite(dep)) return 3600;
  return dep - now > 24 * 3600_000 ? 12 * 3600 : 10 * 60;
}
