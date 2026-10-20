import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { ErrorBox, Loading } from './ui';
import { t } from './i18n';
import { confirmInApp } from './ConfirmHost';

type Account = { id: string; name: string; email: string; active: boolean | number; memberships_count: number };
type Listing = { items: Account[]; total: number; page: number; page_size: number };

export function PlatformAccounts() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<Listing>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState('');

  async function load(currentPage = page, currentSearch = search) {
    const query = new URLSearchParams({ page: String(currentPage) });
    if (currentSearch) query.set('search', currentSearch);
    setResult(await api<Listing>(`platform/accounts?${query}`));
  }
  useEffect(() => { load().catch(setError); }, [page, search]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const next = searchInput.trim();
    if (page === 1 && search === next) load().catch(setError);
    else { setPage(1); setSearch(next); }
  }

  async function change(account: Account) {
    const active = !Boolean(account.active);
    if (!await confirmInApp(t(active
      ? '¿Reactivar la cuenta de {name} ({email})? Las sesiones anteriores no volverán a activarse.'
      : '¿Suspender la cuenta de {name} ({email})? Se cerrarán sus sesiones en todas las juntas y sus accesos pendientes.',
    {name: account.name, email: account.email}))) return;
    setBusy(true); setError(undefined); setNotice('');
    try {
      await api(`platform/accounts/${account.id}`, 'PATCH', { active, expected_active: Boolean(account.active) });
      setNotice(active ? 'Cuenta reactivada. Deberá iniciar sesión de nuevo.'
        : 'Cuenta suspendida. Sus sesiones quedaron revocadas.');
      await load();
    } catch (reason) {
      setError(reason);
      await load().catch(() => {});
    } finally { setBusy(false); }
  }

  return <section className="panel">
    <h2>{t('Cuentas de la plataforma')}</h2>
    <p>{t('Acceso exclusivo del superadministrador. Suspender una cuenta revoca sus sesiones en todas las juntas. No se puede suspender al último administrador activo de una junta.')}</p>
    <ErrorBox error={error} />
    {notice && <p role="status">{t(notice)}</p>}
    <form onSubmit={submit} className="filters">
      <label className="grow">{t('Buscar por nombre o correo')}<input value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={120} placeholder={t('Nombre o correo de la cuenta')} /></label>
      <button disabled={busy}>{t('Buscar cuentas')}</button>
    </form>
    {!result ? error ? <button type="button" onClick={() => { setError(undefined); load().catch(setError); }}>{t('Actualizar cuentas')}</button> : <Loading /> : <>
      <p>{t(result.total === 1 ? '{count} cuenta encontrada.' : '{count} cuentas encontradas.', {count: result.total})}</p>
      <div className="table-wrap"><table><thead><tr><th>{t('Cuenta')}</th><th>{t('Correo')}</th><th>{t('Juntas')}</th><th>{t('Estado')}</th><th>{t('Acción')}</th></tr></thead><tbody>
        {result.items.map(account => <tr key={account.id}><td>{account.name}</td><td>{account.email}</td>
          <td>{account.memberships_count}</td><td>{t(account.active ? 'Activa' : 'Suspendida')}</td>
          <td><button disabled={busy} onClick={() => change(account)}>{t(account.active ? 'Suspender cuenta' : 'Reactivar cuenta')}</button></td></tr>)}
      </tbody></table></div>
      <div className="actions"><button disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>{t('Anterior')}</button>
        <span>{t('Página {page} de {total}', {page, total: Math.max(1, Math.ceil(result.total / result.page_size))})}</span>
        <button disabled={busy || page * result.page_size >= result.total} onClick={() => setPage(page + 1)}>{t('Siguiente')}</button>
        <button disabled={busy} onClick={() => load().catch(setError)}>{t('Actualizar cuentas')}</button></div>
    </>}
  </section>;
}
