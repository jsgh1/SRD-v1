# SRD — Informe de avance para presentación académica

**Proyecto:** Sistema de Registro Digital para Juntas de Acción Comunal.  
**Fecha de corte:** 21 de septiembre de 2026.  
**Entrega:** incremento funcional 0.1, aplicación web de desarrollo local.

## 1. Resumen del avance

SRD ya permite demostrar un recorrido real: ingresar a una junta con verificación por correo, administrar personas, adjuntar fotografías privadas, consultar y filtrar registros, configurar campos y cargos, gestionar miembros y revisar auditoría. La interfaz está conectada a servicios y bases de datos; las funciones descritas como implementadas no son únicamente maquetas.

El proyecto completo sigue en desarrollo. Faltan dominios importantes y los clientes Android y Windows. Esta entrega permite presentar el avance y ejecutarlo localmente; no constituye una versión de producción ni la aceptación final de todos los requisitos.

El alcance se mantiene basado en el prompt inicial y los documentos de requisitos, análisis, propuesta técnica y diseño. La trazabilidad registra **56 requisitos funcionales, 18 no funcionales y 20 casos de uso**. No se importaron datos del ZIP escolar de referencia: solo se tomó como orientación para organizar carpetas de base de datos.

No se asigna un porcentaje global: todavía no existe una ponderación y aceptación integral de los requisitos que permita calcularlo de forma defendible. La evidencia se presenta por funcionalidad y prueba, sin equiparar carpetas, contratos o pantallas a módulos terminados.

## 2. Funcionalidades implementadas y demostrables

| Área | Avance disponible |
|---|---|
| Acceso por junta | Selección mediante código o enlace directo al login, términos versionados, contraseña, código de verificación por correo local, recuperación y cierre de sesiones. |
| Separación y permisos | Contexto de junta y usuario verificado, roles diferenciados y aislamiento de datos. La nota interna solo corresponde a los roles autorizados. |
| Perfil | Datos básicos, tema visual, presencia, cambio de correo con verificación y revocación de otras sesiones. |
| Juntas | Superadministrador: crear y listar juntas, activar o suspender e invitar a su administrador. El acceso de plataforma todavía parte de una junta seleccionada. |
| Miembros | Invitaciones privadas con vencimiento y uso único; aceptación, roles, activación y revocación de sesiones de la membresía modificada. |
| Panel | Indicadores reales, últimos registros, búsqueda de personas y contactos y hasta tres accesos rápidos autorizados. |
| Accesos rápidos | Administrador y superadministrador editan funciones y etiquetas comunes. Solo el superadministrador cambia la política común/personal. Cada usuario puede personalizar cuando está permitido. |
| Personas | Alta, edición, estados pendiente/completado, validaciones, ubicación condicional, consulta, detalle, nota restringida y eliminación confirmada. Control de versión para evitar sobrescrituras. |
| Fotografías privadas | Tres posiciones: persona, documento y predio. Carga desde el alta o el detalle, ampliación, reemplazo y eliminación. JPEG/PNG/WebP hasta 5 MB, análisis antivirus, normalización y corrección de orientación JPEG. |
| Conservación de fotos | Cuotas por junta, limpieza persistente al eliminar nuevas personas, reintentos y protección frente a cargas concurrentes. |
| Campos adicionales | Texto, fecha, decimal y selección; orden, obligatoriedad, desactivación, opciones e historia. Integración con captura, detalle y consulta. Edición delegable por rol, con revocación. |
| Catálogo de cargos | Cargos iniciales ampliables por junta, renombrado, desactivación, versiones y conservación del nombre histórico en las fichas. El cargo no concede permisos del sistema. |
| Filtros y paginación | Búsqueda por nombre, apellido o documento; estado, zona, afiliación, género, documento, cargo y rol descriptivo. Hasta tres criterios adicionales combinados y páginas de 10/25/50. |
| Intervalos de fecha | En campos adicionales de fecha: coincidencia exacta o Desde/Hasta inclusivos. Incluye campos inactivos, combinación con otros criterios y paginación en el servidor. |
| Filtros visibles | Selección común por junta y delegación de su edición por rol. Es una configuración de interfaz; no cambia permisos de lectura. |
| Contactos y presencia | Directorio de miembros, búsqueda, actualización manual y automática y estados de presencia. Base disponible para futura comunicación. |
| Auditoría | Eventos con actor y junta, entrega mediante outbox con reintentos y deduplicación; consulta con filtros, paginación, detalle y estado de entregas. |
| Respaldos | Copia manual local cifrada con seis bases y fotografías; verificación de autenticidad y simulacro de restauración aislada. |

## 3. Base técnica disponible

- Web en React y TypeScript.
- Seis aplicaciones Laravel: gateway, identidad, configuración, registros, auditoría y archivos, con bases y credenciales MySQL separadas.
- Comunicación interna firmada, sesiones, protección CSRF, validación de entradas y autorización en el servidor.
- Docker Compose con quince contenedores: aplicaciones, cuatro planificadores, MySQL, Mailpit, web, antivirus y actualizador de firmas.
- Migraciones, contratos OpenAPI, scripts de arranque, pruebas y empaquetado; documentación de arquitectura, permisos, trazabilidad y validación.
- El código de los clientes Android y Electron todavía no está implementado. La web adaptable a móvil no sustituye una aplicación Android.

## 4. Evidencia de verificación

Últimas ejecuciones de las suites backend:

| Servicio | Pruebas | Aserciones |
|---|---:|---:|
| Registros | 34 | 789 |
| Identidad | 26 | 313 |
| Gateway | 8 | 70 |
| Configuración | 14 | 169 |
| Auditoría | 5 | 70 |
| Archivos | 9 | 83 |
| **Total** | **96** | **1.494** |

Estos resultados corresponden a la última ejecución de cada suite, en fechas distintas; no a una única ejecución conjunta. Las suites PHP usan SQLite en memoria. Hay evidencia separada sobre MySQL y navegador:

- Recorridos Chromium con correo local y MySQL para acceso, personas, permisos, fotos, configuración, contactos y auditoría.
- Intervalos de fecha: recorrido aprobado en 21,0 segundos; regresión de filtros base y exactos aprobada en 20,4 segundos.
- Delegación de campos y filtros comprobada, incluida revocación sobre formularios abiertos.
- Política de accesos rápidos comprobada con superadministrador, administrador y consultor.
- Cinco escenarios de concurrencia de cargos, tres de campos y tres del publicador outbox comprobados con procesos y transacciones reales de MySQL.
- Motor de fotos con 17 escenarios MySQL; pruebas de integración con antivirus real y limpieza de objetos.
- Simulacro de respaldo del 19/09: recuperación de seis bases, 34 tablas, 13 claves foráneas y una fotografía sintética con comprobación de integridad.
- Revisión visual de los incrementos recientes en escritorio y vista móvil de 360 píxeles.

Estas verificaciones no equivalen a pruebas exhaustivas de carga, todos los navegadores, dispositivos físicos o seguridad integral. El detalle, incluidos intentos fallidos corregidos y limitaciones, está en [VALIDACION.md](docs/VALIDACION.md).

## 5. Trabajo pendiente

| Área | Qué falta |
|---|---|
| Plataforma | Login de plataforma independiente de una junta, supervisión global y completar la política de sesiones al suspender. La suspensión actual bloquea solicitudes mientras dure; una sesión aún vigente puede volver a servir al reactivar. |
| Configuración | Otros catálogos base, logo, delegaciones de otros módulos y ajustes restantes del alcance. |
| Búsqueda | Otros rangos, consultas guardadas y validación integral. Los intervalos actuales son solo para campos adicionales de fecha, no para nacimiento o fecha de registro. |
| Calendario | Vistas mes/semana/agenda, eventos, participantes, estados, permisos y recordatorios. |
| Tesorería | Saldo, ingresos/egresos, comprobantes, historial y reportes, con permisos exclusivos. |
| Inventario | Recursos, cantidades, movimientos, responsables y reportes. |
| Exportaciones | PDF y XLSX reales, fichas y planillas, plantillas configurables y composición solicitada. |
| Carpetas y archivos | Explorador jerárquico general, permisos, movimiento, previsualización y gestión de archivos más allá de las fotografías de personas. |
| Comunicación | Chat, adjuntos, audio, llamadas y sus permisos. La presencia existente no significa que el chat esté terminado. |
| Notificaciones | Bandeja, preferencias y avisos de calendario, chat y exportación. No molestar todavía no tiene esos avisos sobre los que actuar. |
| Privacidad | Completar conservación, supresión, operación sobre respaldos y demás flujos de privacidad. |
| Auditoría y operación | Exportación de auditoría, supervisión y reintento administrativo de trabajos agotados, diferencias de cambios cuando corresponda y observabilidad integral. |
| Fotografías | Conciliación de borrados históricos y validación con cámaras/dispositivos físicos. |
| Respaldos | Programación diaria, retención, almacenamiento externo, permisos de restauración y procedimiento operativo de recuperación. |
| Clientes | React Native Android y Electron Windows, empaquetado, instaladores y actualizaciones. No hay APK ni instalador Windows. |
| Calidad y puesta en producción | Aceptación funcional completa, accesibilidad, más navegadores, carga, recuperación operativa, infraestructura y configuración de producción. |

El orden sugerido es consolidar acceso de plataforma y configuración; desarrollar los dominios pendientes por incrementos; incorporar exportaciones, comunicación y clientes nativos sobre contratos estables; y cerrar la validación integral antes del piloto. No se fijan fechas sin una planificación acordada.

## 6. Qué contiene el ZIP

La entrega `SRD-avance-2026-09-21.zip` contiene una carpeta `SRD` con el código fuente actual, archivos de bloqueo de dependencias, migraciones, Docker, scripts, pruebas, contratos, documentación y este informe.

No contiene `.env`, contraseñas, claves de recuperación, bases con datos de la máquina de desarrollo, fotografías almacenadas, respaldos privados, `.local`, documentos originales ni dependencias descargadas (`vendor` y `node_modules`). Tampoco contiene imágenes Docker preconstruidas. **Es una entrega reproducible del código, no una copia de los datos actuales ni un paquete para instalación sin conexión.** Las dependencias e imágenes se descargan durante el primer arranque y las cuentas de demostración se generan en el equipo destino.

## 7. Ejecutarlo para la demostración

### En este equipo

Con Docker Desktop abierto, abre PowerShell dentro de la carpeta SRD:

```powershell
./scripts/Up.ps1 -SkipBuild
./scripts/Seed-ComposeTests.ps1
```

### En otro equipo Windows

1. Tener Docker Desktop funcionando con contenedores Linux, Node.js 24, PowerShell y conexión a Internet. PHP y MySQL del sistema no son necesarios para el arranque con Docker.
2. Extraer el ZIP. Abrir PowerShell dentro de la carpeta `SRD`, donde está `compose.yaml`.
3. Ejecutar:

```powershell
./scripts/Up.ps1
./scripts/Seed-ComposeTests.ps1
```

El primer arranque construye las imágenes, genera secretos locales y aplica migraciones; puede tardar varios minutos. No usar `-SkipBuild` en un equipo que todavía no tiene las imágenes. No hace falta ejecutar los generadores históricos ni configurar bases manualmente.

### Acceder

- **Login directo:** http://localhost:8080/j/srd-e2e-a/login
- **Código de junta:** `srd-e2e-a`, si se entra desde http://localhost:8080.
- **Administrador:** `admin@srd-e2e.test`.
- **Superadministrador:** `superadmin@srd-e2e.test`.
- **Consultor:** `viewer@srd-e2e.test`.
- **Contraseña:** se genera localmente; está en el campo `password` de `.local/e2e-fixture.json`. No se publica en esta entrega.
- **Correo de demostración:** http://localhost:8025. Después de aceptar los términos e ingresar, abrir el mensaje de la cuenta correspondiente y copiar su código de verificación.

Las semillas crean juntas y cuentas ficticias; no incluyen un censo ni un historial completo de demostración. Se pueden crear unas pocas personas ficticias desde Registro. Los correos se reciben en Mailpit y no se entregan al exterior.

Antes de mostrar fotografías, comprobar `docker compose ps`: el antivirus debe estar sano y disponer de firmas vigentes. Una carga rechazada por falta de análisis no debe presentarse como guardada; la ficha de persona se conserva y permite reintentar después.

Para detener sin borrar los datos locales:

```powershell
./scripts/Down.ps1
```

Conservar `.env` y los volúmenes. Las direcciones `localhost` solo funcionan en el equipo donde corre Docker: enviar el ZIP permite a la instructora ejecutarlo en su equipo, pero no crea un enlace público. Esta entrega prepara una demostración local, no un despliegue externo con HTTPS y correo real.

## 8. Guion sugerido para la instructora

1. Explicar el objetivo: gestionar información por junta, con permisos y trazabilidad.
2. Ingresar como administrador mediante el enlace directo y mostrar el código recibido en Mailpit.
3. Crear una persona ficticia; explicar pendiente/completado y guardar. Usar fotos sintéticas si se quiere demostrar adjuntos.
4. Abrir Lista, buscar, ver y editar la ficha. Mostrar que el cargo y el rol descriptivo no crean permisos de usuario.
5. En Configuración, añadir un campo de fecha; registrar valores en dos o tres fichas y demostrar el intervalo Desde/Hasta.
6. Mostrar cargos configurables, conservación histórica y filtros visibles.
7. Delegar temporalmente la edición de campos al consultor. En una ventana privada, mostrar el editor delegado y la ausencia de permisos para crear personas o leer notas. Revocar la delegación.
8. Mostrar accesos rápidos: el administrador edita etiquetas; el superadministrador decide si admite personalización individual.
9. Mostrar contactos, indicadores y auditoría. Los eventos se entregan de forma asíncrona; esperar al planificador y actualizar si es necesario.
10. Cerrar con la tabla de pendientes y distinguir el avance web funcional de la versión completa todavía por construir.

## 9. Documentación de respaldo

- [Inicio y comandos](README.md).
- [Estado y continuidad](docs/ESTADO.md).
- [Trazabilidad de requisitos](docs/TRAZABILIDAD.md).
- [Arquitectura](docs/ARQUITECTURA.md).
- [Matriz de permisos](docs/PERMISOS.md).
- [Evidencias y límites de validación](docs/VALIDACION.md).
- [Campos, delegaciones y filtros](docs/CAMPOS-ADICIONALES.md).
- [Respaldos y restauración](docs/RESPALDOS.md).

**Conclusión de la entrega:** hay una base web funcional y verificable para acceso, registros, configuración, fotografías y auditoría. Se entrega para revisión académica del avance, manteniendo explícitos los módulos y validaciones que aún faltan.
