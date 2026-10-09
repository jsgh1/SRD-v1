import { useEffect, useState } from 'react';
import { api } from './api';
import { Empty, ErrorBox, Loading, Modal } from './ui';
import { calendarState } from './calendar-state';
import { useCalendarClock } from './useCalendarClock';
import { useRequestGeneration } from './useRequestGeneration';
import { formatLocale, t, useLanguage } from './i18n';

type Event = {
  id: string; title: string; title_en?: string | null; type: 'meeting' | 'appointment' | 'activity' | 'important_date';
  starts_at: string; ends_at: string; location: string | null; location_en?: string | null; description: string | null; description_en?: string | null;
  cancelled_at: string | null; remind_24h: boolean; remind_1h: boolean;
  state: 'scheduled' | 'upcoming' | 'in_progress' | 'finished' | 'cancelled';
  participants: { name: string; response: 'pending' | 'accepted' | 'declined' }[];
};
type Page = { items: Event[]; total: number; page_size: number };
const types: Record<Event['type'], string> = { meeting: 'Reunión', appointment: 'Cita', activity: 'Actividad', important_date: 'Fecha importante' };
const states: Record<Event['state'], string> = { scheduled: 'Programado', upcoming: 'Próximo', in_progress: 'En curso', finished: 'Finalizado', cancelled: 'Cancelado' };
const responses = { pending: 'Pendiente', accepted: 'Aceptada', declined: 'Rechazada' };
const dateTime = (value: string) => new Intl.DateTimeFormat(formatLocale(), {
  timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

export function CalendarSearch({ query }: { query: string }) {
  const language = useLanguage();
  const localized = (spanish: string | null, english?: string | null) => language === 'en' && english ? english : spanish || '';
  const clock = useCalendarClock();
  const generation = useRequestGeneration();
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  const [data, setData] = useState<Page>(), [error, setError] = useState<unknown>();
  const [selected, setSelected] = useState<Event>(), [detailError, setDetailError] = useState<unknown>();
  const [detailBusy, setDetailBusy] = useState(false);
  useEffect(() => {
    let active = true; setData(undefined); setError(undefined);
    api<Page>(`calendar-events/search?${new URLSearchParams({ q: query, page: String(page) })}`)
      .then(value => { if (active) setData(value); })
      .catch(value => { if (active) setError(value); });
    return () => { active = false; };
  }, [query, page, retry]);

  async function open(id: string) {
    const current = ++generation.current;
    setDetailBusy(true); setDetailError(undefined); setSelected(undefined);
    try { const value = await api<Event>(`calendar-events/${id}`); if (current === generation.current) setSelected(value); }
    catch (value) { if (current === generation.current) setDetailError(value); }
    finally { if (current === generation.current) setDetailBusy(false); }
  }

  return <section className="panel" aria-label={t('Resultados de calendario')}>
    <h2>{t('Calendario')}</h2>
    <p className="muted">{t('Los estados avanzan con la hora del dispositivo. Vuelve a buscar para consultar cambios de otros integrantes.')}</p>
    <ErrorBox error={error} />
    {error ? <button onClick={() => setRetry(value => value + 1)}>{t('Reintentar calendario')}</button> : !data && <Loading />}
    {data && <>
      <p role="status">{t('{count} coincidencias en calendario', { count: data.total })}</p>
      {!data.items.length ? <Empty title={t('Sin coincidencias en calendario')}>{t('Prueba otro título o lugar.')}</Empty> :
        <div className="table-scroll"><table><thead><tr><th>{t('Inicio')}</th><th>{t('Título')}</th><th>{t('Tipo')}</th><th>{t('Lugar')}</th><th>{t('Estado')}</th><th></th></tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id}>
            <td>{dateTime(item.starts_at)}</td><td>{localized(item.title, item.title_en)}</td><td>{t(types[item.type])}</td>
            <td>{localized(item.location, item.location_en) || '—'}</td><td>{t(states[calendarState(item, clock)])}</td>
            <td><button onClick={() => void open(item.id)} aria-label={t('Ver evento {title}', { title: localized(item.title, item.title_en) })}>{t('Ver evento')}</button></td>
          </tr>)}</tbody></table></div>}
      <div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>{t('Anterior')}</button>
        <span>{t('Página {page}', { page })}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage(value => value + 1)}>{t('Siguiente')}</button></div>
    </>}
    <ErrorBox error={detailError} />
    {detailBusy && <Loading />}
    {selected && <Modal title={t('Detalle del evento')} onClose={() => { generation.current++; setSelected(undefined); setDetailBusy(false); setDetailError(undefined); }}>
      <div className="calendar-detail">
        <p><strong>{localized(selected.title, selected.title_en)}</strong> · {t(types[selected.type])}</p>
        <p>{t('Inicio')}: {dateTime(selected.starts_at)}</p><p>{t('Fin')}: {dateTime(selected.ends_at)}</p>
        <p>{t('Estado')}: {t(states[calendarState(selected, clock)])}</p>
        <p>{t('Recordatorios del evento')}: {[selected.remind_24h && t('24 horas'), selected.remind_1h && t('1 hora')].filter(Boolean).join(t(' y ')) || t('Ninguno')}</p>
        {selected.location && <p>{t('Lugar')}: {localized(selected.location, selected.location_en)}</p>}
        {selected.description && <p>{localized(selected.description, selected.description_en)}</p>}
        <p><strong>{t('Participantes')}:</strong> {selected.participants.length
          ? selected.participants.map(item => `${item.name} (${t(responses[item.response])})`).join(', ')
          : t('Sin participantes asignados')}</p>
      </div>
    </Modal>}
  </section>;
}
