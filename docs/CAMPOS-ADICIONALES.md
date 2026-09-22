# Campos adicionales de personas

En **Configuración → Campos adicionales de personas**, SA y AD pueden definir hasta 20 campos por junta y delegar esa edición a RE, TE, AU o CO. Cada campo tiene etiqueta, tipo, estado activo y obligatoriedad al completar. Los botones Subir/Bajar determinan su orden en el formulario.

Tipos disponibles:

| Tipo | Valor permitido |
|---|---|
| Texto | Hasta 500 caracteres |
| Fecha | Fecha válida, formato de API `YYYY-MM-DD` |
| Número decimal | Cadena con hasta 12 dígitos enteros y 4 decimales; puede ser negativo o cero |
| Selección | Una opción activa del campo, hasta 50 opciones por campo |

Los campos nuevos aparecen al abrir o recargar el formulario de personas. Un registro Pendiente puede omitirlos; para Completado se exigen los campos adicionales activos marcados como obligatorios, junto con las validaciones base. Los registros completados anteriormente conservan su estado; al volver a guardarlos deben satisfacer la configuración vigente.

Los campos base no se reemplazan: cada campo adicional tiene un UUID y sus valores se guardan por separado. Su contenido es visible para todos los roles que pueden consultar esa persona; la nota interna conserva sus permisos propios. No deben usarse estos campos para eludir la restricción de la nota.

## Cambios e historia

Se puede cambiar etiqueta, obligatoriedad, orden y estado. El tipo de un campo guardado es inmutable. Campos y opciones guardados no se eliminan desde esta interfaz, aunque aún no tengan valores: se desactivan y cuentan dentro de los límites. Antes del primer guardado se pueden retirar del borrador.

Una opción desactivada desaparece de las nuevas selecciones. Un registro que ya la usaba puede mantenerla al editar otros datos. Cuando cambia a otra opción, no puede volver a seleccionar la inactiva. Un campo inactivo conserva su valor y no acepta cambios hasta reactivarlo.

Cada valor guarda la etiqueta del campo y la etiqueta de opción que tenía al capturarse. Renombrar la configuración no reescribe esas etiquetas históricas. Si el valor no cambia, conserva su etiqueta; un nuevo valor usa la etiqueta vigente. El detalle muestra lo capturado. Esto conserva el último valor de la ficha, no un historial completo de todas sus versiones anteriores.

Si otra persona cambia la configuración mientras hay un formulario abierto, guardar devuelve conflicto 409. **Recargar configuración de campos** obtiene la versión nueva; revisa los campos antes de guardar otra vez. La versión de la persona se comprueba por separado. En Configuración, **Descartar cambios y recargar campos** recupera lo guardado y descarta el borrador local.

## API y persistencia

- `GET /api/v1/person-fields`: esquema y versión de la junta activa; lectura autorizada de personas.
- `PUT /api/v1/person-fields`: reemplaza la definición ordenada, conservando identificadores guardados; requiere SA/AD o un rol delegado vigente, CSRF y versión vigente. Solo SA/AD pueden enviar `delegated_roles`; omitirlo conserva las delegaciones existentes.
- Guardar persona acepta `schema_version` y `custom_values`, un objeto UUID→cadena/null. Los campos omitidos conservan su valor; null borra un valor de un campo activo. Una selección contiene el UUID de la opción, no su etiqueta.
- Detalle y consulta exacta incluyen `custom_fields` con `value`, `display`, `label` y `type`. No se incluyen valores adicionales en listas ni indicadores.

Migración `2026_09_10_000001_person_fields`: tablas `person_field_schemas` y `person_field_values` en Registros, sin modificar columnas base ni importar datos. Borrar una persona elimina sus valores mediante clave foránea. El outbox registra identificadores de cambios, sin etiquetas ni contenido de los campos.

La fila de esquema se bloquea antes de guardar configuración o persona y se mantiene durante la transacción. Así, la validación de tipos, opciones y versión usa la misma configuración que el guardado. Una consulta sin configuración devuelve versión 0 y lista vacía sin insertar datos. La primera escritura crea la fila de control.

`scripts/Test-PersonFieldsConcurrency.ps1` comprueba tres escenarios con procesos PHP separados contra MySQL: configuración/configuración con y sin fila previa, y configuración/formulario antiguo. Los procesos esperan una barrera de inicio; una transacción conserva el bloqueo durante 800 ms. Se verifica un guardado, un conflicto 409, versión final 1, un solo evento confirmado y ninguna persona creada por el formulario antiguo. Usa juntas sintéticas aleatorias y retira exclusivamente sus filas y temporales al terminar. No demuestra capacidad bajo carga ni todas las intercalaciones posibles.

RF-019 queda parcial: faltan catálogos base restantes y validación integral. La delegación de edición de campos está disponible por rol dentro de cada junta, no por usuario ni por campo individual. Las exportaciones siguen pendientes.

## Delegar la edición de campos

SA/AD seleccionan los roles autorizados en **Quién puede editar campos adicionales** y guardan junto con la configuración. Los delegados pueden crear, ordenar, renombrar y desactivar campos y opciones de toda la junta, respetando los tipos inmutables y la conservación histórica. No pueden conceder delegaciones, administrar cargos o filtros visibles por esta autorización, modificar cuentas ni acceder a notas internas. Un Consultor delegado puede editar el esquema, pero sigue sin poder crear personas.

La migración `2026_09_20_000002_person_field_delegations` añade `delegated_roles` nullable a la tabla existente. Null equivale a ninguna delegación, por lo que las juntas anteriores conservan sus permisos. La lectura de campos devuelve también `delegated_roles`, `can_manage` y `can_delegate`; el servidor calcula las capacidades con el rol verificado, nunca con datos del navegador.

Permisos y definición comparten la versión y el bloqueo de la fila de esquema. Cada escritura comprueba los permisos actuales dentro de la transacción; una revocación rechaza con 403 incluso formularios abiertos previamente. Cambiar delegaciones incrementa también la versión de esquema: formularios de personas abiertos con la versión anterior reciben 409 y deben recargar la configuración. Se elige esta regla conservadora para serializar campos y permisos sin una segunda fila de bloqueo. Dos ediciones concurrentes no se fusionan: la segunda debe recargar. El outbox registra `person_fields.updated` con actor y junta; no almacena valores de fichas ni el detalle de diferencias de permisos.

Después de revocar, un panel ya abierto puede permanecer visible hasta recargar; la API deniega el guardado inmediatamente. **Descartar cambios y recargar campos** obtiene el estado vigente y oculta el panel si ya no existe permiso. La delegación para filtros visibles es independiente.

## Filtrar personas

La lista permite combinar afiliación, zona, estado, género, tipo de documento, cargo, rol descriptivo y búsqueda con hasta tres campos adicionales. Todos deben coincidir. Cada valor adicional admite hasta 120 caracteres; la comparación predeterminada es exacta, sin comodines. Los campos de fecha también permiten **Entre dos fechas**, con Desde/Hasta obligatorios y extremos incluidos. Los números conservan su representación textual: `1` y `1.0` son distintos. Se pueden consultar campos y opciones inactivos para encontrar registros históricos. Los textos guardados de más de 120 caracteres no se pueden consultar mediante este filtro exacto.

«Más filtros de la ficha» usa los mismos valores base que Registro. Cargo consulta el catálogo de la junta activa, permite opciones inactivas y ofrece reintento si la carga del catálogo falla. La API acepta `document_type`, `gender`, `descriptive_role` y `position_code`; rechaza valores inválidos y códigos de cargo ajenos o desconocidos. Busca por identificador de cargo, conservando las etiquetas históricas de las fichas. Un filtro vacío no restringe resultados; las fichas sin ese dato no coinciden con un valor seleccionado. El rol descriptivo no consulta cuentas ni concede permisos.

Los criterios de consulta están disponibles a todos los roles con lectura de personas. La [selección de filtros visibles](FILTROS-VISIBLES.md) permite a SA/AD y roles expresamente delegados elegir cuáles muestra Lista. Es una preferencia común de interfaz, no una restricción de lectura de fichas.

Aplicar o limpiar filtros vuelve a la primera página. La paginación y el total usan los mismos criterios. La API recibe `custom_filters[0][field_id]=UUID` y `custom_filters[0][value]=valor`, con índices consecutivos de 0 a 2; rechaza campos ajenos a la junta, repetidos, opciones desconocidas y valores incompatibles con el tipo. El listado conserva sus columnas base y no expone notas ni valores adicionales.

Para un intervalo de fecha se añade `custom_filters[0][operator]=between` y `custom_filters[0][value_to]=YYYY-MM-DD`; `value` contiene la fecha inicial. La fecha final no puede ser anterior a la inicial. Solo se admite en campos adicionales de tipo fecha, incluso inactivos; no incluye fecha de nacimiento, fecha de registro ni rangos numéricos. Sin `operator`, o con `eq`, se conserva la coincidencia exacta y no se admite `value_to`. Son fechas de calendario sin hora: no se convierten a UTC. Los registros sin valor quedan fuera del intervalo. Los criterios y la paginación se resuelven en el servidor.
