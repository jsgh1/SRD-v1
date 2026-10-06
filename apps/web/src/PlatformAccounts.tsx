import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { ErrorBox, Loading } from './ui';

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
    const action = active ? 'Reactivar' : 'Suspender';
    if (!window.confirm(`${action} la cuenta de ${account.name} (${account.email})? ${active
      ? 'Las sesiones anteriores no volverán a activarse.'
      : 'Se cerrarán sus sesiones en todas las juntas y sus accesos pendientes.'}`)) return;
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
    <h2>Cuentas de la plataforma</h2>
    <p>Acceso exclusivo del superadministrador. Suspender una cuenta revoca sus sesiones en todas las juntas. No se puede suspender al último administrador activo de una junta.</p>
    <ErrorBox error={error} />
    {notice && <p role="status">{notice}</p>}
    <form onSubmit={submit} className="filters">
      <label className="grow">Buscar por nombre o correo<input value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={120} /></label>
      <button disabled={busy}>Buscar cuentas</button>
    </form>
    {!result ? <Loading /> : <>
      <p>{result.total} cuenta{result.total === 1 ? '' : 's'} encontrada{result.total === 1 ? '' : 's'}.</p>
      <div className="table-wrap"><table><thead><tr><th>Cuenta</th><th>Correo</th><th>Juntas</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
        {result.items.map(account => <tr key={account.id}><td>{account.name}</td><td>{account.email}</td>
          <td>{account.memberships_count}</td><td>{account.active ? 'Activa' : 'Suspendida'}</td>
          <td><button disabled={busy} onClick={() => change(account)}>{account.active ? 'Suspender cuenta' : 'Reactivar cuenta'}</button></td></tr>)}
      </tbody></table></div>
      <div className="actions"><button disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
        <span>Página {page} de {Math.max(1, Math.ceil(result.total / result.page_size))}</span>
        <button disabled={busy || page * result.page_size >= result.total} onClick={() => setPage(page + 1)}>Siguiente</button>
        <button disabled={busy} onClick={() => load().catch(setError)}>Actualizar cuentas</button></div>
    </>}
  </section>;
}
