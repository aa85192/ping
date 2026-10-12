import { useEffect } from 'react';
import { tripDates } from '../data/model';
import { useApp } from '../store';
import { dayAnchors } from './lodging';
import { buildSchedule, sortCards } from './schedule';

/**
 * Queue every leg of the trip once the data settles, so slow (AI) transit
 * lookups are usually finished before you open that day. Answers are cached
 * on the server, so both travellers benefit.
 */
export function usePrefetchLegs() {
  const trip = useApp((s) => s.trip);
  const cards = useApp((s) => s.cards);
  const bookings = useApp((s) => s.bookings);
  useEffect(() => {
    if (!trip) return;
    const t = setTimeout(() => {
      const { legs, ensureLeg } = useApp.getState();
      for (const date of tripDates(trip)) {
        const sched = buildSchedule(date, sortCards(cards, date), trip.days[date], trip, legs, dayAnchors(date, trip, bookings));
        for (const it of sched.items) if (it.leg) ensureLeg(it.leg.key, it.leg.req);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [trip, cards, bookings]);
}
