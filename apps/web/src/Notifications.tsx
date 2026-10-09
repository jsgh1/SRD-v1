import { useEffect, useId, useRef, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { api } from './api';
import { ErrorBox } from './ui';
import { notificationQuietHoursActive, type QuietHours } from './NotificationQuietHours';
import { formatLocale, t, useLanguage } from './i18n';

type Notice = { id: string; event_id: string | null; conversation_id: string | null; kind: 'invitation' | 'event_changed' | 'event_cancelled' | 'reminder_24h' | 'reminder_1h' | 'chat_message'; title: string; title_en?: string | null; created_at: string; read_at: string | null };
type Inbox = { items: Notice[]; page: number; page_size: number; total: number; unread: number };
type Preferences = QuietHours & { event_changes: boolean; reminders: boolean; chat_messages: boolean };
const messages: Record<Notice['kind'], string> = {
  invitation: 'Te invitaron al evento', event_changed: 'Cambió el evento',
  event_cancelled: 'Se canceló el evento', reminder_24h: 'Recordatorio de 24 horas', reminder_1h: 'Recordatorio de 1 hora', chat_message: 'Chat',
};
function relativeTime(value: string): string {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  const format = new Intl.RelativeTimeFormat(formatLocale(), { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  return Math.abs(hours) < 24 ? format.format(hours, 'hour') : format.format(Math.round(hours / 24), 'day');
}

export function Notifications({ organizationId, doNotDisturb, onEvent, onChat }: { organizationId: string; doNotDisturb: boolean; onEvent: (id: string) => void; onChat: (id: string) => void }) {
  const language = useLanguage();
  const anchor = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false), [page, setPage] = useState(1);
  const [inbox, setInbox] = useState<Inbox>(), [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
  const [preferences, setPreferences] = useState<Preferences>(), [draft, setDraft] = useState<Preferences>();
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { if (!open) setDraft(preferences); }, [open, preferences]);
  function closeInbox() {
    setOpen(false);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchor.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && anchor.current?.contains(document.activeElement)) {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setClock(new Date());
      timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
    };
    tick();
    const onFocus = () => setClock(new Date());
    window.addEventListener('focus', onFocus);
    return () => { clearTimeout(timer); window.removeEventListener('focus', onFocus); };
  }, []);
  const quiet = notificationQuietHoursActive(preferences, clock);
  const silent = doNotDisturb || quiet;
  useEffect(() => { setInbox(undefined); setPreferences(undefined); setDraft(undefined); setOpen(false); setPage(1); }, [organizationId]);
  useEffect(() => {
    let active = true;
    const load = () => {
      if (document.hidden) return;
      void api<Inbox>(`notifications?page=${open ? page : 1}`).then(value => { if (active) { setInbox(value); setError(undefined); } })
        .catch(value => { if (active && open) setError(value); });
    };
    load();
    const interval = window.setInterval(load, 30000);
    document.addEventListener('visibilitychange', load);
    return () => { active = false; clearInterval(interval); document.removeEventListener('visibilitychange', load); };
  }, [organizationId, open, page, refresh]);
  useEffect(() => {
    let active = true;
    if (open) setDraft(undefined);
    api<Preferences>('notification-preferences').then(value => {
      if (active) { setPreferences(value); setDraft(value); }
    }).catch(value => { if (active) setError(value); });
    return () => { active = false; };
  }, [organizationId, open]);
  async function change(id: string, operation: 'read' | 'dismiss') {
    setBusy(true); setError(undefined);
    try {
      await api(operation === 'read' ? `notifications/${id}/read` : `notifications/${id}`,
        operation === 'read' ? 'POST' : 'DELETE');
      setRefresh(value => value + 1);
    } catch (value) { setError(value); } finally { setBusy(false); }
  }
  async function savePreferences() {
    if (!draft) return;
    setBusy(true); setError(undefined);
    try {
      const saved = await api<Preferences>('notification-preferences', 'PUT', draft);
      setPreferences(saved); setDraft(saved);
    } catch (value) { setError(value); } finally { setBusy(false); }
  }
  return <div className="notification-anchor" ref={anchor}>
    <button type="button" ref={trigger} className="notification-trigger" aria-controls={open ? panelId : undefined} aria-label={`${t('Notificaciones')}${doNotDisturb ? `, ${t('No molestar')}` : quiet ? `, ${t('Horario de silencio')}` : inbox?.unread ? `, ${t('{count} sin leer', { count: inbox.unread })}` : ''}`} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {silent ? <BellOff size={20} /> : <Bell size={20} />}{!silent && !!inbox?.unread && <span className="notification-count">{inbox.unread > 99 ? '99+' : inbox.unread}</span>}
    </button>
    {open && <section id={panelId} className="notification-popover" aria-label={t('Bandeja de notificaciones')}>
      <div className="section-heading"><h2>{t('Notificaciones')}</h2><button ref={closeButton} type="button" onClick={closeInbox}>{t('Cerrar')}</button></div>
      <button type="button" onClick={() => setRefresh(value => value + 1)}>{t('Actualizar')}</button>
      {doNotDisturb && <p className="muted">{t('No molestar está activo: tus avisos siguen aquí, sin distintivo en la campana.')}</p>}
      {quiet && <p className="muted">{t('Horario de silencio activo: tus avisos siguen aquí, sin distintivo en la campana.')}</p>}
      <ErrorBox error={error} />
      {!inbox && !error && <p className="muted">{t('Cargando avisos…')}</p>}
      {inbox && <><p className="muted">{t('{count} sin leer', { count: inbox.unread })}</p>
        {inbox.items.length ? <ul className="notification-list">{inbox.items.map(item => <li key={item.id} className={item.read_at ? '' : 'unread'}>
          <button type="button" className="notification-link" onClick={() => { if (item.kind === 'chat_message' && item.conversation_id) onChat(item.conversation_id); else if (item.event_id) onEvent(item.event_id); setOpen(false); if (!item.read_at) void change(item.id, 'read'); }}>
            <strong>{t(messages[item.kind])}: {language === 'en' && item.title_en ? item.title_en : item.title}</strong><small>{relativeTime(item.created_at)}</small>
          </button>
          <div className="pagination">{!item.read_at && <button type="button" disabled={busy} onClick={() => change(item.id, 'read')}>{t('Marcar leído')}</button>}
            <button type="button" disabled={busy} onClick={() => change(item.id, 'dismiss')}>{t('Descartar')}</button></div>
        </li>)}</ul> : <p className="muted">{t('No tienes avisos.')}</p>}
        {inbox.total > inbox.page_size && <div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>{t('Anterior')}</button>
          <span>{t('Página {page}', { page })}</span><button disabled={page * inbox.page_size >= inbox.total} onClick={() => setPage(value => value + 1)}>{t('Siguiente')}</button></div>}
      </>}
      <div className="notification-preferences">
        <h3>{t('Preferencias de avisos')}</h3>
        {draft ? <>
          <label><input type="checkbox" checked={draft.event_changes} onChange={event => setDraft({ ...draft, event_changes: event.target.checked })} /> {t('Avisos de cambios de eventos')}</label>
          <label><input type="checkbox" checked={draft.reminders} onChange={event => setDraft({ ...draft, reminders: event.target.checked })} /> {t('Recordatorios de 24 horas y 1 hora')}</label>
          <label><input type="checkbox" checked={draft.chat_messages} onChange={event => setDraft({ ...draft, chat_messages: event.target.checked })} /> {t('Avisos de mensajes de Chat')}</label>
          <p className="muted">{t('Las invitaciones y cancelaciones siempre llegan a esta bandeja.')}</p>
          <label><input type="checkbox" checked={draft.quiet_start !== null} onChange={event => setDraft({ ...draft,
            quiet_start: event.target.checked ? '22:00' : null, quiet_end: event.target.checked ? '07:00' : null })} /> {t('Activar horario de silencio')}</label>
          {draft.quiet_start !== null && <div className="form-grid">
            <label>{t('Silencio desde')}<input type="time" value={draft.quiet_start} onChange={event => setDraft({ ...draft, quiet_start: event.target.value })} /></label>
            <label>{t('Silencio hasta')}<input type="time" value={draft.quiet_end ?? ''} onChange={event => setDraft({ ...draft, quiet_end: event.target.value })} /></label>
          </div>}
          <p className="muted">{t('Horario diario de Colombia, según el reloj de este dispositivo. Puede cruzar medianoche. Oculta el distintivo y conserva los avisos; no cambia tu presencia ni los correos de seguridad.')}</p>
          <button type="button" disabled={busy || (preferences?.event_changes === draft.event_changes && preferences?.reminders === draft.reminders && preferences?.chat_messages === draft.chat_messages
            && preferences?.quiet_start === draft.quiet_start && preferences?.quiet_end === draft.quiet_end)} onClick={savePreferences}>{t('Guardar preferencias')}</button>
        </> : <p className="muted">{t('Cargando preferencias…')}</p>}
      </div>
    </section>}
  </div>;
}
