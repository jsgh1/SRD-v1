let csrf = "";
let csrfRequest: Promise<string> | undefined;
function boundedSignal(external?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  external?.addEventListener('abort', abort, { once: true });
  if (external?.aborted) abort();
  const timeout = globalThis.setTimeout(abort, 30000);
  return {
    signal: controller.signal,
    dispose: () => { globalThis.clearTimeout(timeout); external?.removeEventListener('abort', abort); },
  };
}
function getCsrf(): Promise<string> {
  if (csrf) return Promise.resolve(csrf);
  if (!csrfRequest) {
    const request = boundedSignal();
    csrfRequest = fetch('/api/v1/csrf', { credentials: 'same-origin', signal: request.signal })
      .then(async response => {
        if (!response.ok) throw new Error('No se pudo preparar el formulario. Intenta de nuevo.');
        csrf = (await response.json()).data.token;
        return csrf;
      }).catch(() => { throw new Error('No se pudo preparar el formulario. Intenta de nuevo.'); })
      .finally(() => { request.dispose(); csrfRequest = undefined; });
  }
  return csrfRequest;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
  options?: { signal?: AbortSignal },
): Promise<T> {
  if (method !== "GET" && !csrf) {
    await getCsrf();
  }
  const request = boundedSignal(options?.signal);
  try {
  let response: Response;
  try {
    response = await fetch("/api/v1/" + path, {
      method,
      credentials: "same-origin",
      signal: request.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(method !== "GET" ? { "X-CSRF-TOKEN": csrf } : {}),
      },
      ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}),
    });
  } catch {
    if (request.signal.aborted) throw new Error(method === 'GET'
      ? 'La conexión tardó demasiado. Vuelve a intentar.'
      : 'No se pudo confirmar la operación. Recarga para comprobar su estado.');
    throw new Error("No hay conexión. La operación no se ha confirmado.");
  }
  if (response.status === 419) csrf = "";
  let json;
  try { json = await response.json(); }
  catch {
    if (request.signal.aborted) throw new Error(method === 'GET'
      ? 'La conexión tardó demasiado. Vuelve a intentar.'
      : 'No se pudo confirmar la operación. Recarga para comprobar su estado.');
    throw new ApiError(response.status, response.status === 413
      ? 'El archivo supera el tamaño permitido.'
      : 'No se pudo confirmar la operación. Recarga para comprobar su estado.');
  }
  if (!response.ok) {
    if (response.status === 419) csrf = "";
    throw new ApiError(
      response.status,
      json.error?.message || "No se pudo completar la solicitud.",
      json.error?.fields,
    );
  }
  if (path === "auth/logout" || path === "auth/verify" || path === "auth/switchOrganization") csrf = "";
  return json.data;
  } finally { request.dispose(); }
}
export const roleNames: Record<string, string> = {
  superadmin: "Superadministrador",
  admin: "Administrador",
  registrar: "Registrador",
  treasurer: "Tesorero",
  auditor: "Auditor",
  viewer: "Consultor",
};
export type Organization = {
  id: string;
  code: string;
  name: string;
  accent: string;
  logo_data?: string | null;
  version: number;
  terms: { id: string; version: number; body: string; body_en?: string | null };
};
export type Principal = {
  user_id: string;
  person_id?: string | null;
  role: string;
  user: { name: string; email: string; theme: string; presence: string; language: 'es' | 'en'; title?: string | null; title_en?: string | null };
  organization: Organization;
  terms_required: boolean;
};
export const canWrite = (role: string) =>
  ["superadmin", "admin", "registrar"].includes(role);
export const canAdmin = (role: string) =>
  ["superadmin", "admin"].includes(role);
