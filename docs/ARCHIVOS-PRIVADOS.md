# Archivos privados: preparación de fotografías

Este documento describe el procesamiento de imágenes en `services/files/app`, utilizado por el servicio Archivos ya desplegado. Las fichas web guardadas admiten las tres fotos mediante el gateway autenticado. La integración, cuota y limpieza se describen en [ALMACENAMIENTO-FOTOS.md](ALMACENAMIENTO-FOTOS.md).

## Procesamiento implementado

`ImageGate` recibe bytes y un nombre, valida extensión contra MIME real, un máximo de 5 MiB y dimensiones de hasta 20 millones de píxeles. Las entradas aceptadas son JPEG, PNG y WebP. El límite adicional de píxeles protege la memoria del decodificador y deberá revisarse con pruebas de carga antes del piloto.

Escribe el original en cuarentena con un identificador aleatorio, sin usar el nombre del usuario como ruta. `ClamdScanner` envía el contenido al antivirus mediante INSTREAM y solo admite una confirmación limpia exacta. Un rechazo, respuesta desconocida, conexión incompleta o timeout impiden obtener una imagen aprobada. El protocolo se implementó según la [documentación oficial de ClamD](https://docs.clamav.net/manual/Usage/ClamdProtocol.html).

Después del primer análisis, se lee la orientación EXIF de los JPEG y GD aplica el giro o reflejo correspondiente a los valores 1–8. Solo se consulta ese metadato después de que el original supere el antivirus. Luego se genera un PNG, descartando metadatos y contenido adicional del original. Las dimensiones devueltas corresponden a la imagen ya orientada. Esa imagen también debe superar el límite de tamaño y un segundo análisis antes de devolverse al consumidor. El resultado incluye bytes, MIME, dimensiones, tamaño y SHA-256; no contiene una URL pública. Se retira la cuarentena tanto al completar como al fallar.

Normalizar a PNG puede aumentar el tamaño y rechazar fotografías que originalmente pesaban menos de 5 MiB. La corrección de orientación se aplica a nuevas cargas JPEG con un valor EXIF reconocido; un valor ausente o fuera de 1–8 deja la imagen sin giro. No modifica fotos ya guardadas. Orientación en PNG/WebP, animaciones, perfiles de color y pruebas con cámaras reales siguen pendientes. Un cierre abrupto del proceso puede dejar cuarentena pendiente de limpieza: aún falta su conciliación después de interrupciones.

La extensión EXIF se instala únicamente en los contenedores del proyecto. Si falta en el servicio, una carga JPEG se rechaza; no se guarda silenciosamente sin corregir su orientación. No se modifica el PHP global del equipo.

## Verificación local aislada

Ejecuta `./scripts/Test-FileSafety.ps1`. Construye un verificador PHP/GD y arranca ClamAV en un proyecto Compose separado, sin puertos y en una red interna sin salida. Usa exclusivamente imágenes sintéticas; no lee archivos personales. El script detiene y retira sus contenedores al finalizar sin detener SRD ni eliminar sus volúmenes.

`./scripts/Test-FileSafety.ps1 -UnitOnly` ejecuta únicamente los casos con antivirus simulado, sin iniciar otro ClamAV. El informe declara `real_scanner_requested: false`; no equivale a verificación antimalware real. Los casos de orientación usan cuadrantes de colores y comprueban píxeles, dimensiones, eliminación de EXIF y ambos análisis para los ocho valores, tanto en orden de bytes little-endian como big-endian.

ClamAV usa la base de firmas incluida en la imagen fijada por digest. La actualización automática de firmas está desactivada en esta prueba aislada; **no es la política de un antivirus de producción**. La [guía oficial de Docker](https://docs.clamav.net/manual/Installing/Docker.html) describe las variantes con firmas y sus requisitos de memoria. Se asignan 2 GiB al contenedor de prueba; si no consigue cargar firmas, la prueba falla y no se sustituye por un resultado limpio ficticio.

La imagen final usa ClamAV 1.4.6, que incorpora el [parche de seguridad publicado en agosto de 2026](https://blog.clamav.net/2026/08/clamav-154-and-146-security-patch.html). El informe registra la versión y base de firmas que responde el daemon. La prueba EICAR usa el [patrón de prueba estándar](https://www.eicar.org/download-anti-malware-testfile/) directamente con el analizador, sin malware real. No demuestra detección universal de contenido malicioso dentro de imágenes.

El informe queda en `.local/file-safety/results.json`. Los dobles de prueba verifican fallos controlados; los casos identificados como `real-clamd` ejecutan el analizador real. Los temporales y resultados se excluyen del ZIP. La prueba Linux no valida ACL de cuarentena en Windows ni equivale a certificación antimalware.

## Integración y pendientes

El motor de almacenamiento y cuota está conectado a la aplicación: [ALMACENAMIENTO-FOTOS.md](ALMACENAMIENTO-FOTOS.md). El servicio tiene base propia, permisos por junta, tres posiciones por ficha, auditoría, actualización separada de firmas, limpieza de nuevas personas eliminadas y respaldo manual cifrado con imágenes.

1. El alta ofrece el paso opcional Guardar y añadir fotos, después de persistir la ficha. Completar otros metadatos de orientación y verificación con dispositivos reales.
2. Conciliar objetos huérfanos, cuarentena interrumpida y fotos de personas eliminadas antes de la limpieza durable.
3. Completar vigilancia operativa, carga, recuperación, automatización de copias y supresiones posteriores a las copias.
4. Ampliar a documentos y audios autorizados, límites de 20 MB, carpetas, permisos y supresión según conservación.

No se da por completado RF-020 ni RF-039 con este procesamiento previo.
