# Accesos rápidos

En **Configuración → Accesos rápidos del panel**, el administrador o superadministrador puede seleccionar hasta tres funciones, ordenar su aparición mediante los tres puestos, editar sus etiquetas y retirar accesos eligiendo **Sin acceso**. Retirarlos no elimina las funciones del menú.

El superadministrador elige uno de estos modos para la junta, conforme a CA-RF-047:

- **Configuración común:** todos usan los accesos de la junta, filtrados por los permisos de su rol.
- **Personalización por usuario:** cada persona puede guardar sus propios accesos desde esa misma sección. Inicialmente hereda los comunes y puede volver a ellos con **Usar los accesos de la junta**. Una lista personal vacía oculta todos sus accesos; no equivale a heredar.

Las preferencias personales se conservan al cambiar temporalmente al modo común, pero solo se aplican cuando la junta permite personalización. Cada usuario conserva preferencias diferentes por junta. La delegación granular para que otros roles administren la configuración común sigue pendiente; habilitar personalización no concede permisos administrativos.

El administrador conserva la edición de funciones y etiquetas comunes, pero ve la política como texto y no puede cambiarla. La API comprueba esta restricción bajo el mismo bloqueo de junta que las escrituras personales: cambiar `mode` sin ser superadministrador devuelve 403 sin persistir accesos ni eventos. Omitir `mode` conserva el vigente; enviar el mismo valor sigue siendo compatible. Una versión antigua devuelve 409. Las políticas ya guardadas se conservan; no se migran ni restablecen preferencias.

El catálogo del servidor contiene únicamente funciones implementadas: registro, lista, consulta, configuración, auditoría y descargas. No acepta URLs, rutas escritas por el usuario, funciones repetidas ni funciones sin permiso. Las etiquetas admiten hasta 40 caracteres y React las representa como texto. Una pérdida de permisos oculta el acceso en la siguiente consulta, aunque estuviera guardado anteriormente.

`organization_quick_links` almacena modo, lista y versión de la junta. `personal_quick_links` usa la clave compuesta de junta y usuario; una lista nula significa herencia. No se guardan claves foráneas hacia la base de identidad. El usuario y la junta provienen del contexto autenticado y firmado.

Las escrituras bloquean primero la fila de la junta. La edición común requiere su versión; la personal requiere tanto su versión como la de la configuración común. Una versión antigua produce 409 sin cambiar los datos. **Recargar accesos** permite recuperar la configuración vigente; un error de guardado conserva lo digitado. Restaurar la herencia incrementa la versión personal para impedir que una edición vieja reaparezca.

Las escrituras generan eventos mínimos de auditoría con actor y junta, sin copiar etiquetas al evento. Leer los valores predeterminados no inserta filas. Una junta suspendida no permite leer ni modificar estas preferencias.
