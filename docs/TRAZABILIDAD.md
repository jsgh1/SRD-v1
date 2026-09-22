# Trazabilidad de SRD

Se verificaron 56 RF (RF-001–056), 18 RNF (RNF-001–018) y 20 CU (CU-01–20). Ningún RF se declara terminado mientras falten sus criterios completos y la integración MySQL.

| Requisito | Caso / interfaz | Estado | Implementación y pendientes |
|---|---|---|---|
| RF-001 · Crear y administrar juntas | CU-01 / UI-11 | Parcial | Alta con términos, listado paginado, activación/suspensión e invitación de administrador por UI de plataforma. Acceso exclusivo SA, versiones y auditoría; validación integral pendiente. |
| RF-002 · Administrar cuentas internas | CU-01 / UI-11 | Parcial | Bootstrap, invitación privada 24 h/uso único, vinculación de cuentas existentes, roles/activación por junta y revocación de sesiones. Pruebas backend; validación integral pendiente. |
| RF-003 · Iniciar sesión y aceptar términos | CU-02 / UI-01 | Parcial | Login con términos, cookie de sesión y CSRF; prueba SMTP/Chromium. |
| RF-004 · Verificar el acceso por correo | CU-02 / UI-02 | Parcial | Código HMAC de cinco minutos, cinco intentos, consumo único; probado con SQLite y SMTP. |
| RF-005 · Reenviar códigos de verificación | CU-02 / UI-02 | Parcial | Espera de 60 s, cinco envíos/hora, invalida código previo; probado. |
| RF-006 · Recuperar contraseña | CU-03 / UI-01 | Parcial | Enlace de recuperación con fragmento efímero, 15 min, contraseña y revocación; pruebas backend. |
| RF-007 · Seleccionar junta y aplicar permisos | CU-01 / UI-03 | Parcial | Contexto firmado, membresía vigente, junta y términos; pruebas cruzadas. Selector por código. |
| RF-008 · Cerrar y revocar sesiones | CU-03 / UI-11 | Parcial | Logout, revocar otras sesiones, 30 min inactividad/8 h; pruebas backend. |
| RF-009 · Editar perfil y preferencias | CU-04 / UI-11 | Parcial | Nombre/tema/preferencia persistentes y copia de correo. Fotografías pendientes. |
| RF-010 · Confirmar cambio de correo | CU-04 / UI-11 | Parcial | Cambio con contraseña y código al nuevo correo, revocación de otras sesiones y aviso durable al correo anterior; pruebas backend. Validación multidispositivo pendiente. |
| RF-011 · Gestionar presencia | CU-15 / UI-10 | Parcial | Preferencia persistente, latidos cada 30 segundos sin renovar inactividad, agregación de sesiones válidas y vencimiento a los 90 segundos; Invisible se representa como Desconectado. Indicador propio y contactos con actualización automática visible y manual sin prolongar sesión; chat y avisos No molestar pendientes. |
| RF-012 · Mostrar navegación e identidad de la junta | CU-05 / UI-03 | Parcial | Shell responsive y menú de módulos disponibles. Búsqueda global, campana y logo pendientes. |
| RF-013 · Configurar tres accesos rápidos | CU-05 / UI-03 | Parcial | Hasta tres accesos configurables por SA/AD con etiquetas, catálogo autorizado, herencia, persistencia y versiones. Solo SA cambia la política común/personal; AD conserva edición de accesos comunes. Delegación granular pendiente. |
| RF-014 · Consultar indicadores y últimos registros | CU-05 / UI-03 | Parcial | Conteos, últimas fichas, barras y circulares con actualización manual y fecha del servidor. Probados medianoche colombiana, lunes, cambio de mes y borrado. Pendientes carga y concurrencia integral. |
| RF-015 · Buscar información autorizada | CU-05 / UI-03 | Parcial | Búsqueda conjunta de personas y contactos desde el encabezado, resultados separados, paginación y errores independientes; detalle autorizado y exclusión de notas. Otros dominios y recursos pendientes. |
| RF-016 · Crear registro de persona | CU-06 / UI-04 | Parcial | Ficha base con junta, autor, documento único, nota y campos adicionales tipados. Opción Guardar y añadir fotos: ficha persistida antes de las cargas, sin repetir el alta si una foto falla. Validación integral pendiente. |
| RF-017 · Guardar pendientes y completar registros | CU-06 / UI-04 | Parcial | Validación Pendiente/Completado de campos base y obligatoriedad de campos adicionales activos. |
| RF-018 · Validar campos y ubicación condicional | CU-06 / UI-04 | Parcial | Validaciones y ubicación condicional. Cargo validado contra catálogo versionado por junta; otros catálogos configurables pendientes. |
| RF-019 · Administrar campos y catálogos dinámicos | CU-17 / UI-11 | Parcial | Campos adicionales tipados, versiones e historia; edición delegable por SA/AD a roles de la junta, con revocación bajo bloqueo. Catálogo de cargos configurable por SA/AD y etiquetas históricas. Otros catálogos base y validación integral pendientes. |
| RF-020 · Adjuntar fotos al registro | CU-06 / UI-05 | Parcial | Fotos de persona, documento y predio desde el detalle o el paso opcional Guardar y añadir fotos del alta: carga, lectura privada, ampliación, reemplazo, borrado confirmado y versiones, con gateway autenticado y ClamAV. Nuevas eliminaciones con limpieza persistente. Orientación EXIF 1–8 en JPEG. La ficha se guarda antes de subir imágenes; otros formatos de orientación, dispositivos y validación integral pendientes. |
| RF-021 · Listar, filtrar y paginar registros | CU-07 / UI-05 | Parcial | Filtros base y hasta tres criterios adicionales: coincidencia exacta o intervalo inclusivo para fechas, paginación 10/25/50 y limpieza. Selección visible común por junta con versiones y delegación por rol. No altera permisos de lectura. Otros rangos, consultas guardadas y validación integral pendientes. |
| RF-022 · Consultar detalle y proteger notas | CU-07 / UI-05 | Parcial | Consulta exacta y detalle sin nota para roles excluidos. Fotografías privadas y ampliación desde el detalle, con permisos por junta. Validación integral pendiente. |
| RF-023 · Editar registros con control de concurrencia | CU-08 / UI-04 | Parcial | Edición con versión y conflicto 409; probado. |
| RF-024 · Eliminar un registro con confirmación | CU-08 / UI-05 | Parcial | Confirmación y borrado de persona/notas con evento mínimo; nuevas eliminaciones generan limpieza durable de fotografías. Conciliación histórica, otros adjuntos y supresión de copias pendientes. |
| RF-025 · Crear y editar eventos de calendario | CU-09 / UI-06 | Pendiente | Conservado en alcance; no implementado. |
| RF-026 · Calcular estados y recordatorios de eventos | CU-09 / UI-06 | Pendiente | Conservado en alcance; no implementado. |
| RF-027 · Consultar saldo de tesorería | CU-10 / UI-07 | Pendiente | Conservado en alcance; no implementado. |
| RF-028 · Registrar ingresos y egresos | CU-10 / UI-07 | Pendiente | Conservado en alcance; no implementado. |
| RF-029 · Corregir movimientos mediante reverso | CU-10 / UI-07 | Pendiente | Conservado en alcance; no implementado. |
| RF-030 · Gestionar inventario de inmuebles | CU-11 / UI-08 | Pendiente | Conservado en alcance; no implementado. |
| RF-031 · Gestionar bienes muebles y existencias | CU-11 / UI-08 | Pendiente | Conservado en alcance; no implementado. |
| RF-032 · Exportar información en PDF y Excel | CU-12 / UI-09 | Pendiente | Conservado en alcance; no implementado. |
| RF-033 · Configurar planilla de hasta diez columnas | CU-12 / UI-09 | Pendiente | Conservado en alcance; no implementado. |
| RF-034 · Personalizar encabezados y firmas de planillas | CU-12 / UI-09 | Pendiente | Conservado en alcance; no implementado. |
| RF-035 · Nombrar archivos exportados | CU-12 / UI-09 | Pendiente | Conservado en alcance; no implementado. |
| RF-036 · Exportar ficha individual y comprobantes | CU-12 / UI-09 | Pendiente | Conservado en alcance; no implementado. |
| RF-037 · Procesar exportaciones extensas | CU-12 / UI-09 | Pendiente | Conservado en alcance; no implementado. |
| RF-038 · Organizar carpetas internas | CU-13 / UI-12 | Pendiente | Conservado en alcance; no implementado. |
| RF-039 · Validar archivos y controlar almacenamiento | CU-13 / UI-12 | Parcial | Fotos conectadas al gateway y al detalle de fichas, con MySQL y volumen privados, permisos, ClamAV, actualización de firmas, limpieza y outbox programados. Nuevos borrados de personas con orden durable, reintentos y protección contra cargas concurrentes. Copia local cifrada con fotos y verificación de metadatos. Otros tipos de archivo, conciliación histórica y operación integral pendientes. |
| RF-040 · Buscar contactos e iniciar chat interno | CU-14 / UI-10 | Parcial | Directorio paginado de cuentas activas de la junta, búsqueda por nombre y presencia pública sin correos ni fechas de conexión. Inicio de conversaciones pendiente. |
| RF-041 · Enviar y conservar mensajes | CU-14 / UI-10 | Pendiente | Conservado en alcance; no implementado. |
| RF-042 · Adjuntar documentos, imágenes y notas de voz | CU-14 / UI-10 | Pendiente | Conservado en alcance; no implementado. |
| RF-043 · Mostrar estados de entrega y lectura | CU-14 / UI-10 | Pendiente | Conservado en alcance; no implementado. |
| RF-044 · Realizar llamadas de voz individuales | CU-15 / UI-10 | Pendiente | Conservado en alcance; no implementado. |
| RF-045 · Consultar y limpiar notificaciones | CU-16 / UI-03 | Pendiente | Conservado en alcance; no implementado. |
| RF-046 · Enviar alertas internas y por correo | CU-16 / UI-03 | Pendiente | Conservado en alcance; no implementado. |
| RF-047 · Administrar configuración y delegaciones | CU-17 / UI-11 | Parcial | Perfil, nombre/color, términos y delegación independiente de campos adicionales y filtros. Política común/personal de accesos rápidos reservada a SA; AD edita accesos comunes. Resto de configuración/delegaciones pendiente. |
| RF-048 · Versionar términos y autorizaciones | CU-17 / UI-11 | Parcial | Términos inmutables por versión, aceptación por usuario/junta. Autorización de captura básica. |
| RF-049 · Registrar auditoría integral | CU-18 / UI-13 | Parcial | Outbox, confirmación positiva, reintentos bajo bloqueo y consumidor idempotente; tres escenarios de concurrencia MySQL probados. Cobertura integral pendiente. |
| RF-050 · Consultar y exportar auditoría | CU-18 / UI-13 | Parcial | Bitácora de solo lectura con filtros combinables por fecha UTC, actor, módulo, acción y resultado, paginación y detalle. Estado de entregas por junta y consulta de agotados. Exportación y supervisión global pendientes. |
| RF-051 · Descargar instaladores oficiales | CU-19 / UI-14 | Parcial | Estado vacío honesto, sin binarios publicados. |
| RF-052 · Ofrecer experiencia móvil priorizada | CU-19 / UI-15 | Pendiente | Conservado en alcance; no implementado. |
| RF-053 · Mantener paridad web y Windows | CU-19 / UI-14 | Pendiente | Conservado en alcance; no implementado. |
| RF-054 · Gestionar privacidad y supresión controlada | CU-17 / UI-11 | Pendiente | Conservado en alcance; no implementado. |
| RF-055 · Supervisar servicios y tareas fallidas | CU-20 / UI-11 | Parcial | Salud /up y reintentos outbox; panel operativo y supervisión integral pendientes. |
| RF-056 · Respaldar y restaurar información | CU-20 / UI-11 | Parcial | Copia manual local cifrada de seis bases, .env y fotografías con pausa de escritores; autenticación y simulacro aislado de SQL y objetos con tablas, claves foráneas, hashes y cuotas. Compatibilidad con copias anteriores sin fotos. Programación diaria, retención, copia externa, recuperación operativa, permisos, supresiones posteriores y conciliación pendientes. |

## Requisitos no funcionales

- RNF-001: Rendimiento interactivo. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-002: Reportes y mensajería. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-003: Aislamiento entre juntas. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-004: Autenticación y secretos. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-005: Canales y cliente seguro. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-006: Autorización y mínimo privilegio. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-007: Integridad transaccional. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-008: Disponibilidad. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-009: Recuperación. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-010: Tolerancia a fallos. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-011: Usabilidad y accesibilidad. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-012: Adaptación y compatibilidad. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-013: Capacidad de almacenamiento. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-014: Mantenibilidad. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-015: Observabilidad. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-016: Privacidad y conservación. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-017: Tiempo y consistencia de lectura. Pendiente de validación integral; evidencia parcial en VALIDACION.md.
- RNF-018: Distribución y actualizaciones. Pendiente de validación integral; evidencia parcial en VALIDACION.md.

## Casos de uso

- CU-01: Administrar junta y acceso. La aceptación requiere todos sus RF relacionados.
- CU-02: Iniciar sesión con verificación. La aceptación requiere todos sus RF relacionados.
- CU-03: Recuperar acceso y cerrar sesiones. La aceptación requiere todos sus RF relacionados.
- CU-04: Actualizar perfil y correo. La aceptación requiere todos sus RF relacionados.
- CU-05: Consultar panel y buscar. La aceptación requiere todos sus RF relacionados.
- CU-06: Registrar una persona. La aceptación requiere todos sus RF relacionados.
- CU-07: Listar y consultar personas. La aceptación requiere todos sus RF relacionados.
- CU-08: Editar o eliminar una persona. La aceptación requiere todos sus RF relacionados.
- CU-09: Programar eventos y avisos. La aceptación requiere todos sus RF relacionados.
- CU-10: Controlar tesorería. La aceptación requiere todos sus RF relacionados.
- CU-11: Administrar inventario. La aceptación requiere todos sus RF relacionados.
- CU-12: Exportar planilla o reporte. La aceptación requiere todos sus RF relacionados.
- CU-13: Gestionar carpeta y archivos. La aceptación requiere todos sus RF relacionados.
- CU-14: Conversar y compartir soportes. La aceptación requiere todos sus RF relacionados.
- CU-15: Gestionar presencia y llamada. La aceptación requiere todos sus RF relacionados.
- CU-16: Atender notificaciones. La aceptación requiere todos sus RF relacionados.
- CU-17: Configurar la junta y privacidad. La aceptación requiere todos sus RF relacionados.
- CU-18: Inspeccionar auditoría. La aceptación requiere todos sus RF relacionados.
- CU-19: Usar aplicaciones y descargas. La aceptación requiere todos sus RF relacionados.
- CU-20: Supervisar y recuperar operación. La aceptación requiere todos sus RF relacionados.
