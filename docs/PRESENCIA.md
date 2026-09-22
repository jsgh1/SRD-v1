# Presencia de conexión

El encabezado muestra la preferencia y conexión de la cuenta: En línea, Ausente, No molestar o Invisible. La preferencia se guarda desde Configuración. Invisible tiene representación pública Desconectado; el propietario sigue viendo Invisible.

La web envía `POST /api/v1/presence/heartbeat` cada 30 segundos y al recuperar conexión o volver a una pestaña visible. El gateway utiliza exclusivamente la credencial de su sesión HttpOnly; ignora tokens, usuarios y roles suministrados por el navegador. La ruta requiere CSRF y conserva el límite general de solicitudes.

Identidad valida sesión, cuenta, membresía, junta y términos antes de registrar `presence_seen_at`. Esta columna es independiente de `last_activity_at`: los latidos no llaman a `auth/me` ni renuevan el plazo de inactividad. Se mantienen los límites de ocho horas y 30 minutos sin actividad autenticada. Las señales no generan un evento de auditoría por latido; los cambios de preferencia conservan la auditoría de perfil.

La representación efectiva combina las sesiones del usuario con señal de menos de 90 segundos, no revocadas y dentro de ambos plazos de sesión. Al cerrar la última conexión válida, el estado es Desconectado; al perder red o cerrar el navegador sin logout se agota la señal. No depende de ejecutar JavaScript al cerrar una pestaña. Una señal tardía nunca elimina una revocación. Una cuenta desactivada o Invisible se representa como Desconectado.

Si el navegador no puede confirmar un latido muestra «Conexión sin confirmar». Ante 401/403 detiene las señales y muestra «Sesión sin acceso». No elimina automáticamente un formulario que el usuario estaba editando. Los temporizadores de pestañas suspendidas pueden causar desconexión hasta que se reanuden las señales.

Migración: `2026_09_12_000001_session_presence`, columna nullable e índice por usuario/señal. Las sesiones anteriores adquieren señal al recibir su primer latido. No se importan datos ni se revocan sesiones existentes al migrar.

RF-011 continúa parcial: incorpora la base de conexión, el indicador propio y la presencia pública del directorio de contactos de la junta (CONTACTOS.md). Aún faltan chat, distribución de cambios en tiempo real y avisos que respeten No molestar. El directorio se actualiza cada 30 segundos mientras está visible, al recuperar conexión y manualmente, sin renovar la inactividad y no permite consultar cuentas arbitrarias ni expone fechas de última conexión. La agregación considera señales de todas las sesiones de la cuenta; una junta suspendida impide nuevos latidos, y su señal anterior se agota en hasta 90 segundos.
