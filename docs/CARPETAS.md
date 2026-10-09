# Carpetas internas

La pantalla **Acceso a Carpeta** de Configuración presenta en ES/EN la explicación, roles, búsqueda de miembros, selección individual, vigencia, paginación, acciones y resultado de guardado. Chromium verificó con una junta sintética la concesión y revocación por rol y por persona, persistencia tras recargar y ancho de 360 px. La pantalla principal de Carpeta también tiene rótulos ES/EN y permite guardar `name` (español) y `name_en` (inglés) al crear o renombrar. La migración aditiva `2026_10_08_000001_add_folder_name_en.php` conserva las carpetas antiguas y los clientes que solo envían `name`; cuando falta `name_en`, la interfaz inglesa muestra el nombre original. El listado, las migas de pan, el selector de destino y las rutas de búsqueda de archivos usan el nombre inglés cuando existe. Las vistas de archivos privados presentan en ES/EN la carga, el listado, la cuota, las acciones, las vistas previas, el movimiento, el renombrado, la eliminación y los estados vacíos. Los nombres de archivos escritos por personas se muestran tal como se guardaron.

Incrementos de RF-038: creación, navegación, cambio de nombre, movimiento y eliminación de carpetas vacías desde el menú **Carpeta**. Superadministrador y Administrador gestionan carpetas en su junta. Pueden conceder lectura por rol a Registrador, Tesorero, Auditor y Consultor o individualmente a hasta 20 membresías activas de la junta; sin concesión, ninguno de esos roles accede. La concesión permite navegar, listar, previsualizar y descargar archivos, pero no crear, cargar, renombrar, mover ni eliminar.

La web consume exclusivamente el gateway. El servicio Archivos exige firma interna emitida por el gateway y contexto válido de junta, usuario, sesión y rol. La persistencia está en `srd_files.internal_folders`, sin consultas a bases de otros servicios. El padre se resuelve dentro de la junta autorizada; los identificadores de otra junta no permiten listar, crear hijos ni renombrar.

La ampliación ES/EN pasó 32 pruebas PHP de Archivos (778 aserciones), compilación web e imágenes Docker. La migración MySQL se aplicó con éxito. Chromium aprobó `folder-language.spec.mjs` con alta ES/EN, perfil, recarga, rótulos ingleses de archivos y 360 px; también aprobó `folders.spec.mjs` con auditoría, movimiento, versiones y paginación. El primer intento se había aplazado por memoria; la validación integrada se completó después con servicios mínimos y todos quedaron detenidos al terminar.

El selector de archivos muestra texto ES/EN propio del sistema en lugar del idioma nativo del navegador. El input de tipo `file` sigue asociado a su etiqueta y se puede enfocar con teclado; la última prueba Chromium verificó ambos idiomas y una captura móvil de viewport. La vista previa y las operaciones continúan autorizándose en el servidor al solicitarlas.

## Reglas

La configuración **Acceso a Carpeta** está en **Configuración**, es propia de cada junta y empieza vacía. SA/AD pueden conceder o revocar conjuntamente los roles RE/TE/AU/CO y hasta 20 membresías individuales; guardan con versión y un cambio concurrente devuelve 409. La lista individual se busca por nombre o correo entre miembros activos de esta junta, y el servidor de Identidad valida cada ID antes de guardar. La concesión guarda la versión de la membresía: si esta cambia, la lectura individual caduca, incluso si después se reactiva la cuenta; hay que retirar y volver a conceder ese acceso. El servidor vuelve a comprobar el permiso en cada listado, vista previa y descarga, de modo que una revocación impide nuevas lecturas aunque la pestaña muestre contenido anterior. La vista de los lectores oculta todos los controles de escritura, y la API también rechaza sus intentos directos. Cada cambio efectivo genera `folder.access_updated` en outbox sin nombres ni contenido de archivos. `GET/PUT /api/v1/folder-access` expone esta configuración por el gateway; solo SA/AD reciben las listas configuradas y pueden modificarlas. Migraciones aditivas: `2026_09_27_000005_create_folder_access.php` y `2026_09_28_000006_add_folder_reader_memberships.php`.

- Carpeta raíz virtual, ruta de navegación y listados de 25 elementos. La consulta incluye conteo de todos los hijos y solo devuelve la página solicitada.
- Nombre de hasta 120 caracteres, sin barras, controles ni nombres `.`/`..`; se recortan espacios extremos. Nombres hermanos únicos mediante hash de la forma en minúsculas. No se unifican formas Unicode compuestas/descompuestas en este incremento.
- Hasta 20 niveles y 10.000 carpetas por junta. Son límites técnicos iniciales, no criterios de capacidad aprobados.
- Creación con UUID generado por el cliente. Un reintento del mismo usuario, ID, padre y nombre devuelve la carpeta existente sin duplicar auditoría. Reutilizar ese ID con otro contenido produce conflicto. No hay creación automática tras pérdida de conexión.
- Renombrar exige la versión leída: una versión obsoleta produce 409. El nombre duplicado también produce 409 y la transacción conserva los datos anteriores.
- Mover exige versión y destino explícito (carpeta de la junta o Inicio). El selector de destino navega y pagina en el servidor. El backend rechaza mover dentro de la propia carpeta o de sus descendientes, nombres hermanos duplicados y ubicaciones que hagan superar 20 niveles a cualquier descendiente. Conserva ID, creador, nombre y referencias de las subcarpetas; actualiza únicamente padre, versión y fecha de la carpeta movida. Un destino idéntico no cambia versión ni genera evento. Si aparece un conflicto de versión, cancela el movimiento y actualiza Carpetas antes de volver a elegir.
- Si mover vacía la última página, el listado vuelve automáticamente a la última página válida. El selector aplica el mismo ajuste cuando otro usuario cambia los destinos disponibles.
- Escape cierra el selector antes de confirmar. Durante una operación pendiente se conserva abierto hasta conocer el resultado; no se presenta el cierre del diálogo como cancelación de una escritura enviada al servidor. El componente Modal delega el cierre en `onClose`, evitando que el navegador lo cierre por su cuenta y omita las restricciones del formulario.
- Las escrituras bloquean la fila de cuota propia de la junta para serializar cambios de jerarquía; no consumen bytes de fotografías ni modifican sus metadatos.
- Creación, cambio de nombre y movimiento generan `folder.created` / `folder.renamed` / `folder.moved` en outbox dentro de la misma transacción. El planificador existente entrega esos eventos a Auditoría. No se registra el nombre de carpeta en el evento.

## API

Gateway: `GET /api/v1/folders?parent_id=<uuid>&page=1`, `POST /api/v1/folders`, `PATCH /api/v1/folders/{id}`, `POST /api/v1/folders/{id}/move` con `{parent_id, version}` y `DELETE /api/v1/folders/{id}` con `{version, confirm:true}`. Internamente conserva estas rutas con prefijo `/internal/v1` en Archivos. Contrato en `contracts/files.openapi.json`.

Migración aditiva `2026_09_27_000001_create_internal_folders.php`, incorporada al procedimiento habitual `scripts/Up.ps1`. No reemplaza ni borra las tablas existentes.

## Eliminar carpetas vacías

**Eliminar** pide confirmación explícita y ofrece **Cancelar eliminación** y **Sí, eliminar**. Solo SA/AD pueden eliminar una carpeta propia con la versión vigente. Inicio es virtual y no se elimina. La operación retira únicamente la fila de una carpeta vacía; no elimina documentos ni realiza borrado recursivo y no se puede deshacer desde la aplicación.

Dentro del bloqueo exclusivo de cuota se comprueban versión, subcarpetas y documentos. Cualquier documento, incluido uno aún incompleto, impide el borrado. Creación y movimiento de hijos/documentos comparten ese bloqueo: deben confirmar un padre vigente o impedir la eliminación al ocuparlo. La cuota y los objetos privados permanecen intactos. `folder.deleted` conserva en Auditoría el identificador de la carpeta y actor, sin registrar el nombre.

La interfaz no permite confirmar sin marcar la casilla. Escape y Cancelar cierran antes de enviar; durante una operación pendiente permanecen bloqueados hasta conocer el resultado. Un conflicto, carpeta inexistente o contenido existente permite **Actualizar carpetas y cerrar** para revisar el estado actual; no elimina automáticamente tras recargar. Si desaparece el único elemento de la última página, el listado vuelve a una página válida. Repetir el DELETE de una carpeta eliminada devuelve 404 sin otro evento.

No hay papelera ni limpieza de carpetas con contenido, documentos o recursos vinculados. Las futuras integraciones con comprobantes/chat deben incorporar sus restricciones antes de permitir eliminar recursos vinculados.

## Pendientes

Otros formatos de audio y vista previa de PDF, además de representación fiel de DOCX/XLSX; eliminación de carpetas con contenido y protección de recursos vinculados; delegación de escritura y permisos por usuario; validación integral de cuotas; integración con comprobantes y chat. Carpeta ya admite imágenes JPEG/PNG/WebP privadas, convertidas a PNG tras análisis y visibles bajo demanda, además de DOCX/XLSX, PDF de solo descarga y WAV PCM con reproducción privada; Office tiene extractos privados y limitados de texto DOCX y de una de las primeras 32 hojas XLSX. Ver [DOCUMENTOS-PRIVADOS.md](DOCUMENTOS-PRIVADOS.md). No se declara terminado RF-038 ni el explorador completo. Las fotos privadas de personas y bienes siguen siendo un recorrido independiente. La altura de la rama se calcula sobre un árbol acotado a 10.000 carpetas dentro del bloqueo de la junta; la carga máxima y los demás escenarios de concurrencia entre procesos InnoDB requieren validación específica.

Pruebas y límites de validación en `VALIDACION.md`.

El bloqueo de la cuota conserva los bytes y evita la conversión de bloqueos compartidos de `INSERT IGNORE` a exclusivos. La prueba MySQL independiente de renombrado simultáneo de carpeta/documento confirma ambos cambios sin interbloqueo. Los demás escenarios de concurrencia de jerarquía y la carga máxima siguen pendientes.

La carga, descarga privada, cambio de nombre y movimiento de DOCX/XLSX están disponibles en cada ubicación. Ver [DOCUMENTOS-PRIVADOS.md](DOCUMENTOS-PRIVADOS.md). Mover una carpeta conserva las referencias de sus documentos.
