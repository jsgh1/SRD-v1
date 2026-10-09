import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, roleNames, type Principal } from './api';
import { Empty, ErrorBox, Loading, Modal } from './ui';
import { calendarState } from './calendar-state';
import { useCalendarClock } from './useCalendarClock';
import { formatLocale, t, useLanguage } from './i18n';

type CalendarEvent = {
  id: string; type: 'meeting' | 'appointment' | 'activity' | 'important_date';
  title: string; title_en?: string | null; description: string | null; description_en?: string | null; location: string | null; location_en?: string | null;
  starts_at: string; ends_at: string; cancelled_at: string | null;
  state: 'scheduled' | 'upcoming' | 'in_progress' | 'finished' | 'cancelled';
  version: number;
  remind_24h: boolean; remind_1h: boolean;
  participants: Participant[];
};
type Response = 'pending' | 'accepted' | 'declined';
type Participant = { user_id: string; name: string; response: Response; response_version: number; responded_at: string | null };
type SelectedParticipant = Pick<Participant, 'user_id' | 'name'>;
type Invitation = { event_id: string; title: string; title_en?: string | null; starts_at: string; ends_at: string; location: string | null; location_en?: string | null; response: Response; response_version: number };
type InvitationPage = { items: Invitation[]; page: number; page_size: number; total: number };
type Contact = { id: string; name: string; role: string };
type Settings = { version: number; editor_roles: string[]; can_manage: boolean; can_edit: boolean };
type View = 'month' | 'week' | 'agenda';
type Form = { type: CalendarEvent['type']; title: string; title_en: string; description: string; description_en: string; location: string; location_en: string; starts_at: string; ends_at: string; remind_24h: boolean; remind_1h: boolean };
const zone = 'America/Bogota';
const types: Record<CalendarEvent['type'], string> = { meeting: 'Reunión', appointment: 'Cita', activity: 'Actividad', important_date: 'Fecha importante' };
const states: Record<CalendarEvent['state'], string> = { scheduled: 'Programado', upcoming: 'Próximo', in_progress: 'En curso', finished: 'Finalizado', cancelled: 'Cancelado' };
const delegatedRoles = ['registrar', 'treasurer', 'auditor', 'viewer'];
const responseNames: Record<Response, string> = { pending: 'Pendiente', accepted: 'Aceptada', declined: 'Rechazada' };
const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function addDays(day: string, count: number): string {
  const date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
function localParts(value: string): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
}
function today(): string {
  const p = localParts(new Date().toISOString());
  return `${p.year}-${p.month}-${p.day}`;
}
function localInput(value: string): string {
  const p = localParts(value);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function dayLabel(day: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(formatLocale(), { timeZone: 'UTC', ...options }).format(new Date(day + 'T12:00:00Z'));
}
function localTime(value: string): string {
  return new Intl.DateTimeFormat(formatLocale(), { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}
function localDateTime(value: string): string {
  return `${dayLabel(localInput(value).slice(0, 10), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${localTime(value)}`;
}
function overlaps(event: CalendarEvent, day: string): boolean {
  const first = new Date(day + 'T00:00:00-05:00').getTime();
  const next = new Date(addDays(day, 1) + 'T00:00:00-05:00').getTime();
  return new Date(event.starts_at).getTime() < next && new Date(event.ends_at).getTime() > first;
}
function windowFor(view: View, anchor: string): { from: string; to: string; title: string; dates: string[] } {
  const date = new Date(anchor + 'T12:00:00Z');
  if (view === 'month') {
    const first = `${anchor.slice(0, 7)}-01`;
    const offset = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7;
    const from = addDays(first, -offset);
    const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    const last = addDays(nextMonth.toISOString().slice(0, 10), -1);
    const count = Math.ceil((offset + Number(last.slice(8))) / 7) * 7;
    return { from, to: addDays(from, count - 1), title: dayLabel(first, { month: 'long', year: 'numeric' }), dates: Array.from({ length: count }, (_, i) => addDays(from, i)) };
  }
  if (view === 'week') {
    const from = addDays(anchor, -(date.getUTCDay() + 6) % 7);
    return { from, to: addDays(from, 6), title: `${dayLabel(from, { day: 'numeric', month: 'short' })} – ${dayLabel(addDays(from, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`, dates: Array.from({ length: 7 }, (_, i) => addDays(from, i)) };
  }
  return { from: anchor, to: addDays(anchor, 29), title: `${dayLabel(anchor, { day: 'numeric', month: 'long' })} – ${dayLabel(addDays(anchor, 29), { day: 'numeric', month: 'long', year: 'numeric' })}`, dates: Array.from({ length: 30 }, (_, i) => addDays(anchor, i)) };
}
function initialForm(day: string, event?: CalendarEvent): Form {
  return event ? { type: event.type, title: event.title, title_en: event.title_en || '', description: event.description || '', description_en: event.description_en || '', location: event.location || '', location_en: event.location_en || '', starts_at: localInput(event.starts_at), ends_at: localInput(event.ends_at), remind_24h: event.remind_24h, remind_1h: event.remind_1h }
    : { type: 'meeting', title: '', title_en: '', description: '', description_en: '', location: '', location_en: '', starts_at: `${day}T09:00`, ends_at: `${day}T10:00`, remind_24h: true, remind_1h: true };
}

export function Calendar({ principal, openEventId, onOpened }: { principal: Principal; openEventId?: string; onOpened?: () => void }) {
  const language = useLanguage();
  const localized = (spanish: string | null, english?: string | null) => language === 'en' && english ? english : spanish || '';
  const [view, setView] = useState<View>('month'), [anchor, setAnchor] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today), [settings, setSettings] = useState<Settings>();
  const [events, setEvents] = useState<CalendarEvent[]>([]), [selected, setSelected] = useState<CalendarEvent>();
  const [invitations, setInvitations] = useState<InvitationPage>(), [invitationPage, setInvitationPage] = useState(1);
  const [editing, setEditing] = useState<CalendarEvent | 'new'>(), [form, setForm] = useState<Form>(() => initialForm(today()));
  const [participants, setParticipants] = useState<SelectedParticipant[]>([]), [contactQuery, setContactQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]), [contactError, setContactError] = useState<unknown>();
  const [roles, setRoles] = useState<string[]>([]), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(), [notice, setNotice] = useState(''), [refresh, setRefresh] = useState(0);
  const range = useMemo(() => windowFor(view, anchor), [view, anchor, language]);
  const clock = useCalendarClock();

  useEffect(() => {
    if (!openEventId) return;
    let active = true;
    api<CalendarEvent>(`calendar-events/${openEventId}`).then(value => {
      if (active) { setSelected(value); setAnchor(localInput(value.starts_at).slice(0, 10)); onOpened?.(); }
    }).catch(value => { if (active) { setError(value); onOpened?.(); } });
    return () => { active = false; };
  }, [openEventId, onOpened]);

  useEffect(() => {
    let active = true;
    api<Settings>('calendar-settings').then(value => { if (active) { setSettings(value); setRoles(value.editor_roles); } }).catch(value => { if (active) setError(value); });
    return () => { active = false; };
  }, [principal.organization.id]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(undefined);
    api<{ items: CalendarEvent[] }>(`calendar-events?${new URLSearchParams({ from: range.from, to: range.to })}`)
      .then(value => { if (active) setEvents(value.items); })
      .catch(value => { if (active) setError(value); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [principal.organization.id, range.from, range.to, refresh]);
  useEffect(() => {
    let active = true;
    api<InvitationPage>(`calendar-invitations?page=${invitationPage}`)
      .then(value => { if (active) setInvitations(value); })
      .catch(value => { if (active) setError(value); });
    return () => { active = false; };
  }, [principal.organization.id, invitationPage, refresh]);
  useEffect(() => {
    if (!editing) return;
    let active = true;
    const timer = window.setTimeout(() => {
      api<{ items: Contact[] }>(`contacts?${new URLSearchParams({ q: contactQuery.trim(), page: '1' })}`)
        .then(value => { if (active) { setContacts(value.items); setContactError(undefined); } })
        .catch(value => { if (active) { setContacts([]); setContactError(value); } });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [editing, contactQuery, principal.organization.id]);
  function move(direction: number) {
    if (view === 'week') setAnchor(addDays(anchor, direction * 7));
    else if (view === 'agenda') setAnchor(addDays(anchor, direction * 30));
    else {
      const date = new Date(anchor + 'T12:00:00Z');
      setAnchor(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction, 1)).toISOString().slice(0, 10));
    }
  }
  function openForm(event?: CalendarEvent) {
    setForm(initialForm(selectedDay, event)); setEditing(event || 'new'); setError(undefined); setNotice('');
    setParticipants(event?.participants ?? []); setContactQuery(''); setContacts([]); setContactError(undefined);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (form.ends_at <= form.starts_at) { setError(new Error('El final debe ser posterior al inicio.')); return; }
    setBusy(true); setError(undefined);
    try {
      const body = { ...form, participants: participants.map(item => item.user_id), starts_at: form.starts_at + ':00-05:00', ends_at: form.ends_at + ':00-05:00', ...(editing !== 'new' && editing ? { version: editing.version } : {}) };
      const value = await api<CalendarEvent>(editing === 'new' ? 'calendar-events' : `calendar-events/${(editing as CalendarEvent).id}`, editing === 'new' ? 'POST' : 'PATCH', body);
      setEditing(undefined); setSelected(value); setSelectedDay(localInput(value.starts_at).slice(0, 10)); setAnchor(localInput(value.starts_at).slice(0, 10));
      setNotice(editing === 'new' ? 'Evento creado.' : 'Evento actualizado.'); setRefresh(count => count + 1);
    } catch (value) { setError(value); } finally { setBusy(false); }
  }
  async function cancel() {
    if (!selected || !window.confirm(t('¿Cancelar este evento?'))) return;
    setBusy(true); setError(undefined);
    try { setSelected(await api<CalendarEvent>(`calendar-events/${selected.id}/cancel`, 'POST', { version: selected.version })); setNotice('Evento cancelado.'); setRefresh(count => count + 1); }
    catch (value) { setError(value); } finally { setBusy(false); }
  }
  async function respond(invitation: Invitation, response: 'accepted' | 'declined') {
    setBusy(true); setError(undefined);
    try {
      const value = await api<CalendarEvent>(`calendar-invitations/${invitation.event_id}/respond`, 'POST', { response, version: invitation.response_version });
      if (selected?.id === value.id) setSelected(value);
      setNotice(response === 'accepted' ? 'Asistencia confirmada.' : 'Invitación rechazada.');
      setRefresh(count => count + 1);
    } catch (value) { setError(value); setRefresh(count => count + 1); } finally { setBusy(false); }
  }
  async function openInvitation(id: string) {
    setError(undefined);
    try { setSelected(await api<CalendarEvent>(`calendar-events/${id}`)); }
    catch (value) { setError(value); }
  }
  async function saveRoles() {
    if (!settings) return;
    setBusy(true); setError(undefined); setNotice('');
    try { const value = await api<Settings>('calendar-settings', 'PUT', { version: settings.version, editor_roles: delegatedRoles.filter(role => roles.includes(role)) }); setSettings(value); setRoles(value.editor_roles); setNotice('Permisos del calendario guardados.'); }
    catch (value) { setError(value); } finally { setBusy(false); }
  }
  const dayEvents = (day: string) => events.filter(event => overlaps(event, day));
  const availableContacts = contacts.filter(contact => !participants.some(item => item.user_id === contact.id));
  const addParticipant = (user_id: string, name: string) => {
    if (participants.length < 50 && !participants.some(item => item.user_id === user_id)) setParticipants(current => [...current, { user_id, name }]);
  };
  const participantPicker = <fieldset className="calendar-participants"><legend>{t('Participantes de la junta')}</legend>
    <p className="muted">{t('Al guardar, los participantes nuevos reciben una invitación en su bandeja de SRD.')}</p>
    {participants.length > 0 && <ul className="calendar-participant-list">{participants.map(item => <li key={item.user_id}>{item.name} <button type="button" onClick={() => setParticipants(current => current.filter(value => value.user_id !== item.user_id))} aria-label={t('Quitar a {name}', { name: item.name })}>{t('Quitar')}</button></li>)}</ul>}
    <label>{t('Buscar integrante')}<input maxLength={120} value={contactQuery} onChange={e => setContactQuery(e.target.value)} placeholder={t('Nombre del integrante')} /></label>
    <ErrorBox error={contactError} />
    {participants.length < 50 && principal.user_id && !participants.some(item => item.user_id === principal.user_id) && <button type="button" onClick={() => addParticipant(principal.user_id, principal.user.name)}>{t('Añadirme')}</button>}
    {availableContacts.length > 0 && <ul className="calendar-participant-list">{availableContacts.map(contact => <li key={contact.id}><span>{contact.name} · {t(roleNames[contact.role] ?? contact.role)}</span><button type="button" disabled={participants.length >= 50} onClick={() => addParticipant(contact.id, contact.name)} aria-label={t('Añadir a {name}', { name: contact.name })}>{t('Añadir')}</button></li>)}</ul>}
    {!contactQuery && contacts.length === 25 && <p className="muted">{t('Busca por nombre para encontrar otros integrantes.')}</p>}
  </fieldset>;
  const button = (event: CalendarEvent) => <button key={event.id} type="button" className={`calendar-event ${event.state === 'cancelled' ? 'cancelled' : ''}`} onClick={() => setSelected(event)} title={localized(event.title, event.title_en)}><span className="calendar-event-title">{localTime(event.starts_at)} · {localized(event.title, event.title_en)}</span><small className="calendar-event-state">{t(states[calendarState(event, clock)])}</small></button>;
  const reminderPicker = <fieldset className="calendar-reminders"><legend>{t('Recordatorios para participantes')}</legend>
    <label><input type="checkbox" checked={form.remind_24h} onChange={event => setForm({ ...form, remind_24h: event.target.checked })} />{t('24 horas antes')}</label>
    <label><input type="checkbox" checked={form.remind_1h} onChange={event => setForm({ ...form, remind_1h: event.target.checked })} />{t('1 hora antes')}</label>
    <p className="muted">{t('Puedes desactivar ambos. Invitaciones y cancelaciones siguen llegando. Cada participante conserva su preferencia personal de recordatorios. Si la anticipación ya pasó y el evento aún no empezó, el aviso queda listo inmediatamente.')}</p>
  </fieldset>;
  return <>
    <div className="page-heading"><div><h1>{t('Calendario')}</h1><p className="muted">{t('Eventos de {name} · hora de Colombia', { name: principal.organization.name })}</p></div>
      {settings?.can_edit && <button className="primary" onClick={() => openForm()}>{t('Crear evento')}</button>}</div>
    <ErrorBox error={error} />{notice && <p className="notice" role="status">{t(notice)}</p>}
    <p className="muted">{t('Próximo: durante las 24 horas previas al inicio. Los estados avanzan automáticamente con la hora del dispositivo. Usa Actualizar calendario para consultar cambios de otros integrantes.')}</p>
    {invitations && <section className="panel" aria-label={t('Mis invitaciones')}><h2>{t('Mis invitaciones')}</h2>
      <p className="muted">{t('Eventos futuros a los que te asignaron. Puedes responder aquí y consultar los avisos en la campana.')}</p>
      {invitations.items.length ? <ul className="calendar-invitation-list">{invitations.items.map(item => <li key={item.event_id}>
        <div><button type="button" className="link-button" onClick={() => openInvitation(item.event_id)}>{localized(item.title, item.title_en)}</button>
          <span className="muted">{localDateTime(item.starts_at)}{item.location ? ` · ${localized(item.location, item.location_en)}` : ''} · {t(responseNames[item.response])}</span></div>
        <div className="pagination">{item.response !== 'accepted' && <button type="button" disabled={busy} onClick={() => respond(item, 'accepted')}>{t('Aceptar')}</button>}
          {item.response !== 'declined' && <button type="button" disabled={busy} onClick={() => respond(item, 'declined')}>{t('Rechazar')}</button>}</div>
      </li>)}</ul> : <p className="muted">{t('No tienes invitaciones a eventos futuros.')}</p>}
      {invitations.total > invitations.page_size && <div className="pagination"><span>{t('{count} invitaciones', { count: invitations.total })}</span>
        <button disabled={invitationPage === 1} onClick={() => setInvitationPage(page => page - 1)}>{t('Anterior')}</button>
        <span>{t('Página {page}', { page: invitationPage })}</span><button disabled={invitationPage * invitations.page_size >= invitations.total} onClick={() => setInvitationPage(page => page + 1)}>{t('Siguiente')}</button></div>}
    </section>}
    <section className="panel calendar-panel" aria-label={t('Calendario de la junta')}>
      <div className="calendar-toolbar"><div className="pagination"><button onClick={() => move(-1)} aria-label={t('Período anterior')}>{t('Anterior')}</button><button onClick={() => { const value = today(); setAnchor(value); setSelectedDay(value); }}>{t('Hoy')}</button><button onClick={() => move(1)} aria-label={t('Período siguiente')}>{t('Siguiente')}</button><button disabled={loading} onClick={() => setRefresh(value => value + 1)}>{t('Actualizar calendario')}</button></div>
        <h2>{range.title}</h2><div className="pagination">{(['month', 'week', 'agenda'] as View[]).map(value => <button key={value} aria-pressed={view === value} onClick={() => setView(value)}>{t(value === 'month' ? 'Mes' : value === 'week' ? 'Semana' : 'Agenda')}</button>)}</div></div>
      {loading ? <Loading /> : <>
        {view === 'month' && <><div className="calendar-weekdays">{days.map(day => <strong key={day}>{t(day)}</strong>)}</div><div className="calendar-grid">{range.dates.map(day => <div key={day} className={`calendar-day ${day.slice(0, 7) !== anchor.slice(0, 7) ? 'outside' : ''} ${selectedDay === day ? 'selected' : ''}`}>
          <button className="calendar-date" onClick={() => setSelectedDay(day)} aria-label={day}>{Number(day.slice(8))}</button>
          {dayEvents(day).slice(0, 3).map(button)}{dayEvents(day).length > 3 && <small>{t('+{count} más', { count: dayEvents(day).length - 3 })}</small>}
        </div>)}</div><div className="calendar-selected"><h3>{dayLabel(selectedDay, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>{dayEvents(selectedDay).length ? dayEvents(selectedDay).map(button) : <p className="muted">{t('Sin eventos este día.')}</p>}</div></>}
        {view === 'week' && <div className="calendar-week">{range.dates.map(day => <section key={day}><h3>{dayLabel(day, { weekday: 'short', day: 'numeric', month: 'short' })}</h3>{dayEvents(day).length ? dayEvents(day).map(button) : <p className="muted">{t('Sin eventos')}</p>}</section>)}</div>}
        {view === 'agenda' && <div className="calendar-agenda">{range.dates.filter(day => dayEvents(day).length).map(day => <section key={day}><h3>{dayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>{dayEvents(day).map(button)}</section>)}{!events.length && <Empty title={t('No hay eventos en este período')}>{t('Cambia de fecha o crea el primero.')}</Empty>}</div>}
      </>}
    </section>
    {settings?.can_manage && <section className="panel"><h2>{t('Quién puede editar el calendario')}</h2><p className="muted">{t('Administradores y superadministradores siempre pueden editar. La delegación se aplica a toda la junta y se puede retirar.')}</p><div className="calendar-roles">{delegatedRoles.map(role => <label key={role}><input type="checkbox" checked={roles.includes(role)} onChange={e => setRoles(current => e.target.checked ? [...current, role] : current.filter(item => item !== role))} />{t(roleNames[role] ?? role)}</label>)}</div><button disabled={busy} onClick={saveRoles}>{t('Guardar permisos')}</button></section>}
    {selected && <Modal title={t('Detalle del evento')} onClose={() => setSelected(undefined)}><div className="calendar-detail">
      <p><strong>{localized(selected.title, selected.title_en)}</strong> · {t(types[selected.type])}</p>
      <p>{t('Inicio')}: {localDateTime(selected.starts_at)}</p><p>{t('Fin')}: {localDateTime(selected.ends_at)}</p>
      <p>{t('Estado')}: {t(states[calendarState(selected, clock)])}</p>
      <p>{t('Recordatorios del evento')}: {[selected.remind_24h && t('24 horas'), selected.remind_1h && t('1 hora')].filter(Boolean).join(t(' y ')) || t('Ninguno')}</p>
      {selected.location && <p>{t('Lugar')}: {localized(selected.location, selected.location_en)}</p>}
      {selected.description && <p>{localized(selected.description, selected.description_en)}</p>}
      <p><strong>{t('Participantes')}:</strong> {selected.participants?.length ? selected.participants.map(item => `${item.name} (${t(responseNames[item.response])})`).join(', ') : t('Sin participantes asignados')}</p>
      <div className="pagination">{settings?.can_edit && selected.state !== 'cancelled' && <><button onClick={() => { openForm(selected); setSelected(undefined); }}>{t('Editar')}</button><button disabled={busy} onClick={cancel}>{t('Cancelar evento')}</button></>}</div>
    </div></Modal>}
    {editing && <Modal title={t(editing === 'new' ? 'Crear evento' : 'Editar evento')} onClose={() => setEditing(undefined)}><form className="calendar-form" onSubmit={save}>
      <label>{t('Tipo')}<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Form['type'] })}>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select></label>
      <p className="muted">{t('Escribe cada texto del evento en español e inglés. Los eventos antiguos sin inglés necesitan una versión antes de guardar cambios.')}</p>
      <label>{t('Título')}<input required minLength={2} maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
      <label>{t('Título (EN)')}<input required minLength={2} maxLength={160} value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} /></label>
      <label>{t('Inicio')}<input required type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></label>
      <label>{t('Final')}<input required type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></label>
      <label>{t('Lugar')}<input required={!!form.location_en.trim()} maxLength={160} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></label>
      <label>{t('Lugar (EN)')}<input required={!!form.location.trim()} maxLength={160} value={form.location_en} onChange={e => setForm({ ...form, location_en: e.target.value })} /></label>
      <label>{t('Descripción')}<textarea required={!!form.description_en.trim()} maxLength={4000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <label>{t('Descripción (EN)')}<textarea required={!!form.description.trim()} maxLength={4000} value={form.description_en} onChange={e => setForm({ ...form, description_en: e.target.value })} /></label>
      {reminderPicker}{participantPicker}<ErrorBox error={error} />
      <button className="primary" type="submit" disabled={busy}>{t(busy ? 'Guardando…' : 'Guardar evento')}</button>
    </form></Modal>}
  </>;
}
