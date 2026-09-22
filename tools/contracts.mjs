import fs from "node:fs";
const str = (extra = {}) => ({ type: "string", ...extra }),
  uuid = () => str({ format: "uuid" }),
  obj = (properties, required = Object.keys(properties)) => ({
    type: "object",
    properties,
    required,
  });
const error = obj({
  error: obj({
    code: str(),
    message: str(),
    fields: {
      type: "object",
      additionalProperties: { type: "array", items: str() },
    },
  }),
  correlation_id: uuid(),
});
const envelope = {
  type: "object",
  required: ["data", "meta"],
  properties: { data: {}, meta: obj({ correlation_id: uuid() }) },
};
const response = {
  description: "Resultado confirmado",
  content: { "application/json": { schema: envelope } },
};
const schemas = {
  PersonFilterSettings: obj({ version: { type: 'integer', minimum: 0 }, base: { type: 'array', maxItems: 7, uniqueItems: true, items: str({ enum: ['status','zone','affiliated','document_type','gender','descriptive_role','position_code'] }) }, custom: { type: 'array', maxItems: 20, uniqueItems: true, items: uuid() }, delegated_roles: { type: 'array', maxItems: 4, uniqueItems: true, items: str({ enum: ['registrar','treasurer','auditor','viewer'] }) } }, ['version','base','custom']),
  PersonPositionCatalog: obj({ version: { type: 'integer', minimum: 0 }, items: { type: 'array', minItems: 1, maxItems: 50, items: { ...obj({ code: str({ maxLength: 60, pattern: '^[a-z0-9-]+$' }), label: str({ maxLength: 80 }), active: { type: 'boolean' } }), additionalProperties: false } } }),
  PersonFieldOption: { ...obj({ id: uuid(), label: str({ minLength: 1, maxLength: 80 }), active: { type: 'boolean' } }), additionalProperties: false },
  PersonField: { ...obj({ id: uuid(), label: str({ minLength: 1, maxLength: 80 }), type: str({ enum: ['text', 'date', 'number', 'select'] }), active: { type: 'boolean' }, required: { type: 'boolean' }, options: { type: 'array', maxItems: 50, items: { $ref: '#/components/schemas/PersonFieldOption' } } }), additionalProperties: false },
  PersonFieldSchema: obj({ version: { type: 'integer', minimum: 0 }, fields: { type: 'array', maxItems: 20, items: { $ref: '#/components/schemas/PersonField' } }, delegated_roles: { type: 'array', maxItems: 4, uniqueItems: true, items: str({ enum: ['registrar','treasurer','auditor','viewer'] }), description: 'Opcional; solo SA/AD. Omitir conserva las delegaciones vigentes.' } }, ['version','fields']),
  QuickLink: { ...obj({ function: str({ enum: ['register', 'list', 'lookup', 'settings', 'audit', 'downloads'] }), label: str({ minLength: 1, maxLength: 40 }) }), additionalProperties: false },
  OrganizationQuickLinks: obj({ version: { type: 'integer', minimum: 0 }, mode: str({ enum: ['common', 'personal'], description: 'Opcional: omitir conserva la política vigente. Solo SA puede cambiarla; AD puede enviar el valor vigente.' }), items: { type: 'array', maxItems: 3, items: { $ref: '#/components/schemas/QuickLink' } } }, ['version','items']),
  PersonalQuickLinks: obj({ version: { type: 'integer', minimum: 0 }, common_version: { type: 'integer', minimum: 0 }, inherit: { type: 'boolean' }, items: { type: 'array', maxItems: 3, items: { $ref: '#/components/schemas/QuickLink' } } }),
  OrganizationCreate: obj({ code: str({ minLength: 3, maxLength: 40, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }), name: str({ maxLength: 160 }), terms: str({ minLength: 20, maxLength: 50000 }) }),
  OrganizationStatus: obj({ active: { type: 'boolean' }, version: { type: 'integer', minimum: 1 } }),
  AdministratorInvitation: obj({ email: str({ format: 'email', maxLength: 254 }) }),
  Invitation: obj({ email: str({ format: 'email', maxLength: 254 }), role: str({ enum: ['admin', 'registrar', 'treasurer', 'auditor', 'viewer'] }) }),
  InvitationCredential: obj({ invitation_id: uuid(), secret: str({ pattern: '^[a-f0-9]{64}$', writeOnly: true }) }),
  InvitationAccept: obj({ invitation_id: uuid(), secret: str({ pattern: '^[a-f0-9]{64}$', writeOnly: true }), name: str({ minLength: 2, maxLength: 120 }), password: str({ minLength: 12, maxLength: 128, writeOnly: true }), password_confirmation: str({ writeOnly: true }), terms_version_id: uuid(), accepted: { type: 'boolean', const: true } }),
  Membership: obj({ role: str({ enum: ['admin', 'registrar', 'treasurer', 'auditor', 'viewer'] }), active: { type: 'boolean' }, version: { type: 'integer', minimum: 1 } }),
  SessionToken: obj({ token: str({ pattern: "^[a-f0-9]{64}$", writeOnly: true }) }),
  Login: obj({
    email: str({ format: "email", maxLength: 254 }),
    password: str({ minLength: 1, maxLength: 1024 }),
    organization_code: str({ pattern: "^[a-z0-9-]{3,40}$" }),
    terms_version_id: uuid(),
    accepted: { type: "boolean", const: true },
  }),
  Verify: obj({ challenge_id: uuid(), code: str({ pattern: "^[0-9]{6}$" }) }),
  Challenge: obj({ challenge_id: uuid() }),
  EmailChange: obj({
    new_email: str({ format: "email", maxLength: 254 }),
    password: str({ maxLength: 1024 }),
  }),
  Recover: obj({ email: str({ format: "email" }), organization_code: str() }),
  Reset: obj({
    challenge_id: uuid(),
    secret: str({ minLength: 64, maxLength: 64 }),
    password: str({ minLength: 12, maxLength: 128 }),
    password_confirmation: str(),
  }),
  Switch: obj({
    organization_code: str(),
    terms_version_id: uuid(),
    accepted: { type: "boolean", const: true },
  }),
  Profile: obj({
    name: str({ maxLength: 120 }),
    theme: str({ enum: ["light", "dark"] }),
    presence: str({ enum: ["online", "away", "dnd", "invisible"] }),
  }),
  Organization: obj({
    name: str({ maxLength: 160 }),
    accent: str({ pattern: "^#[0-9a-fA-F]{6}$" }),
    version: { type: "integer", minimum: 1 },
  }),
  Terms: obj({
    body: str({ minLength: 20, maxLength: 50000 }),
    version: { type: "integer", minimum: 1 },
  }),
  Person: obj(
    {
      schema_version: { type: 'integer', minimum: 0, description: 'Versión vigente de /person-fields. Omitir equivale a 0; una versión antigua devuelve 409.' },
      positions_version: { type: 'integer', minimum: 0, description: 'Versión vigente de /person-positions. Omitir equivale a 0; una versión antigua devuelve 409.' },
      custom_values: { type: 'object', maxProperties: 20, propertyNames: { format: 'uuid' }, additionalProperties: { type: ['string', 'null'], maxLength: 500 }, description: 'UUID de campo a valor. Fechas YYYY-MM-DD, decimales en cadena (12 enteros y hasta 4 decimales), selecciones UUID de opción. Omitidos conservan su valor; null retira un valor activo.' },
      document_type: str({ enum: ["RC", "TI", "CC", "CE", "NIT"] }),
      document_number: str({ maxLength: 30 }),
      first_names: str({ maxLength: 120 }),
      last_names: str({ maxLength: 120 }),
      status: str({ enum: ["pending", "complete"] }),
      affiliated: { type: ["boolean", "null"] },
      zone: str({ enum: ["rural", "urban"] }),
      gender: str({ enum: ["male", "female", "other"] }),
      birth_date: str({ format: "date" }),
      phone: str({ maxLength: 20 }),
      email: str({ format: "email" }),
      position_code: { type: ['string', 'null'], maxLength: 60, pattern: '^[a-z0-9-]+$', description: 'Identificador del catálogo de la junta. Una opción inactiva solo puede conservarse en la ficha que ya la usaba.' },
      position_label: { type: ['string', 'null'], maxLength: 80, readOnly: true, description: 'Nombre capturado al asignar el cargo; conserva su historia aunque cambie el catálogo.' },
      descriptive_role: str({
        enum: ["admin", "registrar", "treasurer", "auditor", "viewer"],
      }),
      property_name: str({ maxLength: 160 }),
      address: str({ maxLength: 180 }),
      neighborhood: str({ maxLength: 100 }),
      note: str({ maxLength: 4000 }),
      authorization_basis: str({ maxLength: 120 }),
      authorization_purpose: str({ maxLength: 1000 }),
      version: { type: "integer", minimum: 1 },
    },
    [
      "document_type",
      "document_number",
      "first_names",
      "status",
      "authorization_basis",
      "authorization_purpose",
    ],
  ),
  Delete: obj({
    confirmed: { type: "boolean", const: true },
    version: { type: "integer", minimum: 1 },
  }),
  Error: error,
};
const routes = [
  ['get', '/person-fields', 'Configuración de campos de personas de la junta; todos los lectores'],
  ['get', '/person-filter-settings', 'Filtros visibles comunes, versión y permisos de edición. custom=null en la configuración inicial significa todos los campos.'],
  ['put', '/person-filter-settings', 'Guardar filtros comunes; SA/AD o rol delegado vigente. Solo SA/AD pueden enviar delegated_roles. Conflicto de versión: 409; no modifica permisos de lectura.', 'PersonFilterSettings'],
  ['get', '/person-positions', 'Catálogo de cargos de personas de la junta; todos los lectores'],
  ['put', '/person-positions', 'Guardar cargos; SA/AD, versión, desactivación e historia', 'PersonPositionCatalog'],
  ['get', '/contacts', 'Directorio de otras cuentas con membresía activa en la junta; nombre, rol y presencia pública. Valida la sesión sin renovar inactividad.'],
  ['put', '/person-fields', 'Guardar campos adicionales; SA/AD o delegado vigente. Solo SA/AD conceden delegaciones. Versión compartida y conservación histórica.', 'PersonFieldSchema'],
  ["get", "/csrf", "Inicializar CSRF", null, "public"],
  [
    "get",
    "/organizations/{code}",
    "Términos e identidad pública por código",
    null,
    "public",
  ],
  [
    "post",
    "/auth/login",
    "Validar credenciales sin emitir sesión",
    "Login",
    "public",
  ],
  [
    "post",
    "/auth/verify",
    "Consumir código y establecer sesión HttpOnly",
    "Verify",
    "public",
  ],
  [
    "post",
    "/auth/resend",
    "Reenviar sujeto a 60 segundos y cinco envíos por hora",
    "Challenge",
    "public",
  ],
  [
    "post",
    "/auth/cancel",
    "Cancelar desafío ligado a la sesión de navegador",
    "Challenge",
    "public",
  ],
  [
    "post",
    "/auth/recover",
    "Solicitar recuperación con respuesta genérica",
    "Recover",
    "public",
  ],
  [
    "post",
    "/auth/reset",
    "Consumir enlace y revocar sesiones",
    "Reset",
    "public",
  ],
  ["post", "/auth/logout", "Revocar sesión actual"],
  ["post", "/auth/revokeOthers", "Revocar otras sesiones"],
  [
    "post",
    "/auth/switchOrganization",
    "Validar membresía y aceptar términos de destino",
    "Switch",
  ],
  ["get", "/me", "Perfil de sesión y estado de aceptación"],
  ['get', '/members', 'Miembros de la junta; administradores; páginas de 25'],
  ['patch', '/members/{id}', 'Cambiar rol/estado con versión y revocar sesiones de la junta', 'Membership'],
  ['get', '/invitations', 'Invitaciones de la junta, sin credenciales; páginas de 25'],
  ['get', '/audit-delivery/{service}', 'Estado de entrega y hasta 20 eventos agotados de la junta; requiere permiso de auditoría'],
  ['get', '/quick-links', 'Accesos efectivos, catálogo autorizado y versiones de configuración'],
  ['patch', '/quick-links/organization', 'Guardar accesos comunes: SA/AD. Cambiar política común/personal: solo SA; AD recibe 403 si intenta cambiarla. Versión antigua: 409.', 'OrganizationQuickLinks'],
  ['patch', '/quick-links/personal', 'Guardar accesos propios o volver a heredar; requiere modo personal y versiones vigentes', 'PersonalQuickLinks'],
  ['get', '/platform/organizations', 'Listar juntas, solo superadministrador; páginas de 25'],
  ['post', '/platform/organizations', 'Crear junta con términos iniciales, solo superadministrador', 'OrganizationCreate'],
  ['patch', '/platform/organizations/{id}', 'Activar o suspender junta con versión; no suspender la junta actual', 'OrganizationStatus'],
  ['post', '/platform/organizations/{id}/administrators', 'Invitar administrador de la junta indicada, solo superadministrador', 'AdministratorInvitation'],
  ['post', '/invitations', 'Crear invitación privada con envío pendiente y caducidad de 24 horas', 'Invitation'],
  ['delete', '/invitations/{id}', 'Revocar enlace de invitación no aceptado'],
  ['post', '/invitations/inspect', 'Consultar invitación únicamente presentando su secreto', 'InvitationCredential', 'public'],
  ['post', '/invitations/accept', 'Consumir invitación y vincular cuenta sin iniciar sesión', 'InvitationAccept', 'public'],
  ["get", "/dashboard", "Indicadores exclusivos de junta; date en America/Bogota, generated_at UTC y timezone. Semana desde lunes; períodos hasta antes de la siguiente medianoche colombiana."],
  ["get", "/persons", "Consulta paginada de personas"],
  ["post", "/persons", "Crear persona y evento durable", "Person"],
  ["get", "/persons/lookup", "Consulta exacta por tipo y documento"],
  ["get", "/persons/{id}", "Detalle; nota solo para SA/AD/RE"],
  ["patch", "/persons/{id}", "Actualizar con versión requerida", "Person"],
  ["delete", "/persons/{id}", "Borrado confirmado con versión", "Delete"],
  ["patch", "/profile", "Editar perfil propio, sin rol ni correo", "Profile"],
  [
    "post",
    "/profile/email-change",
    "Reautenticar y enviar código al nuevo correo",
    "EmailChange",
  ],
  [
    "post",
    "/profile/email-change/resend",
    "Reenviar dentro del período de reautenticación",
    "Challenge",
  ],
  [
    "post",
    "/profile/email-change/confirm",
    "Verificar correo y revocar otras sesiones",
    "Verify",
  ],
  ["patch", "/organization", "Editar nombre/color con versión", "Organization"],
  [
    "post",
    "/organization/terms",
    "Publicar versión inmutable de términos",
    "Terms",
  ],
  ["get", "/audit-events", "Auditoría de junta; SA/AD/AU"],
  ["get", "/releases", "Lista vacía hasta disponer de instaladores reales"],
];
const paths = {};
for (const [method, path, summary, input, scope] of routes) {
  const op = {
    summary,
    operationId: method + path.replace(/[^a-zA-Z]/g, "_"),
    security: scope === "public" ? [] : [{ session: [] }],
    responses: {
      200: response,
      ...Object.fromEntries(
        [401, 403, 404, 409, 419, 422, 429, 503].map((code) => [
          code,
          {
            description: "Error normalizado " + code,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        ]),
      ),
    },
  };
  if (input)
    op.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/" + input },
        },
      },
    };
  op.parameters = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: m[1] === "id" ? uuid() : m[1] === 'service' ? str({ enum: ['identity', 'configuration', 'records'] }) : str(),
  }));
  if (method !== "get")
    op.parameters.push({
      name: "X-CSRF-TOKEN",
      in: "header",
      required: true,
      schema: str(),
      description: "Obtener de /csrf; renovar tras /auth/verify y logout.",
    });
  if (path === "/persons" && method === "get")
    op.parameters.push(
      { name: 'document_type', in: 'query', schema: str({ enum: ['RC', 'TI', 'CC', 'CE', 'NIT'] }) },
      { name: 'gender', in: 'query', schema: str({ enum: ['male', 'female', 'other'] }) },
      { name: 'descriptive_role', in: 'query', schema: str({ enum: ['admin', 'registrar', 'treasurer', 'auditor', 'viewer'] }), description: 'Rol de la ficha; no representa permisos de cuenta.' },
      { name: 'position_code', in: 'query', schema: str({ maxLength: 60, pattern: '^[a-z0-9-]+$' }), description: 'Código del catálogo de la junta activa, incluidos cargos inactivos. Todos los filtros se combinan con AND.' },
    );
  if (path === "/persons" && method === "get")
    for (const name of [
      "q",
      "status",
      "zone",
      "affiliated",
      "page",
      "page_size",
    ])
      op.parameters.push({
        name,
        in: "query",
        schema:
          name === "page"
            ? { type: "integer", minimum: 1 }
            : name === "page_size"
              ? { type: "integer", enum: [10, 25, 50] }
              : str(),
      });
  if (path === "/persons" && method === "get")
    op.parameters.push({ name: 'custom_filters', in: 'query', description: 'Hasta tres criterios combinados con AND. Codificar custom_filters[0][field_id] y [value] (índices 0..2). operator omitido o eq: coincidencia exacta, sin value_to. between: solo fechas ISO YYYY-MM-DD, value inicial y value_to final obligatorios, extremos inclusivos y ordenados. UUID de campo de la junta; campos y opciones inactivos admitidos. Números exactos comparados como cadenas, 1 difiere de 1.0.', schema: { type: 'array', maxItems: 3, items: { ...obj({ field_id: uuid(), value: str({ minLength: 1, maxLength: 120 }), operator: str({enum:['eq','between']}), value_to: str({format:'date'}) }, ['field_id','value']), additionalProperties: false } } });
  if (path === '/contacts') op.parameters.push(
    { name: 'q', in: 'query', schema: str({ maxLength: 120 }), description: 'Parte literal del nombre; no busca correos ni documentos.' },
    { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 }, description: '25 contactos por página, ordenados por nombre e identificador.' },
  );
  if (path === "/persons/lookup")
    op.parameters.push(
      ...["document_type", "document_number"].map((name) => ({
        name,
        in: "query",
        required: true,
        schema: str(),
      })),
    );
  if (path === '/audit-events' && method === 'get') {
    for (const [name, schema] of Object.entries({
      page: { type: 'integer', minimum: 1, maximum: 1000000 },
      page_size: { type: 'integer', enum: [10, 25, 50], default: 25 },
      date_from: { type: 'string', format: 'date', description: 'Primer día incluido, UTC.' },
      date_to: { type: 'string', format: 'date', description: 'Último día incluido, UTC; no anterior a date_from.' },
      actor_id: uuid(), service: str({ enum: ['identity', 'configuration', 'records', 'files'] }),
      action: str({ maxLength: 100 }), result: str({ enum: ['success', 'rejected', 'failed'] }),
    })) op.parameters.push({ name, in: 'query', schema });
  }
  paths[path] ??= {};
  paths[path][method] = op;
}
paths['/presence/heartbeat'] = { post: {
  summary: 'Confirmar conexión sin renovar inactividad',
  description: 'Cada 30 segundos. Señal válida durante 90 segundos. Usa únicamente la credencial del gateway. Respuesta propia: effective (online/away/dnd/offline), preference (incluye invisible), ttl_seconds=90. No permite consultar otras cuentas.',
  security: [{ session: [] }],
  parameters: [{ name: 'X-CSRF-TOKEN', in: 'header', required: true, schema: str() }],
  responses: { 200: response, 401: { description: 'Sesión inválida o vencida' }, 403: { description: 'Acceso o términos no vigentes' }, 419: { description: 'CSRF inválido' }, 429: { description: 'Límite de solicitudes' } },
} };
fs.mkdirSync("contracts", { recursive: true });
const doc = {
  openapi: "3.1.0",
  info: {
    title: "SRD Gateway API",
    version: "0.1.0",
    description:
      "Contrato del incremento implementado. Identidad nativa, archivos y otros dominios aún no expuestos. Cada éxito contiene data y meta. Listas contienen items/page/page_size/total dentro de data.",
  },
  servers: [
    { url: "http://localhost:8080/api/v1", description: "Compose local" },
  ],
  paths,
  components: {
    securitySchemes: {
      session: {
        type: "apiKey",
        in: "cookie",
        name: "srd_session",
        description:
          "Cookie cifrada HttpOnly Laravel; nunca contiene una credencial legible por JavaScript.",
      },
    },
    schemas,
  },
};
fs.writeFileSync(
  "contracts/gateway.openapi.json",
  JSON.stringify(doc, null, 2) + "\n",
);
for (const [service, filter] of Object.entries({
  identity: (p) => p === '/contacts' || p.startsWith("/auth/") || p.startsWith("/profile") || p.startsWith('/members') || p.startsWith('/invitations') || p.endsWith('/administrators'),
  configuration: (p) => p.startsWith("/organization") || p.startsWith('/quick-links') || (p.startsWith('/platform/organizations') && !p.endsWith('/administrators')),
  records: (p) => p.startsWith("/persons") || p === '/person-fields' || p === '/person-positions' || p === '/person-filter-settings' || p === "/dashboard",
  audit: (p) => p === "/audit-events",
})) {
  const internalPaths = {};
  for (const [p, v] of Object.entries(paths))
    if (filter(p)) {
      let target =
        p === "/audit-events"
          ? "/events"
          : p === "/organizations/{code}"
            ? "/organizations/code/{code}"
            : p;
      const ops = structuredClone(v);
      for (const op of Object.values(ops)) {
        op.security = [{ internal: [] }];
        op.parameters = op.parameters.filter((p) => p.name !== "X-CSRF-TOKEN");
        if (
          service === "identity" &&
          target.startsWith("/auth/") &&
          ![
            "/auth/login",
            "/auth/verify",
            "/auth/resend",
            "/auth/cancel",
            "/auth/recover",
            "/auth/reset",
          ].includes(target)
        ) {
          op.description =
            "Recibe token de sesión por POST desde el gateway; nunca del navegador directamente.";
          const tokenSchema = { $ref: "#/components/schemas/SessionToken" };
          const schema = op.requestBody?.content?.["application/json"]?.schema;
          op.requestBody = { required: true, content: { "application/json": { schema: schema ? { allOf: [schema, tokenSchema] } : tokenSchema } } };
        }
      }
      internalPaths[target] = ops;
    }
  if (service === "identity")
    internalPaths["/auth/me"] = {
      post: {
        summary: "Resolver credencial opaca y contexto; touch_activity=false valida sin renovar inactividad",
        requestBody: { required: true, content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/SessionToken" }, { type: 'object', properties: { touch_activity: { type: 'boolean', default: true } } }] } } } },
        security: [{ internal: [] }],
        responses: { 200: response },
      },
    };
  if (service === 'identity') internalPaths['/auth/presence'] = { post: {
    summary: 'Registrar latido sin tocar last_activity_at',
    security: [{ internal: [] }],
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SessionToken' } } } },
    responses: { 200: response, 401: { description: 'Sesión vencida o revocada' }, 403: { description: 'Términos pendientes' } },
  } };
  if (['identity', 'configuration', 'records'].includes(service)) {
    const status = structuredClone(paths['/audit-delivery/{service}'].get);
    status.security = [{ internal: [] }];
    status.parameters = [];
    internalPaths['/outbox-status'] = { get: status };
  }
  if (service === 'records') internalPaths['/persons/{id}/photo-access'] = { post: {
    summary: 'Decisión mínima de acceso a fotos; solo emisor files',
    description: 'Comprueba el rol del contexto firmado y la existencia de la persona en esa junta. No devuelve campos ni notas, no almacena concesiones y no valida por sí sola una sesión. No está publicada en el gateway.',
    parameters: [{ name: 'id', in: 'path', required: true, schema: uuid() }],
    security: [{ internal: [] }],
    requestBody: { required: true, content: { 'application/json': { schema: obj({ action: str({ enum: ['persons.read', 'persons.write'] }) }) } } },
    responses: {
      200: { description: 'Acceso permitido, sin datos de la persona', content: { 'application/json': { schema: obj({ data: obj({ authorized: { type: 'boolean', const: true } }), meta: obj({ correlation_id: uuid() }) }) } } },
      401: { description: 'Firma o emisor no admitido' },
      403: { description: 'Emisor distinto de files o permisos insuficientes' },
      404: { description: 'Persona inexistente o fuera de la junta' },
      422: { description: 'Acción no admitida' },
    },
  } };
  if (service === "configuration")
    internalPaths["/organizations/{id}"] = {
      get: {
        summary: "Consulta para identidad; incluye términos y estado",
        parameters: [
          { name: "id", in: "path", required: true, schema: uuid() },
        ],
        security: [{ internal: [] }],
        responses: { 200: response },
      },
    };
  if (service === "audit")
    internalPaths["/events"].post = {
      summary: "Ingestión idempotente de evento mínimo; emisor igual a service",
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "./audit-event.v1.schema.json" } } } },
      security: [{ internal: [] }],
      responses: { 200: response },
    };
  fs.writeFileSync(
    `contracts/${service}.openapi.json`,
    JSON.stringify(
      {
        ...doc,
        info: { title: `SRD ${service} API interna`, version: "0.1.0" },
        servers: [{ url: `http://${service}:8000/internal/v1` }],
        paths: internalPaths,
        components: {
          schemas,
          securitySchemes: {
            internal: {
              type: "apiKey",
              in: "header",
              name: "X-SRD-Context",
              description:
                "Base64(JSON claims).HMAC-SHA256; audiencia, método, ruta, hash del cuerpo, nonce y caducidad obligatorios.",
            },
          },
        },
      },
      null,
      2,
    ) + "\n",
  );
}
fs.writeFileSync(
  "contracts/audit-event.v1.schema.json",
  JSON.stringify(
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "SRD audit event v1",
      ...obj({
        id: uuid(),
        organization_id: { type: ["string", "null"], format: "uuid" },
        actor_id: { type: ["string", "null"], format: "uuid" },
        service: str({ enum: ["identity", "configuration", "records", "files"] }),
        action: str({ maxLength: 100 }),
        resource_id: { type: ["string", "null"], format: "uuid" },
        result: str({ enum: ["success", "rejected", "failed"] }),
        correlation_id: uuid(),
        occurred_at: str(),
        event_version: { type: "integer", const: 1 },
      }),
    },
    null,
    2,
  ) + "\n",
);
await import('./contracts-files.mjs');
console.log("OpenAPI contracts written, including authenticated photo routes.");
