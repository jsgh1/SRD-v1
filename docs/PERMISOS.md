# Matriz de permisos

SA: superadministrador. AD: administrador. RE: registrador. TE: tesorero. AU: auditor. CO: consultor.

La lectura delegada de Carpetas empieza deshabilitada en cada junta. SA/AD pueden conceder o revocar RE/TE/AU/CO mediante **Configuración → Acceso a Carpeta**; la concesión incluye navegación, listado, vista previa disponible y descarga privada, pero ninguna escritura. El backend verifica el rol y la configuración vigente en cada petición. El cambio se guarda con versión y deja evento mínimo `folder.access_updated`. La delegación por usuario y la de escritura siguen pendientes.

| Acción | SA | AD | RE | TE | AU | CO |
|---|---|---|---|---|---|---|
| Gestionar carpetas y archivos privados: crear, cargar, renombrar, mover y eliminar | Sí | Sí | No | No | No | No |
| Leer carpetas y listar/descargar archivos privados | Sí | Sí | Delegación | Delegación | Delegación | Delegación |
| Configurar lectura delegada de Carpetas por rol | Sí | Sí | No | No | No | No |
| Panel, lista, consulta y detalle de personas | Sí | Sí | Sí | Sí | Sí | Sí |
| Crear/editar personas | Sí | Sí | Sí | No | No | No |
| Leer/escribir nota interna | Sí | Sí | Sí | No | No | No |
| Eliminar personas | Sí | Sí | No | No | No | No |
| Nombre/color/términos de la junta activa | Sí | Sí | No | No | No | No |
| Configurar campos adicionales de personas | Sí | Sí | Delegación | Delegación | Delegación | Delegación |
| Elegir filtros visibles de personas | Sí | Sí | Delegación | Delegación | Delegación | Delegación |
| Conceder/revocar delegaciones de campos o filtros | Sí | Sí | No | No | No | No |
| Administrar catálogo de cargos | Sí | Sí | No | No | No | No |
| Consultar esquema y valores adicionales de personas | Sí | Sí | Sí | Sí | Sí | Sí |
| Editar accesos rápidos comunes | Sí | Sí | No | No | No | No |
| Cambiar política común/personal de accesos rápidos | Sí | No | No | No | No | No |
| Accesos propios cuando la junta permite personalizar | Sí | Sí | Sí | Sí | Sí | Sí |
| Invitar, revocar invitación y gestionar miembros de la junta | Sí | Sí | No | No | No | No |
| Perfil propio, tema, cerrar sesiones | Sí | Sí | Sí | Sí | Sí | Sí |
| Directorio y presencia pública de contactos de la junta | Sí | Sí | Sí | Sí | Sí | Sí |
| Auditoría de la junta | Sí | Sí | No | No | Sí | No |
| Consultar estado de entrega de auditoría de la junta | Sí | Sí | No | No | Sí | No |
| Tesorería: consulta, movimientos y exportación | Sí | Sí | No | Sí | No | No |
| Inventario: consulta, movimientos y exportación | Sí | Sí | No | Sí | No | No |
| Exportar personas permitidas | Sí | Sí | Sí | Sí | Sí | Sí |
| Exportar auditoría | Sí | Sí | No | No | Sí | No |
| Administrar plataforma y crear juntas | Sí | No | No | No | No | No |
| Gestionar agenda y carpetas compartidas | Sí | Sí | Delegación | Delegación | Delegación | Delegación |
| Descargas publicadas y chat con miembros | Sí | Sí | Sí | Sí | Sí | Sí |

La tabla conserva el alcance de los módulos, aunque algunos siguen parciales. Tesorería e Inventario ya aplican sus permisos en endpoints propios; la exportación general sigue pendiente. Las delegaciones comienzan deshabilitadas. Están implementadas por separado la edición de filtros visibles y la de campos adicionales de personas: SA/AD pueden habilitar cada una para RE/TE/AU/CO dentro de su junta y revocarla; los delegados no pueden otorgar permisos. Las delegaciones de cargos y otros módulos siguen pendientes. La administración de cuentas no puede conceder un rol global desde un administrador de junta.

Srd\Access implementa la política utilizada por los servicios existentes. React filtra acciones; el backend decide siempre. Las consultas usan organization_id derivado del contexto firmado y los recursos de otra junta responden 404. Usuarios sin nota no reciben ese campo en detalle, lista ni indicadores. Los roles descriptivos de personas no participan en la autorización.

Las invitaciones solo conceden AD/RE/TE/AU/CO en la junta activa, nunca el rol global SA. Las mutaciones vuelven a comprobar que el administrador siga activo. Se impiden cambios a la propia membresía, a una cuenta SA y la retirada del último AD. Cambiar un miembro revoca sesiones y desafíos de acceso de esa junta; no desactiva la cuenta global ni sus membresías de otras juntas. El invitado existente debe demostrar su contraseña actual, sin permitir restablecerla mediante una invitación.
