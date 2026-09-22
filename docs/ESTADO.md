# Estado de SRD

Actualizado: 21/09/2026. Incremento 0.1 funcional; el proyecto completo continúa en desarrollo.

Último paso de integración: Archivos incorporado a Compose con base y credenciales propias, volumen privado, antivirus local, actualizador separado de firmas y planificador de limpieza/auditoría. Inicialización repetible sin rotar claves existentes y aislamiento de las seis bases comprobados. Gateway y fichas ya conectados: carga, lectura privada, ampliación, reemplazo y eliminación. La verificación final de navegador se registra en VALIDACION.md.

El motor de fotografías conserva cuota por junta, versiones, reemplazo, borrado, retirada de objetos y eventos outbox. Sus 17 casos MySQL pasaron tras añadir la limpieza de personas eliminadas, incluida una carrera de carga y borrado. ALMACENAMIENTO-FOTOS.md detalla el servicio, las pruebas aisladas y las tareas de integración pendientes.

La limpieza de fotos de nuevas personas eliminadas ya tiene órdenes durables, reintentos y protección frente a cargas concurrentes. Ver ELIMINACION-FOTOS.md; no incluye conciliación histórica. El respaldo manual local ahora incorpora fotografías con pausa de escritores y restauración aislada de objetos.

## Trabajo conservado

- Intervalos inclusivos para campos adicionales de fecha en Lista, combinados con los demás criterios: Registros 34/789, compilación TypeScript/Vite y recorrido Chromium/MySQL aprobados. Desplegado localmente; panel revisado en escritorio y móvil. Semántica y límites en CAMPOS-ADICIONALES.md y VALIDACION.md.

- Concurrencia del catálogo de cargos comprobada en MySQL: cinco escenarios con procesos independientes, incluidos conflicto entre ediciones, rechazo de alta/edición antiguas y conservación histórica cuando la persona se guarda primero. Datos sintéticos y eventos limpiados con verificación; scripts y límites en CARGOS.md y VALIDACION.md. No requirió cambios en producción.

- Política de accesos rápidos corregida según CA-RF-047: solo SA cambia común/personal; AD mantiene funciones y etiquetas comunes. Configuración 14/169, compilación y recorrido Chromium/MySQL con tres roles aprobados. Panel del administrador revisado en escritorio y móvil. No requiere migraciones ni cambia preferencias guardadas. Evidencia en VALIDACION.md.

- Delegación de edición de campos adicionales por rol dentro de la junta: Registros 33/761 aprobado, respaldo previo autenticado, migración aplicada y tres regresiones de concurrencia MySQL aprobadas. Recorrido con administrador y consultor aprobado (34,4 segundos), incluida revocación sobre formulario abierto y uso del campo creado en Registro. Panel revisado en escritorio y móvil; detalle en CAMPOS-ADICIONALES.md y VALIDACION.md.

- Selección de filtros visibles comunes por junta y delegación de su edición a roles concretos: Registros 31/688 y Gateway 8/70 aprobados, migración aplicada, respaldo previo autenticado y recorrido final de navegador aprobado (29,5 segundos). Panel revisado en escritorio y móvil; revocación comprobada sobre un formulario abierto. Semántica y límites en FILTROS-VISIBLES.md.

- Filtros de personas ampliados: género, tipo de documento, cargo y rol descriptivo combinables con criterios existentes. El cargo se valida contra el catálogo de la junta y admite entradas inactivas para búsquedas históricas. Paginación y limpieza compartidas; configuración de filtros visibles descrita en FILTROS-VISIBLES.md. Evidencia en VALIDACION.md.

- Alta con fotografías: «Guardar y añadir fotos» guarda la persona y abre un paso opcional con las tres posiciones de imágenes. «Guardar registro» conserva el regreso directo a la lista. Un fallo de carga mantiene la persona guardada y permite recargar y reintentar sin repetir el alta. No es una transacción única entre persona e imágenes; al recargar la página se retoma desde el detalle. Evidencia de navegador en VALIDACION.md.

- Orientación JPEG: nuevas cargas y reemplazos corrigen EXIF 1–8 (giros y reflejos) antes de retirar metadatos. Pasaron 32 casos de procesamiento con antivirus simulado y una integración con ClamAV real en las tres posiciones, dimensiones corregidas y limpieza completa. No se alteraron fotos existentes. Cámaras físicas y orientación de otros formatos pendientes; detalle en ARCHIVOS-PRIVADOS.md y VALIDACION.md.

- Respaldo con fotografías: formato cifrado nuevo y compatibilidad con copias anteriores. El simulacro del 19/09 recuperó seis bases, 34 tablas y una imagen sintética; verificó 13 claves foráneas, hash y cuotas. Pasaron 17 pruebas Node y el rechazo de una exportación inválida con reanudación de servicios. Copia manual con pausa temporal; automatización y recuperación operativa pendientes. Ver RESPALDOS.md y VALIDACION.md.

- Limpieza de fotos al borrar una persona: implementada y comprobada el 19/09 con planificadores reales, ClamAV, retirada física, cuota cero y auditoría. La cola conserva y reintenta órdenes ante fallos; la marca terminal impide recrear fotos mediante una carga concurrente. Se aplica a nuevas eliminaciones; detalle y límites en ELIMINACION-FOTOS.md.

- Fotografías: recorrido final Chromium/SMTP/MySQL aprobado el 18/09 (2,5 minutos), incluyendo ClamAV real, tres posiciones, ampliación, conflicto entre pestañas, consultor sin escritura, CSRF, borrado persistente y móvil. Capturas de escritorio y 360 px revisadas. Gateway repetido: 7 pruebas/66 aserciones. Evidencia e intentos previos en VALIDACION.md.

- Integración de fotos en curso: consulta mínima firmada a Registros, API de Archivos desplegada internamente y publicación de eventos propios a Auditoría. El servicio no puede consultar datos completos de fichas ni leer Auditoría con su emisor. Las fichas guardadas incluyen las tres posiciones de fotografías.

- Fuentes y trazabilidad: 56 RF, 18 RNF y 20 CU en TRAZABILIDAD.md y requirements.json. No se reutilizaron datos del ZIP escolar.
- Seis aplicaciones Laravel independientes: gateway, identity, configuration, records, audit y files. React web conectado a la API existente; bases y credenciales MySQL separadas. Las rutas públicas de fotografías exigen sesión vigente y CSRF para cambios.
- Login, términos versionados, código SMTP, recuperación, sesiones y cambio autorizado de junta.
- Perfil básico, tema persistente, cambio de correo con contraseña/código, revocación de otras sesiones y aviso durable al correo anterior.
- Invitaciones privadas y administración de membresías implementadas; pruebas backend y recorrido de navegador con el planificador de Compose aprobados.
- Administración de juntas por interfaz de superadministrador: alta con términos, listado paginado, activación/suspensión e invitación de administrador. Detalle en ADMINISTRACION-JUNTAS.md.
- Accesos rápidos: configuración común o personal por junta, hasta tres funciones autorizadas, etiquetas, herencia y control de versiones. Detalle en ACCESOS-RAPIDOS.md.
- Personas: registro base, consulta, listado paginado, edición con versión, notas restringidas, borrado confirmado e indicadores reales. Capas de HTTP, validación, caso de uso y consulta por junta separadas.
- Outbox transaccional, auditoría con deduplicación y cuatro planificadores. Imágenes fijadas por digest y archivos de bloqueo.
- Publicador de auditoría con comprobación de espera/agotamiento bajo bloqueo y confirmación positiva. Consulta de entregas por junta en Auditoría y contadores por CLI. Tres escenarios de concurrencia MySQL aprobados; detalles en OUTBOX.md.
- Consulta de auditoría con filtros combinables por fecha UTC, actor, módulo, acción y resultado, páginas de 10/25/50 y detalle de eventos. Exportación pendiente; instrucciones en AUDITORIA.md.
- Campos adicionales de personas desde Configuración: texto, fecha, decimal y selección; orden, obligatoriedad, desactivación, etiquetas históricas y versiones. Integrados en captura, edición, detalle y hasta tres filtros combinados, exactos o por intervalo para fechas; edición delegable por rol. Detalle en CAMPOS-ADICIONALES.md; catálogo de cargos disponible en CARGOS.md; otros catálogos base pendientes.
- README, contratos OpenAPI y scripts PowerShell para arranque, pruebas y paquete. Distribución: dist/SRD-0.1-source.zip mediante scripts/Package.ps1.

## Evidencia vigente

- Fotografías internas aprobadas con ClamAV real: tres posiciones, reemplazo, conflicto, aislamiento y borrado. Evidencia anterior de siete eventos en `.local/files-live-before-person-deletion.json`; la nueva prueba de limpieza por borrado de persona entrega cinco eventos y está en `.local/files-live-results.json`. Datos e imágenes sintéticos; las rutas públicas y el navegador tienen evidencia separada.

- Evidencia del despliegue inicial de Archivos (14/09): seis bases aisladas (seis accesos propios y treinta cruzados denegados), firmas actualizadas, cuatro planificadores y arranque repetible. Entonces pasaron 83 pruebas/1.041 aserciones y el simulacro SQL de 32 tablas, 1.688 filas y doce claves foráneas, sin objetos. Los resultados posteriores, incluido el respaldo con imágenes, se describen al inicio de este documento y en VALIDACION.md.

- API de Archivos: siete pruebas/67 aserciones aprobadas; consulta de autorización en Registros: siete/74 en regresión dirigida; motor MySQL: 15 casos aprobados nuevamente. Prueba Docker aislada aprobada con migraciones repetibles, respuestas HTTP de rechazo y antivirus desconectado sin persistencia de cuarentena. No constituye un recorrido de carga en navegador. Detalles y fallos corregidos en VALIDACION.md.

- Autorización de fotos: Registros aprobado con 25 pruebas y 372 aserciones, incluidas siete pruebas nuevas de permisos, aislamiento, datos mínimos y comunicación firmada. Informe `.local/records-photo-authorization.xml`. No equivale a fotografías integradas.

- Almacenamiento de fotos: 15 casos aprobados en MySQL 8.4.11, incluidas dos carreras entre procesos, corrupción, rollback, limpieza y cuota. Informe .local/photo-storage/results.json. El antivirus y el autorizador son dobles controlados en esta prueba; ClamAV real conserva su evidencia separada. No se han integrado aún las fichas ni cambiado las bases principales.

- Archivos: 17 casos específicos aprobados en contenedor PHP/GD, incluidos dos con ClamAV 1.4.6 real; informe .local/file-safety/results.json. No se suman a las suites PHPUnit anteriores ni equivalen a fotos integradas. Pruebas fallidas previas y límites documentados en VALIDACION.md.

- Cargos configurables: Registros 18/298 aprobado, migración aplicada y respaldo previo cifrado autenticado. Recorrido Chromium/MySQL final aprobado (26,0 segundos), con catálogo persistente, ficha, conflicto entre pestañas, historia, permisos, CSRF y móvil. Informe actual .local/browser-results.json; detalles en CARGOS.md y VALIDACION.md.

- Contactos automáticos: recorrido con dos cuentas aprobado en Chromium/MySQL (59,3 segundos), incluidos sondeo de estado, recuperación de error, detención ante 401 y móvil. Informe conservado .local/browser-contacts-auto-baseline.json. Identidad 26/313 y gateway 6/61 aprobados; la consulta pasiva conserva el vencimiento por inactividad. Detalle en VALIDACION.md.

- Indicadores: suite Registros aprobada con 16 pruebas/256 aserciones y recorrido Chromium/MySQL aprobado (31,5 segundos), incluidos alta, borrado, reintento y móvil. Informe conservado .local/browser-dashboard-baseline.json. Compilación y contenedores actualizados.

- Respaldos: siete pruebas Node del cifrado aprobadas; copia real cifrada y autenticada, clave conservada al repetir y simulacro aislado aprobado con cinco bases, 26 tablas, 1.526 filas y diez claves foráneas. Copia alterada rechazada antes de crear contenedor. Registro privado en .local/backups/operations.jsonl; límites en VALIDACION.md.

- Búsqueda conjunta: recorrido dirigido aprobado como consultor sobre Chromium/MySQL (39,6 segundos), con paginación, notas protegidas, reintento independiente y móvil. Informe conservado .local/browser-global-search-baseline.json.

- Contactos: recorrido dirigido aprobado con dos cuentas en Chromium/MySQL; búsqueda, privacidad de Invisible, actualización de estados, logout y vista móvil. Repetición final: 21,1 segundos. Informe conservado .local/browser-contacts-baseline.json.

- Presencia: recorrido dirigido aprobado en Chromium/MySQL (24,8 segundos), CSRF, preferencias, reconexión, logout y móvil. Informe conservado .local/browser-presence-baseline.json; detalle en VALIDACION.md.

- Últimas suites: Registros 34 pruebas/789 aserciones; Identidad 26/313, Gateway 8/70, Configuración 14/169, Auditoría 5/70 y Archivos 9/83. Las seis suites suman 96 pruebas y 1.494 aserciones aprobadas en sus últimas ejecuciones, no en una única ejecución conjunta. El 21/09 se repitió Registros por los intervalos de fecha; las anteriores ejecuciones y los recorridos dirigidos figuran en VALIDACION.md.
- Migración de campos adicionales aplicada en MySQL. Tres escenarios de concurrencia real aprobados: configuración/configuración con y sin fila previa, y configuración/formulario antiguo. Scripts y límites en CAMPOS-ADICIONALES.md.
- Migraciones MySQL aplicadas. Cinco accesos a base propia permitidos y veinte accesos cruzados denegados.
- Campos adicionales probados de principio a fin en Chromium, SMTP y MySQL: configuración, captura, conflicto entre pestañas, desactivación, historia, permisos, borrado y móvil. La repetición sobre la imagen final pasó (37,6 segundos); informe conservado en .local/browser-before-person-filters.json.
- El ejecutor de navegador aísla cuentas y juntas por archivo. Cinco casos pasaron en la batería aislada; la prueba de plataforma se corrigió para recorrer la paginación y pasó después en una ejecución dirigida. Informes originales y repeticiones conservados; detalle en VALIDACION.md.
- Cinco pruebas Chromium/SMTP/MySQL pasaron el 10/09: acceso, CRUD, aislamiento, CSRF, tema, móvil, logout, invitaciones, auditoría, administración de juntas y accesos rápidos. Informe conservado en .local/browser-suite-baseline.json. Tras la ampliación de auditoría pasó otra ejecución focalizada de invitaciones, entrega real y panel de estado en escritorio/móvil, con rechazo de acceso del consultor; informe .local/browser-outbox-baseline.json. Cada ejecución usa juntas y cuentas sintéticas propias, separadas de las cuentas de demostración.
- Arranque repetible Up.ps1 -SkipBuild verificado sin cambiar credenciales ni reaplicar migraciones. El 10/09 se volvió a iniciar el entorno tras encontrar los contenedores detenidos.
- Detalle y límites en VALIDACION.md. No equivale a aceptación de todos los requisitos.
- Tras añadir filtros y detalle de auditoría, volvió a pasar el recorrido focalizado en Chromium/SMTP/MySQL (1,6 minutos), incluidos errores de validación, limpieza, detalle, filtros combinados y móvil. Informe conservado en .local/browser-audit-filters-baseline.json; la ejecución previa del panel de entregas se conserva en .local/browser-outbox-baseline.json.

## Cómo revisar este incremento

Abre http://localhost:8080/j/srd-e2e-a/login. Cuenta sintética: admin@srd-e2e.test; contraseña aleatoria en .local/e2e-fixture.json. Código en http://localhost:8025. Si está detenido, ejecuta scripts/Up.ps1; instrucciones completas en README.md.

## Siguiente trabajo

1. Completar el acceso de plataforma independiente de una junta, la supervisión global y la revocación definitiva de sesiones al suspender, si así se define en la aceptación funcional.
2. Completar los catálogos base restantes y las delegaciones de otros módulos. La edición de campos adicionales, la selección común de filtros visibles y sus delegaciones independientes por rol están implementadas. Hay intervalos para campos adicionales de fecha; quedan otros rangos y consultas guardadas. Las fotos JPEG/PNG/WebP de hasta 5 MB tienen análisis previo, carga desde el alta y el detalle, respaldo manual y limpieza persistente para nuevas eliminaciones. Faltan logo y conciliación de borrados históricos.
3. Implementar los dominios restantes por incrementos verificables y los clientes React Native Android/Electron Windows según la trazabilidad.
4. Completar auditoría, supervisión de trabajos, concurrencia InnoDB, navegadores, accesibilidad, carga y recuperación operativa antes de cualquier piloto. El respaldo y simulacro manual local ya existen; faltan programación diaria, retención, almacenamiento externo, futuros archivos distintos de fotos, permisos de restauración y supresiones posteriores a las copias.

También siguen pendientes calendario, tesorería, inventario, archivos, PDF/XLSX, chat/audio/llamadas, notificaciones y privacidad integral. La base de presencia, el indicador propio y el directorio con actualización automática y manual están implementados; No molestar aún no tiene avisos a los que aplicarse. No hay APK ni instalador Windows. No se declara terminado un requisito por tener una carpeta o un contrato.

## Continuidad y alcance

No hay repositorio Git inicializado. Revisar archivos y evidencia antes de generar código. tools/scaffold.mjs, tools/migrations.mjs, tools/test-config.mjs y tools/refactor-records-once.mjs son generadores históricos, no procedimientos de actualización. No ejecutarlos sobre trabajo existente.

Todo el trabajo está dentro de SRD. No se modificaron configuraciones globales ni otros proyectos, no se publicó al exterior ni se enviaron correos reales. Secretos y datos temporales en .env y .local; se excluyen del ZIP junto con docs/sources, dependencias y cachés. database/ se inspiró únicamente en nombres de carpetas del ZIP guía.
