import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, roleNames, type Principal } from './api';
import { AssetSearch } from './AssetSearch';
import { TreasurySearch } from './TreasurySearch';
import { CalendarSearch } from './CalendarSearch';
import { FolderSearch } from './FolderSearch';
import { PersonDetail, PersonTable, type Person } from './Persons';
import { Empty, ErrorBox, Loading } from './ui';

type Kind = 'persons' | 'contacts';
type Contact = { id: string; name: string; role: string; presence: string };
type Result = { items: (Person | Contact)[]; total: number; page_size: number };
const presence: Record<string, string> = { online: 'En línea', away: 'Ausente', dnd: 'No molestar', offline: 'Desconectado' };

function SearchGroup({ kind, query }: { kind: Kind; query: string }) {
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0), [detail, setDetail] = useState<string>();
  const [data, setData] = useState<Result>(), [error, setError] = useState<unknown>();
  const [contactBusy, setContactBusy] = useState(false), [consulted, setConsulted] = useState('');
  const title = kind === 'persons' ? 'Personas' : 'Contactos';
  useEffect(() => {
    let active = true, pending = false, stopped = false;
    setData(undefined); setError(undefined); setConsulted(''); setContactBusy(false);
    const params = new URLSearchParams({ q: query, page: String(page) });
    if (kind === 'persons') params.set('page_size', '10');
    async function update() {
      if (!active || pending || stopped || (kind === 'contacts' && document.visibilityState !== 'visible')) return;
      pending = true;
      if (kind === 'contacts') setContactBusy(true);
      try {
        const result = await api<Result>(`${kind}?${params}`);
        if (active) { setData(result); setError(undefined); if (kind === 'contacts') setConsulted(new Date().toLocaleTimeString('es-CO')); }
      } catch (e) {
        if (active) { setError(e); setData(undefined); setConsulted(''); }
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
  return <section className="panel" aria-label={`Resultados de ${title.toLowerCase()}`}>
    <h2>{title}</h2>
    {kind === 'contacts' && <>
      <p className="muted">Estados actualizados cada 30 segundos mientras la página esté visible. Consultar contactos no prolonga la sesión.</p>
      <p className="muted" role="status">{contactBusy ? 'Actualizando estados…' : consulted ? `Última consulta: ${consulted}` : 'Estados sin confirmar'}</p>
      <button type="button" disabled={contactBusy} onClick={() => setRetry(value => value + 1)}>Actualizar contactos</button>
    </>}
    <ErrorBox error={error} />
    {error ? <button onClick={() => setRetry(v => v + 1)}>Reintentar {title.toLowerCase()}</button> : !data && <Loading />}
    {data && <>
      <p role="status">{data.total} coincidencias en {title.toLowerCase()}</p>
      {!data.items.length ? <Empty title={`Sin coincidencias en ${title.toLowerCase()}`}>Prueba otro nombre o documento.</Empty> : kind === 'persons'
        ? <PersonTable rows={data.items as Person[]} onView={person => setDetail(person.id)} />
        : <ul className="contact-list">{(data.items as Contact[]).map(contact => <li key={contact.id} className="contact-card"><span className="avatar" aria-hidden="true">{contact.name.slice(0, 1)}</span><div><strong>{contact.name}</strong><div className="muted">{roleNames[contact.role]}</div><span className="presence-status" data-state={contact.presence}><span aria-hidden="true">●</span> {presence[contact.presence] ?? 'Desconectado'}</span></div></li>)}</ul>}
      <div className="pagination"><button disabled={page === 1} onClick={() => setPage(v => v - 1)}>Anterior</button><span>Página {page}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage(v => v + 1)}>Siguiente</button></div>
    </>}
    {detail && <PersonDetail id={detail} onClose={() => setDetail(undefined)} />}
  </section>;
}

export function GlobalSearch({ principal, folderRead, onOpenFolder }: { principal: Principal; folderRead: boolean; onOpenFolder: (id?: string) => void }) {
  const [query, setQuery] = useState(''), [scope, setScope] = useState('all');
  const [search, setSearch] = useState<{ query: string; scope: string; version: number }>(), [error, setError] = useState<unknown>();
  const financialAllowed = ['superadmin', 'admin', 'treasurer'].includes(principal.role);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) { setError(new Error('Escribe un texto para buscar.')); return; }
    setError(undefined); setSearch({ query: query.trim(), scope, version: (search?.version ?? 0) + 1 });
  }
  return <>
    <div className="page-heading"><div><h1>Buscar en la junta</h1><p className="muted">Personas por nombre, apellido o documento; contactos por nombre de cuenta; eventos por título o lugar{folderRead ? '; archivos por nombre' : ''}{financialAllowed ? '; bienes por código o nombre; tesorería por concepto o comprobante.' : '.'}</p></div></div>
    <section className="panel"><form className="filters" onSubmit={submit} aria-label="Búsqueda de la junta">
      <label className="grow">Texto de búsqueda<input autoFocus required maxLength={120} value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre, documento o código" /></label>
      <label>Buscar en<select value={scope} onChange={e => setScope(e.target.value)}><option value="all">Todos los módulos disponibles</option><option value="persons">Personas</option><option value="contacts">Contactos</option><option value="calendar">Calendario</option>{folderRead && <option value="files">Archivos de Carpeta</option>}{financialAllowed && <><option value="assets">Bienes de inventario</option><option value="treasury">Tesorería</option></>}</select></label>
      <button className="primary">Buscar</button><button type="button" onClick={() => { setQuery(''); setScope('all'); setSearch(undefined); setError(undefined); }}>Limpiar búsqueda</button>
    </form><ErrorBox error={error} /><p className="muted">Los resultados pertenecen a tu junta activa. La presencia de contactos se actualiza mientras los resultados estén visibles.</p></section>
    {!search ? <Empty title="¿Qué necesitas encontrar?">Escribe un texto para consultar los módulos disponibles.</Empty> : <div key={`${search.version}:${search.query}:${search.scope}`}>
      {(search.scope === 'all' || search.scope === 'persons') && <SearchGroup kind="persons" query={search.query} />}
      {(search.scope === 'all' || search.scope === 'contacts') && <SearchGroup kind="contacts" query={search.query} />}
      {(search.scope === 'all' || search.scope === 'calendar') && <CalendarSearch query={search.query} />}
      {folderRead && (search.scope === 'all' || search.scope === 'files') && <FolderSearch query={search.query} onOpenFolder={onOpenFolder} />}
      {financialAllowed && (search.scope === 'all' || search.scope === 'assets') && <AssetSearch query={search.query} />}
      {financialAllowed && (search.scope === 'all' || search.scope === 'treasury') && <TreasurySearch query={search.query} />}
    </div>}
  </>;
}
