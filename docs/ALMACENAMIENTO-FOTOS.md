# Almacenamiento privado de fotografías

**Ampliación para Inventario (23/09/2026).** El mismo motor atiende `/api/v1/assets/{id}/photos` y tres posiciones por bien: frontal, lateral y detalle. Archivos vuelve a comprobar en Inventario, mediante contexto firmado, la junta, el permiso y la existencia del bien en cada operación. Las fotos de bienes dados de baja conservan lectura y bloquean escritura. Personas y bienes comparten cuota, análisis ClamAV, retirada física y respaldo cifrado.

`PhotoStore` es el núcleo de la aplicación Laravel de Archivos. Usa MySQL/InnoDB y objetos PNG privados en disco, después de pasar por `ImageGate`. Está conectado al gateway y a la sección **Fotografías** del detalle de personas y bienes. No se publican enlaces anónimos a los objetos.

Desde **Lista → Ver persona**, administradores, superadministradores y registradores pueden agregar o reemplazar fotos de la persona, documento y predio. Los demás roles con acceso a la ficha pueden verlas y ampliarlas. El borrado requiere confirmación. Cada operación usa la versión de la fotografía: si otra pestaña la cambió, es necesario recargar antes de volver a guardar.

En **Nuevo registro**, **Guardar y añadir fotos** guarda primero la ficha y abre inmediatamente sus tres espacios de imágenes. **Terminar e ir a la lista** permite completar el recorrido con o sin fotos; **Guardar registro** conserva la salida directa a la lista. Si falla una carga, la ficha ya está guardada y se puede recargar/reintentar esa foto sin repetir el alta. No hay una transacción conjunta entre ficha y fotografías ni se mantienen archivos seleccionados al recargar la página. Tras recargar o salir, se continúa desde Lista → Ver persona.

El navegador envía las peticiones a `/api/v1/persons/{id}/photos` o `/api/v1/assets/{id}/photos`. El gateway resuelve la sesión vigente, comprueba los términos, aplica CSRF a los cambios y firma el contexto para Archivos. Nginx permite hasta 8 MiB de cuerpo solo en estas rutas de fotos; Archivos conserva su límite de 7 MiB para el JSON y 5 MiB para la imagen. La espera interna del gateway es de 75 segundos para Archivos, sin reintentar escrituras automáticamente; ante error o resultado sin confirmar, la interfaz exige recargar la fotografía.

## Operaciones del motor

### Servicio Laravel implementado

`services/files` ya contiene una aplicación Laravel ejecutable: configuración propia, migración MySQL versionada, proveedor que conecta `PhotoStore`, `RecordsPhotoAuthorizer` y ClamAV real, y cuatro operaciones HTTP internas. El contrato está en `contracts/files.openapi.json`, regenerable con `node tools/contracts-files.mjs`.

Las rutas `/internal/v1/persons/{id}/photos` y `/internal/v1/persons/{id}/photos/{slot}` exigen firma del gateway y contexto con junta, usuario, rol y sesión. El gateway valida esa sesión antes de invocarlas. Lectura permitida según `persons.read`, carga/borrado según `persons.write`, y existencia comprobada en Registros. El controlador no toma la autoridad del cuerpo del formulario.

La carga recibe `name`, `content` en base64 canónico y `version`; limita el cuerpo a 7 MiB y los bytes decodificados a 5 MiB. El procesamiento mantiene los límites de formatos y píxeles y los dos análisis antivirus. La lectura devuelve base64 PNG, versión y tipo, sin ruta ni hash interno. El borrado exige confirmación y versión. Todas las respuestas deshabilitan caché. Errores de recursos, versión, validación, dependencias y cuota se traducen a 404/409/422/503/507 sin exponer mensajes internos.

La imagen `docker/files.Dockerfile` instala GD y PDO MySQL dentro del contenedor y configura 256 MiB para PHP. No modifica el PHP global. `scripts/Test-FilesApi.ps1` construye y arranca una prueba aislada, migra dos veces y comprueba HTTP, dependencias y antivirus no disponibles. Usa MySQL temporal y claves de prueba, sin puertos, datos de usuarios ni volúmenes principales. Esa configuración no es la del futuro despliegue persistente.

El proveedor no tiene un antivirus ficticio ni un autorizador que permita todo. Los dobles existen únicamente en las pruebas de la API. El despliegue principal incorpora base persistente, volumen privado, actualización separada de firmas y planificador de limpieza/outbox. La comprobación de actualización debe tener menos de 48 horas; de lo contrario se rechazan las cargas. El respaldo manual cifrado incorpora los objetos de fotos; siguen pendientes conciliación de borrados históricos y validación integral del alta con dispositivos reales.

- Tres posiciones por persona y junta: persona, documento y predio. La clave compuesta impide asociaciones duplicadas; el nombre original nunca se usa como ruta.
- Alta y reemplazo con versión esperada. El listado devuelve presencia, versión, tamaño y dimensiones, sin rutas ni identificadores físicos del objeto.
- Lectura con comprobación de longitud y SHA-256. Un objeto ausente o alterado no se entrega; un reemplazo detectado durante la consulta produce conflicto.
- Eliminación con confirmación y versión. Se conserva una fila vacía con versión incrementada, para impedir que un formulario antiguo recree una foto borrada usando la versión inicial.
- Eventos mínimos `photo.created`, `photo.replaced` y `photo.deleted` en outbox, dentro de la misma transacción. No contienen bytes, nombres originales ni rutas. El planificador los envía a Auditoría.

El constructor exige un autorizador de recursos: debe confirmar explícitamente acceso vigente a la persona o bien y a su junta para leer o escribir. Se comprueba antes de procesar y antes de persistir; la lectura también vuelve a comprobarlo antes de entregar los bytes. En las pruebas es un doble controlado; en operación se consulta Registros o Inventario con contexto firmado y la sesión ya validada por el gateway. El código no debe exponerse por HTTP usando un autorizador que acepte todos los recursos.

## Cuota, reemplazos y limpieza

La cuota inicial del motor es 5 GiB (5 × 1024³ bytes), configurable al construirlo. La reserva por junta se bloquea en MySQL durante cada operación. Cuenta tanto objetos vigentes como objetos pendientes de retirar; reemplazar necesita espacio para que coexistan temporalmente el anterior y el nuevo.

Al reemplazar o eliminar se registra el objeto anterior en `file_garbage`. No se libera su cuota hasta que `collect` confirma la retirada física. Un fallo conserva la reserva y permite reintentar; el recolector rechaza rutas simbólicas, directorios y objetos que aún aparecen como vigentes. `collect` es una operación interna de mantenimiento, no un permiso de cliente.

El archivo nuevo se escribe con nombre aleatorio, permisos restrictivos, vaciado y sincronización antes del commit. Si falla la transacción, solo se intenta retirarlo después de comprobar que ninguna ficha lo referencia. Una desconexión con resultado de commit desconocido deja el objeto para conciliación: se prioriza no destruir un archivo que pudo quedar confirmado.

MySQL y el sistema de archivos no comparten una transacción distribuida. Sigue pendiente un conciliador de huérfanos después de interrupciones y errores de E/S, y automatizar las copias. El respaldo manual de base y objetos utiliza una pausa de los escritores de SRD, descrita en RESPALDOS.md. La cuota representa objetos registrados, no mide todos los bytes físicos del volumen ante esas situaciones excepcionales. Las ACL de Windows, el cifrado de objetos y la resistencia a fallos de energía no están validados por estas pruebas.

## Verificación reproducible

Ejecuta `./scripts/Test-PhotoStorage.ps1`. Construye primero PHP/GD desde la receta fijada en `file-safety.Dockerfile` y después añade PDO MySQL y soporte de procesos para las carreras de prueba. No instala extensiones ni cambia PHP globalmente.

Usa un proyecto Compose separado, una red sin salida ni puertos publicados y MySQL con almacenamiento temporal en memoria. La base `srd_files_probe` contiene solo datos sintéticos y se descarta al retirar el contenedor. No usa las credenciales ni las bases del proyecto principal. Las fotos temporales se crean bajo un directorio aleatorio de `.local/photo-storage` y se retiran al terminar.

Las pruebas de almacenamiento usan un doble de antivirus; la evidencia de ClamAV real sigue en `Test-FileSafety.ps1`. Se verifican permisos simulados, aislamiento de consultas, cuotas, historial de versiones, corrupción, rollback, limpieza y dos carreras con procesos y conexiones MySQL independientes: misma foto y espacio suficiente para una sola carga. Resultados en `.local/photo-storage/results.json` y límites en VALIDACION.md.

## Siguiente integración

Ya existe `POST /internal/v1/persons/{id}/photo-access` en Registros y el adaptador `RecordsPhotoAuthorizer`, inyectable en `PhotoStore` mediante `Closure::fromCallable`. Solo admite al emisor firmado `files` y las acciones `persons.read` y `persons.write`. Ese emisor no puede utilizar las demás rutas internas. La respuesta contiene únicamente `authorized: true` y metadatos de correlación, sin campos ni notas y con caché deshabilitada.

La junta y el rol proceden del contexto firmado. La existencia se consulta en cada llamada: una persona borrada o de otra junta produce 404. El adaptador exige el booleano `true`, convierte 403/404 en denegación y propaga fallos de comunicación o autenticación. Esta consulta no valida sesiones por sí sola: el gateway resuelve la sesión vigente antes de llamar a Archivos, que consulta a Registros. El borrado concurrente se resuelve con la orden durable y la marca terminal de Archivos descritas en ELIMINACION-FOTOS.md.

1. Gateway y fichas conectados, con sesión, CSRF, límites de carga y esperas específicas. La interfaz incluye carga, lectura privada, ampliación, reemplazo y eliminación confirmada; exige recargar tras un conflicto.
2. Las nuevas eliminaciones de personas generan órdenes durables y limpieza programada; ver ELIMINACION-FOTOS.md. Falta conciliar borrados históricos y objetos huérfanos.
3. El respaldo/restauración aislada de fotografías está implementado; falta automatización y recuperación operativa. La orientación EXIF se corrige en nuevas cargas JPEG; el alta tiene un paso opcional de fotografías después de guardar la ficha. Faltan otros formatos de orientación y pruebas con dispositivos reales. La evidencia del recorrido de navegador se registra en VALIDACION.md.

La migración ya está aplicada en `srd_files` del entorno principal. El esquema también se conserva para pruebas aisladas del motor. Esto no declara terminado RF-020 ni RF-039.
