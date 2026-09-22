# Arquitectura y decisiones

## ADR-016 · Presencia separada de actividad autenticada

Identidad conserva una señal nullable por sesión, separada de su actividad autenticada. La ruta de latidos del gateway utiliza su credencial interna directamente, sin resolver primero `auth/me`, para no renovar la inactividad por tráfico automático. La consulta efectiva usa señales recientes de sesiones vigentes; no depende de un planificador que escriba Desconectado ni de eventos de cierre del navegador. Invisible se transforma a Desconectado en la representación pública. El endpoint de latidos devuelve exclusivamente el estado propio. El directorio de contactos devuelve presencia pública de cuentas con membresía activa en la junta, calculada en bloque y actualizada manualmente. Los avisos siguen pendientes. Ver PRESENCIA.md.

SRD mantiene el alcance de once dominios Laravel más un gateway. Este incremento implementa cinco dominios reales: identity (auth del documento), configuration (configuración), records (registros), audit (auditoría) y files (fotografías privadas conectadas al gateway y al detalle de personas). Cada aplicación tiene bootstrap, rutas, configuración, composer.lock, migraciones, pruebas y base independiente. No hay una aplicación Laravel que seleccione el dominio por una variable de entorno.

El gateway conserva solo sesiones técnicas del navegador. Los clientes nunca eligen directamente el rol, usuario o UUID de junta para acceder a un dominio. El gateway resuelve la sesión opaca con identidad en cada operación, comprueba los términos y firma un contexto específico para el destinatario. Cada dominio aplica nuevamente sus permisos y condiciones de organización. Las referencias a juntas y usuarios de otros dominios son UUID lógicos; no existen consultas ni claves externas entre bases.

Los seis dominios restantes (tesorería, inventario, calendario, reportes, chat y notificaciones) permanecen en el plan. Archivos aún debe completar documentos, audios, firmas, operación y conexión con clientes; tener desplegado el servicio de fotos no completa ese dominio.

Archivos tiene volumen privado y consulta a Registros mediante una decisión mínima firmada. Solo el gateway puede invocar sus operaciones HTTP de fotos; debe validar primero la sesión. ClamAV analiza dentro de la red interna, sin puertos publicados. Otro contenedor descarga firmas cada seis horas y únicamente comparte el volumen de firmas; no recibe fotografías, claves de aplicación ni acceso a las bases. El proveedor exige una confirmación de actualización de menos de 48 horas. ClamAV revisa cambios cada 60 segundos y recarga sin mantener dos motores simultáneos para limitar memoria local. Esta instalación sigue destinada a desarrollo.

## ADR-001 · Versiones

Laravel 12 se conserva por compatibilidad con PHP 8.2 instalado y con los documentos. Se comprobó su soporte de seguridad hasta el 24/02/2027 en https://laravel.com/docs/12.x/releases. Composer resolvió 12.69.1; cada lock conserva parches y transitivas. Laravel 13 requiere PHP 8.3: evaluar la migración antes del piloto; no modificar PHP global para esta sesión.

Compose fija PHP 8.4 y MySQL 8.4 por digest consultado al registro. Node 24 construye React 19.2.8 y Vite 7.3.1. Referencias: https://react.dev/versions y https://vite.dev/guide/. TypeScript ayuda a comprobar contratos de interfaz. Lucide aporta SVG locales consistentes, sin CDN ni fuentes externas.

## ADR-002 · Sesión web y autenticación nativa

La primera entrega usa la sesión web de Laravel en el gateway, cookie HttpOnly/SameSite Strict y CSRF de Laravel. Un token opaco de 256 bits solo se conserva en la sesión del servidor; identidad guarda su SHA-256. El cliente no recibe ese token ni lo almacena en localStorage. Se usa un almacén explícito auth_sessions para expiración absoluta, inactividad y revocación central. Se renueva la sesión y el token CSRF tras verificar el segundo factor.

Esto ajusta el uso de Sanctum propuesto en diseño: no se instaló Sanctum todavía, porque no hay tokens nativos ni autenticación de usuarios dentro del gateway. Antes de Android/Electron debe integrarse su emisión y almacenamiento nativo con el mismo control central. No se declara implementada la autenticación nativa.

## ADR-003 · Seguridad interna

HMAC-SHA256 con clave local, audiencia, emisor, método, ruta, SHA-256 del cuerpo, emisión, expiración de 30 segundos y nonce de uso único. Los nonces duran 65 segundos. El gateway reconstruye el contexto; no reenvía cabeceras del navegador. La caché de nonce en archivos sirve para una instancia; al escalar se requiere caché compartida. El secreto interno es común a los servicios iniciales: antes del piloto conviene sustituirlo por claves por emisor/destinatario o firma asimétrica. No se afirma protección contra un servicio ya comprometido.

## ADR-004 · Códigos, SMTP y recuperación

Contraseñas Argon2id; códigos criptográficos de seis dígitos HMAC ligados al ID, finalidad y destino. Cinco minutos, cinco intentos; 60 segundos entre envíos y cinco envíos/hora por usuario/finalidad. Las transacciones conservan los intentos rechazados. Reenvío invalida el anterior. La sesión nace únicamente después del consumo del código y nueva comprobación de usuario, membresía, junta y términos.

El primer flujo envía SMTP durante la solicitud y no persiste códigos recuperables. Una caída SMTP invalida el desafío, conserva el intento y responde 503 al login. Los reintentos de correo de seguridad son explícitos, sujetos a límites, sin cola que guarde el código en claro. Se debe completar el procesamiento robusto de notificaciones antes de cerrar RF-046.

La recuperación usa un secreto aleatorio de 256 bits, de 15 minutos. Viaja en el fragmento del enlace (#), se retira inmediatamente de la barra y se envía por POST; no aparece en el path/query ni en logs HTTP. Ajusta la frase general “ningún secreto en URL” del RNF-004 para hacer viable el enlace solicitado en RF-006. No se carga contenido remoto en esa pantalla y se usa Referrer-Policy no-referrer. La respuesta inicial es genérica; falta medir resistencia a enumeración por tiempo.

## ADR-005 · Transacciones y auditoría

Una mutación y su evento mínimo se guardan en la misma transacción del servicio. El planificador publica el outbox mediante HTTP interno. Auditoría deduplica por UUID. Los reintentos esperan 1, 5 y 15 minutos; después quedan retenidos para revisión (attempts=4). La caída del consumidor no borra eventos del productor. El consumidor no conserva contraseñas, códigos, notas ni contenido de mensajes. No hay API para editar o borrar auditoría.

Faltan cadena de hashes, anclaje externo, bitácora de lectura de auditoría, clasificación completa de rechazos y supervisión/reintento administrativo. No debe confundirse el outbox ya implementado con la auditoría integral terminada.

## ADR-006 · Base de datos de referencia

Se inspeccionaron solo nombres y directorios del ZIP escolar. database/ reproduce DDL, DML, DCL, TCL, rollbacks y changelog como organización; no importa sus datos ni su configuración. Laravel migrations es la fuente ejecutable única de tablas/índices. El changelog es un índice documental, no un segundo motor de migraciones. MySQL no tiene vistas materializadas nativas; esa categoría queda explícitamente sin implementación.

## ADR-007 · Entorno local y producción

Docker Desktop estuvo inicialmente detenido. Después de que el usuario lo inició se construyeron los contenedores y se ejecutaron todas las migraciones en MySQL. Se verificó acceso propio y rechazo de las otras cuatro bases con cada una de las cinco credenciales. SQLite en memoria se conserva para las pruebas backend aisladas; no demuestra bloqueos concurrentes InnoDB.

Compose es de desarrollo: PHP built-in server y HTTP en 127.0.0.1. Los dominios y MySQL se conectan exclusivamente a la red interna. Web y Mailpit también tienen una red local de acceso para que Docker Desktop publique sus puertos de loopback; esa red no bloquea su salida, pero no hay relay SMTP ni envíos externos configurados. MySQL comprueba disponibilidad TCP para no aceptar como listo el servidor temporal de inicialización. Nginx renueva DNS de Docker para soportar recreaciones del gateway. Antes de cualquier piloto se necesita PHP-FPM, HTTPS, cookies Secure, SMTP real autorizado, pruebas de carga, credenciales por ambiente y operación respaldada. Nada fue publicado fuera del equipo.

## ADR-008 · Tiempo y fuentes

Fechas de persistencia UTC; presentación y límites de indicadores en America/Bogota. La semana inicia el lunes. Los conteos consultan exclusivamente la junta activa. El TXT se trata como fuente funcional; su instrucción histórica de escribir otro prompt no reemplaza la solicitud actual de construir. El SRS jurídico citado no define este sistema.

Se extrajo y leyó texto de los cuatro DOCX y el contexto TXT. No se verificó visualmente cada figura embebida de Word. El enlace Figma no abrió con el lector web y el navegador integrado no estuvo disponible; no se afirma fidelidad a las 99 pantallas. La interfaz sigue el texto del diseño, con evaluación visual local independiente.

## ADR-009 · Cambio de correo

Requiere la contraseña actual y un código enviado a la nueva dirección. El correo se reemplaza únicamente al consumir ese desafío de finalidad `email_change`. El reenvío requiere reautenticación dentro de cinco minutos. Se revocan las otras sesiones, se invalidan desafíos previos y se registra el evento en una transacción. El aviso al correo anterior se guarda cifrado en `security_notices`, con cuatro intentos y esperas 1/5/15 minutos. Tras enviarlo se elimina el destino cifrado. La entrega SMTP es al menos una vez: una caída después del envío y antes del commit puede duplicar el aviso; no se promete entrega exactamente una vez.

## ADR-010 · Capas del registro

`PersonController` autentica y adapta HTTP; `PersonInput` valida los campos; `PersonService` ejecuta consultas y transacciones del caso de uso; `PersonRepository` centraliza el alcance obligatorio de junta en consultas de personas. Se conserva Query Builder dentro del servicio para las escrituras relacionadas, sin repositorios genéricos ni acceso entre bases.

## ADR-011 · Invitaciones y membresías

Las invitaciones pertenecen a identidad y caducan a las 24 horas. El enlace contiene 256 bits aleatorios, vinculados por HMAC al ID. El secreto se conserva cifrado solo mientras espera entrega y se elimina al enviar o revocar. El trabajo periódico hace cuatro intentos (1/5/15 minutos); un duplicado SMTP conserva el mismo enlace y no concede dos membresías. La interfaz distingue pendiente, enviada, agotada, revocada, vencida y aceptada.

Aceptar prueba posesión del enlace y, para una cuenta existente, de su contraseña. No cambia una cuenta existente ni inicia sesión. La membresía conserva el rol elegido por el administrador al emitir, independientemente del cuerpo enviado al aceptar. Se comprueba que el emisor conserve autoridad y que la junta esté activa. Cinco contraseñas incorrectas bloquean la invitación. El login y su segundo factor siguen siendo obligatorios después.

`membership_guards` serializa las mutaciones de membresías/invitaciones por junta antes de bloquear sus filas. El control de versión impide sobrescribir una edición simultánea. Las sesiones y desafíos se revocan por junta al cambiar rol/estado. Se protegen la propia membresía, las cuentas de plataforma y el último administrador. El aprovisionamiento de SA sigue siendo exclusivo del bootstrap; no hay escalamiento a SA mediante invitaciones.

## ADR-012 · Administración de juntas

Configuración guarda juntas, términos y estado; identidad conserva cuentas e invitaciones de administradores. Crear la junta e invitar son pasos separados y recuperables, sin transacción entre bases. Solo SA puede administrar plataforma. La suspensión bloquea las siguientes resoluciones de sesión sin borrar información; no revoca definitivamente las sesiones. La junta actual no se puede suspender desde sí misma. Detalles y límites en ADMINISTRACION-JUNTAS.md.

## ADR-013 · Accesos rápidos

Las preferencias por usuario y junta pertenecen a configuración. El catálogo es una lista cerrada de identificadores de funciones; ninguna preferencia contiene rutas ejecutables. La autorización se aplica al guardar y al resolver los accesos efectivos. La junta define modo común o personal, con herencia explícita mediante lista nula; lista vacía significa ocultar los accesos. Las escrituras comparten el bloqueo de la junta y usan versiones para impedir sobreescrituras. La identidad procede siempre del contexto firmado, sin acceso a la base de cuentas. Ver ACCESOS-RAPIDOS.md.

## ADR-014 · Publicación y consulta de entregas

OutboxPublisher vuelve a comprobar publicación, espera y agotamiento después de adquirir el bloqueo de la fila. Requiere confirmación positiva del receptor y conserva el identificador entre intentos. Se mantiene entrega al menos una vez con deduplicación, sin prometer atomicidad entre bases. Los errores del commit local se propagan para que la transacción se revierta.

La consulta web de entregas requiere audit.read y filtra por la junta del contexto firmado en cada servicio. La interfaz consulta los tres productores por separado y distingue errores de servicio de contadores vacíos. El gateway acepta únicamente identity, configuration y records como productores. La consola local dispone de contadores globales por servicio. Ver OUTBOX.md para operación y límites de las pruebas.

## ADR-015 · Campos adicionales y validación transaccional

La pantalla de administración pertenece a Configuración, pero el esquema específico de personas y sus valores pertenecen al servicio Registros. Esta decisión concreta la distribución del requisito RF-019 para evitar validar contra una copia remota que podría quedar obsoleta durante el guardado. El servicio Configuración conserva juntas, términos y preferencias; no escribe la base de Registros.

Una fila por junta en person_field_schemas contiene versión y definición ordenada. Configurar y guardar persona bloquean primero esa fila; guardar bloquea después la persona y persiste sus valores dentro de la misma transacción. Se evita una transacción distribuida y se comprueban tanto versión de esquema como de persona. Las lecturas de esquema no crean filas. Los valores se guardan en person_field_values con clave foránea compuesta a la junta/persona y etiquetas capturadas; no se agregan columnas SQL a partir de nombres enviados por el usuario.

El esquema y sus opciones usan identificadores inmutables; desactivar no borra historia. El tipo tampoco cambia después del primer guardado. No se almacenan valores adicionales en el outbox. Los permisos de nota interna permanecen separados. Ver CAMPOS-ADICIONALES.md para límites y semántica de actualización.

La inicialización de la fila de control usa un upsert que, si ya existe, actualiza únicamente la misma clave de junta. Conserva versión y campos y adquiere el bloqueo de escritura antes de releer el esquema. Se evita depender de convertir el bloqueo compartido de una inserción ignorada por duplicado en uno exclusivo.

## Limpieza de fotografías tras eliminar personas

Registros guarda una orden durable en su propia base dentro de la transacción del borrado. Su planificador la entrega a una ruta de Archivos reservada al emisor records. Archivos conserva una marca terminal bajo el bloqueo de cuota que también toman las cargas, retira metadatos y encola objetos para retirada física. La entrega es idempotente y se reintenta con espera creciente; la cuota solo se libera después de retirar los objetos. No hay consultas entre bases ni dependencia de una sesión de navegador abierta. Límites históricos y operativos en ELIMINACION-FOTOS.md.
