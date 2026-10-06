import { useEffect, useState } from 'react';
import { api } from './api';
import { Empty, ErrorBox, Loading, Modal } from './ui';
import { calendarState } from './calendar-state';
import { useCalendarClock } from './useCalendarClock';
import { useRequestGeneration } from './useRequestGeneration';

type Event = {
  id: string; title: string; type: 'meeting' | 'appointment' | 'activity' | 'important_date';
  starts_at: string; ends_at: string; location: string | null; description: string | null;
  cancelled_at: string | null; remind_24h: boolean; remind_1h: boolean;
  state: 'scheduled' | 'upcoming' | 'in_progress' | 'finished' | 'cancelled';
  participants: { name: string; response: 'pending' | 'accepted' | 'declined' }[];
};
type Page = { items: Event[]; total: number; page_size: number };
const types: Record<Event['type'], string> = { meeting: 'Reunión', appointment: 'Cita', activity: 'Actividad', important_date: 'Fecha importante' };
const states: Record<Event['state'], string> = { scheduled: 'Programado', upcoming: 'Próximo', in_progress: 'En curso', finished: 'Finalizado', cancelled: 'Cancelado' };
const responses = { pending: 'Pendiente', accepted: 'Aceptada', declined: 'Rechazada' };
const dateTime = (value: string) => new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

export function CalendarSearch({ query }: { query: string }) {
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

  return <section className="panel" aria-label="Resultados de calendario">
    <h2>Calendario</h2>
    <p className="muted">Los estados avanzan con la hora del dispositivo. Vuelve a buscar para consultar cambios de otros integrantes.</p>
    <ErrorBox error={error} />
    {error ? <button onClick={() => setRetry(value => value + 1)}>Reintentar calendario</button> : !data && <Loading />}
    {data && <>
      <p role="status">{data.total} coincidencias en calendario</p>
      {!data.items.length ? <Empty title="Sin coincidencias en calendario">Prueba otro título o lugar.</Empty> :
        <div className="table-scroll"><table><thead><tr><th>Inicio</th><th>Título</th><th>Tipo</th><th>Lugar</th><th>Estado</th><th></th></tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id}>
            <td>{dateTime(item.starts_at)}</td><td>{item.title}</td><td>{types[item.type]}</td>
            <td>{item.location || '—'}</td><td>{states[calendarState(item, clock)]}</td>
            <td><button onClick={() => void open(item.id)} aria-label={`Ver evento ${item.title}`}>Ver evento</button></td>
          </tr>)}</tbody></table></div>}
      <div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button>
        <span>Página {page}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
    </>}
    <ErrorBox error={detailError} />
    {detailBusy && <Loading />}
    {selected && <Modal title="Detalle del evento" onClose={() => { generation.current++; setSelected(undefined); setDetailBusy(false); setDetailError(undefined); }}>
      <div className="calendar-detail">
        <p><strong>{selected.title}</strong> · {types[selected.type]}</p>
        <p>Inicio: {dateTime(selected.starts_at)}</p><p>Fin: {dateTime(selected.ends_at)}</p>
        <p>Estado: {states[calendarState(selected, clock)]}</p>
        <p>Recordatorios del evento: {[selected.remind_24h && '24 horas', selected.remind_1h && '1 hora'].filter(Boolean).join(' y ') || 'Ninguno'}</p>
        {selected.location && <p>Lugar: {selected.location}</p>}
        {selected.description && <p>{selected.description}</p>}
        <p><strong>Participantes:</strong> {selected.participants.length
          ? selected.participants.map(item => `${item.name} (${responses[item.response]})`).join(', ')
          : 'Sin participantes asignados'}</p>
      </div>
    </Modal>}
  </section>;
}
