# Filtros visibles de personas

En Configuración, el panel **Filtros visibles de personas** permite elegir los criterios comunes de Lista: estado, zona, afiliación, tipo de documento, género, rol descriptivo, cargo, intervalos de nacimiento y de registro, y campos adicionales de la junta. La búsqueda por nombre, apellido o documento siempre permanece. Puedes desmarcar todos los criterios opcionales.

La selección se aplica al volver a abrir Lista o recargar la aplicación. No hay actualización automática de pestañas que ya tienen Lista abierta. Los criterios de búsqueda se reinician al cargar la configuración para evitar aplicar un filtro que no se muestra. Ante un fallo de lectura se ofrece reintento; la búsqueda de texto sigue disponible.

Esto configura la interfaz, no la autorización para leer datos. Las fichas conservan sus campos y la API de consulta sigue admitiendo todos los criterios válidos. Ocultar un filtro no protege información sensible. La nota interna conserva su permiso exclusivo y nunca es un filtro configurable.

## Delegación

Superadministradores y administradores siempre pueden cambiar la selección y autorizar a Registrador, Tesorero, Auditor o Consultor para editarla. La autorización se concede al rol dentro de esa junta, no a todas sus membresías en otras juntas. El cambio de un delegado afecta a toda la junta.

El delegado no puede conceder ni retirar delegaciones, ni administrar campos, cargos, cuentas, tesorería o auditoría por esta autorización. Cada guardado relee los permisos bajo bloqueo en el servidor. Revocar una delegación impide guardar incluso desde un formulario abierto antes de la revocación. La interfaz puede seguir mostrándolo hasta recargar; el servidor devuelve 403.

## Datos, versiones y auditoría

Registros posee `person_filter_settings`, una fila por junta con versión, criterios base, identificadores de campos adicionales y roles delegados. La migración `2026_09_20_000001_person_filter_settings` solo añade esa tabla. No hay referencias SQL a otros servicios.

- `GET /api/v1/person-filter-settings`: cualquier lector de personas; devuelve `version`, `base`, `custom`, `delegated_roles`, `can_manage` y `can_delegate`.
- `PUT`: requiere sesión, CSRF y permiso vigente. Recibe `version`, `base`, `custom` y, solo para administradores, `delegated_roles`. Identificadores de campos ajenos, criterios desconocidos y duplicados devuelven 422. Una versión antigua devuelve 409.
- Antes de configurar, la lectura no crea filas: versión 0, todos los criterios base, `custom: null` (todos los campos adicionales presentes o futuros), sin delegados. Guardar fija una selección explícita; campos adicionales creados después quedan ocultos hasta seleccionarlos. Los campos inactivos siguen disponibles para búsquedas históricas.
- Escritura, control de versión y evento `person_filters.updated` comparten transacción. Se bloquea primero el esquema de campos y luego la configuración. El evento identifica actor y junta sin copiar valores de fichas. No incluye aún un detalle de diferencias de selección.

**Descartar cambios y recargar filtros** recupera la configuración vigente. Ante 409 o revocación, recarga antes de volver a editar. La funcionalidad no incluye personalización por usuario, delegaciones de otros módulos ni consultas guardadas. Los campos adicionales de fecha visibles permiten coincidencia exacta o intervalo inclusivo, descritos en CAMPOS-ADICIONALES.md; otros rangos siguen pendientes. Evidencia y límites de pruebas en VALIDACION.md.

**Nacimiento desde/hasta** es un único criterio base de visibilidad: ambos extremos son obligatorios cuando se utiliza y se incluyen en la consulta. La API acepta `birth_date_from` y `birth_date_to` también si el criterio no se muestra; ocultarlo no restringe permisos. Las juntas sin configuración guardada lo ven por defecto. Una junta con selección explícita anterior conserva su selección hasta que alguien autorice y guarde este nuevo criterio. Las fichas sin fecha de nacimiento no coinciden.

**Registro desde/hasta** es otro criterio base independiente. Usa la fecha de creación de la ficha, no la fecha de nacimiento ni la última edición. Ambos extremos son obligatorios, válidos y ordenados. La API acepta `registered_from` y `registered_to` aunque el control esté oculto. Cada fecha representa el día civil de `America/Bogota`: el servidor compara en UTC desde el inicio del primer día hasta, sin incluir, el inicio del día posterior al último. Así incluye todo el día final, incluso si la base guarda fracciones de segundo. Las juntas sin selección guardada lo ven por defecto; las selecciones explícitas anteriores se conservan y pueden añadirlo desde Configuración.
