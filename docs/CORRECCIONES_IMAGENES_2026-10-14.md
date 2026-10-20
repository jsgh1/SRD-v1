# Correcciones solicitadas con `imagenes.zip`

El archivo de referencia está fuera del proyecto. Esta nota registra las decisiones aplicadas a la web de SRD; no contiene datos del ZIP ni credenciales.

## Acceso

- En código de junta, inicio de sesión, recuperación y verificación se separó el texto de la ilustración animada. La escena responde al foco y al clic.
- Contraseña tiene texto de ayuda dentro del campo. La aceptación de términos y su enlace comparten una línea cuando el ancho lo permite.
- Una respuesta temporal 429 al comprobar la sesión ya no se presenta como cierre de sesión; permite reintentar. El límite específico de intentos de inicio de sesión se conserva por seguridad.

## Personas y cuentas

- En estado **Pendiente** pueden quedar vacíos los campos que solo exige una ficha **Completada**, incluidos los dos de autorización de tratamiento. Tipo y número de documento y nombres siguen siendo obligatorios para identificar y evitar duplicados.
- “Fundamento o referencia del soporte” indica cómo quedó documentada la autorización; “Finalidad de la captura” indica para qué se usarán los datos. Ambos deben completarse para pasar la ficha a **Completada**.
- La fotografía de persona aparece en el detalle de la ficha y en el perfil de una cuenta vinculada. Esa cuenta puede reemplazarla desde Perfil; el permiso se limita a la foto de su propia persona.
- Al guardar una persona nueva o abrir el detalle de una ficha existente se puede pedir una invitación a su correo, con un rol de acceso. El registrador solo puede elegir **Consultor**. El servicio verifica que correo, persona y junta coincidan, conserva el vínculo al aceptar y evita asignar la misma ficha a dos cuentas.
- La invitación incluye el código de junta. La persona invitada confirma el enlace, acepta los términos y define su propia contraseña. No se envía una contraseña compartida por correo.
- El campo histórico `descriptive_role` sigue en la ficha para filtros y exportaciones como “Rol en la comunidad”. El rol que concede permisos es el de la invitación y la membresía. Las invitaciones antiguas sin ficha vinculada siguen siendo válidas para administración.

## Chat

- Se reorganizaron el encabezado, las burbujas, la vista de adjuntos y el compositor para escritorio y móvil.
- Las imágenes válidas se muestran dentro del mensaje y antes de enviarse; se utilizan URL `data:` admitidas por la política de seguridad existente. El error de una vista previa inválida se limpia al elegir otro archivo.
- Las notas de voz tienen controles de reproducción. La llamada se inicia desde el encabezado del chat y sus controles aparecen en un cuadro de llamada.
- La búsqueda, los mensajes fijados, las respuestas, borrar un mensaje para la cuenta y vaciar el chat para la cuenta tienen persistencia por usuario.

## Límites actuales

- Las cuentas antiguas sin ficha vinculada conservan su avatar propio y su gestión actual.
- La creación de una invitación vinculada se realiza después de guardar la ficha. Si falla la creación, la ficha sigue guardada y la pantalla ofrece reintentar. La entrega del correo se supervisa por separado.
- La web todavía requiere una revisión integral contra todos los documentos de requisitos antes de declararla terminada al 100 %.

## Comprobación realizada

- La web compiló con TypeScript/Vite y el inventario de traducciones no encontró claves inglesas faltantes.
- Pasaron las pruebas del vínculo de invitación y de foto propia en Identidad, la autorización de foto en Registros y las pruebas de fotografías de Archivos.
- En navegador pasó la creación de una persona pendiente con invitación vinculada y la prueba real de envío y descarga de adjuntos del chat con antivirus. También pasó la vista previa y reintento de una imagen a 360 px.
- Pasó la prueba de llamadas entre dos sesiones web: aceptar, silenciar, finalizar y detectar una interrupción de conexión. El simulador de esa prueba se actualizó para responder a los mensajes fijados del chat.
- Pasó la prueba de notas de voz en ancho móvil: grabar, convertir, enviar y reproducir.
- Los contenedores afectados fueron reconstruidos y quedaron en ejecución local. Tras un reinicio de Docker, se levantaron los 16 servicios necesarios para la web y las pruebas; los servicios de tareas programadas quedaron detenidos para reducir consumo. La migración `2026_10_14_000001_person_membership_links` está aplicada.
