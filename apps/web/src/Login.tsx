import { useEffect, useRef, useState, type FormEvent } from "react";
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
import { localizedTerms, t } from './i18n';

export function Login({ onLogin }: { onLogin: (p: Principal) => void }) {
  const [initialCode] = useState(() =>
    location.pathname.match(/^\/j\/([a-z0-9-]+)\/login/)?.[1] || "",
  );
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
    [notice, setNotice] = useState(""),
    [sceneTurned, setSceneTurned] = useState(false);
  const [resetCredential] = useState(() => {
    return [privateLink.id, privateLink.secret];
  });
  const codeValue = useRef(initialCode);
  const organizationLookup = useRef(0);
  useEffect(() => {
    if (initialCode) {
      const version = ++organizationLookup.current;
      api<Organization>("organizations/" + initialCode)
        .then(value => {
          if (version === organizationLookup.current && codeValue.current === initialCode) setOrg(value);
        })
        .catch(cause => {
          if (version === organizationLookup.current && codeValue.current === initialCode) setError(cause);
        });
      return () => { organizationLookup.current++; };
    }
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
    let lookupVersion: number | undefined;
    try {
      if (!org && step !== "reset") {
        const requestedCode = code.trim();
        const version = ++organizationLookup.current;
        lookupVersion = version;
        const o = await api<Organization>(
          "organizations/" + encodeURIComponent(requestedCode),
        );
        if (version !== organizationLookup.current || codeValue.current.trim() !== requestedCode) return;
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
        await api("auth/recover", "POST", {
          ...d,
          organization_code: org!.code,
        });
        setNotice('Si la cuenta está habilitada, recibirás instrucciones para recuperar el acceso.');
      }
      if (step === "reset") {
        await api("auth/reset", "POST", {
          ...d,
          challenge_id: resetCredential[0],
          secret: resetCredential[1],
        });
        history.replaceState(null, "", "/");
        setStep("login");
        setNotice(
          t('Contraseña actualizada. Inicia sesión con tu nueva contraseña.'),
        );
      }
    } catch (e) {
      if (lookupVersion === undefined || lookupVersion === organizationLookup.current) setError(e);
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
      setNotice(t('Enviamos un nuevo código. El anterior ya no funciona.'));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function back() {
    setError(null);
    setNotice("");
    if (step === "reset") history.replaceState(null, "", "/");
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
          <span className={org?.logo_data ? 'brand-mark brand-mark-logo' : 'brand-mark'}>
            {org?.logo_data ? <img src={org.logo_data} alt="" /> : <Building2 size={22} />}
          </span>{" "}
          SRD <span className="brand-sub">{t('Sistema de Registro Digital')}</span>
        </a>
        <span className="internal-label">
          <LockKeyhole size={14} /> {t('Espacio de acceso interno')}
        </span>
      </div>
      <div className="access-card">
        <section className="access-intro">
          <h1>
            {step === "verify"
              ? t('Verifica tu correo para continuar.')
              : t('Organiza los registros de tu junta.')}
          </h1>
          <p>
            {step === "verify"
              ? t('Verifica tu correo para acceder a los registros de tu junta. Solo tú debes conocer este código.')
              : t('Consulta personas, carpetas, eventos y movimientos según los permisos de tu cuenta.')}
          </p>
          <button
            className={`community-scene${sceneTurned ? ' turned' : ''}`}
            type="button"
            aria-label={t('Girar la ilustración de la comunidad')}
            aria-pressed={sceneTurned}
            onClick={() => setSceneTurned(value => !value)}
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
            <span className="scene-caption">{t('Registros de la junta')}</span>
          </button>
          <div className="intro-foot">
            <ShieldCheck size={20} />
            <span>
              {t('Acceso solo para cuentas autorizadas.')}
              <br />
              <strong>{t('Usa el correo asignado a tu junta.')}</strong>
            </span>
          </div>
        </section>
        <section className="access-form">
          <span className="small-label">{org?.name || t('BIENVENIDO A SRD')}</span>
          <h2>
            {!org && step !== "reset"
              ? t('Encuentra tu junta')
              : t({ login: 'Iniciar sesión', verify: 'Ingresa tu código', recover: 'Recuperar acceso', reset: 'Nueva contraseña' }[step])}
          </h2>
          <p className="muted">
            {!org && step !== "reset"
              ? t('Escribe el código de junta que te dio el administrador.')
              : step === "verify"
                ? t('Revisa tu bandeja de entrada y escribe los seis dígitos.')
                : step === "login"
                  ? t('Ingresa con tu correo y contraseña.')
                  : t('Te ayudamos a volver a tu espacio de trabajo.')}
          </p>
          <ErrorBox error={error} />
          {notice && (
            <p className="notice" role="status">
              {t(notice)}
            </p>
          )}
          <form onSubmit={submit}>
            {!org && step !== "reset" ? (
              <label>
                {t('Código de la junta')}
                <input
                  value={code}
                  onChange={(e) => {
                    codeValue.current = e.target.value;
                    organizationLookup.current++;
                    setCode(e.target.value);
                    setAccepted(false);
                    setError(null);
                  }}
                placeholder={t('codigo-de-junta')}
                  required
                  pattern="[a-z0-9-]{3,40}"
                  autoComplete="organization"
                />
              </label>
            ) : (
              <>
                {(step === "login" || step === "recover") && (
                  <label>
                    {t('Correo electrónico')}
                    <span className="input-icon">
                      <Mail size={18} />
                      <input
                        name="email"
                        type="email"
                placeholder={t('usuario@correo.com')}
                        autoComplete="username"
                        required
                        maxLength={254}
                      />
                    </span>
                  </label>
                )}
                {(step === "login" || step === "reset") && (
                  <label>
                    {t(step === 'reset' ? 'Nueva contraseña' : 'Contraseña')}
                    <span className="input-icon">
                      <LockKeyhole size={18} />
                      <input
                        name="password"
                        type={visible ? "text" : "password"}
                        placeholder={
                          step === "reset"
                            ? t('Mínimo 12 caracteres')
                            : t('Escribe tu contraseña')
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
                          t(visible ? 'Ocultar contraseña' : 'Mostrar contraseña')
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
                    {t('Repetir contraseña')}
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
                    <div className="terms-choice">
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={accepted}
                          onChange={(e) => setAccepted(e.target.checked)}
                          required
                        />
                        {t('Acepto los')}
                      </label>
                      <button className="text-button" type="button" onClick={() => setTerms(true)}>
                        {t('términos y condiciones')}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setStep("recover");
                        setError(null);
                      }}
                    >
                      {t('Olvidé mi contraseña')}
                    </button>
                  </div>
                )}
                {step === "verify" && (
                  <>
                    <label>
                      {t('Código de verificación')}
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
                      {wait ? t('Reenviar en {seconds} s', {seconds: wait}) : t('Reenviar código')}
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
                ? t('Procesando…')
                : !org && step !== "reset"
                  ? t('Continuar')
                  : t({ login: 'Ingresar', verify: 'Confirmar código', recover: 'Enviar instrucciones', reset: 'Guardar contraseña' }[step])}
              <ArrowRight size={18} />
            </button>
          </form>
          {step !== "login" && (
            <button className="text-button back" onClick={back} disabled={busy}>
              {t('← Volver al inicio de sesión')}
            </button>
          )}
          {step === "login" && org && (
            <button
              className="text-button back"
              onClick={() => {
                organizationLookup.current++;
                setOrg(null);
                setAccepted(false);
                history.replaceState(null, "", "/");
              }}
            >
              {t('Ingresar a otra junta')}
            </button>
          )}
          <div className="form-foot">
            <Check size={15} /> {t('Tu cuenta es personal. No compartas tus credenciales.')}
          </div>
        </section>
      </div>
      <footer>
        © {new Date().getFullYear()} · {t('Sistema de Registro Digital')}
      </footer>
      {terms && org && (
        <Modal
          title={t('Términos y condiciones · Versión {version}', {version: org.terms.version})}
          onClose={() => setTerms(false)}
        >
          <p className="terms-text">{localizedTerms(org.terms)}</p>
          <button
            className="primary"
            onClick={() => {
              setAccepted(true);
              setTerms(false);
            }}
          >
            {t('Aceptar términos')}
          </button>
        </Modal>
      )}
    </main>
  );
}
