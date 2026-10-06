import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { ApiError } from "./api";
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="error" role="alert" tabIndex={-1}>
      <strong>{error instanceof Error ? error.message : String(error)}</strong>
      {error instanceof ApiError &&
        Object.entries(error.fields).map(([key, messages]) => (
          <p key={key}>{messages.join(" ")}</p>
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
          aria-label="Cerrar"
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
      Cargando información…
    </p>
  );
}
