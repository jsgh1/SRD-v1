import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { ApiError } from "./api";
import { isKnownEnglishCopy, t, translateToEnglish, useLanguage } from './i18n';

const errorFallback: Record<number, string> = {
  400: 'No se pudo completar la solicitud.',
  401: 'Debes iniciar sesión.',
  403: 'No tienes permiso para esta acción.',
  404: 'No se encontró el recurso.',
  409: 'El recurso cambió o ya existe. Recarga y vuelve a intentar.',
  413: 'El archivo supera el tamaño permitido.',
  419: 'La sesión del formulario venció. Recarga la página.',
  422: 'Revisa los datos del formulario.',
  429: 'Alcanzaste el límite. Espera antes de intentar.',
  500: 'No se pudo completar la operación.',
  503: 'Un servicio necesario no está disponible. Intenta más tarde.',
  507: 'La junta no tiene espacio disponible para este archivo.',
};

function localizedError(message: string, fallback: string, language: 'es' | 'en'): string {
  if (language === 'es') return message;
  const translated = translateToEnglish(message);
  return translated === message && !isKnownEnglishCopy(message) ? t(fallback) : translated;
}

export function ErrorBox({ error }: { error: unknown }) {
  const language = useLanguage();
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const fallback = error instanceof ApiError
    ? errorFallback[error.status] ?? 'No se pudo completar la solicitud.'
    : 'No se pudo completar la operación.';
  return (
    <div className="error" role="alert" tabIndex={-1}>
      <strong>{localizedError(message, fallback, language)}</strong>
      {error instanceof ApiError &&
        Object.entries(error.fields).map(([key, messages]) => (
          <p key={key}>{messages.map(fieldMessage => localizedError(fieldMessage, 'Revisa este campo.', language)).join(' ')}</p>
        ))}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={t('Cerrar')}
          onClick={onClose}
        >
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Loading() {
  return (
    <p role="status" className="loading">
      {t('Cargando información…')}
    </p>
  );
}
