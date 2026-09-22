import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, roleNames } from './api';
import { Empty, ErrorBox, Loading } from './ui';

type Contact = { id: string; name: string; role: string; presence: string };
type Result = { items: Contact[]; page: number; total: number; page_size: number };
const labels: Record<string, string> = { online: 'En línea', away: 'Ausente', dnd: 'No molestar', offline: 'Desconectado' };

export function Contacts() {
  const [query, setQuery] = useState(''), [applied, setApplied] = useState(''), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<Result>(), [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false), [consulted, setConsulted] = useState('');
  useEffect(() => {
    let active = true, pending = false, stopped = false;
    setResult(undefined); setError(undefined); setConsulted('');
    async function update() {
      if (!active || pending || stopped || document.visibilityState !== 'visible') return;
      pending = true; setBusy(true);
      try {
        const value = await api<Result>(`contacts?${new URLSearchParams({ q: applied, page: String(page) })}`);
        if (active) { setResult(value); setError(undefined); setConsulted(new Date().toLocaleTimeString('es-CO')); }
      } catch (e) {
        if (active) { setError(e); setResult(undefined); setConsulted(''); }
        if (e instanceof ApiError && [401, 403].includes(e.status)) stopped = true;
      } finally { pending = false; if (active) setBusy(false); }
    }
    void update();
    const interval = window.setInterval(() => void update(), 30000);
    const resume = () => void update();
    document.addEventListener('visibilitychange', resume); window.addEventListener('online', resume);
    return () => { active = false; clearInterval(interval); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  }, [applied, page, refresh]);
  function search(e: FormEvent) { e.preventDefault(); setPage(1); setApplied(query); setRefresh(v => v + 1); }
  return <>
    <div className="page-heading"><div><h1>Contactos de la junta</h1><p className="muted">Cuentas activas del equipo. La mensajería todavía no está disponible.</p></div></div>
    <section className="panel" aria-label="Directorio de contactos">
      <form className="filters" onSubmit={search}><label className="grow">Buscar contacto<input maxLength={120} placeholder="Nombre de la cuenta" value={query} onChange={e => setQuery(e.target.value)} /></label><button className="primary">Buscar</button><button type="button" onClick={() => { setQuery(''); setApplied(''); setPage(1); setRefresh(v => v + 1); }}>Limpiar</button><button type="button" onClick={() => setRefresh(v => v + 1)}>Actualizar estados</button></form>
      <p className="muted">Actualización cada 30 segundos mientras esta página esté visible. Una conexión sin señal vence en 90 segundos. Consultar contactos no prolonga la sesión.</p>
      <p className="muted" role="status">{busy ? 'Actualizando estados…' : consulted ? `Última consulta: ${consulted}` : 'Estados sin confirmar'}</p>
      <ErrorBox error={error} />
      {!result && !error && <Loading />}
      {result && <>
        {result.items.length ? <ul className="contact-list">{result.items.map(contact => <li key={contact.id} className="contact-card"><span className="avatar" aria-hidden="true">{contact.name.slice(0, 1)}</span><div><strong>{contact.name}</strong><div className="muted">{roleNames[contact.role]}</div><span className="presence-status" data-state={contact.presence}><span aria-hidden="true">●</span> {labels[contact.presence] ?? 'Desconectado'}</span></div></li>)}</ul> : <Empty title="Sin contactos">No hay otras cuentas activas que coincidan con tu búsqueda.</Empty>}
        <div className="pagination"><span>{result.total} contactos encontrados</span><button disabled={page === 1} onClick={() => setPage(v => v - 1)}>Anterior</button><span>Página {page}</span><button disabled={page * result.page_size >= result.total} onClick={() => setPage(v => v + 1)}>Siguiente</button></div>
      </>}
    </section>
  </>;
}
