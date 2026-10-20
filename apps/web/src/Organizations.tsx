import { useEffect, useState, type FormEvent } from 'react';
import { api, type Principal } from './api';
import { ErrorBox, Loading, Modal } from './ui';
import { t } from './i18n';
import { confirmInApp } from './ConfirmHost';

type Junta = { id: string; name: string; code: string; active: boolean | number; version: number };
type Page = { data: Junta[]; current_page: number; last_page: number };

export function Organizations({ principal }: { principal: Principal }) {
  const [result, setResult] = useState<Page>();
  const [page, setPage] = useState(1);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{key: string; values?: Record<string, string>} | null>(null);
  const [inviteTarget, setInviteTarget] = useState<Junta>();
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteTarget) return;
    const email = new FormData(event.currentTarget).get('email');
    setBusy(true); setError(undefined); setMessage(null);
    try {
      await api(`platform/organizations/${inviteTarget.id}/administrators`, 'POST', { email });
      setMessage({key: 'Invitación de administrador para {name} en cola de envío. Revisa el correo local en Mailpit.', values: {name: inviteTarget.name}});
      setInviteTarget(undefined);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function refresh() { setResult(await api<Page>(`platform/organizations?page=${page}`)); }
  useEffect(() => { refresh().catch(setError); }, [page]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError(undefined); setMessage(null);
    try {
      const org = await api<Junta>('platform/organizations', 'POST', Object.fromEntries(values));
      form.reset();
      setMessage({key: 'Junta {name} creada. Su código es {code}.', values: {name: org.name, code: org.code}});
      await refresh();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function toggle(org: Junta) {
    if (!await confirmInApp(t(org.active
      ? '¿Suspender la junta {name}? Sus usuarios no podrán acceder mientras esté suspendida.'
      : '¿Activar la junta {name}?', {name: org.name}))) return;
    setBusy(true); setError(undefined); setMessage(null);
    try {
      await api(`platform/organizations/${org.id}`, 'PATCH', { active: !org.active, version: org.version });
      setMessage({key: 'Estado de la junta actualizado.'});
      await refresh();
    } catch (e) { setError(e); await refresh().catch(() => {}); } finally { setBusy(false); }
  }
  return <section className="panel">
    <h2>{t('Administración de juntas')}</h2>
    <p>{t('Acceso exclusivo del superadministrador. Cada junta tiene su código y sus términos de uso.')}</p>
    <ErrorBox error={error} />
    {message && <p role="status">{t(message.key, message.values)}</p>}
    <form onSubmit={create}><div className="form-grid">
      <label>{t('Nombre de la junta')}<input name="name" required maxLength={160} placeholder={t('Ejemplo: Junta Barrio Central')} /></label>
      <label>{t('Código de junta')}<input name="code" required minLength={3} maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder={t('junta-ejemplo')} /></label>
      <label style={{ gridColumn: '1 / -1' }}>{t('Términos de uso iniciales en español')}<textarea name="terms" required minLength={20} maxLength={50000} /></label>
      <label style={{ gridColumn: '1 / -1' }}>{t('Términos de uso iniciales en inglés')}<textarea name="terms_en" required minLength={20} maxLength={50000} /></label>
      </div>
      <button className="primary" disabled={busy}>{t('Crear junta')}</button>
    </form>
    <p>{t('El administrador inicial se asigna mediante una invitación. La creación de una junta no crea cuentas automáticamente.')}</p>
    {!result ? error ? <button type="button" onClick={() => { setError(undefined); refresh().catch(setError); }}>{t('Actualizar juntas')}</button> : <Loading /> : <>
      <div className="table-wrap"><table><thead><tr><th>{t('Junta')}</th><th>{t('Código')}</th><th>{t('Estado')}</th><th>{t('Acciones')}</th></tr></thead><tbody>
        {result.data.map(org => <tr key={org.id}><td>{org.name}</td><td><a href={`/j/${org.code}/login`}>{org.code}</a></td><td>{t(org.active ? 'Activa' : 'Suspendida')}</td><td><button disabled={busy || org.id === principal.organization.id} onClick={() => toggle(org)}>{t(org.active ? 'Suspender' : 'Activar')}</button><button disabled={busy || !org.active} onClick={() => { setError(undefined); setInviteTarget(org); }}>{t('Invitar administrador')}</button></td></tr>)}
      </tbody></table></div>
      <div className="actions"><button disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>{t('Anterior')}</button><span>{t('Página {page} de {total}', {page: result.current_page, total: result.last_page})}</span><button disabled={busy || page >= result.last_page} onClick={() => setPage(page + 1)}>{t('Siguiente')}</button><button disabled={busy} onClick={() => refresh().catch(setError)}>{t('Actualizar juntas')}</button></div>
    </>}
    {inviteTarget && <Modal title={t('Invitar administrador · {name}', {name: inviteTarget.name})} onClose={() => { if (!busy) setInviteTarget(undefined); }}>
      <ErrorBox error={error} />
      <form onSubmit={invite}><label>{t('Correo del administrador')}<input name="email" type="email" required maxLength={254} /></label><p>{t('El destinatario debe aceptar los términos y crear su contraseña o confirmar la de su cuenta existente. El enlace vence en 24 horas.')}</p><button className="primary" disabled={busy}>{t('Enviar invitación de administrador')}</button></form>
    </Modal>}
  </section>;
}
