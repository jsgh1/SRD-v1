import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  Home,
  UserPlus,
  Users,
  Search,
  Settings,
  ClipboardList,
  Download,
  Menu,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ArrowUpRight,
  ShieldCheck,
  Copy,
  Hand,
  CalendarDays,
  Wallet,
  Package,
  Folder,
  Check,
  MessageCircle,
} from "lucide-react";
import {
  api,
  canAdmin,
  canWrite,
  roleNames,
  type Principal,
  type Organization,
} from "./api";
import { Login } from "./Login";
import { EmailChange } from "./EmailChange";
import { Organizations } from "./Organizations";
import { PlatformAccounts } from "./PlatformAccounts";
import { QuickLinks, QuickLinkSettings } from "./QuickLinks";
import { PersonFieldSettings } from "./PersonFields";
import { PersonPositionSettings } from './PersonPositions';
import { PersonFilterSettings } from './PersonFilterSettings';
import { PlanillaSettings } from './PlanillaSettings';
import { Presence } from './Presence';
import { Contacts } from './Contacts';
import { Chat } from './Chat';
import { GlobalSearch } from './GlobalSearch';
import { ServiceStatus } from './ServiceStatus';
import { SchedulerAlert } from './SchedulerAlert';
import { DeliveryAlert } from './DeliveryAlert';
import { AuditDeliveryAlert } from './AuditDeliveryAlert';
import { Audit } from "./Audit";
import { Calendar } from './Calendar';
import { Treasury } from './Treasury';
import { Inventory } from './Inventory';
import { Folders } from './Folders';
import { FolderAccessSettings } from './FolderAccessSettings';
import { Notifications } from './Notifications';
import { Memberships, InvitationAcceptance } from "./Memberships";
import { Empty, ErrorBox, Loading, Modal } from "./ui";
import {
  Persons,
  PersonForm,
  PersonTable,
  PersonDetail,
  genders,
  documents,
} from "./Persons";

export function App() {
  const [principal, setPrincipal] = useState<Principal | null>(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState("home"),
    [menu, setMenu] = useState(false),
    [profile, setProfile] = useState(false),
    [calendarTarget, setCalendarTarget] = useState<string>(),
    [chatTarget, setChatTarget] = useState<string>(),
    [chatConversationTarget, setChatConversationTarget] = useState<string>(),
    [folderTarget, setFolderTarget] = useState<string>(),
    [folderRead, setFolderRead] = useState(false),
    [themeSaving, setThemeSaving] = useState(false),
    [theme, setTheme] = useState(localStorage.getItem("srd-theme") || "light"),
    [error, setError] = useState<unknown>();
  useEffect(() => {
    if (location.pathname === '/invite') { setLoading(false); return; }
    api<Principal>("me")
      .then(setPrincipal)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("srd-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!principal || principal.terms_required) { setFolderRead(false); return; }
    let active = true;
    const refresh = () => { void api<{can_read:boolean}>('folder-access').then(value => { if (active) setFolderRead(value.can_read); })
      .catch(() => { if (active) setFolderRead(false); }); };
    refresh();
    const visible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', refresh);
    return () => { active = false; document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', refresh); };
  }, [principal?.organization.id, principal?.user_id, principal?.role, principal?.terms_required]);
  useEffect(() => {
    const fn = (e: StorageEvent) => {
      if (e.key === "srd-theme") setTheme(e.newValue || "light");
    };
    window.addEventListener("storage", fn);
    return () => window.removeEventListener("storage", fn);
  }, []);
  async function reload() {
    const p = await api<Principal>("me");
    setPrincipal(p);
  }
  async function toggleTheme() {
    if (themeSaving) return;
    const next = theme === "light" ? "dark" : "light";
    if (principal) {
      setThemeSaving(true);
      try {
        await api("profile", "PATCH", {
          name: principal.user.name,
          theme: next,
          presence: principal.user.presence,
        });
        setTheme(next);
        await reload();
      } catch (e) {
        setError(e);
      } finally {
        setThemeSaving(false);
      }
    } else setTheme(next);
  }
  async function logout() {
    try {
      await api("auth/logout", "POST");
      setPrincipal(null);
      setProfile(false);
      setPage("home");
    } catch (e) {
      setError(e);
    }
  }
  function navigate(value: string) {
    setFolderTarget(undefined);
    setPage(value);
    setMenu(false);
    setProfile(false);
    setError(null);
  }
  const chatStarted = useCallback(() => setChatTarget(undefined), []);
  const chatOpened = useCallback(() => setChatConversationTarget(undefined), []);
  if (location.pathname === '/invite') return <InvitationAcceptance />;
  if (loading)
    return (
      <main className="boot">
        <Building2 size={40} />
        <Loading />
      </main>
    );
  if (!principal)
    return (
      <Login
        onLogin={(p) => {
          setPrincipal(p);
          setTheme(p.user.theme);
        }}
      />
    );
  if (principal.terms_required)
    return (
      <main className="boot">
        <div className="panel">
          <h1>Los términos de tu junta cambiaron</h1>
          <p>Lee la versión vigente para continuar.</p>
          <p className="terms-text">{principal.organization.terms.body}</p>
          <ErrorBox error={error} />
          <button
            className="primary"
            onClick={async () => {
              try {
                await api("auth/switchOrganization", "POST", {
                  organization_code: principal.organization.code,
                  terms_version_id: principal.organization.terms.id,
                  accepted: true,
                });
                await reload();
              } catch (e) {
                setError(e);
              }
            }}
          >
            Aceptar y continuar
          </button>
          <button onClick={logout}>Cerrar sesión</button>
        </div>
      </main>
    );
  const links = [
    { key: "home", label: "Home", icon: Home },
    {
      key: "register",
      label: "Registro",
      icon: UserPlus,
      allow: canWrite(principal.role),
    },
    { key: "list", label: "Lista", icon: Users },
    { key: "lookup", label: "Consultar", icon: Search },
    { key: "contacts", label: "Contactos", icon: Users },
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: 'folders', label: 'Carpeta', icon: Folder, allow: canAdmin(principal.role) || folderRead },
    { key: "calendar", label: "Calendario", icon: CalendarDays },
    { key: "treasury", label: "Tesorería", icon: Wallet, allow: ["superadmin", "admin", "treasurer"].includes(principal.role) },
    { key: "inventory", label: "Inventario", icon: Package, allow: ["superadmin", "admin", "treasurer"].includes(principal.role) },
    { key: "settings", label: "Configuración", icon: Settings },
    {
      key: "audit",
      label: "Auditoría",
      icon: ClipboardList,
      allow: ["superadmin", "admin", "auditor"].includes(principal.role),
    },
    { key: "downloads", label: "Descargas", icon: Download },
  ].filter((x) => x.allow !== false);
  return (
    <div
      className="app-shell"
      style={
        { "--accent": principal.organization.accent } as React.CSSProperties
      }
    >
      <header className="app-header">
        <button
          className="icon-button hamburger"
          aria-label="Abrir menú"
          onClick={() => setMenu(!menu)}
        >
          <Menu />
        </button>
        <a
          className="brand"
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          <span className="brand-mark">
            <Building2 size={22} />
          </span>
          <span>
            {principal.organization.name}
            <small>Sistema de Registro Digital</small>
          </span>
        </a>
        <button className="header-search" onClick={() => navigate("search")} aria-label="Buscar en la junta">
          <Search size={18} />
          <span>Buscar en la junta</span>
        </button>
        <div className="profile-anchor">
          <Notifications key={principal.organization.id} organizationId={principal.organization.id} doNotDisturb={principal.user.presence === 'dnd'} onEvent={id => { setCalendarTarget(id); navigate('calendar'); }} onChat={id => { setChatTarget(undefined); setChatConversationTarget(id); navigate('chat'); }} />
          <Presence principal={principal} />
          <button
            className="profile-trigger"
            aria-label={`Abrir perfil de ${principal.user.name}`}
            aria-expanded={profile}
            onClick={() => setProfile(!profile)}
          >
            <span className="avatar">{principal.user.name.slice(0, 1)}</span>
            <span className="profile-name">
              {principal.user.name}
              <small>{roleNames[principal.role]}</small>
            </span>
            <ChevronDown size={16} />
          </button>
          {profile && (
            <div className="profile-menu">
              <strong>{principal.user.name}</strong>
              <small>{roleNames[principal.role]}</small>
              <button
                className="copy-email"
                title={principal.user.email}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(principal.user.email);
                  } catch {
                    setError(new Error("No se pudo copiar el correo."));
                  }
                }}
              >
                <span>{principal.user.email}</span>
                <Copy size={14} />
              </button>
              <button onClick={toggleTheme} disabled={themeSaving}>
                {theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
                Cambiar a tema {theme === "light" ? "oscuro" : "claro"}
              </button>
              <button onClick={() => navigate("settings")}>
                <Settings size={18} />
                Editar perfil
              </button>
              <button onClick={logout}>
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <span className="nav-label">MI JUNTA</span>
        <nav>
          {links.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => navigate(key)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={22} />
          <strong>Tu espacio de confianza</strong>
          <p>
            Acceso según tu rol.
            <br />
            Información de tu junta.
          </p>
          <span className="version">SRD · Desarrollo 0.1</span>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMenu(false)}
        />
      )}
      <main className="workspace">
        <ErrorBox error={error} />
        {canAdmin(principal.role) && <SchedulerAlert key={`${principal.organization.id}:${principal.user_id}`} onOpen={() => {
          navigate('settings');
          window.scrollTo({ top: 0 });
        }} />}
        {canAdmin(principal.role) && <DeliveryAlert key={`${principal.organization.id}:${principal.user_id}`} onOpen={() => {
          navigate('settings');
          window.scrollTo({ top: 0 });
        }} />}
        {canAdmin(principal.role) && <AuditDeliveryAlert key={`${principal.organization.id}:${principal.user_id}`} onOpen={() => {
          navigate('audit');
          window.scrollTo({ top: 0 });
        }} />}
        {page === "home" && (
          <Dashboard key={principal.organization.id} principal={principal} navigate={navigate} />
        )}
        {page === "register" && (
          <PersonForm
            principal={principal}
            onSaved={() => navigate("list")}
            onBack={() => navigate("list")}
          />
        )}
        {(page === "list" || page === "lookup") && (
          <Persons
            principal={principal}
            mode={page === "list" ? "list" : "lookup"}
            onCreate={() => navigate("register")}
          />
        )}
        {page === "settings" && (
          <SettingsPanel
            principal={principal}
            reload={reload}
            setTheme={setTheme}
          />
        )}
          {page === "audit" && <Audit key={principal.organization.id} principal={principal} />}
          {page === 'calendar' && <Calendar key={principal.organization.id} principal={principal} openEventId={calendarTarget} onOpened={() => setCalendarTarget(undefined)} />}
          {page === 'treasury' && <Treasury key={principal.organization.id} principal={principal} />}
          {page === 'inventory' && <Inventory key={principal.organization.id} principal={principal} />}
          {page === 'folders' && (canAdmin(principal.role) || folderRead) && <Folders key={`${principal.organization.id}:${folderTarget ?? 'root'}`} canManage={canAdmin(principal.role)} initialFolder={folderTarget} />}
          {page === 'contacts' && <Contacts key={principal.organization.id} onChat={id => { setChatTarget(id); navigate('chat'); }} />}
          {page === 'chat' && <Chat key={principal.organization.id} userId={chatTarget} conversationId={chatConversationTarget} onStarted={chatStarted} onOpened={chatOpened} selfId={principal.user_id} onContacts={() => navigate('contacts')} />}
          {page === 'search' && <GlobalSearch key={principal.organization.id} principal={principal} folderRead={folderRead || canAdmin(principal.role)} onOpenFolder={id => { navigate('folders'); setFolderTarget(id); }} />}
        {page === "downloads" && (
          <>
            <div className="page-heading">
              <div>
                <h1>Descargas</h1>
                <p className="muted">
                  Aplicaciones de SRD para Windows y Android.
                </p>
              </div>
            </div>
            <section className="panel">
              <Empty title="Todavía no hay instaladores disponibles">
                Los paquetes aparecerán aquí después de construirlos y verificar
                su firma y checksum.
              </Empty>
            </section>
          </>
        )}
        <footer>
          ©{" "}
          {new Date().toLocaleDateString("es-CO", {
            year: "numeric",
            timeZone: "America/Bogota",
          })}{" "}
          · {principal.organization.name}
        </footer>
      </main>
    </div>
  );
}
function Dashboard({
  principal,
  navigate,
}: {
  principal: Principal;
  navigate: (p: string) => void;
}) {
  const [data, setData] = useState<any>(),
    [error, setError] = useState<unknown>(),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(true),
    [detail, setDetail] = useState<string>();
  useEffect(() => {
    let active = true;
    setBusy(true); setData(undefined); setError(undefined);
    api("dashboard").then(value => { if (active) setData(value); }).catch(e => { if (active) setError(e); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [principal.organization.id, refresh]);
  const total = data?.total ?? 0;
  const max = Math.max(
    1,
    ...(data?.last_seven_days.map((d: any) => d.count) || []),
  );
  return (
    <>
      <section className="welcome">
        <div>
          <span className="eyebrow">TU COMUNIDAD, EN UN SOLO LUGAR</span>
          <h1>
            Hola, {roleNames[principal.role]}{" "}
            <Hand className="wave" size={30} />
          </h1>
          <p>Bienvenido al panel de {principal.organization.name}.</p>
          <QuickLinks navigate={navigate} />
        </div>
        <div className="today-card">
          <CalendarDays size={24} />
          <span>Fecha de hoy</span>
          <strong>
            {data ? new Date(data.date + 'T12:00:00-05:00').toLocaleDateString("es-CO", {
              timeZone: "America/Bogota",
              day: "2-digit",
              month: "long",
              year: "numeric",
            }) : busy ? 'Consultando fecha…' : 'Fecha no disponible'}
          </strong>
          <small>Hora de Colombia</small>
        </div>
      </section>
      <div className="section-heading">
        <p className="muted">{data ? `Datos consultados: ${new Date(data.generated_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} (Colombia)` : 'Los indicadores se calculan con la fecha del servidor.'}</p>
        <button disabled={busy} onClick={() => setRefresh(value => value + 1)}>Actualizar indicadores</button>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stats-grid">
              {[
                ["Personas registradas", data.total, "En esta junta"],
                ["Registradas hoy", data.today, "Desde las 00:00"],
                ["Esta semana", data.week, "Desde el lunes"],
                ["Este mes", data.month, "Mes en curso"],
              ].map(([label, value, help]) => (
                <article className="stat" key={label}>
                  <span>{label}</span>
                  <strong>{value.toLocaleString("es-CO")}</strong>
                  <small>{help}</small>
                </article>
              ))}
            </div>
            <div className="charts-grid">
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Actividad de registro</h2>
                    <p className="muted">Últimos siete días</p>
                  </div>
                  <span className="chip">
                    {data.last_seven_days.reduce(
                      (s: number, d: any) => s + d.count,
                      0,
                    )}{" "}
                    registros
                  </span>
                </div>
                <div
                  className="bar-chart"
                  role="img"
                  aria-label={data.last_seven_days
                    .map((d: any) => `${d.date}: ${d.count}`)
                    .join(", ")}
                >
                  {data.last_seven_days.map((d: any) => (
                    <div className="bar-column" key={d.date}>
                      <span>{d.count}</span>
                      <div className="bar-track">
                        <div style={{ height: `${(d.count / max) * 100}%` }} />
                      </div>
                      <small>
                        {new Date(
                          d.date + "T12:00:00-05:00",
                        ).toLocaleDateString("es-CO", { weekday: "short" })}
                      </small>
                    </div>
                  ))}
                </div>
              </section>
              <section className="panel">
                <h2>Distribución de personas</h2>
                {total ? (
                  <>
                    <Distribution
                      rows={data.gender}
                      field="gender"
                      labels={genders}
                      total={total}
                      title="Por género"
                    />
                    <Distribution
                      rows={data.document_types}
                      field="document_type"
                      labels={documents}
                      total={total}
                      title="Por documento"
                    />
                  </>
                ) : (
                  <Empty title="Cada registro cuenta">
                    Cuando agregues personas verás aquí su distribución.
                  </Empty>
                )}
              </section>
            </div>
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Últimos registros</h2>
                  <p className="muted">
                    Las diez incorporaciones más recientes
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("list")}
                >
                  Ver lista completa <ArrowUpRight size={16} />
                </button>
              </div>
              {data.latest.length ? (
                <PersonTable
                  rows={data.latest}
                  onView={(p) => setDetail(p.id)}
                />
              ) : (
                <Empty title="Tu registro comunitario empieza aquí">
                  Aún no se han guardado personas en esta junta.
                </Empty>
              )}
            </section>
          </>
        )
      )}
      {detail && (
        <PersonDetail id={detail} onClose={() => setDetail(undefined)} />
      )}
    </>
  );
}
function Distribution({
  rows,
  field,
  labels,
  total,
  title,
}: {
  rows: any[];
  field: string;
  labels: Record<string, string>;
  total: number;
  title: string;
}) {
  const colors = [
    "#245bce",
    "#5ca7a0",
    "#f1b65c",
    "#9a85c6",
    "#77879f",
    "#ba7188",
  ];
  let start = 0;
  const gradient = rows
    .map((r, i) => {
      const end = start + (r.count / total) * 100;
      const x = `${colors[i % colors.length]} ${start}% ${end}%`;
      start = end;
      return x;
    })
    .join(",");
  return (
    <div className="distribution">
      <div
        className="donut"
        style={{ background: `conic-gradient(${gradient})` }}
        role="img"
        aria-label={title}
      >
        <span>{total}</span>
      </div>
      <div>
        <h3>{title}</h3>
        {rows.map((r, i) => (
          <div className="legend" key={r[field] || "none"}>
            <i style={{ background: colors[i % colors.length] }} />
            <span>{labels[r[field]] || "Sin registrar"}</span>
            <strong>{r.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
function SettingsPanel({
  principal,
  reload,
  setTheme,
}: {
  principal: Principal;
  reload: () => Promise<void>;
  setTheme: (v: string) => void;
}) {
  const [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState<Organization>(),
    [code, setCode] = useState("");
  async function submit(
    e: FormEvent<HTMLFormElement>,
    path: string,
    method: string,
  ) {
    e.preventDefault();
    setError(null);
    setNotice("");
    setBusy(true);
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    if (d.version) d.version = +d.version;
    try {
      await api(path, method, d);
      if (d.theme) setTheme(d.theme);
      await reload();
      setNotice("Cambios guardados.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Configuración</h1>
          <p className="muted">Tu perfil, la identidad y los permisos de tu junta.</p>
        </div>
      </div>
      <ErrorBox error={error} />
      {notice && (
        <p className="notice" role="status">
          <Check size={18} />
          {notice}
        </p>
      )}
      {canAdmin(principal.role) && <div id="service-status"><ServiceStatus key={principal.organization.id} /></div>}
      <section className="panel">
        <h2>Mi perfil</h2>
        <form onSubmit={(e) => submit(e, "profile", "PATCH")}>
          <div className="form-grid">
            <label>
              Nombre
              <input
                name="name"
                defaultValue={principal.user.name}
                required
                maxLength={120}
              />
            </label>
            <label>
              Correo de acceso
              <input value={principal.user.email} readOnly />
            </label>
            <label>
              Tema
              <select name="theme" defaultValue={principal.user.theme}>
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
              </select>
            </label>
            <label>
              Preferencia de presencia
              <select name="presence" defaultValue={principal.user.presence}>
                <option value="online">En línea</option>
                <option value="away">Ausente</option>
                <option value="dnd">No molestar</option>
                <option value="invisible">Invisible</option>
              </select>
            </label>
          </div>
          <p className="muted">
            La conexión se confirma cada 30 segundos y vence tras 90 segundos sin señal. Invisible se representa como Desconectado. No molestar oculta el distintivo de la campana, pero conserva los avisos en la bandeja.
          </p>
          <button className="primary" disabled={busy}>
            Guardar perfil
          </button>
        </form>
      </section>
      <EmailChange onChanged={reload} />
      <QuickLinkSettings principal={principal} />
      <PersonFieldSettings key={principal.organization.id} />
      {canAdmin(principal.role) && <PersonPositionSettings key={principal.organization.id} />}
      <PersonFilterSettings key={principal.organization.id} />
      <PlanillaSettings key={principal.organization.id} organizationName={principal.organization.name} />
      {canAdmin(principal.role) && <FolderAccessSettings key={principal.organization.id} />}
      {canAdmin(principal.role) && <Memberships principal={principal} />}
      {principal.role === 'superadmin' && <Organizations principal={principal} />}
      {principal.role === 'superadmin' && <PlatformAccounts />}
        <section className="panel">
          <h2>Seguridad de la cuenta</h2>
        <button
          disabled={busy}
          onClick={async () => {
            try {
              await api("auth/revokeOthers", "POST");
              setNotice("Las demás sesiones fueron revocadas.");
            } catch (e) {
              setError(e);
            }
          }}
        >
          Cerrar las demás sesiones
        </button>
      </section>
      <section className="panel">
        <h2>Cambiar de junta</h2>
        <p className="muted">
          Solo puedes entrar a una junta autorizada para tu cuenta. Debes
          aceptar sus términos.
        </p>
        <form
          className="filters"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setTarget(await api("organizations/" + encodeURIComponent(code)));
            } catch (e) {
              setError(e);
            }
          }}
        >
          <label className="grow">
            Código de la junta
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button>Cargar términos</button>
        </form>
      </section>
      {canAdmin(principal.role) && (
        <>
          <section className="panel">
            <h2>Identidad de la junta</h2>
            <form onSubmit={(e) => submit(e, "organization", "PATCH")}>
              <input
                type="hidden"
                name="version"
                value={principal.organization.version}
              />
              <div className="form-grid">
                <label>
                  Nombre
                  <input
                    name="name"
                    defaultValue={principal.organization.name}
                    required
                    maxLength={160}
                  />
                </label>
                <label>
                  Color principal
                  <input
                    name="accent"
                    type="color"
                    defaultValue={principal.organization.accent}
                  />
                </label>
              </div>
              <button className="primary" disabled={busy}>
                Guardar identidad
              </button>
            </form>
          </section>
          <section className="panel">
            <h2>
              Términos de uso · Versión {principal.organization.terms.version}
            </h2>
            <form onSubmit={(e) => submit(e, "organization/terms", "POST")}>
              <input
                type="hidden"
                name="version"
                value={principal.organization.terms.version}
              />
              <label>
                Texto de los términos
                <textarea
                  name="body"
                  defaultValue={principal.organization.terms.body}
                  required
                  minLength={20}
                  maxLength={50000}
                  rows={8}
                />
              </label>
              <p className="muted">
                Publicar una nueva versión exigirá que cada usuario la acepte
                para continuar.
              </p>
              <button className="primary" disabled={busy}>
                Publicar nueva versión
              </button>
            </form>
          </section>
        </>
      )}
      {target && (
        <Modal
          title={`Términos de ${target.name}`}
          onClose={() => setTarget(undefined)}
        >
          <p className="terms-text">{target.terms.body}</p>
          <button
            className="primary"
            onClick={async () => {
              try {
                await api("auth/switchOrganization", "POST", {
                  organization_code: target.code,
                  terms_version_id: target.terms.id,
                  accepted: true,
                });
                await reload();
                setTarget(undefined);
              } catch (e) {
                setError(e);
                setTarget(undefined);
              }
            }}
          >
            Aceptar y cambiar de junta
          </button>
        </Modal>
      )}
    </>
  );
}
