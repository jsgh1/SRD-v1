import {agendaWindow, type CalendarEvent, type CalendarInvitation, type InvitationPage} from './calendar';
import {type NotificationInbox} from './notificationModels';

export type Organization = {
  code: string;
  name: string;
  terms: {id: string; version: number; body: string};
};

export type Principal = {
  user_id: string;
  role: string;
  user: {name: string; email: string; theme: 'light' | 'dark'; presence: 'online' | 'away' | 'dnd' | 'invisible'};
  organization: Organization;
  terms_required: boolean;
};

export type Dashboard = {
  total: number;
  today: number;
  week: number;
  month: number;
  latest?: {id: string; first_names: string; last_names: string}[];
};

export type Person = {
  id: string;
  first_names: string;
  last_names: string;
  document_type: string;
  document_number: string;
  status: 'pending' | 'complete';
  affiliated?: boolean | number;
  zone?: 'rural' | 'urban';
  address?: string | null;
  neighborhood?: string | null;
  property_name?: string | null;
  birth_date?: string | null;
  gender?: 'male' | 'female' | 'other';
  position_label?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type PersonPage = {items: Person[]; page: number; page_size: number; total: number};
export type DocumentType = 'RC' | 'TI' | 'CC' | 'CE' | 'NIT';
export type PendingPersonInput = {
  documentType: DocumentType;
  documentNumber: string;
  firstNames: string;
  lastNames: string;
  authorizationBasis: string;
  authorizationPurpose: string;
};
export type ProfileInput = {name: string; presence: Principal['user']['presence']; theme: Principal['user']['theme']};
export type NotificationPreferences = {
  event_changes: boolean;
  reminders: boolean;
  chat_messages: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class NetworkError extends Error {
  constructor(public readonly path: string, message: string) {super(message);}
}

export class UnconfirmedWriteError extends Error {}

export function normalizeOrigin(input: string, allowLocalHttp: boolean): string {
  const value = input.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Escribe la dirección completa del servidor, por ejemplo https://srd.ejemplo.com.');
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('La dirección debe contener solo el origen del servidor.');
  }
  const local = ['10.0.2.2', '127.0.0.1', 'localhost'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowLocalHttp && url.protocol === 'http:' && local)) {
    throw new Error('Usa HTTPS. HTTP solo se permite para la conexión local de desarrollo.');
  }
  return url.origin;
}

export class GatewayClient {
  private csrf = '';
  constructor(private readonly origin: string) {}

  private async request<T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
    if (method !== 'GET' && !this.csrf) {
      const response = await this.fetchJson<{token: string}>('csrf', 'GET');
      this.csrf = response.token;
    }
    const result = await this.fetchJson<T>(path, method, body);
    if (path === 'auth/verify' || path === 'auth/logout') this.csrf = '';
    return result;
  }

  private async fetchJson<T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.origin}/api/v1/${path}`, {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(method !== 'GET' ? {'X-CSRF-TOKEN': this.csrf} : {}),
        },
        ...(method !== 'GET' ? {body: JSON.stringify(body ?? {})} : {}),
      });
    } catch {
      throw new NetworkError(path, 'No hay conexión con el servidor. Comprueba su dirección y tu red.');
    }
    if (response.status === 419 || response.status === 401) this.csrf = '';
    let json: {data?: T; error?: {message?: string}};
    try {
      json = await response.json();
    } catch {
      throw new ApiError(response.status, 'El servidor devolvió una respuesta no válida.');
    }
    if (!response.ok) {
      throw new ApiError(response.status, json.error?.message || 'No se pudo completar la solicitud.');
    }
    if (json.data === undefined) throw new Error('El servidor no devolvió datos.');
    return json.data;
  }

  organization(code: string) {
    return this.request<Organization>(`organizations/${encodeURIComponent(code.trim().toLowerCase())}`);
  }
  me() {
    return this.request<Principal>('me');
  }
  updateProfile(input: ProfileInput) {
    const name = input.name.trim();
    if (!name || name.length > 120) throw new Error('Ingresa un nombre de hasta 120 caracteres.');
    if (!['online', 'away', 'dnd', 'invisible'].includes(input.presence) || !['light', 'dark'].includes(input.theme)) {
      throw new Error('La preferencia del perfil no es válida.');
    }
    return this.request<ProfileInput>('profile', 'PATCH', {...input, name}).catch(cause => {
      if (cause instanceof NetworkError && cause.path === 'profile') {
        throw new Error('No se pudo confirmar el cambio. Vuelve a abrir tu perfil para comprobarlo antes de guardar otra vez.');
      }
      throw cause;
    });
  }
  login(email: string, password: string, organization: Organization) {
    return this.request<{challenge_id: string; resend_after: number}>('auth/login', 'POST', {
      email: email.trim(), password, organization_code: organization.code,
      accepted: true, terms_version_id: organization.terms.id,
    }).catch(cause => {
      if (cause instanceof ApiError && cause.status === 401) {
        throw new Error('Correo o contraseña incorrectos. Revisa los datos e inténtalo de nuevo.');
      }
      throw cause;
    });
  }
  recover(email: string, organization: Organization) {
    return this.request<{message: string}>('auth/recover', 'POST', {
      email: email.trim().toLowerCase(), organization_code: organization.code,
    });
  }
  verify(challengeId: string, code: string) {
    return this.request<Principal>('auth/verify', 'POST', {challenge_id: challengeId, code});
  }
  resend(challengeId: string) {
    return this.request<{challenge_id: string; resend_after: number}>('auth/resend', 'POST', {challenge_id: challengeId});
  }
  cancel(challengeId: string) {
    return this.request<unknown>('auth/cancel', 'POST', {challenge_id: challengeId});
  }
  async switchOrganization(target: Organization): Promise<void> {
    const path = 'auth/switchOrganization';
    try {
      await this.request<unknown>(path, 'POST', {
        organization_code: target.code, terms_version_id: target.terms.id, accepted: true,
      });
    } catch (cause) {
      if (cause instanceof NetworkError && cause.path === path) {
        throw new UnconfirmedWriteError('No se pudo confirmar el cambio. Comprueba la junta activa antes de intentar otra vez.');
      }
      throw cause;
    } finally {
      // El backend rota la sesión; incluso una respuesta perdida puede haberla rotado.
      this.csrf = '';
    }
  }
  dashboard() {
    return this.request<Dashboard>('dashboard');
  }
  agenda(anchor: string) {
    const {from, to} = agendaWindow(anchor);
    return this.request<{items: CalendarEvent[]; timezone: string}>(`calendar-events?from=${from}&to=${to}`);
  }
  calendarEvent(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('El identificador del evento no es válido.');
    }
    return this.request<CalendarEvent>(`calendar-events/${id}`);
  }
  invitations(page = 1) {
    if (!Number.isInteger(page) || page < 1) throw new Error('La página de invitaciones no es válida.');
    return this.request<InvitationPage>(`calendar-invitations?page=${page}`);
  }
  respondInvitation(invitation: CalendarInvitation, response: 'accepted' | 'declined') {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invitation.event_id)
      || !Number.isInteger(invitation.response_version) || invitation.response_version < 1) {
      throw new Error('La invitación no es válida.');
    }
    const path = `calendar-invitations/${invitation.event_id}/respond`;
    return this.request<CalendarEvent>(path, 'POST', {
      response, version: invitation.response_version,
    }).catch(cause => {
      if (cause instanceof NetworkError && cause.path === path) {
        throw new Error('No se pudo confirmar la respuesta. Actualiza las invitaciones antes de intentar de nuevo.');
      }
      throw cause;
    });
  }
  notifications(page = 1) {
    if (!Number.isInteger(page) || page < 1) throw new Error('La página de avisos no es válida.');
    return this.request<NotificationInbox>(`notifications?page=${page}`);
  }
  notificationPreferences() {
    return this.request<NotificationPreferences>('notification-preferences');
  }
  updateNotificationPreferences(input: NotificationPreferences) {
    if (typeof input.event_changes !== 'boolean' || typeof input.reminders !== 'boolean' || typeof input.chat_messages !== 'boolean') {
      throw new Error('Las categorías de avisos no son válidas.');
    }
    const {quiet_start: start, quiet_end: end} = input;
    if ((start === null) !== (end === null)
      || (start !== null && (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(start)
        || !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(end ?? '') || start === end))) {
      throw new Error('Indica horas válidas y diferentes para el inicio y fin del silencio, o desactiva ambos campos.');
    }
    return this.request<NotificationPreferences>('notification-preferences', 'PUT', input).catch(cause => {
      if (cause instanceof NetworkError && cause.path === 'notification-preferences') {
        throw new UnconfirmedWriteError('No se pudo confirmar el guardado. Vuelve a abrir las preferencias antes de intentar de nuevo.');
      }
      throw cause;
    });
  }
  markNotificationRead(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('El aviso no es válido.');
    }
    const path = `notifications/${id}/read`;
    return this.request<{id: string}>(path, 'POST').catch(cause => {
      if (cause instanceof NetworkError && cause.path === path) {
        throw new Error('No se pudo confirmar la lectura. Actualiza los avisos antes de intentar de nuevo.');
      }
      throw cause;
    });
  }
  dismissNotification(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('El aviso no es válido.');
    }
    const path = `notifications/${id}`;
    return this.request<{id: string}>(path, 'DELETE').catch(cause => {
      if (cause instanceof NetworkError && cause.path === path) {
        throw new Error('No se pudo confirmar el descarte. Actualiza los avisos antes de intentar de nuevo.');
      }
      throw cause;
    });
  }
  persons(page = 1, query = '') {
    if (!Number.isInteger(page) || page < 1) throw new Error('La página solicitada no es válida.');
    const search = query.trim();
    if (search.length > 120) throw new Error('La búsqueda no puede superar 120 caracteres.');
    return this.request<PersonPage>(`persons?page=${page}&page_size=10${search ? `&q=${encodeURIComponent(search)}` : ''}`);
  }
  person(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('El identificador de la persona no es válido.');
    }
    return this.request<Person>(`persons/${id}`);
  }
  async lookupPerson(documentType: DocumentType, documentNumber: string): Promise<Person | null> {
    if (!['RC', 'TI', 'CC', 'CE', 'NIT'].includes(documentType)) {
      throw new Error('El tipo de documento no es válido.');
    }
    const number = documentNumber.trim();
    if (!/^[0-9A-Za-z-]{1,30}$/.test(number)) {
      throw new Error('Ingresa un número de documento válido, sin espacios.');
    }
    const result = await this.request<Person | []>(`persons/lookup?document_type=${documentType}&document_number=${encodeURIComponent(number)}`);
    if (Array.isArray(result) && result.length === 0) return null;
    if (!Array.isArray(result) && typeof result.id === 'string') return result;
    throw new Error('El servidor devolvió una ficha no válida.');
  }
  async createPendingPerson(input: PendingPersonInput): Promise<{id: string; version: number}> {
    const number = input.documentNumber.trim();
    const firstNames = input.firstNames.trim();
    const lastNames = input.lastNames.trim();
    const basis = input.authorizationBasis.trim();
    const purpose = input.authorizationPurpose.trim();
    if (!['RC', 'TI', 'CC', 'CE', 'NIT'].includes(input.documentType)) throw new Error('El tipo de documento no es válido.');
    if (!/^[0-9A-Za-z-]{1,30}$/.test(number)) throw new Error('Ingresa un número de documento válido, sin espacios.');
    if (!firstNames || firstNames.length > 120) throw new Error('Ingresa los nombres (máximo 120 caracteres).');
    if (lastNames.length > 120) throw new Error('Los apellidos no pueden superar 120 caracteres.');
    if (!basis || basis.length > 120) throw new Error('Indica el fundamento o referencia de la autorización.');
    if (!purpose || purpose.length > 1000) throw new Error('Indica la finalidad de la captura.');
    const [fields, positions] = await Promise.all([
      this.request<{version: number}>('person-fields'),
      this.request<{version: number}>('person-positions'),
    ]);
    if (!Number.isInteger(fields.version) || !Number.isInteger(positions.version)) {
      throw new Error('No se pudo confirmar la configuración de la junta.');
    }
    try {
      return await this.request<{id: string; version: number}>('persons', 'POST', {
        document_type: input.documentType,
        document_number: number,
        first_names: firstNames,
        last_names: lastNames || null,
        status: 'pending',
        authorization_basis: basis,
        authorization_purpose: purpose,
        schema_version: fields.version,
        positions_version: positions.version,
        custom_values: {},
      });
    } catch (cause) {
      if (cause instanceof NetworkError && cause.path === 'persons') {
        throw new Error('No se pudo confirmar el guardado. Consulta el documento antes de intentar de nuevo.');
      }
      throw cause;
    }
  }
  logout() {
    return this.request<unknown>('auth/logout', 'POST');
  }
}
