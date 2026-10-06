# Respaldos locales cifrados

Desde PowerShell, dentro de SRD:

```powershell
./scripts/Backup-Local.ps1
./scripts/Test-BackupRestore.ps1 -VerifyOnly
./scripts/Test-BackupRestore.ps1
```

La primera orden crea una copia nueva. La segunda autentica la copia más reciente. La tercera la importa en un MySQL temporal aislado, comprueba tablas y referencias y retira el contenedor y el archivo descifrado. Puedes seleccionar otra copia con `-Backup 'nombre.srdbackup'`, siempre dentro de `.local/backups`.

## Contenido y protección

Las copias nuevas incluyen once bases: `srd_gateway`, `srd_identity`, `srd_configuration`, `srd_records`, `srd_audit`, `srd_files`, `srd_calendar`, `srd_notifications`, `srd_treasury`, `srd_inventory` y `srd_chat`, junto con el `.env` raíz y los objetos del volumen privado. El simulacro admite también las copias anteriores sin Calendario, Notificaciones, Tesorería, Inventario o Chat cuando faltan sus claves de aplicación.

El formato de contenido 2 indica `private_objects_included: true`. Conserva los objetos PNG de `photos`, tanto de personas como de bienes de Inventario, incluidos los pendientes de retirar y los archivos sin referencia que cumplan el formato del almacén. No incluye cuarentena ni otros futuros tipos de archivo. El exportador rechaza enlaces, nombres inesperados, imágenes mayores de 5 MiB, objetos registrados ausentes o alterados y más de 100.000 imágenes. El archivo JSON acompañante solo describe la copia: al verificar y restaurar se lee el formato desde el contenido autenticado, nunca desde ese JSON.

## Consistencia y pausa local

La copia detiene los contenedores activos de web, gateway, los diez dominios y sus planificadores; conserva MySQL, Mailpit y el antivirus. La aplicación queda temporalmente inaccesible. Exporta los objetos desde un contenedor de Archivos de una sola ejecución y ejecuta `mysqldump --single-transaction` mientras los escritores están detenidos. No ejecutar migraciones, otros procesos que escriban a las bases ni cambios manuales en el volumen durante esta ventana.

Se validan los identificadores y el proyecto de los contenedores, y al finalizar se arrancan solamente los que estaban activos, incluso si falla la copia. Los que ya estaban detenidos permanecen así. `.backup.lock` impide dos copias simultáneas; `.paused-UUID.json` conserva los identificadores de la pausa dentro del directorio privado. Una terminación forzada puede dejar el bloqueo o servicios detenidos: revisar esos archivos y el estado de Docker antes de recuperar manualmente con `Up.ps1 -SkipBuild` y retirar el bloqueo de esa ejecución. El script no elimina automáticamente bloqueos antiguos ni modifica ajustes globales de Docker.

El contenido se cifra mientras se recibe, sin crear archivos SQL o imágenes sin cifrar en el equipo durante la copia. El contenedor lee el volumen original privado. El formato exterior usa AES-256-GCM, nonce aleatorio de 12 bytes, etiqueta de autenticación de 16 bytes y cabecera versionada autenticada. El `.env`, el índice de fotos, sus bytes y el SQL están dentro del contenido cifrado. La verificación se basa en la etiqueta autenticada, no solo en el checksum.

La clave aleatoria de 32 bytes se guarda una sola vez en `.local/backups/recovery-key.bin`. Las ejecuciones siguientes la conservan. Sin esa clave no se puede descifrar la copia. En Windows se restringe el directorio de respaldos al usuario actual y SYSTEM; esos permisos se aplican únicamente dentro de SRD. El paquete de fuentes excluye `.local`, por lo que no incluye respaldos, claves ni datos.

## Simulacro de restauración

El archivo se autentica completamente antes de entregar SQL a MySQL. Una clave incorrecta, truncamiento o alteración impide la importación. El temporal descifrado permanece en el directorio restringido y se elimina al terminar; no se promete borrado físico seguro del disco.

Se usa la imagen MySQL 8.4 fijada en `compose.yaml`, que debe estar disponible localmente. El contenedor tiene nombre y etiqueta aleatorios propios, `--network none`, ningún puerto publicado, límite de 768 MiB y una CPU. No monta carpetas del equipo ni volúmenes de SRD. Su almacenamiento temporal pertenece exclusivamente a ese contenedor. Se espera hasta diez minutos al servidor final mediante TCP de loopback, evitando confundirlo con el servidor de inicialización que solo abre un socket.

El simulacro importa únicamente en ese contenedor, ejecuta `CHECK TABLE`, cuenta tablas y filas por base y comprueba todas las claves foráneas declaradas, incluidas las compuestas. Para contenido 2 restaura cada imagen bajo `/tmp/srd-photo-restore`, comprueba SHA-256 de los archivos escritos, tamaño y hash contra los metadatos de fotos vigentes, presencia de objetos pendientes de retirar, conciliación de cuotas y ausencia de fotos vinculadas a marcas terminales de personas eliminadas. Los objetos sin referencia se cuentan sin eliminarlos automáticamente. La lectura del índice rechaza rutas relativas, duplicados y truncamientos.

El informe muestra solo metadatos y totales. El contenedor se elimina por su identificador y tras verificar su etiqueta; las bases y volúmenes operativos no son destino de restauración. Una interrupción o error intenta retirar los temporales y registra el fallo; una terminación forzada del proceso o del equipo puede requerir revisión manual de restos en el directorio privado.

`operations.jsonl` registra inicios, copia, autenticación, etapas del simulacro y resultados, sin SQL ni valores de registros. La salida de MySQL no se imprime porque podría incluir datos; solo se conserva, cuando está disponible, el número del error. Este registro operativo local no sustituye todavía la auditoría central de operaciones administrativas.

## Alcance pendiente

RF-056 y RNF-009 siguen parciales. Estas herramientas son manuales y locales: faltan programación diaria, retención de 30 días, copia cifrada fuera del equipo, custodia separada de claves, respaldo de futuros archivos privados distintos de fotografías, restauración operativa autorizada, comprobación de permisos y juntas entre servicios, reaplicación de supresiones posteriores a la copia y conciliación de tesorería. Restaurar una copia antigua puede recuperar una foto borrada después: el simulacro no define una política de supresión de copias. Tampoco se respalda el volumen de sesiones web ni se promete conservar sesiones de navegador tras recuperar el sistema. El `.env` se incluye cifrado, pero el simulacro no lo instala ni recrea usuarios y privilegios MySQL de producción. No se ha medido el tiempo de pausa ni recuperación para volúmenes grandes.

Los conteos del simulacro describen la copia restaurada; no se comparan con una lectura posterior de las bases activas, que podrían haber cambiado. La evidencia local no demuestra los objetivos de RPO de 24 horas ni RTO de cuatro horas para el piloto. No se configuraron tareas globales, almacenamiento externo ni envíos a terceros.
