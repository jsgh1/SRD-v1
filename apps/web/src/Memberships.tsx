import { useEffect, useState, type FormEvent } from "react";
import { Mail, RefreshCw, Users } from "lucide-react";
import {
  api,
  ApiError,
  roleNames,
  type Organization,
  type Principal,
} from "./api";
import { ErrorBox, Loading, Modal } from "./ui";
import { privateLink } from "./privateLink";

type Member = {
  id: string;
  user_id: string;
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
    setError(null);
    setNotice("");
    const form = event.currentTarget;
    try {
      const result = await api(
        "invitations",
        "POST",
        Object.fromEntries(new FormData(form)),
      );
      form.reset();
      setNotice(result.message);
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
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
            <Users size={20} /> Usuarios de la junta
          </h2>
          <p className="muted">
            Las cuentas de acceso son independientes de las personas
            registradas.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => load().catch(setError)}
        >
          <RefreshCw size={16} />
          Actualizar miembros
        </button>
      </div>
      <ErrorBox error={error} />
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <h3>Invitar por correo</h3>
      <form onSubmit={invite}>
        <div className="form-grid">
          <label>
            Correo de la persona invitada
            <input type="email" name="email" required maxLength={254} />
          </label>
          <label>
            Rol de la invitación
            <select name="role" defaultValue="viewer">
              {assignable.map(([role, name]) => (
                <option key={role} value={role}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="primary" disabled={busy}>
          <Mail size={17} />
          Crear invitación privada
        </button>
      </form>
      <p className="muted">
        Vence en 24 horas. El correo se envía por el planificador; crearla no
        confirma su entrega. Una nueva invitación al mismo correo revoca la
        anterior.
      </p>
      <h3>Miembros</h3>
      {!members ? (
        <Loading />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {members.items.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.email}</td>
                    <td>{roleNames[m.role]}</td>
                    <td>{m.active ? "Activo" : "Inactivo"}</td>
                    <td>
                      <button
                        type="button"
                        disabled={
                          busy ||
                          !!m.superadmin ||
                          m.user_id === principal.user_id
                        }
                        onClick={() => setEdit(m)}
                        aria-label={`Editar membresía de ${m.name}`}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Miembros anteriores
            </button>
            <span>
              Página {page} · {members.total} miembros
            </span>
            <button
              disabled={page * 25 >= members.total}
              onClick={() => setPage(page + 1)}
            >
              Más miembros
            </button>
          </div>
        </>
      )}
      <h3>Invitaciones</h3>
      {!invitations ? (
        <Loading />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invitations.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.email}</td>
                    <td>{roleNames[i.role]}</td>
                    <td>{status(i)}</td>
                    <td>
                      <button
                        type="button"
                        disabled={busy || !!i.consumed_at || !!i.revoked_at}
                        onClick={() => setRevoke(i)}
                        aria-label={`Revocar invitación de ${i.email}`}
                      >
                        Revocar
                      </button>
                    </td>
                  </tr>
                ))}
                {!invitations.items.length && (
                  <tr>
                    <td colSpan={4}>No hay invitaciones en esta junta.</td>
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
              Invitaciones anteriores
            </button>
            <span>Página {invitePage}</span>
            <button
              disabled={invitePage * 25 >= invitations.total}
              onClick={() => setInvitePage(invitePage + 1)}
            >
              Más invitaciones
            </button>
          </div>
        </>
      )}
      {edit && (
        <Modal
          title="Editar membresía"
          onClose={() => !busy && setEdit(undefined)}
        >
          <ErrorBox error={error} />
          <p>
            {edit.name} · {edit.email}
          </p>
          <form onSubmit={save}>
            <label>
              Rol del miembro
              <select name="role" defaultValue={edit.role}>
                {assignable.map(([role, name]) => (
                  <option key={role} value={role}>
                    {name}
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
              Membresía activa
            </label>
            <p className="muted">
              Guardar revoca las sesiones del miembro en esta junta. No cambia
              su acceso a otras juntas. No puedes modificar tu propia membresía
              ni una cuenta de plataforma.
            </p>
            <button className="primary" disabled={busy}>
              Confirmar cambios de membresía
            </button>
          </form>
        </Modal>
      )}
      {revoke && (
        <Modal
          title="Revocar invitación"
          onClose={() => !busy && setRevoke(undefined)}
        >
          <ErrorBox error={error} />
          <p>El enlace enviado a {revoke.email} dejará de funcionar.</p>
          <button className="danger" disabled={busy} onClick={revokeInvitation}>
            Confirmar revocación
          </button>
        </Modal>
      )}
    </section>
  );
}

export function InvitationAcceptance() {
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
        <h1>Invitación privada a SRD</h1>
        <ErrorBox error={error} />
        {done ? (
          <>
            <p role="status">
              Invitación aceptada. Tu cuenta está vinculada a la junta.
            </p>
            <p>
              Continúa con correo, contraseña y código de seguridad. Se cerrará
              cualquier sesión actual de este navegador.
            </p>
            <button className="primary" disabled={busy} onClick={login}>
              Continuar al inicio de sesión
            </button>
          </>
        ) : details ? (
          <>
            <p>
              <strong>{details.organization.name}</strong> te invita como{" "}
              <strong>{roleNames[details.role]}</strong>.
            </p>
            <p>{details.email}</p>
            <p className="muted">
              {details.existing_account
                ? "Ya tienes cuenta: confirma tu contraseña actual. No se cambiarán tu nombre ni tu contraseña."
                : "Completa tus datos para crear una cuenta privada. No se iniciará sesión automáticamente."}
            </p>
            <form onSubmit={accept}>
              <label>
                Nombre de la cuenta
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={
                    details.existing_account ? "Cuenta existente" : ""
                  }
                  readOnly={details.existing_account}
                  autoComplete="name"
                />
              </label>
              <label>
                {details.existing_account
                  ? "Contraseña actual de tu cuenta"
                  : "Crea tu contraseña"}
                <input
                  name="password"
                  type="password"
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
              <label>
                Repite la contraseña
                <input
                  name="password_confirmation"
                  type="password"
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
                Acepto los términos de esta junta
              </label>
              <button type="button" onClick={() => setTerms(true)}>
                Leer términos de la invitación
              </button>
              <button className="primary" disabled={busy || !accepted}>
                Aceptar invitación privada
              </button>
            </form>
          </>
        ) : (
          !error && <Loading />
        )}
        {!done && (
          <p className="muted">
            Si el enlace venció o fue revocado, solicita una nueva invitación al
            administrador.
          </p>
        )}
        {terms && details && (
          <Modal title="Términos de la junta" onClose={() => setTerms(false)}>
            <div className="terms-body">{details.organization.terms.body}</div>
            <button
              onClick={() => {
                setAccepted(true);
                setTerms(false);
              }}
            >
              Aceptar estos términos
            </button>
          </Modal>
        )}
      </section>
    </main>
  );
}
