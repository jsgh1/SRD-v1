# SRD · Sistema de Registro Digital

El [cliente Windows con Electron](docs/ESCRITORIO.md) abre la interfaz React del servidor local en un paquete x64 probado. Hay un instalador de desarrollo, todavía sin firma ni publicación. El [cliente Android con React Native](docs/MOVIL.md) tiene un APK debug x86_64 probado parcialmente en emulador; sus funciones y aceptación siguen incompletas. Para la exposición del 6 de octubre de 2026, consulta [avance y pendientes](docs/AVANCE-PARA-EXPOSICION-2026-10-06.md) y [guía de demostración](docs/GUIA-DEMO-2026-10-06.md).

Incremento 0.1 para desarrollo local de un sistema para varias Juntas de Acción Comunal. Incluye React web, gateway Laravel y diez servicios independientes: identidad, configuración, registros, auditoría, archivos, calendario, notificaciones, tesorería, inventario y chat. Chat permite conversaciones directas, texto conservado, estados Enviado/Entregado/Leído y señales WebSocket privadas; HTTPS/WSS es opcional en el equipo local. Una medición local de 1.000 mensajes logró p95 de 1.877 ms hasta la lectura autorizada; faltan carga concurrente, TLS de producción, adjuntos y voz. El alcance completo conserva otro dominio de reportes; los clientes Windows y Android son parciales. Consulta [estado](docs/ESTADO.md), [trazabilidad](docs/TRAZABILIDAD.md), [arquitectura](docs/ARQUITECTURA.md) y [validación](docs/VALIDACION.md).

## Arranque en Windows

El [calendario](docs/CALENDARIO.md) ofrece vistas de mes, semana y agenda, gestión de eventos, participantes, respuesta a invitaciones, permisos delegables por junta y estados calculados. La [campana de notificaciones](docs/NOTIFICACIONES.md) muestra invitaciones, cambios, cancelaciones y recordatorios internos de 24 horas.

[Tesorería](docs/TESORERIA.md) permite a SA/AD/TE abrir la cuenta de una junta, registrar ingresos y egresos informativos en COP, consultar saldos y comprobantes, y corregir asientos mediante reversos. No realiza pagos ni operaciones bancarias.

[Inventario](docs/INVENTARIO.md) permite a SA/AD/TE registrar muebles e inmuebles, controlar existencias mediante movimientos con motivo, editar fichas, conservar las bajas históricas y adjuntar tres fotografías privadas por bien.

[Carpetas internas](docs/CARPETAS.md) incorpora creación, navegación paginada, cambio de nombre, movimiento y eliminación de carpetas vacías con confirmación para SA/AD. Incluye carga, descarga privada, renombrado y movimiento de DOCX/XLSX de hasta 20 MiB, con antivirus y cuota compartida; ver [Documentos privados](docs/DOCUMENTOS-PRIVADOS.md). Otros formatos, eliminación de archivos/carpetas con contenido y delegaciones siguen pendientes.

La API Laravel de fotografías privadas está incorporada a Compose con MySQL, volumen privado y antivirus local. Dispone de una [prueba Docker aislada](scripts/Test-FilesApi.ps1), una [prueba sintética de integración interna](scripts/Test-FilesLive.ps1) y un recorrido de navegador `scripts/Test-Browser.ps1 -Compose -Spec photos.spec.mjs`. Sus límites están en [almacenamiento de fotos](docs/ALMACENAMIENTO-FOTOS.md).

El [procesamiento previo de fotografías](docs/ARCHIVOS-PRIVADOS.md) puede verificarse por separado con `scripts/Test-FileSafety.ps1`, usando imágenes sintéticas y un antivirus local aislado. Las nuevas cargas JPEG corrigen la orientación EXIF antes de convertirse a PNG y retirar sus metadatos.

Las [fotografías privadas](docs/ALMACENAMIENTO-FOTOS.md) están conectadas al gateway y a las fichas: desde Lista → Ver se pueden cargar, ampliar, reemplazar y eliminar fotos de persona, documento y predio. El alta ofrece Guardar y añadir fotos para continuar directamente con las imágenes después de guardar la ficha. Las nuevas eliminaciones de personas generan [limpieza persistente de sus fotos](docs/ELIMINACION-FOTOS.md). El [respaldo local cifrado](docs/RESPALDOS.md) incluye imágenes; la conciliación de borrados históricos sigue pendiente.

Desde Configuración, administradores y superadministradores pueden [administrar los cargos de las personas](docs/CARGOS.md). El formulario usa el catálogo de la junta y conserva los nombres históricos en las fichas.

En Lista puedes combinar [filtros de personas](docs/CAMPOS-ADICIONALES.md): búsqueda, estado, zona, afiliación, género, tipo de documento, cargo, rol descriptivo, intervalos inclusivos de nacimiento y de registro, y hasta tres campos adicionales. El intervalo de registro usa los días de Colombia. Los cargos inactivos siguen disponibles para búsquedas históricas.

En Configuración puedes [elegir los filtros visibles para toda la junta](docs/FILTROS-VISIBLES.md). Administradores y superadministradores pueden delegar esta edición a roles concretos y revocarla; no cambia los permisos sobre datos ni otros módulos.

La edición de [campos adicionales](docs/CAMPOS-ADICIONALES.md) también se puede delegar por rol, de manera independiente. Los delegados conservan las reglas de tipos e historia y no pueden conceder permisos a otros.

Puedes crear [respaldos locales cifrados y probar su restauración aislada](docs/RESPALDOS.md) con `scripts/Backup-Local.ps1` y `scripts/Test-BackupRestore.ps1`.

Desde el encabezado puedes [buscar personas y contactos de la junta](docs/BUSQUEDA.md), con resultados separados y acceso al detalle autorizado.

La web incluye un indicador de presencia propia con señales de conexión que no prolongan la sesión, un [directorio de contactos de la junta](docs/CONTACTOS.md) y [chat directo con texto conservado](docs/CHAT.md). Consulta [presencia y límites](docs/PRESENCIA.md); las confirmaciones y avisos internos de Chat ya funcionan; faltan adjuntos, notas de voz, TLS de producción y pruebas de carga. No molestar oculta el distintivo de la campana sin borrar los avisos.

Requisitos: Docker Desktop con contenedores Linux, Node.js 24 y PowerShell. Abre PowerShell en esta carpeta:

```powershell
./scripts/Up.ps1
```

El script genera secretos aleatorios en `.env` cuando falta el archivo y añade solo las claves nuevas que falten en instalaciones existentes, sin rotar las anteriores. Construye imágenes, espera MySQL, crea las bases de servicio faltantes, aplica migraciones y arranca web y planificadores. No requiere instalar PHP ni MySQL globalmente. Abre **http://localhost:8080**. El correo se recibe únicamente en **http://localhost:8025** (Mailpit); no se entrega al exterior. Los puertos se enlazan a `127.0.0.1` y los servicios de dominio no publican puertos. Es un entorno de desarrollo HTTP local, aún no apto para producción.

Para probar HTTPS y el socket seguro WSS en este mismo equipo, después de `Up.ps1` ejecuta `./scripts/Enable-LocalTls.ps1` y abre **https://localhost:8443**. El certificado autofirmado se crea en `.local/tls` dentro de SRD; el navegador advertirá que no confía en él. No se instala en Windows ni cambia la confianza global. Esta opción sólo escucha en `127.0.0.1`, conserva HTTP en 8080 y no prepara un despliegue público. Comprueba el recorrido con `./scripts/Test-Browser.ps1 -Compose -Tls -Spec chat-direct.spec.mjs`. Para usarlo en otra PC hay que generar allí su propio certificado ejecutando el mismo script; no copies la clave privada de `.local/tls`.

### Probar con datos ficticios

```powershell
./scripts/Seed-ComposeTests.ps1
```

Se crean dos juntas y seis cuentas sintéticas, sin datos de los documentos ni del ZIP de referencia. Abre http://localhost:8080/j/srd-e2e-a/login. El usuario administrador es `admin@srd-e2e.test`; su contraseña aleatoria está en `.local/e2e-fixture.json` (campo `password`). Acepta los términos ficticios, inicia sesión y toma el código del correo en Mailpit. No existe contraseña universal ni se omite el segundo factor.

Las semillas son opcionales e idempotentes; no restablecen las contraseñas ni preferencias existentes. No uses datos personales reales en este entorno.

### Crear una junta propia de desarrollo

Guarda sus términos en un archivo UTF-8 dentro de SRD, por ejemplo `docs/terminos-locales.txt`. Cambia los valores de ejemplo de estos comandos:

```powershell
docker compose cp docs/terminos-locales.txt configuration:/tmp/terminos.txt
docker compose exec configuration php artisan srd:organization mi-junta "Mi junta" --terms-file=/tmp/terminos.txt
docker compose exec identity php artisan srd:bootstrap mi-junta
```

El último comando solicita nombre, correo y contraseña oculta dos veces. Solo permite crear el superadministrador inicial si no existe uno. Si sembraste las cuentas de prueba ya existe ese administrador. Acceso por `/j/mi-junta/login`.

### Administrar juntas desde la interfaz

La cuenta de prueba `superadmin@srd-e2e.test` usa la contraseña del mismo archivo local de pruebas. En **Configuración → Administración de juntas** puede crear una junta con su código y términos iniciales, invitar a su administrador y activar o suspender juntas. Los demás roles no tienen acceso a esta función.

La invitación de administrador se entrega únicamente al correo local de Mailpit en este entorno. Crear una junta y enviar su invitación son pasos separados: si falla el envío, la junta permanece creada y se puede volver a invitar. La cuenta solo queda vinculada cuando acepta la invitación.

La suspensión impide nuevos accesos y las siguientes solicitudes autenticadas mientras dure; no borra datos ni equivale a revocar permanentemente las sesiones. Al reactivar, una sesión todavía vigente puede volver a utilizarse. No se puede suspender la junta que se está usando: primero cambia a otra. La dirección principal pide el código de junta; compartir `/j/codigo-de-junta/login` abre directamente su login.

### Invitaciones de miembros de la junta actual

Un administrador o superadministrador puede entrar en **Configuración → Usuarios de la junta**, indicar correo y rol, y crear una invitación privada. Su estado inicial es «Pendiente de envío». El planificador intenta entregarla a Mailpit cada minuto; puedes actualizar la lista para ver el estado. No hay registro público ni invitaciones con rol de superadministrador.

El enlace vence en 24 horas y se usa una sola vez. Quien ya tiene cuenta confirma su contraseña actual para vincularse; nunca se reemplaza la contraseña de una cuenta existente. Quien no tiene cuenta crea su contraseña. Después debe iniciar sesión y verificar el código de acceso. Los enlaces llevan un secreto efímero en el fragmento, que se retira de la barra al cargar y se conserva solo en memoria; recargar requiere volver a abrir el correo.

Editar una membresía revoca sus sesiones de esa junta, conservando las de otras juntas. No se permite editar la propia membresía, una cuenta de plataforma ni retirar al último administrador de la junta. Revocar una invitación invalida el enlace. Para reenviar, crea una nueva al mismo correo: invalida la anterior, con espera mínima de 60 segundos y máximo cinco por hora/destino/junta.

Los envíos tienen cuatro intentos y esperas de 1, 5 y 15 minutos. La supervisión/reintento administrativo de agotados aún no está implementada. Para desarrollo puedes ejecutar el planificador de invitaciones inmediatamente con `docker compose exec identity php artisan srd:invitations`.

### Personalizar los accesos rápidos

En **Configuración → Accesos rápidos del panel**, AD/SA eligen hasta tres funciones y sus etiquetas. Solo SA cambia la política que habilita preferencias personales por usuario. Solo se ofrecen funciones existentes y permitidas. Elegir **Sin acceso** retira el botón del panel; el menú conserva la función. Detalles y control de versiones en [ACCESOS-RAPIDOS.md](docs/ACCESOS-RAPIDOS.md).

### Detener y volver a abrir el entorno

```powershell
./scripts/Down.ps1
./scripts/Up.ps1
```

`Down.ps1` conserva los volúmenes. Conserva también `.env`: regenerar las claves sobre datos existentes impediría descifrar información y conectar a MySQL. `Up.ps1` es reutilizable y no reinicializa bases existentes. Hay respaldo local cifrado y simulacro de restauración aislada verificados; automatización y recuperación operativa siguen pendientes. Consulta [RESPALDOS.md](docs/RESPALDOS.md).

## Comprobaciones

Pruebas backend con PHP 8.2+ (pdo_sqlite, mbstring, openssl, fileinfo, dom, xml), Composer y Node disponibles:

```powershell
./scripts/Test.ps1
```

Si las dependencias ya están instaladas: `./scripts/Test.ps1 -SkipInstall`. Las pruebas PHP usan SQLite en memoria para aislamiento; no se deben confundir con las pruebas de integración MySQL.

Con Compose abierto:

```powershell
./scripts/Test-MySqlIsolation.ps1
$env:npm_config_cache = Join-Path $PWD '.local/npm-cache'
npm.cmd ci --prefix tools/browser-tests --no-audit --no-fund
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD '.local/browsers'
node tools/browser-tests/node_modules/playwright/cli.js install chromium
./scripts/Test-Browser.ps1 -Compose
```

Chromium se instala dentro del proyecto. El informe y capturas se guardan en `.local`. `Test-Browser.ps1` prepara juntas y cuentas sintéticas distintas para cada archivo de pruebas, con credenciales aleatorias en `.local/browser-fixtures`, para evitar cruces de datos y límites entre recorridos. Conserva informes individuales en `.local/browser-runs` y los consolida en `.local/browser-results.json`. Se puede ejecutar solo un archivo con `-Spec person-fields.spec.mjs`. Los recorridos crean personas, juntas e invitaciones de prueba; eliminan las personas de los casos CRUD y campos y conservan otros datos sintéticos para revisión. `Seed-ComposeTests.ps1` sigue preparando las cuentas estables para revisión manual. Los comandos npm/Composer descargan dependencias públicas, no cargan archivos del proyecto.

La medición de latencia de Chat es explícita y queda fuera de la suite habitual: `./scripts/Test-Browser.ps1 -Compose -Tls -Spec chat-latency.spec.mjs`. Envía 1.000 mensajes sintéticos de una cuenta a otra conectada por WSS, comprueba cada uno con lectura autorizada y guarda los tiempos individuales y el p95 en `.local/browser-runs/<ejecución>/chat-latency-measurements.json`. Espacia los envíos para respetar el límite por sesión. Requiere varios minutos y conserva esos mensajes sintéticos en la junta aislada creada para la prueba.

## Organización

La entrega de auditoría dispone de contadores de pendientes y agotados mediante `srd:outbox-status`. Las instrucciones y la prueba MySQL de publicadores simultáneos están en [OUTBOX.md](docs/OUTBOX.md).

La pantalla Auditoría permite combinar filtros, paginar, abrir el detalle y exportar hasta 2000 eventos filtrados en Excel. También supervisa la entrega de eventos de Identidad, Configuración, Registros y Archivos. Consulta [AUDITORIA.md](docs/AUDITORIA.md) para las fechas UTC, permisos y límites.

Configuración permite administrar [campos adicionales de personas](docs/CAMPOS-ADICIONALES.md), con tipos, opciones, obligatoriedad y conservación de etiquetas históricas.

- `apps/web`: React/TypeScript y estilos. TypeScript detecta errores de integración durante la compilación.
- `services`: aplicaciones Laravel independientes, con migraciones y credenciales propias.
- `packages/php`: autenticación interna, permisos, correlación y outbox compartidos; sin modelos entre dominios.
- `contracts`: OpenAPI y esquema de evento versionado.
- `database`: categorías de scripts inspiradas solo en la estructura del ZIP guía; las migraciones ejecutables están en cada servicio.
- `scripts`, `docker`: operación y verificación local.
- `docs`: decisiones, trazabilidad y pendientes.

No ejecutes los antiguos generadores `tools/scaffold.mjs`, `tools/migrations.mjs` ni `tools/test-config.mjs` sobre trabajo existente. No son herramientas de actualización.

## Código fuente distribuible

```powershell
./scripts/Package.ps1
```

Genera `dist/SRD-0.1-source.zip` y su SHA-256. Excluye secretos, datos, documentos originales, dependencias descargadas, cachés y binarios compilados. Es una entrega de este incremento; no es el sistema completo ni contiene un APK o instalador Windows.

Para una demostración en otra PC, `./scripts/Prepare-Demo.ps1` arranca SRD y crea cuentas/juntas ficticias. La guía paso a paso está en [GUIA-DEMO-2026-10-06.md](docs/GUIA-DEMO-2026-10-06.md).
