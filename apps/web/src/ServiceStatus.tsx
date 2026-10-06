import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { ErrorBox, Loading } from './ui';

type Status = { items: { service: string; available: boolean }[]; antivirus_available: boolean; checked_at: string };
type SchedulerStatus = { items: { service: string; available: boolean; cycle_recent: boolean; outbox_recent: boolean }[]; checked_at: string };
type CalendarDeliveries = { delivered: number; pending: number; due: number; deferred: number; exhausted: number; exhausted_jobs: { id: string; kind: string; attempts: number; due_at: string }[] };
type MailItem = { id: string; attempts: number; created_at: string; retryable: boolean };
type MailDeliveries = { invitations: { pending: number; due: number; deferred: number; exhausted: number; expired: number; exhausted_items: MailItem[] }; security_notices: { pending: number; due: number; deferred: number; exhausted: number; exhausted_items: MailItem[] } };
const labels: Record<string, string> = {
  identity: 'Identidad', configuration: 'Configuración', records: 'Registros', files: 'Archivos',
  audit: 'Auditoría', calendar: 'Calendario', notifications: 'Notificaciones',
  treasury: 'Tesorería', inventory: 'Inventario', chat: 'Chat',
};

export function ServiceStatus() {
  const [data, setData] = useState<Status>(), [error, setError] = useState<unknown>();
  const [schedulers, setSchedulers] = useState<SchedulerStatus>(), [schedulerError, setSchedulerError] = useState<unknown>();
  const [calendar, setCalendar] = useState<CalendarDeliveries>(), [calendarError, setCalendarError] = useState<unknown>();
  const [mail, setMail] = useState<MailDeliveries>(), [mailError, setMailError] = useState<unknown>();
  const [retrying, setRetrying] = useState<string>(), [retryError, setRetryError] = useState<unknown>();
  const [retryNotice, setRetryNotice] = useState('');
  const [mailRetrying, setMailRetrying] = useState<string>(), [mailRetryError, setMailRetryError] = useState<unknown>();
  const [mailRetryNotice, setMailRetryNotice] = useState('');
  const [busy, setBusy] = useState(false), active = useRef(true);
  useEffect(() => { active.current = true; void refresh(); return () => { active.current = false; }; }, []);
  async function refresh() {
    if (busy) return;
    setBusy(true); setError(undefined); setSchedulerError(undefined); setCalendarError(undefined); setMailError(undefined);
    try {
      const [services, schedulerHealth, deliveries, mailDeliveries] = await Promise.allSettled([
        api<Status>('system/services'), api<SchedulerStatus>('system/schedulers'), api<CalendarDeliveries>('system/calendar-deliveries'),
        api<MailDeliveries>('system/mail-deliveries'),
      ]);
      if (active.current) {
        if (services.status === 'fulfilled') setData(services.value);
        else { setData(undefined); setError(services.reason); }
        if (schedulerHealth.status === 'fulfilled') setSchedulers(schedulerHealth.value);
        else { setSchedulers(undefined); setSchedulerError(schedulerHealth.reason); }
        if (deliveries.status === 'fulfilled') setCalendar(deliveries.value);
        else { setCalendar(undefined); setCalendarError(deliveries.reason); }
        if (mailDeliveries.status === 'fulfilled') setMail(mailDeliveries.value);
        else { setMail(undefined); setMailError(mailDeliveries.reason); }
      }
    }
    finally { if (active.current) setBusy(false); }
  }
  async function retry(id: string) {
    if (!window.confirm('¿Programar un nuevo intento de este aviso agotado?')) return;
    setRetrying(id); setRetryError(undefined); setRetryNotice('');
    try {
      await api(`system/calendar-deliveries/${id}/retry`, 'POST');
      if (active.current) setRetryNotice('Reintento programado. El aviso se procesará en el próximo ciclo.');
      await refresh();
    } catch (reason) { if (active.current) setRetryError(reason); }
    finally { if (active.current) setRetrying(undefined); }
  }
  async function retryMail(type: 'invitations' | 'security-notices', id: string) {
    if (!window.confirm('¿Programar un nuevo intento de envío de este correo agotado?')) return;
    setMailRetrying(id); setMailRetryError(undefined); setMailRetryNotice('');
    try {
      await api(`system/mail-deliveries/${type}/${id}/retry`, 'POST');
      if (active.current) setMailRetryNotice('Reintento de correo programado para el próximo ciclo.');
      await refresh();
    } catch (reason) { if (active.current) setMailRetryError(reason); }
    finally { if (active.current) setMailRetrying(undefined); }
  }
  const available = data?.items.filter(item => item.available).length ?? 0;
  return <section className="panel" aria-label="Estado de servicios">
    <div className="section-heading"><h2>Estado de servicios</h2><button type="button" disabled={busy} onClick={() => void refresh()}>Actualizar estado</button></div>
    <p className="muted">Comprobación puntual de servicios, planificadores y antivirus, y estado de entregas de calendario y correo de esta junta.</p>
    <ErrorBox error={error} />
    {busy && !data && <Loading />}
    {data && <><p role="status">{available} de {data.items.length} servicios disponibles. Consultado: {new Date(data.checked_at).toLocaleString('es-CO')}.</p>
      <div className="delivery-grid">{data.items.map(item => <article className="delivery-card" key={item.service}>
        <h3>{labels[item.service] ?? item.service}</h3><p>{item.available ? 'Disponible' : 'Sin respuesta'}</p>
      </article>)}<article className="delivery-card"><h3>Antivirus de archivos</h3>
        <p>{data.antivirus_available ? 'Disponible y firmas recientes' : 'No disponible o firmas vencidas'}</p></article></div></>}
    <section aria-label="Estado de planificadores">
      <h3>Planificadores</h3>
      <p className="muted">Cada servicio debe ejecutar su ciclo y el publicador de auditoría al menos una vez cada tres minutos. Esta señal no confirma la entrega de cada trabajo.</p>
      <ErrorBox error={schedulerError} />
      {schedulers && <><p role="status">{schedulers.items.filter(item => item.available).length} de {schedulers.items.length} planificadores al día. Consultado: {new Date(schedulers.checked_at).toLocaleString('es-CO')}.</p>
        <div className="delivery-grid">{schedulers.items.map(item => <article className="delivery-card" key={item.service}>
          <h4>{labels[item.service] ?? item.service}</h4>
          <p>Ciclo: {item.cycle_recent ? 'reciente' : 'sin señal reciente'}</p>
          <p>Auditoría: {item.outbox_recent ? 'reciente' : 'sin señal reciente'}</p>
        </article>)}</div></>}
    </section>
    <section aria-label="Entregas de calendario">
      <h3>Avisos de calendario</h3>
      <p className="muted">Estado de entrega de avisos de esta junta. Puedes programar otro intento de un aviso agotado; si el evento ya no es válido, el siguiente ciclo lo descartará.</p>
      <ErrorBox error={calendarError} />
      <ErrorBox error={retryError} />
      {retryNotice && <p role="status">{retryNotice}</p>}
      {calendar && <><dl className="delivery-grid">{[
        ['Entregados', calendar.delivered], ['Pendientes', calendar.pending], ['Listos', calendar.due],
        ['En espera', calendar.deferred], ['Agotados', calendar.exhausted],
      ].map(([label, value]) => <div className="delivery-card" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {!!calendar.exhausted && <details><summary>Avisos agotados ({calendar.exhausted_jobs.length} de {calendar.exhausted})</summary>
          <div className="table-scroll"><table><thead><tr><th>Trabajo</th><th>Tipo</th><th>Fallos</th><th>Programado UTC</th><th>Reintento</th></tr></thead><tbody>
            {calendar.exhausted_jobs.map(job => <tr key={job.id}><td>{job.id}</td><td>{job.kind}</td><td>{job.attempts}</td><td>{job.due_at}</td><td><button type="button" disabled={busy || !!retrying} onClick={() => void retry(job.id)}>Reintentar aviso</button></td></tr>)}
          </tbody></table></div><p>Se muestran como máximo 20, sin títulos ni destinatarios.</p>
        </details>}
      </>}
    </section>
    <section aria-label="Entregas de correo">
      <h3>Correo pendiente</h3>
      <p className="muted">Invitaciones y avisos de seguridad de esta junta. Los agotados pueden programarse para otro intento; no se muestran direcciones ni mensajes.</p>
      <ErrorBox error={mailError} />
      <ErrorBox error={mailRetryError} />
      {mailRetryNotice && <p role="status">{mailRetryNotice}</p>}
      {mail && <div className="delivery-grid">
        <article className="delivery-card"><h4>Invitaciones</h4><dl>{[
          ['Pendientes', mail.invitations.pending], ['Listas', mail.invitations.due],
          ['En espera', mail.invitations.deferred], ['Agotadas', mail.invitations.exhausted],
          ['Vencidas', mail.invitations.expired],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {!!mail.invitations.exhausted && <details><summary>Invitaciones agotadas ({mail.invitations.exhausted_items.length} de {mail.invitations.exhausted})</summary>
            <div className="table-scroll"><table><thead><tr><th>Trabajo</th><th>Fallos</th><th>Creado UTC</th><th>Reintento</th></tr></thead><tbody>
              {mail.invitations.exhausted_items.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.attempts}</td><td>{item.created_at}</td><td>{item.retryable ? <button type="button" disabled={busy || !!mailRetrying} onClick={() => void retryMail('invitations', item.id)}>Reintentar correo</button> : 'Sin datos para reintento'}</td></tr>)}
            </tbody></table></div><p>Las invitaciones vencidas no se reintentan. Se muestran como máximo 20.</p>
          </details>}</article>
        <article className="delivery-card"><h4>Avisos de seguridad</h4><dl>{[
          ['Pendientes', mail.security_notices.pending], ['Listos', mail.security_notices.due],
          ['En espera', mail.security_notices.deferred], ['Agotados', mail.security_notices.exhausted],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {!!mail.security_notices.exhausted && <details><summary>Avisos de seguridad agotados ({mail.security_notices.exhausted_items.length} de {mail.security_notices.exhausted})</summary>
            <div className="table-scroll"><table><thead><tr><th>Trabajo</th><th>Fallos</th><th>Creado UTC</th><th>Reintento</th></tr></thead><tbody>
              {mail.security_notices.exhausted_items.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.attempts}</td><td>{item.created_at}</td><td>{item.retryable ? <button type="button" disabled={busy || !!mailRetrying} onClick={() => void retryMail('security-notices', item.id)}>Reintentar correo</button> : 'Sin datos para reintento'}</td></tr>)}
            </tbody></table></div><p>Se muestran como máximo 20.</p>
          </details>}</article>
      </div>}
    </section>
  </section>;
}
