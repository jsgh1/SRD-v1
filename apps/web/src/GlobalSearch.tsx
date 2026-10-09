import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, roleNames, type Principal } from './api';
import { AssetSearch } from './AssetSearch';
import { TreasurySearch } from './TreasurySearch';
import { CalendarSearch } from './CalendarSearch';
import { FolderSearch } from './FolderSearch';
import { PersonDetail, PersonTable, type Person } from './Persons';
import { Empty, ErrorBox, Loading } from './ui';
import { formatLocale, t, useLanguage } from './i18n';

type Kind = 'persons' | 'contacts';
type Contact = { id: string; name: string; role: string; presence: string };
type Result = { items: (Person | Contact)[]; total: number; page_size: number };
const presence: Record<string, string> = { online: 'En línea', away: 'Ausente', dnd: 'No molestar', offline: 'Desconectado' };

function SearchGroup({ kind, query }: { kind: Kind; query: string }) {
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0), [detail, setDetail] = useState<string>();
  const [data, setData] = useState<Result>(), [error, setError] = useState<unknown>();
  useLanguage();
  const [contactBusy, setContactBusy] = useState(false), [consulted, setConsulted] = useState<number>();
  const title = kind === 'persons' ? 'Personas' : 'Contactos';
  useEffect(() => {
    let active = true, pending = false, stopped = false;
    setData(undefined); setError(undefined); setConsulted(undefined); setContactBusy(false);
    const params = new URLSearchParams({ q: query, page: String(page) });
    if (kind === 'persons') params.set('page_size', '10');
    async function update() {
      if (!active || pending || stopped || (kind === 'contacts' && document.visibilityState !== 'visible')) return;
      pending = true;
      if (kind === 'contacts') setContactBusy(true);
      try {
        const result = await api<Result>(`${kind}?${params}`);
        if (active) { setData(result); setError(undefined); if (kind === 'contacts') setConsulted(Date.now()); }
      } catch (e) {
        if (active) { setError(e); setData(undefined); setConsulted(undefined); }
        if (e instanceof ApiError && [401, 403].includes(e.status)) stopped = true;
      } finally { pending = false; if (active) setContactBusy(false); }
    }
    void update();
    if (kind !== 'contacts') return () => { active = false; };
    const interval = window.setInterval(() => void update(), 30000);
    const resume = () => void update();
    document.addEventListener('visibilitychange', resume); window.addEventListener('online', resume);
    return () => { active = false; clearInterval(interval); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  }, [kind, query, page, retry]);
  return <section className="panel" aria-label={t(kind === 'persons' ? 'Resultados de personas' : 'Resultados de contactos')}>
    <h2>{t(title)}</h2>
    {kind === 'contacts' && <>
      <p className="muted">{t('Estados actualizados cada 30 segundos mientras la página esté visible. Consultar contactos no prolonga la sesión.')}</p>
      <p className="muted" role="status">{contactBusy ? t('Actualizando estados…') : consulted ? t('Última consulta: {time}', { time: new Date(consulted).toLocaleTimeString(formatLocale()) }) : t('Estados sin confirmar')}</p>
      <button type="button" disabled={contactBusy} onClick={() => setRetry(value => value + 1)}>{t('Actualizar contactos')}</button>
    </>}
    <ErrorBox error={error} />
    {error ? <button onClick={() => setRetry(v => v + 1)}>{t(kind === 'persons' ? 'Reintentar personas' : 'Reintentar contactos')}</button> : !data && <Loading />}
    {data && <>
      <p role="status">{t(kind === 'persons' ? '{count} coincidencias en personas' : '{count} coincidencias en contactos', { count: data.total })}</p>
      {!data.items.length ? <Empty title={t(kind === 'persons' ? 'Sin coincidencias en personas' : 'Sin coincidencias en contactos')}>{t('Prueba otro nombre o documento.')}</Empty> : kind === 'persons'
        ? <PersonTable rows={data.items as Person[]} onView={person => setDetail(person.id)} />
        : <ul className="contact-list">{(data.items as Contact[]).map(contact => <li key={contact.id} className="contact-card"><span className="avatar" aria-hidden="true">{contact.name.slice(0, 1)}</span><div><strong>{contact.name}</strong><div className="muted">{t(roleNames[contact.role] ?? contact.role)}</div><span className="presence-status" data-state={contact.presence}><span aria-hidden="true">●</span> {t(presence[contact.presence] ?? 'Desconectado')}</span></div></li>)}</ul>}
      <div className="pagination"><button disabled={page === 1} onClick={() => setPage(v => v - 1)}>{t('Anterior')}</button><span>{t('Página {page}', { page })}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage(v => v + 1)}>{t('Siguiente')}</button></div>
    </>}
    {detail && <PersonDetail id={detail} onClose={() => setDetail(undefined)} />}
  </section>;
}

export function GlobalSearch({ principal, folderRead, onOpenFolder }: { principal: Principal; folderRead: boolean; onOpenFolder: (id?: string) => void }) {
  useLanguage();
  const [query, setQuery] = useState(''), [scope, setScope] = useState('all');
  const [search, setSearch] = useState<{ query: string; scope: string; version: number }>(), [error, setError] = useState<unknown>();
  const financialAllowed = ['superadmin', 'admin', 'treasurer'].includes(principal.role);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) { setError(new Error('Escribe un texto para buscar.')); return; }
    setError(undefined); setSearch({ query: query.trim(), scope, version: (search?.version ?? 0) + 1 });
  }
  return <>
    <div className="page-heading"><div><h1>{t('Buscar en la junta')}</h1><p className="muted">{t('Personas por nombre, apellido o documento; contactos por nombre de cuenta; eventos por título o lugar')}{folderRead ? t('; archivos por nombre') : ''}{financialAllowed ? t('; bienes por código o nombre; tesorería por concepto o comprobante.') : '.'}</p></div></div>
    <section className="panel"><form className="filters" onSubmit={submit} aria-label={t('Búsqueda de la junta')}>
      <label className="grow">{t('Texto de búsqueda')}<input autoFocus required maxLength={120} value={query} onChange={e => setQuery(e.target.value)} placeholder={t('Nombre, documento o código')} /></label>
      <label>{t('Buscar en')}<select value={scope} onChange={e => setScope(e.target.value)}><option value="all">{t('Todos los módulos disponibles')}</option><option value="persons">{t('Personas')}</option><option value="contacts">{t('Contactos')}</option><option value="calendar">{t('Calendario')}</option>{folderRead && <option value="files">{t('Archivos de Carpeta')}</option>}{financialAllowed && <><option value="assets">{t('Bienes de inventario')}</option><option value="treasury">{t('Tesorería')}</option></>}</select></label>
      <button className="primary">{t('Buscar')}</button><button type="button" onClick={() => { setQuery(''); setScope('all'); setSearch(undefined); setError(undefined); }}>{t('Limpiar búsqueda')}</button>
    </form><ErrorBox error={error} /><p className="muted">{t('Los resultados pertenecen a tu junta activa. La presencia de contactos se actualiza mientras los resultados estén visibles.')}</p></section>
    {!search ? <Empty title={t('¿Qué necesitas encontrar?')}>{t('Escribe un texto para consultar los módulos disponibles.')}</Empty> : <div key={`${search.version}:${search.query}:${search.scope}`}>
      {(search.scope === 'all' || search.scope === 'persons') && <SearchGroup kind="persons" query={search.query} />}
      {(search.scope === 'all' || search.scope === 'contacts') && <SearchGroup kind="contacts" query={search.query} />}
      {(search.scope === 'all' || search.scope === 'calendar') && <CalendarSearch query={search.query} />}
      {folderRead && (search.scope === 'all' || search.scope === 'files') && <FolderSearch query={search.query} onOpenFolder={onOpenFolder} />}
      {financialAllowed && (search.scope === 'all' || search.scope === 'assets') && <AssetSearch query={search.query} />}
      {financialAllowed && (search.scope === 'all' || search.scope === 'treasury') && <TreasurySearch query={search.query} />}
    </div>}
  </>;
}
