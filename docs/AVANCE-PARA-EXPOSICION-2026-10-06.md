# SRD: avance real y trabajo pendiente

**Corte: 6 de octubre de 2026.** SRD es el Sistema de Registro Digital para varias Juntas de Acción Comunal. La especificación inicial y los documentos SRS/análisis/diseño guían el alcance; este informe distingue lo que ya funciona de lo que aún necesita implementación o aceptación. El ZIP escolar suministrado solo sirvió como referencia de organización de carpetas, sin copiar sus datos.

## Cómo interpretar el avance

El proyecto **no está terminado ni listo para producción**. La trazabilidad actual registra **56 requisitos funcionales: 52 parciales y 4 pendientes**. «Parcial» significa que existe código y alguna evidencia, no que todos los criterios de aceptación estén cumplidos. Los cuatro pendientes completos son RF-037 (exportaciones extensas), RF-042 (adjuntos y notas de voz para Chat), RF-044 (llamadas de voz) y RF-054 (privacidad y supresión controlada). También hay **18 requisitos no funcionales** y **20 casos de uso** que requieren validación integral. No convierto estos conteos en un porcentaje de terminación: cada requisito tiene tamaño y riesgo distintos. La matriz detallada está en [TRAZABILIDAD.md](TRAZABILIDAD.md).

## Lo que se puede mostrar hoy

| Área | Avance demostrable | Límite importante |
| --- | --- | --- |
| Acceso y juntas | Login asociado a una junta, términos versionados, segundo factor por correo local, recuperación, sesiones, roles, cambio de junta, invitaciones y administración de juntas. | Falta aceptación integral del acceso de plataforma y operación de producción. |
| Personas y configuración | Alta, edición, consulta, búsqueda, filtros, cargos y campos adicionales configurables; control de versiones, aislamiento por junta y fotos privadas con antivirus. | Faltan algunos catálogos, logo, conciliación histórica de fotos y privacidad/supresión integral. |
| Calendario y avisos | Eventos, participantes e invitaciones; recordatorios y bandeja interna con preferencias. | No hay push Android ni canales externos completos. |
| Tesorería | Cuenta por junta, ingresos/egresos informativos, saldo, reversos, comprobantes e historial. | No procesa pagos bancarios ni tiene todos los soportes adjuntos. |
| Inventario | Bienes muebles e inmuebles, movimientos de existencias, historial y hasta tres fotos privadas por bien. | Falta aceptación integral y algunas exportaciones/operaciones avanzadas. |
| Carpetas y archivos | Carpetas internas y archivos privados con permisos; lectura acotada de PDF, DOCX/XLSX y audio. | Faltan vista fiel de Office, delegación de escritura y más integraciones de adjuntos. |
| Chat y presencia | Conversación directa de texto, historial, señales WebSocket, estados enviado/entregado/leído, presencia y contactos. | No hay adjuntos, notas de voz ni llamadas; falta carga concurrente y TLS de producción. |
| Auditoría y supervisión | Eventos de dominio con outbox, consulta/exportación, estado de planificadores y avisos/reintentos de trabajos agotados. | Faltan alertas fuera de la app y supervisión completa de resultados externos. |
| Respaldos | Copia local cifrada manual y simulacro de restauración aislada. | Falta programación, retención, copia externa y recuperación operativa del piloto. |
| Web | Cliente React conectado a los servicios; es el recorrido más amplio para la demostración. | La prueba local no equivale a despliegue público ni aceptación de todos los flujos. |
| Windows | Cliente Electron x64 que abre la web SRD bajo el mismo origen; paquete e instalador de desarrollo generados. | Instalador sin firma, sin prueba completa de instalación/actualización ni funciones nativas de paridad. |
| Android | Cliente React Native con login/MFA, sesión recuperada, resumen, búsqueda/alta pendiente de persona, agenda, invitaciones, avisos, preferencias, perfil y cambio de junta. APK debug x86_64 compilado. | Flujo de cambio de junta aún no recorrido en emulador; faltan varias escrituras, fotos, push, chat y teléfono físico. |

La plataforma usa **diez servicios Laravel de dominio** (Identidad, Configuración, Registros, Auditoría, Archivos, Calendario, Notificaciones, Tesorería, Inventario y Chat), además de un gateway y el cliente web. Cada dominio tiene su base MySQL separada. Los datos del navegador y de las apps pasan por el gateway, que comprueba sesión y junta; los dominios vuelven a comprobar permisos. [ARQUITECTURA.md](ARQUITECTURA.md) explica las decisiones.

## Evidencia disponible

- Se han ejecutado pruebas PHP de servicios, integración MySQL, recorridos Chromium/HTTPS, pruebas de correo local, pruebas de aislamiento entre juntas y verificaciones de permisos. Los resultados concretos y sus límites están registrados por fecha en [VALIDACION.md](VALIDACION.md), no deben presentarse como una única batería reciente.
- Android aprobó **37 pruebas Jest**, TypeScript, lint y compilación del APK de depuración con JavaScript incorporado el 5 de octubre. Se recorrieron en emulador login/MFA, perfil, preferencias y recuperación de sesión; el cambio de junta nuevo se comprobó con pruebas JavaScript y compilación, todavía no de extremo a extremo en Android.
- El instalador Windows disponible es de **desarrollo**, no está firmado ni publicado. La web es la ruta recomendada para exponer el avance completo.
- La demostración usa **dos juntas y cuentas ficticias** creadas localmente. La contraseña se genera en la PC donde se levanta SRD y el código MFA aparece en Mailpit local. El paquete no transporta credenciales ni bases con datos.
- El 6 de octubre se ejecutó `Up.ps1 -SkipBuild` y luego `Prepare-Demo.ps1 -SkipBuild` en la PC de desarrollo: la siembra ficticia terminó, login web y Mailpit respondieron **HTTP 200**, la API devolvió `srd-e2e-a` y Compose informó **26 contenedores en ejecución, 24 saludables y 0 enfermos** al medir. Esto prueba el arranque con imágenes existentes; no prueba la primera construcción desde cero en otra PC. Se detuvieron SRD y Docker Desktop, conservando los volúmenes.

## Trabajo pendiente priorizado

1. **Antes de un piloto:** validar los criterios de aceptación de los 56 RF y los 18 RNF con datos sintéticos y recorridos de usuarios; completar privacidad/supresión, seguridad operativa, accesibilidad, concurrencia, carga, TLS de producción y recuperación ante fallos.
2. **Chat y comunicación:** carga concurrente y latencia bajo condiciones de piloto; adjuntos privados, imágenes, notas de voz y llamadas individuales.
3. **Android:** probar el cambio real entre dos juntas y términos renovados en emulador/teléfono; completar edición de persona, fotos, gestión de eventos, chat, push y autenticación nativa apta para producción.
4. **Windows:** probar instalación/desinstalación/actualización, firmar el instalador y verificar todos los recorridos del cliente con servidor HTTPS real.
5. **Datos y documentos:** exportaciones extensas, más comprobantes/formatos, catálogos faltantes, escritura delegada en carpetas, integración de adjuntos y supresión controlada.
6. **Operación:** programar respaldos, retención y restauración operativa; supervisar entregas externas y alertar aunque SRD esté cerrado.

## Estado de la entrega para la exposición

El archivo `dist/SRD-exposicion-2026-10-06.zip` contiene **código fuente, documentación, scripts de arranque y, si estaban disponibles al empaquetar, el APK de depuración x86_64 y el instalador Windows sin firma**. El ZIP no contiene `.env`, contraseñas, datos locales, bases, dependencias descargadas ni certificados. En otra PC se debe instalar Docker Desktop y Node.js 24, extraerlo y ejecutar `./scripts/Prepare-Demo.ps1` desde `SRD`. Sigue [GUIA-DEMO-2026-10-06.md](GUIA-DEMO-2026-10-06.md) para la preparación y el recorrido sugerido.
