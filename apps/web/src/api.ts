let csrf = "";
let csrfRequest: Promise<string> | undefined;
function getCsrf(): Promise<string> {
  if (csrf) return Promise.resolve(csrf);
  if (!csrfRequest) csrfRequest = fetch('/api/v1/csrf', { credentials: 'same-origin' })
    .then(async response => {
      if (!response.ok) throw new Error('No se pudo preparar el formulario. Intenta de nuevo.');
      csrf = (await response.json()).data.token;
      return csrf;
    }).finally(() => { csrfRequest = undefined; });
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
): Promise<T> {
  if (method !== "GET" && !csrf) {
    await getCsrf();
  }
  let response: Response;
  try {
    response = await fetch("/api/v1/" + path, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(method !== "GET" ? { "X-CSRF-TOKEN": csrf } : {}),
      },
      ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}),
    });
  } catch {
    throw new Error("No hay conexión. La operación no se ha confirmado.");
  }
  if (response.status === 419) csrf = "";
  let json;
  try { json = await response.json(); }
  catch {
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
  version: number;
  terms: { id: string; version: number; body: string };
};
export type Principal = {
  user_id: string;
  role: string;
  user: { name: string; email: string; theme: string; presence: string };
  organization: Organization;
  terms_required: boolean;
};
export const canWrite = (role: string) =>
  ["superadmin", "admin", "registrar"].includes(role);
export const canAdmin = (role: string) =>
  ["superadmin", "admin"].includes(role);
