export type CalendarEvent = {
  id: string;
  type: 'meeting' | 'appointment' | 'activity' | 'important_date';
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  state: 'scheduled' | 'upcoming' | 'in_progress' | 'finished' | 'cancelled';
  participants: {user_id: string; name: string; response: 'pending' | 'accepted' | 'declined'}[];
};

export type CalendarInvitation = {
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  response: 'pending' | 'accepted' | 'declined';
  response_version: number;
};

export type InvitationPage = {items: CalendarInvitation[]; page: number; page_size: number; total: number};

export function addCalendarDays(day: string, count: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(count)) throw new Error('Fecha de agenda no válida.');
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new Error('Fecha de agenda no válida.');
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function agendaWindow(anchor: string): {from: string; to: string} {
  return {from: addCalendarDays(anchor, 0), to: addCalendarDays(anchor, 6)};
}

export function bogotaDateTime(instant: string | Date): {date: string; time: string} {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) throw new Error('Fecha de evento no válida.');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]));
  return {date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`};
}

export function bogotaToday(): string {
  return bogotaDateTime(new Date()).date;
}
