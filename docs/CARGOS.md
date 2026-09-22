# Catálogo de cargos de personas

En **Configuración → Cargos de las personas**, superadministradores y administradores pueden agregar, renombrar y desactivar cargos de su junta. El catálogo empieza con Presidente, Vicepresidente, Secretario, Tesorero, Fiscal y Otro. Admite hasta 50 entradas y exige al menos una activa. Los cargos guardados conservan su identificador y se desactivan en lugar de eliminarse.

Todos los lectores de personas pueden consultar el catálogo. El campo Cargo de Registro usa sus opciones activas; una ficha existente también puede conservar su cargo inactivo. Los nombres se capturan en la ficha al asignar el cargo y no cambian al renombrarlo en el catálogo. Cambiar de cargo captura el nombre vigente. Vaciar el cargo en una ficha pendiente elimina también su etiqueta; sigue siendo obligatorio para completar una ficha.

El cargo es descriptivo y no crea cuentas, membresías ni permisos. Su administración no habilita delegaciones granulares, que continúan pendientes. Los demás catálogos base conservan sus reglas actuales.

## Persistencia y concurrencia

Registros posee `person_position_catalogs`, una fila por junta con versión y opciones JSON. La migración `2026_09_13_000001_person_positions` añade `persons.position_label` y completa las etiquetas de los seis cargos iniciales ya almacenados. No importa datos del ZIP de referencia.

`GET /api/v1/person-positions` devuelve `version` e `items` (`code`, `label`, `active`). `PUT` requiere permisos de administración, CSRF y la versión vigente; registra `person_positions.updated` mediante outbox sin nombres ni valores de fichas.

Guardar una persona incorpora `positions_version`. Omitirla equivale a cero, compatible con juntas cuyo catálogo todavía no cambió. Una versión antigua produce 409. Usa **Recargar configuración de campos** y revisa Cargo antes de repetir. La lectura bloqueada del catálogo, la validación y la escritura de la ficha comparten una transacción. Las etiquetas históricas no pueden suministrarse desde el navegador.

## Validación y límites

`PersonPositionsTest` cubre permisos, aislamiento, versiones, validaciones, históricos, asignación inactiva rechazada y limpieza del cargo. La suite de Registros tiene 18 pruebas y 298 aserciones aprobadas. La prueba de navegador está en `tools/browser-tests/person-positions.spec.mjs`; resultados y límites en VALIDACION.md.

El 21/09 se comprobaron cinco escenarios de concurrencia en MySQL mediante `scripts/Test-PersonPositionsConcurrency.ps1`: dos ediciones del catálogo con y sin fila previa, cambio de catálogo frente a alta o edición con versión antigua, y alta que obtiene el bloqueo antes del cambio. En los cuatro primeros gana el cambio del catálogo y la operación antigua recibe 409; en el último ambas operaciones se guardan en orden y la persona conserva «Presidente», aunque el catálogo se renombre y desactive después.

La prueba usa dos procesos independientes, barreras y transacciones solapadas. Verifica versiones, personas, autorizaciones, ausencia de filas parciales, etiquetas históricas y número de eventos outbox. Solo se ejecuta en entorno local MySQL con habilitación explícita; crea juntas sintéticas UUID, posterga sus eventos dos días para evitar que los planificadores los publiquen y comprueba su limpieza al finalizar. Informe: `.local/positions-concurrency.txt`. No comprueba HTTP, permisos, carga masiva ni todos los posibles órdenes de bloqueo. La evidencia de navegador y permisos sigue siendo independiente.

El límite de 50 incluye las entradas inactivas para mantener acotado el catálogo y conservar referencias.
