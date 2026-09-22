# Consulta de auditoría

En **Auditoría → Buscar eventos**, superadministrador, administrador y auditor consultan únicamente los eventos de su junta activa. La vista no permite editar ni borrar eventos y no concede acceso a los módulos restringidos.

Los filtros se combinan: desde/hasta, actor, módulo, acción y resultado deben coincidir a la vez. Las fechas corresponden a días completos en UTC, como indica la pantalla; no se convierten silenciosamente a la hora de Colombia. Se puede indicar solo uno de los extremos. El fin no puede ser anterior al inicio.

Actor acepta el UUID mostrado en el detalle de un evento. Acción utiliza la clave exacta, por ejemplo `person.created`. Módulo ofrece los tres productores existentes: identidad, configuración y registros. Resultado distingue correcto, rechazado y fallido. La incorporación de otros dominios ampliará este catálogo.

**Aplicar filtros** vuelve a la primera página. Se pueden mostrar 10, 25 o 50 eventos; el total refleja la selección autorizada. El orden es fecha descendente e identificador descendente para desempatar. **Limpiar filtros** restaura la consulta inicial y 25 filas. Las respuestas atrasadas de consultas anteriores no sustituyen la selección vigente; un fallo muestra el error sin conservar resultados de otra consulta.

**Ver** abre fecha, módulo, acción, resultado, actor, recurso, identificador y correlación del evento ya autorizado. No carga notas, contenido de chat ni información del registro asociado. Un identificador no es un enlace de acceso al recurso.

La sección **Entrega de auditoría** conserva la supervisión de pendientes y agotados; véase [OUTBOX.md](OUTBOX.md). Exportación PDF/Excel y supervisión global siguen pendientes. La paginación es estable para un conjunto fijo, pero no es una instantánea: nuevas entregas pueden desplazar filas entre páginas.

Contrato: `GET /api/v1/audit-events`, documentado en `contracts/gateway.openapi.json`; el servicio recibe los mismos filtros en `GET /internal/v1/events` con contexto firmado. No se requiere migración para esta ampliación.
