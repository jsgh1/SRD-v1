import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, roleNames } from './api';
import { Empty, ErrorBox, Loading } from './ui';
import { formatLocale, t, useLanguage } from './i18n';
import { ContactAvatar } from './ContactAvatar';

type Contact = { id: string; name: string; role: string; presence: string };
type Result = { items: Contact[]; page: number; total: number; page_size: number };
const labels: Record<string, string> = { online: 'En línea', away: 'Ausente', dnd: 'No molestar', offline: 'Desconectado' };

export function Contacts({ organizationId, onChat }: { organizationId: string; onChat?: (userId: string) => void }) {
  useLanguage();
  const [query, setQuery] = useState(''), [applied, setApplied] = useState(''), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<Result>(), [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false), [consulted, setConsulted] = useState<number | null>(null);
  useEffect(() => {
    let active = true, pending = false, stopped = false;
    setResult(undefined); setError(undefined); setConsulted(null);
    async function update() {
      if (!active || pending || stopped || document.visibilityState !== 'visible') return;
      pending = true; setBusy(true);
      try {
        const value = await api<Result>(`contacts?${new URLSearchParams({ q: applied, page: String(page) })}`);
        if (active) { setResult(value); setError(undefined); setConsulted(Date.now()); }
      } catch (e) {
        if (active) { setError(e); setResult(undefined); setConsulted(null); }
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
    <div className="page-heading"><div><h1>{t('Contactos de la junta')}</h1><p className="muted">{t('Cuentas activas del equipo. Puedes iniciar una conversación directa.')}</p></div></div>
    <section className="panel" aria-label={t('Directorio de contactos')}>
      <form className="filters" onSubmit={search}><label className="grow">{t('Buscar contacto')}<input maxLength={120} placeholder={t('Nombre de la cuenta')} value={query} onChange={e => setQuery(e.target.value)} /></label><button className="primary">{t('Buscar')}</button><button type="button" onClick={() => { setQuery(''); setApplied(''); setPage(1); setRefresh(v => v + 1); }}>{t('Limpiar')}</button><button type="button" onClick={() => setRefresh(v => v + 1)}>{t('Actualizar estados')}</button></form>
      <p className="muted">{t('Actualización cada 30 segundos mientras esta página esté visible. Una conexión sin señal vence en 90 segundos. Consultar contactos no prolonga la sesión.')}</p>
      <p className="muted" role="status">{busy ? t('Actualizando estados…') : consulted ? t('Última consulta: {time}', {time: new Date(consulted).toLocaleTimeString(formatLocale(), {timeZone:'America/Bogota'})}) : t('Estados sin confirmar')}</p>
      <ErrorBox error={error} />
      {!result && !error && <Loading />}
      {result && <>
        {result.items.length ? <ul className="contact-list">{result.items.map(contact => <li key={contact.id} className="contact-card"><ContactAvatar organizationId={organizationId} userId={contact.id} name={contact.name} /><div><strong>{contact.name}</strong><div className="muted">{t(roleNames[contact.role])}</div><span className="presence-status" data-state={contact.presence}><span aria-hidden="true">●</span> {t(labels[contact.presence] ?? 'Desconectado')}</span>{onChat && <button type="button" onClick={() => onChat(contact.id)}>{t('Abrir chat')}</button>}</div></li>)}</ul> : <Empty title={t('Sin contactos')}>{t('No hay otras cuentas activas que coincidan con tu búsqueda.')}</Empty>}
        <div className="pagination"><span>{t('{count} contactos encontrados',{count:result.total})}</span><button disabled={page === 1} onClick={() => setPage(v => v - 1)}>{t('Anterior')}</button><span>{t('Página {page}',{page})}</span><button disabled={page * result.page_size >= result.total} onClick={() => setPage(v => v + 1)}>{t('Siguiente')}</button></div>
      </>}
    </section>
  </>;
}
