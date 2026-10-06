export type EventState = 'scheduled' | 'upcoming' | 'in_progress' | 'finished' | 'cancelled';

// This advances the display only; dates, versions and deliveries remain server-owned.
export function calendarState(event: {
  starts_at: string; ends_at: string; cancelled_at: string | null; state: EventState;
}, now: number): EventState {
  if (event.cancelled_at !== null || event.state === 'cancelled') return 'cancelled';
  const start = Date.parse(event.starts_at), end = Date.parse(event.ends_at);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return event.state;
  if (now >= end) return 'finished';
  if (now >= start) return 'in_progress';
  return start - now <= 24 * 3600000 ? 'upcoming' : 'scheduled';
}
