# Buscar en la junta

El botón **Buscar en la junta**, situado en el encabezado, abre una consulta conjunta de los módulos disponibles. No solicita datos hasta escribir y enviar un texto. Admite hasta 120 caracteres y descarta espacios exteriores; una entrada formada solo por espacios se rechaza en la interfaz.

- **Personas**: coincidencia por nombre, apellido o documento, diez filas por página y acceso al detalle autorizado. No se buscan notas internas, autorizaciones ni valores adicionales mediante este texto; los filtros adicionales siguen en Lista.
- **Contactos**: coincidencia por nombre de cuenta, 25 tarjetas por página, rol y presencia pública. No se consultan correos ni documentos de cuentas. Las reglas de membresía y privacidad son las de CONTACTOS.md.

Puedes consultar ambos tipos o seleccionar uno. Cada sección tiene su propia paginación. Enviar otra búsqueda vuelve a la primera página; limpiar elimina criterios y resultados. Una búsqueda sin coincidencias conserva el texto. Si falla un módulo, su sección muestra el error y permite reintentar; los resultados del otro módulo se mantienen. Las respuestas de consultas abandonadas no reemplazan la búsqueda actual.

La interfaz reutiliza `GET /api/v1/persons` y `GET /api/v1/contacts`; cada servicio valida permisos y junta con el contexto firmado. No hay un índice central con copias de datos ni una nueva ruta que permita saltar los controles de acceso. Las lecturas se solicitan por acción del usuario, sin sondeo automático. Una junta nueva monta una búsqueda nueva sin resultados anteriores.

Las búsquedas de texto de personas y contactos interpretan `%`, `_` y `!` literalmente mediante parámetros enlazados y un carácter de escape explícito compatible con SQLite/MySQL. La comparación de mayúsculas y acentos depende de la intercalación de la base; no se promete búsqueda fonética.

RF-015 continúa parcial: se integran personas y contactos. Calendario, tesorería, inventario, archivos y otros dominios aún no implementados no se ofrecen como categorías de búsqueda. No hay búsqueda dentro de adjuntos ni exportación de estos resultados.
