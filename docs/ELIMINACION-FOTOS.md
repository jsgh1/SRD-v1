# Fotografías de personas eliminadas

Implementación del 19/09/2026. Se aplica a las eliminaciones realizadas después de instalar las nuevas migraciones y versiones de Registros y Archivos.

Al confirmar el borrado de una persona, Registros guarda una orden en `photo_deletions` dentro de la misma transacción que elimina su ficha y registra el evento de auditoría. Un conflicto de versión o una transacción fallida no debe dejar una orden de limpieza. No depende de que el navegador siga abierto ni de que Archivos esté disponible en ese momento.

El planificador de Registros ejecuta `srd:photos-dispatch-deletions` cada minuto. Entrega hasta diez órdenes pendientes, bloqueando cada fila durante su entrega para serializar publicadores. Solo marca entregada una orden si Archivos responde `accepted: true`. Si falla, conserva la orden y espera 1, 5, 15 y después 60 minutos entre intentos, sin descartarla por agotar intentos. El lote se detiene al primer fallo para no acumular tiempos de espera de una dependencia caída. No se guardan cuerpos de error, fotografías ni datos descriptivos en la cola.

Archivos admite `POST /internal/v1/photo-deletions/{id}` únicamente desde el emisor firmado `records`, con junta, actor y correlación en el contexto. No existe ruta pública de gateway ni permiso de navegador para enviar esta orden. La operación no consulta permisos actuales del actor: ejecuta una eliminación que Registros ya confirmó, incluso si después se cierra o revoca su sesión.

En una transacción, Archivos bloquea la cuota de la junta, registra una marca terminal en `file_deleted_persons`, mueve las referencias de imágenes a `file_garbage`, retira sus metadatos de `person_photos` y registra `photo.person_deleted` en el outbox. Repetir la orden no duplica el evento ni libera espacio dos veces. La carga de fotos comprueba la marca terminal bajo el mismo bloqueo: una carga que comenzó antes del borrado no puede recrear fotos después de la limpieza. Los UUID de personas no se reutilizan.

`srd:photos-collect`, ejecutado por el planificador de Archivos, retira los objetos físicos pendientes. Solo entonces libera la cuota. La confirmación de entrega significa que la limpieza quedó registrada, no que los bytes ya desaparecieron. En funcionamiento normal intervienen dos ciclos de planificación; no se ofrece un plazo fijo durante fallos o acumulación de trabajo.

## Operación local

Los comandos pueden ejecutarse desde SRD para procesar trabajo ya autorizado:

```powershell
docker compose exec -T records php artisan srd:photos-dispatch-deletions
docker compose exec -T files php artisan srd:photos-collect
```

`photo_deletions.delivered_at` confirma la recepción; `attempts` y `next_attempt_at` permiten revisar reintentos. `file_garbage` conserva objetos pendientes y `file_quotas.reserved_bytes` conserva su reserva hasta retirarlos. La consola devuelve contadores, sin datos de las fichas. Falta un panel de supervisión y alertas para esta cola. El recolector actual puede detener un lote ante un objeto que no pueda retirar; conserva su reserva para revisión y reintento.

## Límites

- No se recorren ni eliminan automáticamente fotos históricas de personas borradas antes de este incremento. Falta una conciliación revisada de esos casos y de objetos huérfanos por interrupciones.
- Las marcas terminales y las órdenes conservan UUID mínimos y fechas. No equivalen a una política completa de supresión de identidad, auditoría o copias antiguas.
- El respaldo local incluye imágenes y órdenes en una copia tomada con pausa de escritores. La recuperación operativa y la reaplicación de borrados posteriores a esa copia siguen pendientes.
- El alta dispone de un paso opcional de fotos después de guardar la ficha; este mecanismo de limpieza no añade logo ni nuevos formatos. La orientación EXIF de nuevas cargas JPEG se incorporó después y se describe en ARCHIVOS-PRIVADOS.md; faltan pruebas con cámaras reales.

Pruebas y resultados concretos en [VALIDACION.md](VALIDACION.md). El recorrido interno reproducible `scripts/Test-FilesLive.ps1` crea una persona sintética con tres fotografías y la elimina sin borrar previamente las fotos; espera la entrega y retirada por los planificadores reales, comprueba ausencia física, cuota cero y auditoría.
