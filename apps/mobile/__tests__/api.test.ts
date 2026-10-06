import {GatewayClient, normalizeOrigin, UnconfirmedWriteError} from '../src/api';

const response = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({data}),
}) as Response;

describe('dirección del gateway', () => {
  test('acepta HTTPS y elimina la barra final', () => {
    expect(normalizeOrigin(' https://srd.ejemplo.com/ ', false)).toBe('https://srd.ejemplo.com');
  });
  test('limita HTTP al emulador de desarrollo', () => {
    expect(normalizeOrigin('http://10.0.2.2:8080', true)).toBe('http://10.0.2.2:8080');
    expect(() => normalizeOrigin('http://10.0.2.2:8080', false)).toThrow('HTTPS');
    expect(() => normalizeOrigin('http://example.com', true)).toThrow('HTTPS');
  });
  test('rechaza rutas y credenciales', () => {
    expect(() => normalizeOrigin('https://example.com/path', false)).toThrow('solo el origen');
    expect(() => normalizeOrigin('https://user:pass@example.com', false)).toThrow('solo el origen');
  });
});

describe('cliente del gateway', () => {
  beforeEach(() => jest.resetAllMocks());
  test('consulta la junta sin exponer claves en la URL', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(response({code: 'junta-1', name: 'Junta 1'}));
    await new GatewayClient('https://srd.ejemplo.com').organization('Junta 1');
    expect(globalThis.fetch).toHaveBeenCalledWith('https://srd.ejemplo.com/api/v1/organizations/junta%201', expect.objectContaining({credentials: 'include'}));
  });
  test('obtiene CSRF antes de iniciar sesión y comparte cookies', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(response({token: 'csrf-123'}))
      .mockResolvedValueOnce(response({challenge_id: 'challenge-1', resend_after: 60}));
    const client = new GatewayClient('https://srd.ejemplo.com');
    await client.login(' a@b.co ', 'secret', {code: 'junta', name: 'Junta', terms: {id: 'terms-1', version: 1, body: 'texto'}});
    expect(globalThis.fetch).toHaveBeenNthCalledWith(1, 'https://srd.ejemplo.com/api/v1/csrf', expect.objectContaining({credentials: 'include'}));
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, 'https://srd.ejemplo.com/api/v1/auth/login', expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({'X-CSRF-TOKEN': 'csrf-123'}),
      body: JSON.stringify({email: 'a@b.co', password: 'secret', organization_code: 'junta', accepted: true, terms_version_id: 'terms-1'}),
    }));
  });
  test('cambia de junta con sus términos y renueva CSRF tras rotar la sesión', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(response({token: 'csrf-anterior'}))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({token: 'csrf-nuevo'}))
      .mockResolvedValueOnce(response({}));
    const client = new GatewayClient('https://srd.ejemplo.com');
    await client.switchOrganization({code: 'junta-b', name: 'Junta B', terms: {id: 'terminos-b', version: 2, body: 'Texto B'}});
    await client.cancel('desafio-prueba');
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, 'https://srd.ejemplo.com/api/v1/auth/switchOrganization', expect.objectContaining({
      credentials: 'include', headers: expect.objectContaining({'X-CSRF-TOKEN': 'csrf-anterior'}),
      body: JSON.stringify({organization_code: 'junta-b', terms_version_id: 'terminos-b', accepted: true}),
    }));
    expect(globalThis.fetch).toHaveBeenNthCalledWith(4, expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({'X-CSRF-TOKEN': 'csrf-nuevo'}),
    }));
  });
  test('no repite un cambio de junta si se pierde la respuesta', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(response({token: 'csrf'}))
      .mockRejectedValueOnce(new Error('Sin respuesta'));
    const client = new GatewayClient('https://srd.ejemplo.com');
    await expect(client.switchOrganization({code: 'junta-b', name: 'Junta B', terms: {id: 't-b', version: 1, body: 'Términos'}}))
      .rejects.toBeInstanceOf(UnconfirmedWriteError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
  test('guarda nombre y presencia del perfil con CSRF y conserva el tema del servidor', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(response({token: 'csrf-perfil'}))
      .mockResolvedValueOnce(response({name: 'Ana', presence: 'dnd', theme: 'dark'}));
    const client = new GatewayClient('https://srd.ejemplo.com');
    const result = await client.updateProfile({name: ' Ana ', presence: 'dnd', theme: 'dark'});
    expect(result.name).toBe('Ana');
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, 'https://srd.ejemplo.com/api/v1/profile', expect.objectContaining({
      method: 'PATCH', credentials: 'include',
      headers: expect.objectContaining({'X-CSRF-TOKEN': 'csrf-perfil'}),
      body: JSON.stringify({name: 'Ana', presence: 'dnd', theme: 'dark'}),
    }));
    expect(() => client.updateProfile({name: ' ', presence: 'online', theme: 'light'})).toThrow('nombre');
  });
  test('no repite un cambio de perfil si se pierde la respuesta', async () => {
    globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/csrf')) return response({token: 'csrf'});
      throw new Error('Conexión cerrada');
    });
    await expect(new GatewayClient('https://srd.ejemplo.com').updateProfile({name: 'Ana', presence: 'away', theme: 'light'}))
      .rejects.toThrow('Vuelve a abrir tu perfil');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
  test('solicita recuperación para la junta sin transmitir términos ni contraseña', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(response({token: 'csrf'}))
      .mockResolvedValueOnce(response({message: 'Si la cuenta está habilitada, recibirás instrucciones.'}));
    const client = new GatewayClient('https://srd.ejemplo.com');
    const organization = {code: 'junta', name: 'Junta', terms: {id: 'terms-1', version: 1, body: 'texto'}};
    const result = await client.recover(' Usuario@Correo.com ', organization);
    expect(result.message).toContain('instrucciones');
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, 'https://srd.ejemplo.com/api/v1/auth/recover', expect.objectContaining({
      headers: expect.objectContaining({'X-CSRF-TOKEN': 'csrf'}),
      body: JSON.stringify({email: 'usuario@correo.com', organization_code: 'junta'}),
    }));
  });
  test('renueva el CSRF después de una respuesta 419', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(response({token: 'old'}))
      .mockResolvedValueOnce({ok: false, status: 419, json: async () => ({error: {message: 'Expiró'}})})
      .mockResolvedValueOnce(response({token: 'new'}))
      .mockResolvedValueOnce(response({}));
    const client = new GatewayClient('https://srd.ejemplo.com');
    await expect(client.cancel('x')).rejects.toThrow('Expiró');
    await client.cancel('x');
    expect(globalThis.fetch).toHaveBeenNthCalledWith(4, expect.any(String), expect.objectContaining({headers: expect.objectContaining({'X-CSRF-TOKEN': 'new'})}));
  });
  test('pagina y codifica la búsqueda de personas sin cargar toda la base', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(response({items: [], page: 2, page_size: 10, total: 13}));
    const page = await new GatewayClient('https://srd.ejemplo.com').persons(2, '  Ana & José  ');
    expect(page.total).toBe(13);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://srd.ejemplo.com/api/v1/persons?page=2&page_size=10&q=Ana%20%26%20Jos%C3%A9',
      expect.objectContaining({credentials: 'include'}),
    );
  });
  test('solo consulta un detalle mediante identificador UUID', async () => {
    const id = '123e4567-e89b-42d3-a456-426614174000';
    globalThis.fetch = jest.fn().mockResolvedValue(response({id, first_names: 'Ana'}));
    const client = new GatewayClient('https://srd.ejemplo.com');
    expect(() => client.person('../auth/me')).toThrow('identificador');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await client.person(id);
    expect(globalThis.fetch).toHaveBeenCalledWith(`https://srd.ejemplo.com/api/v1/persons/${id}`, expect.any(Object));
  });
  test('descarta CSRF cuando la sesión vence', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(response({token: 'old'}))
      .mockResolvedValueOnce({ok: false, status: 401, json: async () => ({error: {message: 'Sesión terminada'}})})
      .mockResolvedValueOnce(response({token: 'new'}))
      .mockResolvedValueOnce(response({}));
    const client = new GatewayClient('https://srd.ejemplo.com');
    await expect(client.cancel('x')).rejects.toThrow('Sesión terminada');
    await client.cancel('x');
    expect(globalThis.fetch).toHaveBeenNthCalledWith(4, expect.any(String), expect.objectContaining({headers: expect.objectContaining({'X-CSRF-TOKEN': 'new'})}));
  });
  test('consulta por documento exacto y conserva los ceros iniciales', async () => {
    const found = {id: '123e4567-e89b-42d3-a456-426614174000', document_number: '00123'};
    globalThis.fetch = jest.fn().mockResolvedValue(response(found));
    const result = await new GatewayClient('https://srd.ejemplo.com').lookupPerson('CC', ' 00123 ');
    expect(result?.document_number).toBe('00123');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://srd.ejemplo.com/api/v1/persons/lookup?document_type=CC&document_number=00123',
      expect.objectContaining({credentials: 'include'}),
    );
  });
  test('consulta solo una semana de calendario de la junta y un evento por UUID', async () => {
    const id = '123e4567-e89b-42d3-a456-426614174000';
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(response({items: [], timezone: 'America/Bogota'}))
      .mockResolvedValueOnce(response({id, title: 'Reunión'}));
    const client = new GatewayClient('https://srd.ejemplo.com');
    await client.agenda('2026-10-29');
    expect(globalThis.fetch).toHaveBeenNthCalledWith(1,
      'https://srd.ejemplo.com/api/v1/calendar-events?from=2026-10-29&to=2026-11-04',
      expect.objectContaining({credentials: 'include'}));
    expect(() => client.calendarEvent('../persons')).toThrow('identificador');
    await client.calendarEvent(id);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2,
      `https://srd.ejemplo.com/api/v1/calendar-events/${id}`, expect.any(Object));
  });
  test('pagina invitaciones personales y responde con versión y CSRF', async () => {
    const eventId = '123e4567-e89b-42d3-a456-426614174000';
    const invitation = {event_id: eventId, title: 'Reunión', starts_at: '2026-10-05T14:00:00Z', ends_at: '2026-10-05T15:00:00Z', location: null, response: 'pending' as const, response_version: 2};
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(response({items: [invitation], page: 2, page_size: 25, total: 26}))
      .mockResolvedValueOnce(response({token: 'csrf'}))
      .mockResolvedValueOnce(response({id: eventId, title: 'Reunión'}));
    const client = new GatewayClient('https://srd.ejemplo.com');
    await client.invitations(2);
    await client.respondInvitation(invitation, 'accepted');
    expect(globalThis.fetch).toHaveBeenNthCalledWith(1,
      'https://srd.ejemplo.com/api/v1/calendar-invitations?page=2', expect.any(Object));
    expect(globalThis.fetch).toHaveBeenNthCalledWith(3,
      `https://srd.ejemplo.com/api/v1/calendar-invitations/${eventId}/respond`,
      expect.objectContaining({method: 'POST', headers: expect.objectContaining({'X-CSRF-TOKEN': 'csrf'}), body: JSON.stringify({response: 'accepted', version: 2})}));
  });
  test('no envía invitaciones sin versión válida ni reintenta una respuesta perdida', async () => {
    const eventId = '123e4567-e89b-42d3-a456-426614174000';
    const invitation = {event_id: eventId, title: 'Reunión', starts_at: '', ends_at: '', location: null, response: 'pending' as const, response_version: 1};
    globalThis.fetch = jest.fn();
    const client = new GatewayClient('https://srd.ejemplo.com');
    expect(() => client.respondInvitation({...invitation, response_version: 0}, 'declined')).toThrow('invitación');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/csrf')) return response({token: 'csrf'});
      throw new Error('Conexión cerrada');
    });
    await expect(client.respondInvitation(invitation, 'declined')).rejects.toThrow('Actualiza las invitaciones');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
  test('distingue sin resultados de errores del servidor y valida entrada', async () => {
    const client = new GatewayClient('https://srd.ejemplo.com');
    await expect(client.lookupPerson('CC', '12 34')).rejects.toThrow('sin espacios');
    globalThis.fetch = jest.fn().mockResolvedValue(response([]));
    await expect(client.lookupPerson('TI', '0004')).resolves.toBeNull();
    globalThis.fetch = jest.fn().mockResolvedValue({ok: false, status: 403, json: async () => ({error: {message: 'Sin permiso'}})});
    await expect(client.lookupPerson('TI', '0004')).rejects.toThrow('Sin permiso');
  });
  test('crea un pendiente con versiones vigentes y soporte de autorización explícito', async () => {
    globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/person-fields')) return response({version: 3});
      if (url.endsWith('/person-positions')) return response({version: 2});
      if (url.endsWith('/csrf')) return response({token: 'csrf'});
      if (url.endsWith('/persons')) return response({id: '123e4567-e89b-42d3-a456-426614174000', version: 1});
      throw new Error(`Ruta inesperada: ${url}`);
    });
    const result = await new GatewayClient('https://srd.ejemplo.com').createPendingPerson({
      documentType: 'CC', documentNumber: '00123', firstNames: ' Ana ', lastNames: '',
      authorizationBasis: ' Acta 12 ', authorizationPurpose: ' Registro comunitario ',
    });
    expect(result.version).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://srd.ejemplo.com/api/v1/persons', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({'X-CSRF-TOKEN': 'csrf'}),
      body: JSON.stringify({
        document_type: 'CC', document_number: '00123', first_names: 'Ana', last_names: null,
        status: 'pending', authorization_basis: 'Acta 12', authorization_purpose: 'Registro comunitario',
        schema_version: 3, positions_version: 2, custom_values: {},
      }),
    }));
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });
  test('no envía un registro sin datos mínimos o soporte de autorización', async () => {
    globalThis.fetch = jest.fn();
    const client = new GatewayClient('https://srd.ejemplo.com');
    const valid = {documentType: 'CC' as const, documentNumber: '00123', firstNames: 'Ana', lastNames: '', authorizationBasis: 'Acta', authorizationPurpose: 'Registro comunitario'};
    await expect(client.createPendingPerson({...valid, authorizationBasis: ''})).rejects.toThrow('fundamento');
    await expect(client.createPendingPerson({...valid, documentNumber: '00 123'})).rejects.toThrow('sin espacios');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  test('consulta la bandeja personal por página y valida la paginación', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(response({items: [], page: 2, page_size: 25, total: 26, unread: 3}));
    const client = new GatewayClient('https://srd.ejemplo.com');
    expect(() => client.notifications(0)).toThrow('página');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    const inbox = await client.notifications(2);
    expect(inbox.unread).toBe(3);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://srd.ejemplo.com/api/v1/notifications?page=2',
      expect.objectContaining({method: 'GET', credentials: 'include'}));
  });
  test('lee y guarda preferencias con horario que cruza medianoche y CSRF', async () => {
    const preferences = {event_changes: false, reminders: true, chat_messages: false, quiet_start: '22:00', quiet_end: '07:00'};
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(response(preferences))
      .mockResolvedValueOnce(response({token: 'csrf'}))
      .mockResolvedValueOnce(response(preferences));
    const client = new GatewayClient('https://srd.ejemplo.com');
    expect(await client.notificationPreferences()).toEqual(preferences);
    expect(await client.updateNotificationPreferences(preferences)).toEqual(preferences);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(3,
      'https://srd.ejemplo.com/api/v1/notification-preferences',
      expect.objectContaining({method: 'PUT', credentials: 'include',
        headers: expect.objectContaining({'X-CSRF-TOKEN': 'csrf'}), body: JSON.stringify(preferences)}));
  });
  test('rechaza horarios incompletos y exige recargar tras una respuesta perdida', async () => {
    const valid = {event_changes: true, reminders: true, chat_messages: true, quiet_start: '22:00', quiet_end: '07:00'};
    const client = new GatewayClient('https://srd.ejemplo.com');
    globalThis.fetch = jest.fn();
    expect(() => client.updateNotificationPreferences({...valid, quiet_end: null})).toThrow('horas válidas');
    expect(() => client.updateNotificationPreferences({...valid, quiet_start: '25:00'})).toThrow('horas válidas');
    expect(() => client.updateNotificationPreferences({...valid, quiet_end: '22:00'})).toThrow('horas válidas');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/csrf')) return response({token: 'csrf'});
      throw new Error('Conexión cerrada');
    });
    await expect(client.updateNotificationPreferences(valid)).rejects.toThrow('Vuelve a abrir las preferencias');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
  test('marca lectura y descarta con CSRF y sin aceptar rutas arbitrarias', async () => {
    const id = '123e4567-e89b-42d3-a456-426614174000';
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(response({token: 'csrf'}))
      .mockResolvedValueOnce(response({id}))
      .mockResolvedValueOnce(response({id}));
    const client = new GatewayClient('https://srd.ejemplo.com');
    expect(() => client.markNotificationRead('../auth/me')).toThrow('aviso');
    expect(() => client.dismissNotification('../auth/me')).toThrow('aviso');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await client.markNotificationRead(id);
    await client.dismissNotification(id);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2,
      `https://srd.ejemplo.com/api/v1/notifications/${id}/read`,
      expect.objectContaining({method: 'POST', credentials: 'include', headers: expect.objectContaining({'X-CSRF-TOKEN': 'csrf'})}));
    expect(globalThis.fetch).toHaveBeenNthCalledWith(3,
      `https://srd.ejemplo.com/api/v1/notifications/${id}`,
      expect.objectContaining({method: 'DELETE', credentials: 'include', headers: expect.objectContaining({'X-CSRF-TOKEN': 'csrf'})}));
  });
  test('una respuesta perdida al descartar exige actualizar antes de intentar de nuevo', async () => {
    const id = '123e4567-e89b-42d3-a456-426614174000';
    globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/csrf')) return response({token: 'csrf'});
      throw new Error('Conexión cerrada');
    });
    await expect(new GatewayClient('https://srd.ejemplo.com').dismissNotification(id))
      .rejects.toThrow('Actualiza los avisos');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
  test('advierte si la respuesta del alta se pierde sin reintentar el POST', async () => {
    globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/person-fields') || url.endsWith('/person-positions')) return response({version: 1});
      if (url.endsWith('/csrf')) return response({token: 'csrf'});
      if (url.endsWith('/persons')) throw new Error('Conexión cerrada');
      throw new Error(`Ruta inesperada: ${url}`);
    });
    const client = new GatewayClient('https://srd.ejemplo.com');
    await expect(client.createPendingPerson({
      documentType: 'CC', documentNumber: '00123', firstNames: 'Ana', lastNames: '',
      authorizationBasis: 'Acta', authorizationPurpose: 'Registro comunitario',
    })).rejects.toThrow('Consulta el documento antes de intentar de nuevo');
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });
});
