import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from './api';
import { formatLocale, t, useLanguage } from './i18n';
import { ErrorBox, Loading } from './ui';
import { confirmInApp } from './ConfirmHost';
import { LoaderCircle } from 'lucide-react';

type Person = { id: string; first_names: string; last_names: string | null; document_number: string };
type Item = {
  id: string; person_id: string; first_names: string | null; last_names: string | null;
  document_number: string | null; kind: 'access' | 'correction' | 'erasure';
  status: string; summary: string; decision: string | null; responsible_id: string | null;
  decided_at: string | null; created_at: string; version: number;
  history: { status: string; actor_id: string; created_at: string }[];
};
const kinds: Record<Item['kind'], string> = { access: 'Acceso a datos', correction: 'Corrección de datos', erasure: 'Supresión de datos' };
const statuses: Record<string, string> = {
  open: 'Abierta', in_review: 'En revisión', resolved: 'Resuelta', rejected: 'Solicitud rechazada',
  approved_pending_erasure: 'Aprobada, supresión pendiente',
  erasure_in_progress: 'Supresión en curso', erased: 'Ficha suprimida',
};
const date = (value: string, withTime = false) => new Intl.DateTimeFormat(formatLocale(), {
  timeZone: 'America/Bogota', dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' as const } : {}),
}).format(new Date(value));

export function PrivacyRequests({ userId }: { userId: string }) {
  useLanguage();
  const [items, setItems] = useState<Item[]>([]), [query, setQuery] = useState(''),
    [page, setPage] = useState(1), [total, setTotal] = useState(0), [pageSize, setPageSize] = useState(25),
    [kindFilter, setKindFilter] = useState(''), [statusFilter, setStatusFilter] = useState(''),
    [matches, setMatches] = useState<Person[]>([]), [person, setPerson] = useState<Person>(),
    [kind, setKind] = useState<Item['kind']>('access'), [summary, setSummary] = useState(''),
    [decisions, setDecisions] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false), [creating, setCreating] = useState(false), [loading, setLoading] = useState(true), [listFailed, setListFailed] = useState(false),
    [searching, setSearching] = useState(false), [searchCompleted, setSearchCompleted] = useState(false),
    [error, setError] = useState<unknown>(), [notice, setNotice] = useState('');
  const loadVersion = useRef(0);
  const searchVersion = useRef(0);
  async function load() {
    const version = ++loadVersion.current;
    setError(undefined);
    setLoading(true);
    setListFailed(false);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (kindFilter) params.set('kind', kindFilter);
      if (statusFilter) params.set('status', statusFilter);
      const result = await api<{items: Item[]; total: number; page_size: number}>(`privacy-requests?${params}`);
      if (version !== loadVersion.current) return;
      const lastPage = Math.max(1, Math.ceil(result.total / result.page_size));
      if (page > lastPage) { setItems([]); setTotal(result.total); setPage(lastPage); return; }
      setItems(result.items); setTotal(result.total); setPageSize(result.page_size);
    } catch (e) {
      if (version === loadVersion.current) {
        setItems([]); setTotal(0); setListFailed(true); setError(e);
      }
    }
    finally { if (version === loadVersion.current) setLoading(false); }
  }
  useEffect(() => { void load(); return () => { loadVersion.current++; }; }, [page, kindFilter, statusFilter]);
  useEffect(() => () => { searchVersion.current++; }, []);
  async function search() {
    const version = ++searchVersion.current;
    const term = query.trim();
    setError(undefined); setPerson(undefined); setMatches([]); setSearchCompleted(false);
    if (term.length < 2) { setSearching(false); return; }
    setSearching(true);
    try {
      const result = await api<{items: Person[]}>(`persons?q=${encodeURIComponent(term)}&page_size=10`);
      if (version === searchVersion.current) { setMatches(result.items); setSearchCompleted(true); }
    } catch (e) { if (version === searchVersion.current) setError(e); }
    finally { if (version === searchVersion.current) setSearching(false); }
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    if (!person) return;
    setBusy(true); setCreating(true); setError(undefined); setNotice('');
    try {
      await api('privacy-requests', 'POST', { person_id: person.id, kind, summary: summary.trim() });
      setSummary(''); setPerson(undefined); setMatches([]); setQuery(''); setSearchCompleted(false);
      if (page === 1) await load(); else setPage(1);
      setNotice(t('Solicitud registrada.'));
    } catch (e) { setError(e); } finally { setBusy(false); setCreating(false); }
  }
  async function transition(item: Item, status: string) {
    setBusy(true); setError(undefined); setNotice('');
    try {
      await api(`privacy-requests/${item.id}`, 'PATCH', { status, version: item.version, decision: decisions[item.id]?.trim() || null });
      setDecisions(previous => ({ ...previous, [item.id]: '' }));
      await load(); setNotice(t('Solicitud actualizada.'));
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function executeErasure(item: Item) {
    if (!await confirmInApp(t('Esta acción eliminará la ficha de la persona y las exportaciones guardadas en esta junta. Las copias de seguridad anteriores pueden conservarla. ¿Confirmas la supresión?'))) return;
    setBusy(true); setError(undefined); setNotice('');
    try {
      await api(`privacy-requests/${item.id}/execute-erasure`, 'POST', { version: item.version, confirmed: true });
      await load();
      setNotice(t('Ejecución registrada. Revisa el estado de la supresión.'));
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  return <section className="panel privacy-requests" aria-label={t('Solicitudes de privacidad')}>
    <h2>{t('Solicitudes de privacidad')}</h2>
    <p className="muted">{t('Consulta y resuelve solicitudes sobre datos personales. Las solicitudes de eliminación muestran cuándo termina el borrado.')}</p>
    <ErrorBox error={error} />{notice && <p role="status" className="notice">{notice}</p>}
    <form onSubmit={create}>
      <div className="form-grid">
        <label>{t('Buscar persona por nombre o documento')}
          <span className="filters"><input value={query} placeholder={t('Nombre, apellido o documento')} onChange={e => { searchVersion.current++; setQuery(e.target.value); setPerson(undefined); setMatches([]); setSearching(false); setSearchCompleted(false); }} minLength={2} maxLength={120} />
            <button type="button" onClick={search} disabled={busy || searching || query.trim().length < 2}>{t('Buscar')}</button></span>
        </label>
        <label>{t('Tipo de solicitud')}
          <select value={kind} onChange={e => setKind(e.target.value as Item['kind'])}>
            {Object.entries(kinds).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}
          </select>
        </label>
      </div>
      {searching && <Loading />}
      {searchCompleted && matches.length === 0 && <p className="muted" role="status">{t('No se encontraron personas con esa búsqueda.')}</p>}
      {matches.length > 0 && <div className="privacy-person-results" aria-label={t('Resultados de personas')}>
        {matches.map(match => <button type="button" key={match.id} className={person?.id === match.id ? 'selected' : ''} onClick={() => setPerson(match)}>
          {match.first_names} {match.last_names} · {match.document_number}
        </button>)}
      </div>}
      {person && <p role="status">{t('Persona seleccionada')}: {person.first_names} {person.last_names} · {person.document_number}</p>}
      <label>{t('Descripción de la solicitud')}
        <textarea required minLength={10} maxLength={500} placeholder={t('Resume lo que solicita la persona')} value={summary} onChange={e => setSummary(e.target.value)} />
      </label>
      <div className="actions"><button className="primary" disabled={busy || !person} aria-busy={creating}>
        {creating && <LoaderCircle className="button-spinner" size={17} aria-hidden="true" />}
        {t(creating ? 'Registrando solicitud…' : 'Registrar solicitud')}
      </button></div>
    </form>
    <h3>{t('Seguimiento')}</h3>
    <div className="form-grid">
      <label>{t('Filtrar por tipo')}
        <select value={kindFilter} onChange={event => { setPage(1); setKindFilter(event.target.value); }}>
          <option value="">{t('Todos los tipos de solicitud')}</option>
          {Object.entries(kinds).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}
        </select>
      </label>
      <label>{t('Filtrar por estado')}
        <select value={statusFilter} onChange={event => { setPage(1); setStatusFilter(event.target.value); }}>
          <option value="">{t('Todos los estados de solicitud')}</option>
          {Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}
        </select>
      </label>
    </div>
    {loading ? <Loading /> : listFailed ? null : items.length === 0 ? <p className="muted">{t(kindFilter || statusFilter ? 'No hay solicitudes con estos filtros.' : 'Aún no hay solicitudes de privacidad.')}</p> :
      <div className="privacy-list">{items.map(item => <article className="privacy-item" key={item.id}>
        <div className="privacy-item-heading"><strong>{t(kinds[item.kind])} · {item.first_names ? `${item.first_names} ${item.last_names ?? ''}` : t('Persona ya no disponible')}</strong><span>{t(statuses[item.status] ?? item.status)}</span></div>
        <p className="muted">{item.document_number ?? item.person_id} · {date(item.created_at)}</p>
        <p>{t(item.summary)}</p>
        {item.decision && <p><strong>{t('Decisión')}:</strong> {item.decision}</p>}
        {item.responsible_id && <p className="muted">{t('Responsable de privacidad')}: {item.responsible_id === userId ? t('Tu cuenta') : item.responsible_id}</p>}
        {item.decided_at && <p className="muted">{t('Fecha de decisión')}: {date(item.decided_at, true)}</p>}
        <details><summary>{t('Historial de la solicitud')}</summary><ul>{item.history.map((event, index) => <li key={`${event.created_at}:${index}`}>{t(statuses[event.status] ?? event.status)} · {date(event.created_at, true)}</li>)}</ul></details>
        {item.status === 'approved_pending_erasure' && <div><p className="muted">{t('La supresión aprobada aún no se ha ejecutado.')}</p>
          {item.responsible_id === userId && <button type="button" disabled={busy} onClick={() => executeErasure(item)}>{t('Ejecutar supresión')}</button>}
        </div>}
        {item.status === 'erasure_in_progress' && <div><p className="muted">{t('Registro eliminado. La eliminación de fotos está pendiente de confirmación; puedes reintentar.')}</p>
          {item.responsible_id === userId && <button type="button" disabled={busy} onClick={() => executeErasure(item)}>{t('Reintentar eliminación de fotos')}</button>}
        </div>}
        {item.status === 'open' && <button disabled={busy} onClick={() => transition(item, 'in_review')}>{t('Asumir revisión')}</button>}
        {item.status === 'in_review' && item.responsible_id === userId && <div>
          <label>{t('Motivo de la decisión')}<textarea maxLength={500} minLength={10} placeholder={t('Explica por qué se aprueba o rechaza la solicitud')} value={decisions[item.id] ?? ''} onChange={e => setDecisions(previous => ({ ...previous, [item.id]: e.target.value }))} /></label>
          <div className="actions"><button disabled={busy || (decisions[item.id]?.trim().length ?? 0) < 10} onClick={() => transition(item, item.kind === 'erasure' ? 'approved_pending_erasure' : 'resolved')}>{t(item.kind === 'erasure' ? 'Aprobar, pendiente de supresión' : 'Resolver')}</button>
            <button disabled={busy || (decisions[item.id]?.trim().length ?? 0) < 10} onClick={() => transition(item, 'rejected')}>{t('Rechazar solicitud')}</button></div>
        </div>}
      </article>)}</div>}
    {total > pageSize && <div className="actions"><button type="button" disabled={busy || loading || page <= 1} onClick={() => setPage(value => value - 1)}>{t('Solicitudes anteriores')}</button><span>{t('Página {page} de {pages}', { page, pages: Math.ceil(total / pageSize) })}</span><button type="button" disabled={busy || loading || page * pageSize >= total} onClick={() => setPage(value => value + 1)}>{t('Solicitudes siguientes')}</button></div>}
    <button type="button" disabled={busy} onClick={load}>{t('Actualizar solicitudes')}</button>
  </section>;
}
