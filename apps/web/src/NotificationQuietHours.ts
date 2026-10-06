export type QuietHours = { quiet_start: string | null; quiet_end: string | null };

export function notificationQuietHoursActive(preferences: QuietHours | undefined, date: Date): boolean {
  const start = preferences?.quiet_start, end = preferences?.quiet_end;
  if (!start || !end || start === end) return false;
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
  return start < end ? time >= start && time < end : time >= start || time < end;
}
