# Entrega de auditoría

Los cambios de identidad, configuración y registros guardan su evento de auditoría en la misma transacción que el cambio de negocio. `srd:outbox` intenta entregar hasta 100 eventos vencidos por ejecución, ordenados por próxima fecha, fecha del evento e identificador.

Cada intento bloquea la fila y vuelve a comprobar que no esté publicada, agotada ni en espera. Esta comprobación se hace después de adquirir el bloqueo porque otra ejecución puede haber cambiado el evento desde que se seleccionó el lote. El bloqueo de MySQL es la protección compartida entre el planificador y ejecuciones manuales; `withoutOverlapping` es una protección adicional del planificador.

Solo la respuesta de auditoría con `accepted: true` confirma la entrega. El mensaje conserva siempre el mismo identificador, y auditoría lo deduplica. Se envían únicamente los campos del evento, sin contadores ni fechas internas de reintento.

`attempts` cuenta fallos de entrega. Hay hasta cuatro intentos automáticos con esperas de 1, 5 y 15 minutos entre fallos. Después del cuarto fallo el evento queda retenido y no se vuelve a enviar automáticamente. No se borra ni se reinicia su contador desde la consulta de estado.

En **Auditoría → Entrega de auditoría**, SA, AD y AU pueden consultar los contadores de su junta y hasta 20 eventos agotados por servicio. La página consulta identidad, configuración y registros por separado; si una consulta falla muestra su error. No permite reenviar ni modificar eventos. Las otras juntas quedan excluidas incluso para SA en esta vista.

Para consultar contadores de todo un servicio desde la consola local:

```powershell
docker compose exec configuration php artisan srd:outbox-status
docker compose exec identity php artisan srd:outbox-status
docker compose exec records php artisan srd:outbox-status
```

La salida JSON distingue `published`, `pending`, `due`, `deferred` y `exhausted`. Pendientes incluye tanto los disponibles como los que esperan y los agotados. Es una consulta de contadores, sin datos de personas ni modificaciones.

Para la prueba de concurrencia local:

```powershell
./scripts/Test-OutboxConcurrency.ps1
```

La prueba ejecuta dos procesos PHP contra la misma fila de MySQL en tres escenarios: aceptación, fallo temporal y cuarto fallo. El transporte hacia auditoría se simula dentro de esos procesos; no se detiene ningún servicio ni se provoca una caída real. Las filas son sintéticas y tienen una fecha futura para que el planificador normal no las seleccione. Cada proceso espera una barrera de inicio y se comprueba que solo ocurra una llamada de transporte. Al terminar se retiran únicamente las filas y archivos creados por esta prueba.

La entrega sigue siendo al menos una vez: una caída después de la aceptación remota y antes del commit local puede repetir el envío. La deduplicación del receptor evita repetir el evento almacenado. La prueba de concurrencia no demuestra recuperación ante cortes de energía, restauración de copias ni cumplimiento de RTO/RPO. La supervisión global de plataforma, las alertas automáticas y el procedimiento autorizado de reintento de agotados siguen pendientes.

El 26/09/2026 se detectó un mutex huérfano de `srd:outbox` en el planificador local de Identidad: había eventos disponibles, pero esa tarea no se ejecutaba. Se comprobó en el contenedor del planificador que no existía un publicador activo y se retiró solo el mutex de esa tarea. No se limpiaron otras claves ni se alteraron contadores o filas de eventos. El detalle y la repetición de navegador están en [VALIDACION.md](VALIDACION.md). Sigue pendiente un procedimiento de recuperación formal con comprobaciones de actividad; no debe eliminarse un bloqueo si hay un publicador en ejecución.
