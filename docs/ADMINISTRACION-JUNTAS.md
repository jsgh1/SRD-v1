# Administración de juntas

La interfaz está en **Configuración → Administración de juntas** y requiere una cuenta de superadministrador. El administrador de una junta no puede consultar la lista global, crear juntas ni cambiar el estado de otras juntas.

1. Crear la junta con nombre, código único de 3 a 40 caracteres y términos iniciales. El código admite minúsculas, números y guiones entre segmentos. La junta, sus términos y el evento de auditoría se guardan en una transacción.
2. Pulsar **Invitar administrador** e indicar su correo. El rol se fija en el servidor como administrador. Identidad comprueba nuevamente que el emisor sea una cuenta activa de superadministrador y que la junta exista y esté activa.
3. El destinatario acepta la invitación privada de 24 horas. Si ya tiene cuenta, confirma su contraseña actual; si no, crea una. Después inicia sesión con código de verificación. En este entorno, el correo se recoge exclusivamente en Mailpit.

El listado tiene páginas de 25 juntas. La creación no hace una transacción distribuida con identidad: si la invitación falla, la junta permanece disponible y se puede repetir ese paso sin duplicar la junta.

Activar o suspender requiere la versión vigente de la junta. Un cambio desde una versión anterior devuelve conflicto y la interfaz actualiza el listado. La suspensión pide confirmación y está prohibida para la junta actual del superadministrador, para evitar que pierda su acceso de gestión durante la operación.

Una junta suspendida no tiene configuración pública accesible. La resolución de sesiones consulta su estado en cada solicitud, por lo que las siguientes solicitudes autenticadas quedan bloqueadas. Una operación que ya había sido autorizada puede concluir. Suspender no borra registros ni revoca permanentemente las sesiones; al reactivar, las que todavía estén vigentes pueden continuar. Una revocación definitiva y la administración de plataforma independiente de una junta siguen pendientes.

Los eventos `organization.created`, `organization.activated` y `organization.suspended` se registran en el outbox de configuración para la junta afectada. El listado global de auditoría de plataforma sigue pendiente; la consulta de auditoría existente se limita a la junta seleccionada.

La página raíz conserva el selector por código acordado con el usuario. El enlace `/j/codigo-de-junta/login` abre directamente el login de esa junta.
