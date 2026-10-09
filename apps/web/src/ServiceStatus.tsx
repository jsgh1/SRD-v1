import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { ErrorBox, Loading } from './ui';
import { formatLocale, t } from './i18n';

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
    if (!window.confirm(t('¿Programar un nuevo intento de este aviso agotado?'))) return;
    setRetrying(id); setRetryError(undefined); setRetryNotice('');
    try {
      await api(`system/calendar-deliveries/${id}/retry`, 'POST');
      if (active.current) setRetryNotice(t('Reintento programado. El aviso se procesará en el próximo ciclo.'));
      await refresh();
    } catch (reason) { if (active.current) setRetryError(reason); }
    finally { if (active.current) setRetrying(undefined); }
  }
  async function retryMail(type: 'invitations' | 'security-notices', id: string) {
    if (!window.confirm(t('¿Programar un nuevo intento de envío de este correo agotado?'))) return;
    setMailRetrying(id); setMailRetryError(undefined); setMailRetryNotice('');
    try {
      await api(`system/mail-deliveries/${type}/${id}/retry`, 'POST');
      if (active.current) setMailRetryNotice(t('Reintento de correo programado para el próximo ciclo.'));
      await refresh();
    } catch (reason) { if (active.current) setMailRetryError(reason); }
    finally { if (active.current) setMailRetrying(undefined); }
  }
  const available = data?.items.filter(item => item.available).length ?? 0;
  return <section className="panel" aria-label={t('Estado de servicios')}>
    <div className="section-heading"><h2>{t('Estado de servicios')}</h2><button type="button" disabled={busy} onClick={() => void refresh()}>{t('Actualizar estado')}</button></div>
    <p className="muted">{t('Comprobación puntual de servicios, planificadores y antivirus, y estado de entregas de calendario y correo de esta junta.')}</p>
    <ErrorBox error={error} />
    {busy && !data && <Loading />}
    {data && <><p role="status">{t('{available} de {total} servicios disponibles. Consultado: {date}.', {available, total: data.items.length, date: new Date(data.checked_at).toLocaleString(formatLocale())})}</p>
      <div className="delivery-grid service-grid">{data.items.map(item => <article className="delivery-card" key={item.service}>
        <h3>{t(labels[item.service] ?? item.service)}</h3><p>{t(item.available ? 'Disponible' : 'Sin respuesta')}</p>
      </article>)}<article className="delivery-card"><h3>{t('Antivirus de archivos')}</h3>
        <p>{t(data.antivirus_available ? 'Disponible y firmas recientes' : 'No disponible o firmas vencidas')}</p></article></div></>}
    <section aria-label={t('Estado de planificadores')}>
      <h3>{t('Planificadores')}</h3>
      <p className="muted">{t('Cada servicio debe ejecutar su ciclo y el publicador de auditoría al menos una vez cada tres minutos. Esta señal no confirma la entrega de cada trabajo.')}</p>
      <ErrorBox error={schedulerError} />
      {schedulers && <><p role="status">{t('{available} de {total} planificadores al día. Consultado: {date}.', {available: schedulers.items.filter(item => item.available).length, total: schedulers.items.length, date: new Date(schedulers.checked_at).toLocaleString(formatLocale())})}</p>
        <div className="delivery-grid service-grid">{schedulers.items.map(item => <article className="delivery-card" key={item.service}>
          <h4>{t(labels[item.service] ?? item.service)}</h4>
          <p>{t('Ciclo: {status}', {status: t(item.cycle_recent ? 'reciente' : 'sin señal reciente')})}</p>
          <p>{t('Auditoría: {status}', {status: t(item.outbox_recent ? 'reciente' : 'sin señal reciente')})}</p>
        </article>)}</div></>}
    </section>
    <section aria-label={t('Entregas de calendario')}>
      <h3>{t('Avisos de calendario')}</h3>
      <p className="muted">{t('Estado de entrega de avisos de esta junta. Puedes programar otro intento de un aviso agotado; si el evento ya no es válido, el siguiente ciclo lo descartará.')}</p>
      <ErrorBox error={calendarError} />
      <ErrorBox error={retryError} />
      {retryNotice && <p role="status">{retryNotice}</p>}
      {calendar && <><dl className="delivery-grid">{[
        ['Entregados', calendar.delivered], ['Pendientes', calendar.pending], ['Listos', calendar.due],
        ['En espera', calendar.deferred], ['Agotados', calendar.exhausted],
      ].map(([label, value]) => <div className="delivery-card" key={label}><dt>{t(String(label))}</dt><dd>{value}</dd></div>)}</dl>
        {!!calendar.exhausted && <details><summary>{t('Avisos agotados ({shown} de {total})', {shown: calendar.exhausted_jobs.length, total: calendar.exhausted})}</summary>
          <div className="table-scroll"><table><thead><tr>{['Trabajo','Tipo','Fallos','Programado UTC','Reintento'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>
            {calendar.exhausted_jobs.map(job => <tr key={job.id}><td>{job.id}</td><td>{job.kind}</td><td>{job.attempts}</td><td>{job.due_at}</td><td><button type="button" disabled={busy || !!retrying} onClick={() => void retry(job.id)}>{t('Reintentar aviso')}</button></td></tr>)}
          </tbody></table></div><p>{t('Se muestran como máximo 20, sin títulos ni destinatarios.')}</p>
        </details>}
      </>}
    </section>
    <section aria-label={t('Entregas de correo')}>
      <h3>{t('Correo pendiente')}</h3>
      <p className="muted">{t('Invitaciones y avisos de seguridad de esta junta. Los agotados pueden programarse para otro intento; no se muestran direcciones ni mensajes.')}</p>
      <ErrorBox error={mailError} />
      <ErrorBox error={mailRetryError} />
      {mailRetryNotice && <p role="status">{mailRetryNotice}</p>}
      {mail && <div className="delivery-grid">
        <article className="delivery-card"><h4>{t('Invitaciones')}</h4><dl>{[
          ['Pendientes', mail.invitations.pending], ['Listas', mail.invitations.due],
          ['En espera', mail.invitations.deferred], ['Agotadas', mail.invitations.exhausted],
          ['Vencidas', mail.invitations.expired],
        ].map(([label, value]) => <div key={label}><dt>{t(String(label))}</dt><dd>{value}</dd></div>)}</dl>
          {!!mail.invitations.exhausted && <details><summary>{t('Invitaciones agotadas ({shown} de {total})', {shown: mail.invitations.exhausted_items.length, total: mail.invitations.exhausted})}</summary>
            <div className="table-scroll"><table><thead><tr>{['Trabajo','Fallos','Creado UTC','Reintento'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>
              {mail.invitations.exhausted_items.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.attempts}</td><td>{item.created_at}</td><td>{item.retryable ? <button type="button" disabled={busy || !!mailRetrying} onClick={() => void retryMail('invitations', item.id)}>{t('Reintentar correo')}</button> : t('Sin datos para reintento')}</td></tr>)}
            </tbody></table></div><p>{t('Las invitaciones vencidas no se reintentan. Se muestran como máximo 20.')}</p>
          </details>}</article>
        <article className="delivery-card"><h4>{t('Avisos de seguridad')}</h4><dl>{[
          ['Pendientes', mail.security_notices.pending], ['Listos', mail.security_notices.due],
          ['En espera', mail.security_notices.deferred], ['Agotados', mail.security_notices.exhausted],
        ].map(([label, value]) => <div key={label}><dt>{t(String(label))}</dt><dd>{value}</dd></div>)}</dl>
          {!!mail.security_notices.exhausted && <details><summary>{t('Avisos de seguridad agotados ({shown} de {total})', {shown: mail.security_notices.exhausted_items.length, total: mail.security_notices.exhausted})}</summary>
            <div className="table-scroll"><table><thead><tr>{['Trabajo','Fallos','Creado UTC','Reintento'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>
              {mail.security_notices.exhausted_items.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.attempts}</td><td>{item.created_at}</td><td>{item.retryable ? <button type="button" disabled={busy || !!mailRetrying} onClick={() => void retryMail('security-notices', item.id)}>{t('Reintentar correo')}</button> : t('Sin datos para reintento')}</td></tr>)}
            </tbody></table></div><p>{t('Se muestran como máximo 20.')}</p>
          </details>}</article>
      </div>}
    </section>
  </section>;
}
