# Matriz de permisos

SA: superadministrador. AD: administrador. RE: registrador. TE: tesorero. AU: auditor. CO: consultor.

| Acción | SA | AD | RE | TE | AU | CO |
|---|---|---|---|---|---|---|
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

La tabla conserva el alcance, no afirma implementación de módulos pendientes. Tesorería, inventario y exportación tienen política preparada en Srd\Access, pero no tienen endpoints aún. Las delegaciones comienzan deshabilitadas. Están implementadas por separado la edición de filtros visibles y la de campos adicionales de personas: SA/AD pueden habilitar cada una para RE/TE/AU/CO dentro de su junta y revocarla; los delegados no pueden otorgar permisos. Las delegaciones de cargos y otros módulos siguen pendientes. La administración de cuentas no puede conceder un rol global desde un administrador de junta.

Srd\Access implementa la política utilizada por los servicios existentes. React filtra acciones; el backend decide siempre. Las consultas usan organization_id derivado del contexto firmado y los recursos de otra junta responden 404. Usuarios sin nota no reciben ese campo en detalle, lista ni indicadores. Los roles descriptivos de personas no participan en la autorización.

Las invitaciones solo conceden AD/RE/TE/AU/CO en la junta activa, nunca el rol global SA. Las mutaciones vuelven a comprobar que el administrador siga activo. Se impiden cambios a la propia membresía, a una cuenta SA y la retirada del último AD. Cambiar un miembro revoca sesiones y desafíos de acceso de esa junta; no desactiva la cuenta global ni sus membresías de otras juntas. El invitado existente debe demostrar su contraseña actual, sin permitir restablecerla mediante una invitación.
