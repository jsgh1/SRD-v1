import { useEffect, useState, type FormEvent } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { api } from "./api";
import { ErrorBox } from "./ui";

export function EmailChange({ onChanged }: { onChanged: () => Promise<void> }) {
  const [pending, setPending] = useState<{
    challenge_id: string;
    destination: string;
  }>();
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice("");
    const form = event.currentTarget;
    try {
      const result = await api(
        "profile/email-change",
        "POST",
        Object.fromEntries(new FormData(form)),
      );
      setPending(result);
      setWait(result.resend_after);
      form.reset();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api("profile/email-change/confirm", "POST", {
        challenge_id: pending.challenge_id,
        code: new FormData(event.currentTarget).get("code"),
      });
      await onChanged();
      setNotice(result.message);
      setPending(undefined);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api("profile/email-change/resend", "POST", {
        challenge_id: pending.challenge_id,
      });
      setPending(result);
      setWait(result.resend_after);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Correo de acceso</h2>
      <p className="muted">
        Verificaremos la nueva dirección antes de reemplazar tu correo actual.
        Necesitas confirmar tu contraseña.
      </p>
      <ErrorBox error={error} />
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <form onSubmit={start}>
        <div className="form-grid">
          <label>
            Nuevo correo electrónico
            <input
              name="new_email"
              type="email"
              autoComplete="email"
              placeholder="nuevo@correo.com"
              required
              maxLength={254}
            />
          </label>
          <label>
            Contraseña actual
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
        </div>
        <button className="primary" disabled={busy}>
          <Mail size={18} />
          Enviar código al nuevo correo
        </button>
      </form>
      {pending && (
        <form className="email-confirmation" onSubmit={confirm}>
          <p>
            Tenemos un cambio pendiente para{" "}
            <strong>{pending.destination}</strong>.
          </p>
          <label>
            Código para cambiar el correo
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              placeholder="123456"
            />
          </label>
          <div className="actions">
            <button className="primary" disabled={busy}>
              <ShieldCheck size={18} />
              Confirmar cambio de correo
            </button>
            <button type="button" disabled={busy || wait > 0} onClick={resend}>
              {wait ? `Reenviar en ${wait} s` : "Reenviar código de correo"}
            </button>
          </div>
          <p className="muted">
            El código vence en cinco minutos. Después de ese plazo, confirma de
            nuevo tu contraseña para solicitar otro.
          </p>
        </form>
      )}
    </section>
  );
}
