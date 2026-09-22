import { useEffect, useState, type FormEvent } from 'react';
import { api, roleNames } from './api';
import { PersonDetail, PersonTable, type Person } from './Persons';
import { Empty, ErrorBox, Loading } from './ui';

type Kind = 'persons' | 'contacts';
type Contact = { id: string; name: string; role: string; presence: string };
type Result = { items: (Person | Contact)[]; total: number; page_size: number };
const presence: Record<string, string> = { online: 'En línea', away: 'Ausente', dnd: 'No molestar', offline: 'Desconectado' };

function SearchGroup({ kind, query }: { kind: Kind; query: string }) {
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0), [detail, setDetail] = useState<string>();
  const [data, setData] = useState<Result>(), [error, setError] = useState<unknown>();
  const title = kind === 'persons' ? 'Personas' : 'Contactos';
  useEffect(() => {
    let active = true; setData(undefined); setError(undefined);
    const params = new URLSearchParams({ q: query, page: String(page) });
    if (kind === 'persons') params.set('page_size', '10');
    api<Result>(`${kind}?${params}`).then(result => { if (active) setData(result); }).catch(e => { if (active) setError(e); });
    return () => { active = false; };
  }, [kind, query, page, retry]);
  return <section className="panel" aria-label={`Resultados de ${title.toLowerCase()}`}>
    <h2>{title}</h2>
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

export function GlobalSearch() {
  const [query, setQuery] = useState(''), [scope, setScope] = useState('all');
  const [search, setSearch] = useState<{ query: string; scope: string; version: number }>(), [error, setError] = useState<unknown>();
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) { setError(new Error('Escribe un nombre o documento para buscar.')); return; }
    setError(undefined); setSearch({ query: query.trim(), scope, version: (search?.version ?? 0) + 1 });
  }
  return <>
    <div className="page-heading"><div><h1>Buscar en la junta</h1><p className="muted">Personas por nombre, apellido o documento; contactos por nombre de cuenta.</p></div></div>
    <section className="panel"><form className="filters" onSubmit={submit} aria-label="Búsqueda de la junta">
      <label className="grow">Texto de búsqueda<input autoFocus required maxLength={120} value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre, apellido o documento" /></label>
      <label>Buscar en<select value={scope} onChange={e => setScope(e.target.value)}><option value="all">Personas y contactos</option><option value="persons">Personas</option><option value="contacts">Contactos</option></select></label>
      <button className="primary">Buscar</button><button type="button" onClick={() => { setQuery(''); setScope('all'); setSearch(undefined); setError(undefined); }}>Limpiar búsqueda</button>
    </form><ErrorBox error={error} /><p className="muted">Los resultados pertenecen a tu junta activa. La presencia de contactos corresponde al momento de la consulta.</p></section>
    {!search ? <Empty title="¿Qué necesitas encontrar?">Escribe un texto para consultar los módulos disponibles.</Empty> : <div key={`${search.version}:${search.query}:${search.scope}`}>
      {(search.scope === 'all' || search.scope === 'persons') && <SearchGroup kind="persons" query={search.query} />}
      {(search.scope === 'all' || search.scope === 'contacts') && <SearchGroup kind="contacts" query={search.query} />}
    </div>}
  </>;
}
