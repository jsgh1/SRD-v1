import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, Mail, RefreshCw, Users } from "lucide-react";
import {
  api,
  ApiError,
  roleNames,
  type Organization,
  type Principal,
} from "./api";
import { ErrorBox, Loading, Modal } from "./ui";
import { privateLink } from "./privateLink";
import { localizedTerms, t, useLanguage } from './i18n';

type Member = {
  id: string;
  user_id: string;
  person_id?: string | null;
  name: string;
  email: string;
  role: string;
  active: number | boolean;
  version: number;
  superadmin: number | boolean;
};
type Invitation = {
  id: string;
  email: string;
  role: string;
  person_id?: string | null;
  expires_at: string;
  consumed_at: string | null;
  revoked_at: string | null;
  sent_at: string | null;
  delivery_attempts: number;
};
type Listing<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};
const assignable = Object.entries(roleNames).filter(
  ([role]) => role !== "superadmin",
);

export function Memberships({ principal }: { principal: Principal }) {
  const [members, setMembers] = useState<Listing<Member>>();
  const [invitations, setInvitations] = useState<Listing<Invitation>>();
  const [page, setPage] = useState(1),
    [invitePage, setInvitePage] = useState(1);
  const [edit, setEdit] = useState<Member>();
  const [revoke, setRevoke] = useState<Invitation>();
  const [busy, setBusy] = useState(false),
    [inviting, setInviting] = useState(false),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState("");
  async function load() {
    const [m, i] = await Promise.all([
      api(`members?page=${page}`),
      api(`invitations?page=${invitePage}`),
    ]);
    setMembers(m);
    setInvitations(i);
  }
  useEffect(() => {
    load().catch(setError);
  }, [page, invitePage]);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setInviting(true);
    setError(null);
    setNotice("");
    const form = event.currentTarget;
    try {
      await api(
        "invitations",
        "POST",
        Object.fromEntries(new FormData(form)),
      );
      form.reset();
      setNotice('Invitación creada y puesta en cola de envío.');
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setInviting(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit) return;
    setBusy(true);
    setError(null);
    setNotice("");
    const data = new FormData(event.currentTarget);
    try {
      await api(`members/${edit.id}`, "PATCH", {
        role: data.get("role"),
        active: data.get("active") === "on",
        version: edit.version,
      });
      setEdit(undefined);
      setNotice(
        "Membresía actualizada. Sus sesiones de esta junta fueron revocadas.",
      );
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function revokeInvitation() {
    if (!revoke) return;
    setBusy(true);
    setError(null);
    try {
      await api(`invitations/${revoke.id}`, "DELETE");
      setRevoke(undefined);
      setNotice("Invitación revocada.");
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  function status(item: Invitation) {
    if (item.consumed_at) return "Aceptada";
    if (item.revoked_at) return "Revocada";
    if (
      new Date(item.expires_at.replace(" ", "T") + "Z").getTime() <= Date.now()
    )
      return "Vencida";
    if (item.sent_at) return "Enviada";
    return item.delivery_attempts >= 4 ? "Envío agotado" : "Pendiente de envío";
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>
            <Users size={20} /> {t('Usuarios de la junta')}
          </h2>
          <p className="muted">
            {t('Las invitaciones creadas desde una ficha de persona vinculan su cuenta y su rol de acceso a esa ficha.')}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => { setError(undefined); load().catch(setError); }}
        >
          <RefreshCw size={16} />
          {t('Actualizar miembros')}
        </button>
      </div>
      <ErrorBox error={error} />
      {notice && (
        <p className="notice" role="status">
          {t(notice)}
        </p>
      )}
      <h3>{t('Invitar por correo')}</h3>
      <p className="muted">{t('Si alguien ya tiene ficha en Lista, invítalo desde esa ficha. Para dar acceso sin vincularlo a una ficha, usa este formulario.')}</p>
      <form onSubmit={invite}>
        <div className="form-grid">
          <label>
            {t('Correo de la persona invitada')}
            <input type="email" name="email" required maxLength={254} placeholder={t('usuario@correo.com')} />
          </label>
          <label>
            {t('Rol de la invitación')}
            <select name="role" defaultValue="viewer">
              {assignable.map(([role, name]) => (
                <option key={role} value={role}>
                  {t(name)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="primary" disabled={busy} aria-busy={inviting}>
          {inviting ? <LoaderCircle className="button-spinner" size={17} aria-hidden="true" /> : <Mail size={17} aria-hidden="true" />}
          {t(inviting ? 'Creando invitación…' : 'Crear invitación privada')}
        </button>
      </form>
      <p className="muted">
        {t('Vence en 24 horas. El correo se envía por el planificador; crearla no confirma su entrega. Una nueva invitación al mismo correo revoca la anterior.')}
      </p>
      <h3>{t('Miembros')}</h3>
      {!members ? (
        !error && <Loading />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Nombre')}</th>
                  <th>{t('Correo')}</th>
                  <th>{t('Rol')}</th>
                  <th>{t('Estado')}</th>
                  <th>{t('Acciones')}</th>
                </tr>
              </thead>
              <tbody>
                {members.items.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.email}</td>
                    <td>{t(roleNames[m.role])}</td>
                    <td>{t(m.active ? "Activo" : "Inactivo")}</td>
                    <td>
                      <button
                        type="button"
                        disabled={
                          busy ||
                          !!m.superadmin ||
                          m.user_id === principal.user_id
                        }
                        onClick={() => setEdit(m)}
                        aria-label={t('Editar membresía de {name}', {name: m.name})}
                      >
                        {t('Editar')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              {t('Miembros anteriores')}
            </button>
            <span>
              {t('Página {page} · {count} miembros', {page, count: members.total})}
            </span>
            <button
              disabled={page * 25 >= members.total}
              onClick={() => setPage(page + 1)}
            >
              {t('Más miembros')}
            </button>
          </div>
        </>
      )}
      <h3>{t('Invitaciones')}</h3>
      {!invitations ? (
        !error && <Loading />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Correo')}</th>
                  <th>{t('Rol')}</th>
                  <th>{t('Estado')}</th>
                  <th>{t('Acciones')}</th>
                </tr>
              </thead>
              <tbody>
                {invitations.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.email}</td>
                    <td>{t(roleNames[i.role])}</td>
                    <td>{t(status(i))}</td>
                    <td>
                      <button
                        type="button"
                        disabled={busy || !!i.consumed_at || !!i.revoked_at}
                        onClick={() => setRevoke(i)}
                        aria-label={t('Revocar invitación de {email}', {email: i.email})}
                      >
                        {t('Revocar')}
                      </button>
                    </td>
                  </tr>
                ))}
                {!invitations.items.length && (
                  <tr>
                    <td colSpan={4}>{t('No hay invitaciones en esta junta.')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="actions">
            <button
              disabled={invitePage === 1}
              onClick={() => setInvitePage(invitePage - 1)}
            >
              {t('Invitaciones anteriores')}
            </button>
            <span>{t('Página {page}', {page: invitePage})}</span>
            <button
              disabled={invitePage * 25 >= invitations.total}
              onClick={() => setInvitePage(invitePage + 1)}
            >
              {t('Más invitaciones')}
            </button>
          </div>
        </>
      )}
      {edit && (
        <Modal
          title={t('Editar membresía')}
          onClose={() => !busy && setEdit(undefined)}
        >
          <ErrorBox error={error} />
          <p>
            {edit.name} · {edit.email}
          </p>
          <form onSubmit={save}>
            <label>
              {t('Rol del miembro')}
              <select name="role" defaultValue={edit.role}>
                {assignable.map(([role, name]) => (
                  <option key={role} value={role}>
                    {t(name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                name="active"
                defaultChecked={!!edit.active}
              />
              {t('Membresía activa')}
            </label>
            <p className="muted">
              {t('Guardar revoca las sesiones del miembro en esta junta. No cambia su acceso a otras juntas. No puedes modificar tu propia membresía ni una cuenta de plataforma.')}
            </p>
            <button className="primary" disabled={busy}>
              {t('Confirmar cambios de membresía')}
            </button>
          </form>
        </Modal>
      )}
      {revoke && (
        <Modal
          title={t('Revocar invitación')}
          onClose={() => !busy && setRevoke(undefined)}
        >
          <ErrorBox error={error} />
          <p>{t('El enlace enviado a {email} dejará de funcionar.', {email: revoke.email})}</p>
          <button className="danger" disabled={busy} onClick={revokeInvitation}>
            {t('Confirmar revocación')}
          </button>
        </Modal>
      )}
    </section>
  );
}

export function InvitationAcceptance() {
  const language = useLanguage();
  const [credential] = useState({
    invitation_id: privateLink.id,
    secret: privateLink.secret,
  });
  const [details, setDetails] = useState<{
    email: string;
    role: string;
    organization: Organization;
    existing_account: boolean;
  }>();
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [terms, setTerms] = useState(false),
    [accepted, setAccepted] = useState(false),
    [done, setDone] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  useEffect(() => {
    api("invitations/inspect", "POST", credential)
      .then(setDetails)
      .catch(setError);
  }, [credential]);
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details) return;
    setBusy(true);
    setError(null);
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const result = await api("invitations/accept", "POST", {
        ...data,
        ...credential,
        accepted,
        language,
        terms_version_id: details.organization.terms.id,
      });
      setDone(result.organization_code);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function login() {
    setBusy(true);
    setError(null);
    try {
      await api("auth/logout", "POST");
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        setError(e);
        setBusy(false);
        return;
      }
    }
    location.assign(`/j/${done}/login`);
  }
  return (
    <main className="boot">
      <section className="panel invitation-acceptance">
        <h1>{t('Invitación privada a SRD')}</h1>
        <ErrorBox error={error} />
        {done ? (
          <>
            <p role="status">
              {t('Invitación aceptada. Tu cuenta está vinculada a la junta.')}
            </p>
            <p>
              {t('Continúa con correo, contraseña y código de seguridad. Se cerrará cualquier sesión actual de este navegador.')}
            </p>
            <button className="primary" disabled={busy} onClick={login}>
              {t('Continuar al inicio de sesión')}
            </button>
          </>
        ) : details ? (
          <>
            <p>
              {t('{organization} te invita como {role}.', {organization: details.organization.name, role: t(roleNames[details.role])})}
            </p>
            <p>{details.email}</p>
            <p className="muted">
              {t(details.existing_account
                ? "Ya tienes cuenta: confirma tu contraseña actual. No se cambiarán tu nombre ni tu contraseña."
                : "Completa tus datos para crear una cuenta privada. No se iniciará sesión automáticamente.")}
            </p>
            <form onSubmit={accept}>
              <label>
                {t('Nombre de la cuenta')}
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={
                    details.existing_account ? t('Cuenta existente') : ""
                  }
                  readOnly={details.existing_account}
                  autoComplete="name"
                />
              </label>
               <label>
                {t(details.existing_account
                  ? "Contraseña actual de tu cuenta"
                  : "Crea tu contraseña")}
                 <span className="invitation-password-field">
                <input
                  name="password"
                   type={showPasswords ? "text" : "password"}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete={
                    details.existing_account
                      ? "current-password"
                      : "new-password"
                  }
                />
                 <button type="button" aria-label={t(showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas')} title={t(showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas')} onClick={() => setShowPasswords(value => !value)}>{showPasswords ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                 </span>
              </label>
              <label>
                {t('Repite la contraseña')}
                <input
                  name="password_confirmation"
                   type={showPasswords ? "text" : "password"}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete={
                    details.existing_account
                      ? "current-password"
                      : "new-password"
                  }
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                {t('Acepto los términos de esta junta')}
              </label>
              <button type="button" onClick={() => setTerms(true)}>
                {t('Leer términos de la invitación')}
              </button>
              <button className="primary" disabled={busy || !accepted}>
                {t('Aceptar invitación privada')}
              </button>
            </form>
          </>
        ) : (
          !error && <Loading />
        )}
        {!done && (
          <p className="muted">
            {t('Si el enlace venció o fue revocado, solicita una nueva invitación al administrador.')}
          </p>
        )}
        {terms && details && (
          <Modal title={t('Términos de la junta')} onClose={() => setTerms(false)}>
            <div className="terms-body">{localizedTerms(details.organization.terms)}</div>
            <button
              onClick={() => {
                setAccepted(true);
                setTerms(false);
              }}
            >
              {t('Aceptar estos términos')}
            </button>
          </Modal>
        )}
      </section>
    </main>
  );
}
