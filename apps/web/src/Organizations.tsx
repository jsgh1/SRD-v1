import { useEffect, useState, type FormEvent } from 'react';
import { api, type Principal } from './api';
import { ErrorBox, Loading, Modal } from './ui';

type Junta = { id: string; name: string; code: string; active: boolean | number; version: number };
type Page = { data: Junta[]; current_page: number; last_page: number };

export function Organizations({ principal }: { principal: Principal }) {
  const [result, setResult] = useState<Page>();
  const [page, setPage] = useState(1);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [inviteTarget, setInviteTarget] = useState<Junta>();
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteTarget) return;
    const email = new FormData(event.currentTarget).get('email');
    setBusy(true); setError(undefined); setMessage('');
    try {
      await api(`platform/organizations/${inviteTarget.id}/administrators`, 'POST', { email });
      setMessage(`Invitación de administrador para ${inviteTarget.name} en cola de envío. Revisa el correo local en Mailpit.`);
      setInviteTarget(undefined);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function refresh() { setResult(await api<Page>(`platform/organizations?page=${page}`)); }
  useEffect(() => { refresh().catch(setError); }, [page]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError(undefined); setMessage('');
    try {
      const org = await api<Junta>('platform/organizations', 'POST', Object.fromEntries(values));
      form.reset();
      setMessage(`Junta ${org.name} creada. Su código es ${org.code}.`);
      await refresh();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function toggle(org: Junta) {
    if (!window.confirm(`${org.active ? 'Suspender' : 'Activar'} la junta ${org.name}? ${org.active ? 'Sus usuarios no podrán acceder mientras esté suspendida.' : ''}`)) return;
    setBusy(true); setError(undefined); setMessage('');
    try {
      await api(`platform/organizations/${org.id}`, 'PATCH', { active: !org.active, version: org.version });
      setMessage('Estado de la junta actualizado.');
      await refresh();
    } catch (e) { setError(e); await refresh().catch(() => {}); } finally { setBusy(false); }
  }
  return <section className="panel">
    <h2>Administración de juntas</h2>
    <p>Acceso exclusivo del superadministrador. Cada junta tiene su código y sus términos de uso.</p>
    <ErrorBox error={error} />
    {message && <p role="status">{message}</p>}
    <form onSubmit={create}><div className="form-grid">
      <label>Nombre de la junta<input name="name" required maxLength={160} /></label>
      <label>Código de junta<input name="code" required minLength={3} maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="junta-ejemplo" /></label>
      <label style={{ gridColumn: '1 / -1' }}>Términos de uso iniciales<textarea name="terms" required minLength={20} maxLength={50000} /></label>
      </div>
      <button className="primary" disabled={busy}>Crear junta</button>
    </form>
    <p>El administrador inicial se asigna mediante una invitación. La creación de una junta no crea cuentas automáticamente.</p>
    {!result ? <Loading /> : <>
      <div className="table-wrap"><table><thead><tr><th>Junta</th><th>Código</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        {result.data.map(org => <tr key={org.id}><td>{org.name}</td><td><a href={`/j/${org.code}/login`}>{org.code}</a></td><td>{org.active ? 'Activa' : 'Suspendida'}</td><td><button disabled={busy || org.id === principal.organization.id} onClick={() => toggle(org)}>{org.active ? 'Suspender' : 'Activar'}</button><button disabled={busy || !org.active} onClick={() => { setError(undefined); setInviteTarget(org); }}>Invitar administrador</button></td></tr>)}
      </tbody></table></div>
      <div className="actions"><button disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {result.current_page} de {result.last_page}</span><button disabled={busy || page >= result.last_page} onClick={() => setPage(page + 1)}>Siguiente</button><button disabled={busy} onClick={() => refresh().catch(setError)}>Actualizar juntas</button></div>
    </>}
    {inviteTarget && <Modal title={`Invitar administrador · ${inviteTarget.name}`} onClose={() => { if (!busy) setInviteTarget(undefined); }}>
      <ErrorBox error={error} />
      <form onSubmit={invite}><label>Correo del administrador<input name="email" type="email" required maxLength={254} /></label><p>El destinatario debe aceptar los términos y crear su contraseña o confirmar la de su cuenta existente. El enlace vence en 24 horas.</p><button className="primary" disabled={busy}>Enviar invitación de administrador</button></form>
    </Modal>}
  </section>;
}
