import type { RouteRequest, RouteResponse, TravelMode } from '@ping/shared';
import type { DayInfo, PlaceCard, Trip } from '../data/model';
import { jstIso, toMinutes } from './time';

export const DEFAULT_STAY = 60;

export interface LegPlan {
  key: string;
  req: RouteRequest;
  mode: TravelMode;
  from: PlaceCard;
  to: PlaceCard;
}

export interface ScheduledCard {
  card: PlaceCard;
  /** 'start' / 'end' = the day's lodging, not a real card. */
  anchor: 'start' | 'end' | null;
  arrive: number;
  depart: number;
  /** Planned start exists but the estimated arrival is later. */
  lateBy: number;
  leg: LegPlan | null;
}

export interface DaySchedule {
  items: ScheduledCard[];
  startMin: number;
  endMin: number;
  stayMin: number;
  travelMin: number;
  /** Some legs are still loading or have no location. */
  incomplete: boolean;
}

export function sortCards(cards: PlaceCard[], day: string | null): PlaceCard[] {
  return cards.filter((c) => c.day === day).sort((a, b) => a.order - b.order);
}

export function legMode(card: PlaceCard, day: DayInfo | undefined, trip: Trip): TravelMode {
  return card.legMode ?? day?.defaultMode ?? trip.defaultMode ?? 'TRANSIT';
}

function endpointKey(c: PlaceCard): string {
  if (c.placeId) return c.placeId;
  if (c.location) return `${c.location.lat.toFixed(5)},${c.location.lng.toFixed(5)}`;
  return `name:${c.name}`;
}

export function legKey(from: PlaceCard, to: PlaceCard, mode: TravelMode, departIso: string): string {
  // Transit depends on the timetable; bucket by hour so small edits don't refetch.
  const bucket = mode === 'TRANSIT' ? departIso.slice(0, 13) : '';
  return `${endpointKey(from)}>${endpointKey(to)}|${mode}|${bucket}`;
}

export function canRoute(c: PlaceCard): boolean {
  return Boolean(c.placeId || c.location);
}

export interface DayAnchors {
  start?: PlaceCard;
  end?: PlaceCard;
}

export function buildSchedule(
  date: string,
  cards: PlaceCard[],
  day: DayInfo | undefined,
  trip: Trip,
  legs: Record<string, RouteResponse | 'loading' | undefined>,
  anchors: DayAnchors = {},
): DaySchedule {
  const startMin = toMinutes(day?.startTime) ?? 9 * 60;
  let t = startMin;
  let stayMin = 0;
  let travelMin = 0;
  let incomplete = false;
  const items: ScheduledCard[] = [];
  // Hotel anchors only make sense around at least one real stop.
  const ordered = cards.length ? [...(anchors.start ? [anchors.start] : []), ...cards, ...(anchors.end ? [anchors.end] : [])] : [];

  ordered.forEach((card, i) => {
    const anchor = card === anchors.start ? 'start' : card === anchors.end ? 'end' : null;
    const planned = anchor ? null : toMinutes(card.plannedStart);
    const arrive = planned ?? t;
    const lateBy = planned != null && i > 0 && t > planned + 5 ? t - planned : 0;
    const stay = anchor ? 0 : card.stayMinutes ?? DEFAULT_STAY;
    const depart = arrive + stay;
    stayMin += stay;
    const next = ordered[i + 1];
    let leg: LegPlan | null = null;
    t = depart;
    if (next) {
      const mode = legMode(card, day, trip);
      if (canRoute(card) && canRoute(next)) {
        const departIso = jstIso(date, depart);
        const key = legKey(card, next, mode, departIso);
        leg = {
          key,
          mode,
          from: card,
          to: next,
          req: {
            origin: { placeId: card.placeId ?? undefined, location: card.location ?? undefined, name: card.name },
            destination: { placeId: next.placeId ?? undefined, location: next.location ?? undefined, name: next.name },
            mode,
            departureTime: departIso,
          },
        };
        const r = legs[key];
        if (r && r !== 'loading' && r.durationSec != null) {
          t += r.durationSec / 60;
          travelMin += r.durationSec / 60;
        } else incomplete = true;
      } else incomplete = true;
    }
    items.push({ card, anchor, arrive, depart, lateBy, leg });
  });

  return { items, startMin, endMin: items.length ? items[items.length - 1].depart : startMin, stayMin, travelMin, incomplete };
}

/** Order value that places an item between two neighbours. */
export function orderBetween(before: number | undefined, after: number | undefined): number {
  if (before == null && after == null) return 1000;
  if (before == null) return after! - 1000;
  if (after == null) return before + 1000;
  return (before + after) / 2;
}

export const isAnchorId = (id: string) => id.startsWith('lodging:');

export function toTarget(c: Pick<PlaceCard, 'name' | 'placeId' | 'location'>) {
  return { name: c.name, placeId: c.placeId ?? undefined, location: c.location ?? undefined };
}
