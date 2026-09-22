import fs from 'node:fs';
const response = (description, schema) => ({ description, ...(schema ? { content: { 'application/json': { schema } } } : {}) });
const metadata = { type: 'object', required: ['slot','version','present','size','width','height'], properties: {
  slot: { type: 'string', enum: ['person','document','property'] }, version: { type: 'integer', minimum: 0 }, present: { type: 'boolean' }, size: { type: 'integer', minimum: 0 }, width: { type: ['integer','null'] }, height: { type: ['integer','null'] },
} };
const envelope = data => ({ type: 'object', required: ['data','meta'], properties: { data, meta: { type: 'object', properties: { correlation_id: { type: 'string', format: 'uuid' } }, required: ['correlation_id'] } } });
const parameters = [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }];
const slot = { name: 'slot', in: 'path', required: true, schema: metadata.properties.slot };
const operation = (summary, params, result, body) => ({ summary, parameters: params, security: [{ internal: [] }],
  ...(body ? { requestBody: { required: true, content: { 'application/json': { schema: body } } } } : {}),
  responses: { 200: response('Operación confirmada; Cache-Control: no-store', envelope(result)), 401: response('Firma inválida'), 403: response('Emisor, contexto o permiso inválido'), 404: response('Recurso no disponible'), 409: response('Versión en conflicto'), 413: response('Solicitud mayor de 7 MiB'), 422: response('Datos o imagen inválidos'), 503: response('Dependencia o antivirus no disponible'), 507: response('Cuota insuficiente') },
});
const doc = {
  openapi: '3.1.0', info: { title: 'SRD Archivos: API interna de fotografías', version: '0.1.0', description: 'Servicio incorporado a Compose y conectado a rutas autenticadas del gateway. Solo emisor gateway con contexto de sesión previamente validada. El servicio consulta a Registros y exige antivirus real y comprobación reciente de firmas. Este contrato describe su API interna.' },
  servers: [{ url: 'http://files:8000/internal/v1' }],
  components: { securitySchemes: { internal: { type: 'apiKey', in: 'header', name: 'X-SRD-Context', description: 'Contexto HMAC ligado a audiencia files, cuerpo, método, ruta, nonce y caducidad; incluye junta, usuario, rol y session_id.' } } },
  paths: {
    '/persons/{id}/photos': { get: operation('Consultar tres posiciones de fotografías', parameters, { type: 'object', properties: { items: { type: 'array', items: metadata } }, required: ['items'] }) },
    '/persons/{id}/photos/{slot}': {
      get: operation('Leer fotografía privada normalizada', [...parameters, slot], { type: 'object', required: ['content','mime','version'], properties: { content: { type: 'string', contentEncoding: 'base64' }, mime: { const: 'image/png' }, version: { type: 'integer' } } }),
      put: operation('Crear o reemplazar con versión esperada', [...parameters, slot], metadata, { type: 'object', required: ['name','content','version'], properties: { name: { type: 'string', maxLength: 255 }, content: { type: 'string', maxLength: 6990508, contentEncoding: 'base64', description: 'Base64 canónico sin espacios. JPEG, PNG o WebP; máximo 5 MiB y 20 millones de píxeles.' }, version: { type: 'integer', minimum: 0, maximum: 2147483647 } } }),
      delete: operation('Borrar foto con confirmación y versión', [...parameters, slot], metadata, { type: 'object', required: ['confirmed','version'], properties: { confirmed: { const: true }, version: { type: 'integer', minimum: 1, maximum: 2147483647 } } }),
    },
  },
};
doc.paths['/photo-deletions/{id}'] = { post: {
  summary: 'Orden interna de limpieza de una persona ya eliminada; solo emisor records', parameters,
  description: 'Contexto firmado con organization_id, user_id y correlation_id. Sin autoridad en el cuerpo. Idempotente: registra marca terminal y retira metadatos; la retirada física y la liberación de cuota son posteriores mediante el recolector. Sin ruta pública en el gateway.',
  security: [{ internal: [] }], responses: { 200: response('Orden persistida', envelope({ type: 'object', properties: { accepted: { const: true } }, required: ['accepted'] })), 401: response('Firma inválida'), 403: response('Emisor o contexto inválido'), 500: response('Operación no confirmada; reintentar la misma orden') },
} };
doc.info.description += ' La ruta photo-deletions admite exclusivamente al emisor records para órdenes persistentes de limpieza.';
fs.writeFileSync('contracts/files.openapi.json', JSON.stringify(doc, null, 2) + '\n');
const gateway = JSON.parse(fs.readFileSync('contracts/gateway.openapi.json', 'utf8'));
for (const [path, operations] of Object.entries(doc.paths)) {
  if (!path.startsWith('/persons/')) continue;
  gateway.paths[path] = structuredClone(operations);
  for (const operation of Object.values(gateway.paths[path])) operation.security = structuredClone(gateway.paths['/persons'].get.security);
}
fs.writeFileSync('contracts/gateway.openapi.json', JSON.stringify(gateway, null, 2) + '\n');
