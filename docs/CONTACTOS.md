# Directorio de contactos

Todos los roles pueden abrir **Contactos**. El directorio muestra otras cuentas con membresía activa en la junta actual y cuenta activa. La propia cuenta se omite. Las personas del registro comunitario no se convierten en contactos ni en cuentas de acceso.

Busca por una parte del nombre de la cuenta. Los caracteres `%`, `_` y `!` son literales, no comodines. Se conservan el texto y los criterios cuando no hay coincidencias. Las páginas contienen hasta 25 contactos, ordenados por nombre e identificador. Aplicar o limpiar la búsqueda vuelve a la primera página.

Cada tarjeta incluye nombre, rol y presencia pública; no incluye correo, documento, notas, preferencias privadas ni fecha de última conexión. Invisible se muestra como Desconectado. Los estados se consultan cada 30 segundos mientras la página está visible y al regresar a ella o recuperar conexión. **Actualizar estados** permite consultar manualmente. Se muestra la hora local de la última consulta completada. La señal del usuario sigue el mecanismo descrito en PRESENCIA.md.

Las consultas del directorio, manuales o automáticas, validan la sesión sin renovar su tiempo de inactividad. El gateway fija esta condición; no la decide el navegador. Un fallo retira las tarjetas y muestra el error; la siguiente consulta puede recuperarlas. Tras un 401/403 se detienen los reintentos automáticos. Al salir del directorio se elimina el temporizador y se ignoran respuestas tardías. La búsqueda conjunta conserva su consulta bajo demanda.

Un superadministrador solo aparece como contacto de una junta si tiene membresía activa en ella. Su privilegio global no lo añade a todos los directorios. Al cambiar de junta se vuelve a cargar el directorio con el nuevo contexto. El backend toma la junta exclusivamente del contexto firmado del gateway e ignora identificadores de junta aportados por el navegador.

API: `GET /api/v1/contacts?q=nombre&page=1`. Requiere sesión y permiso `contacts.read` (todos los roles vigentes). Devuelve `items`, `page`, `page_size=25`, `total`; cada elemento tiene únicamente `id`, `name`, `role`, `presence`. Identidad resuelve la presencia de la página en bloque, sin una consulta por contacto. No hay una ruta de consulta de cuentas arbitrarias.

RF-040 continúa parcial: aún no se pueden iniciar conversaciones, enviar mensajes, adjuntar archivos ni llamar. Los avisos No molestar siguen pendientes. Las diferencias de mayúsculas y acentos dependen de la intercalación de la base de datos; no se ofrece búsqueda fonética.
