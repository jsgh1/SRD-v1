import { useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  ShieldCheck,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  LockKeyhole,
  Check,
  RotateCw,
} from "lucide-react";
import { api, type Organization, type Principal } from "./api";
import { ErrorBox, Modal } from "./ui";
import { privateLink } from './privateLink';

export function Login({ onLogin }: { onLogin: (p: Principal) => void }) {
  const initialCode =
    location.pathname.match(/^\/j\/([a-z0-9-]+)\/login/)?.[1] || "";
  const [code, setCode] = useState(initialCode),
    [org, setOrg] = useState<Organization | null>(null),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"login" | "verify" | "recover" | "reset">(
    location.pathname === "/reset" ? "reset" : "login",
  );
  const [challenge, setChallenge] = useState(""),
    [wait, setWait] = useState(0),
    [visible, setVisible] = useState(false),
    [terms, setTerms] = useState(false),
    [accepted, setAccepted] = useState(false),
    [notice, setNotice] = useState("");
  const [resetCredential] = useState(() => {
    return [privateLink.id, privateLink.secret];
  });
  useEffect(() => {
    if (initialCode)
      api<Organization>("organizations/" + initialCode)
        .then(setOrg)
        .catch(setError);
  }, [initialCode]);
  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (!org && step !== "reset") {
        const o = await api<Organization>(
          "organizations/" + encodeURIComponent(code),
        );
        setOrg(o);
        history.replaceState(null, "", "/j/" + o.code + "/login");
        return;
      }
      if (step === "login") {
        const r = await api("auth/login", "POST", {
          ...d,
          organization_code: org!.code,
          accepted,
          terms_version_id: org!.terms.id,
        });
        setChallenge(r.challenge_id);
        setWait(r.resend_after);
        setStep("verify");
      }
      if (step === "verify")
        onLogin(
          await api("auth/verify", "POST", {
            challenge_id: challenge,
            code: d.code,
          }),
        );
      if (step === "recover") {
        const r = await api("auth/recover", "POST", {
          ...d,
          organization_code: org!.code,
        });
        setNotice(r.message);
      }
      if (step === "reset") {
        await api("auth/reset", "POST", {
          ...d,
          challenge_id: resetCredential[0],
          secret: resetCredential[1],
        });
        setStep("login");
        setNotice(
          "Contraseña actualizada. Inicia sesión con tu nueva contraseña.",
        );
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const r = await api("auth/resend", "POST", { challenge_id: challenge });
      setChallenge(r.challenge_id);
      setWait(r.resend_after);
      setNotice("Enviamos un nuevo código. El anterior ya no funciona.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function back() {
    setError(null);
    setNotice("");
    if (step === "verify") {
      setBusy(true);
      try {
        await api("auth/cancel", "POST", { challenge_id: challenge });
      } catch (e) {
        setError(e);
        return;
      } finally {
        setBusy(false);
      }
    }
    setStep("login");
    setChallenge("");
  }
  return (
    <main className="access-page">
      <div className="access-top">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Building2 size={22} />
          </span>{" "}
          SRD <span className="brand-sub">Sistema de Registro Digital</span>
        </a>
        <span className="internal-label">
          <LockKeyhole size={14} /> Espacio de acceso interno
        </span>
      </div>
      <div className="access-card">
        <section className="access-intro">
          <span className="eyebrow">COMUNIDAD · ORGANIZACIÓN · CONFIANZA</span>
          <h1>
            {step === "verify"
              ? "Un paso más para cuidar tu información."
              : "Una comunidad conectada. Una gestión más clara."}
          </h1>
          <p>
            {step === "verify"
              ? "Verifica tu correo para acceder a los registros de tu junta. Solo tú debes conocer este código."
              : "El espacio de tu junta para organizar registros, trabajar en equipo y dar seguimiento a lo que importa."}
          </p>
          <button
            className="community-scene"
            type="button"
            aria-label="Girar la ilustración de la comunidad"
            onClick={(e) => e.currentTarget.classList.toggle("turned")}
          >
            <div className="scene-ground" />
            <div className="house house-one">
              <Building2 />
            </div>
            <div className="house house-two">
              <Building2 />
            </div>
            <div className="house house-three">
              <Building2 />
            </div>
            <span className="scene-shield">
              <ShieldCheck size={42} />
            </span>
            <span className="scene-dot d1" />
            <span className="scene-dot d2" />
            <span className="scene-caption">Juntos, mejor organizados</span>
          </button>
          <div className="intro-foot">
            <ShieldCheck size={20} />
            <span>
              Información protegida.
              <br />
              <strong>Acceso exclusivo para tu equipo.</strong>
            </span>
          </div>
        </section>
        <section className="access-form">
          <span className="small-label">{org?.name || "BIENVENIDO A SRD"}</span>
          <h2>
            {!org && step !== "reset"
              ? "Encuentra tu junta"
              : {
                  login: "Iniciar sesión",
                  verify: "Ingresa tu código",
                  recover: "Recuperar acceso",
                  reset: "Nueva contraseña",
                }[step]}
          </h2>
          <p className="muted">
            {!org && step !== "reset"
              ? "Escribe el código de junta que te dio el administrador."
              : step === "verify"
                ? "Revisa tu bandeja de entrada y escribe los seis dígitos."
                : step === "login"
                  ? "Ingresa con tu correo y contraseña."
                  : "Te ayudamos a volver a tu espacio de trabajo."}
          </p>
          <ErrorBox error={error} />
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <form onSubmit={submit}>
            {!org && step !== "reset" ? (
              <label>
                Código de la junta
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setAccepted(false);
                  }}
                  placeholder="codigo-de-junta"
                  required
                  pattern="[a-z0-9-]{3,40}"
                  autoComplete="organization"
                />
              </label>
            ) : (
              <>
                {(step === "login" || step === "recover") && (
                  <label>
                    Correo electrónico
                    <span className="input-icon">
                      <Mail size={18} />
                      <input
                        name="email"
                        type="email"
                        placeholder="usuario@correo.com"
                        autoComplete="username"
                        required
                        maxLength={254}
                      />
                    </span>
                  </label>
                )}
                {(step === "login" || step === "reset") && (
                  <label>
                    {step === "reset" ? "Nueva contraseña" : "Contraseña"}
                    <span className="input-icon">
                      <LockKeyhole size={18} />
                      <input
                        name="password"
                        type={visible ? "text" : "password"}
                        placeholder={
                          step === "reset"
                            ? "Al menos 12 caracteres"
                            : "Escribe tu contraseña"
                        }
                        autoComplete={
                          step === "reset" ? "new-password" : "current-password"
                        }
                        required
                        minLength={step === "reset" ? 12 : undefined}
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={
                          visible ? "Ocultar contraseña" : "Mostrar contraseña"
                        }
                        onClick={() => setVisible(!visible)}
                      >
                        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </span>
                  </label>
                )}
                {step === "reset" && (
                  <label>
                    Repetir contraseña
                    <input
                      name="password_confirmation"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                    />
                  </label>
                )}
                {step === "login" && (
                  <div className="login-options">
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                        required
                      />
                      Acepto los{" "}
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => setTerms(true)}
                      >
                        términos y condiciones
                      </button>
                    </label>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setStep("recover");
                        setError(null);
                      }}
                    >
                      Olvidé mi contraseña
                    </button>
                  </div>
                )}
                {step === "verify" && (
                  <>
                    <label>
                      Código de verificación
                      <input
                        className="code-input"
                        name="code"
                        placeholder="123456"
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        required
                        autoFocus
                      />
                    </label>
                    <button
                      type="button"
                      className="text-button resend"
                      disabled={busy || wait > 0}
                      onClick={resend}
                    >
                      <RotateCw size={16} />
                      {wait ? `Reenviar en ${wait} s` : "Reenviar código"}
                    </button>
                  </>
                )}
              </>
            )}
            <button
              className="primary full"
              disabled={busy || (step === "login" && !!org && !accepted)}
            >
              {busy
                ? "Procesando…"
                : !org && step !== "reset"
                  ? "Continuar"
                  : {
                      login: "Ingresar",
                      verify: "Confirmar código",
                      recover: "Enviar instrucciones",
                      reset: "Guardar contraseña",
                    }[step]}
              <ArrowRight size={18} />
            </button>
          </form>
          {step !== "login" && (
            <button className="text-button back" onClick={back} disabled={busy}>
              ← Volver al inicio de sesión
            </button>
          )}
          {step === "login" && org && (
            <button
              className="text-button back"
              onClick={() => {
                setOrg(null);
                setAccepted(false);
                history.replaceState(null, "", "/");
              }}
            >
              Ingresar a otra junta
            </button>
          )}
          <div className="form-foot">
            <Check size={15} /> Tu cuenta es personal. No compartas tus
            credenciales.
          </div>
        </section>
      </div>
      <footer>
        © {new Date().getFullYear()} · Sistema de Registro Digital
      </footer>
      {terms && org && (
        <Modal
          title={`Términos y condiciones · Versión ${org.terms.version}`}
          onClose={() => setTerms(false)}
        >
          <p className="terms-text">{org.terms.body}</p>
          <button
            className="primary"
            onClick={() => {
              setAccepted(true);
              setTerms(false);
            }}
          >
            Aceptar términos
          </button>
        </Modal>
      )}
    </main>
  );
}
