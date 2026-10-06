import {addCalendarDays, agendaWindow, bogotaDateTime} from '../src/calendar';

test('la agenda semanal cruza meses sin saltar ni repetir días', () => {
  expect(agendaWindow('2026-10-29')).toEqual({from: '2026-10-29', to: '2026-11-04'});
  expect(addCalendarDays('2026-10-29', 7)).toBe('2026-11-05');
  expect(() => agendaWindow('2026-02-30')).toThrow('Fecha de agenda');
});

test('presenta el instante según America/Bogota, incluso al cambiar de día UTC', () => {
  expect(bogotaDateTime('2026-10-05T02:30:00Z')).toEqual({date: '2026-10-04', time: '21:30'});
});
