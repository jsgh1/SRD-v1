# Indicadores de inicio

Home consulta los indicadores de la junta activa. El botón **Actualizar indicadores** vuelve a consultar los datos y muestra la hora de consulta. La tarjeta de fecha usa la fecha enviada por el servidor en America/Bogota; no depende de la fecha del dispositivo.

Los conteos diarios comienzan a medianoche de Colombia; la semana comienza el lunes y el mes, el día uno. Los tres períodos terminan antes de la siguiente medianoche colombiana. Las siete barras usan esos mismos límites diarios. Total, distribuciones y últimas fichas abarcan los registros existentes de la junta. Los empates de fecha en las últimas fichas se ordenan por identificador.

La consulta agrupa las lecturas en una transacción. Durante una actualización se retiran las cifras anteriores; un error se muestra con la opción de volver a actualizar. Las respuestas de una vista desmontada no actualizan la pantalla. No existe actualización periódica automática.

Validación: DashboardTest prueba límites de fecha, aislamiento, roles, orden, distribuciones y borrado con datos sintéticos. La prueba de navegador dashboard.spec.mjs verifica actualización, recuperación de error y fecha del servidor. No se ha realizado una prueba de carga ni de escritura concurrente sobre el conjunto de indicadores.
