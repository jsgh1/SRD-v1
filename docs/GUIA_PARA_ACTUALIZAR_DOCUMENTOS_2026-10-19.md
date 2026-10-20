# Guía para actualizar los documentos de SRD

Esta carpeta contiene **originales sin modificar** y planes de actualización, no entregables ya actualizados. Los 16 archivos del ZIP en [entregables-originales](entregables-originales) coinciden byte por byte con las entradas del ZIP recibido; los cuatro Word base coinciden por SHA-256 con los archivos aportados aparte. El trabajo anterior de anexar texto a Word y PDF quedó retirado de `docs`.

## Encargo general para Chat

Usa cada Word original como documento de partida y su PDF original como referencia visual cuando exista. **Integra** la información nueva en las secciones pertinentes, conserva el contenido que sigue siendo válido, actualiza índice, tablas, figuras, referencias cruzadas y control de versiones. No añadas un apéndice genérico al final como sustituto de una revisión editorial. Entrega nuevos Word editables y PDF concordantes solo después de revisar visualmente todas sus páginas. No cambies los originales de esta carpeta.

La fecha de corte para la información nueva es **19 de octubre de 2026**. Distingue el estado histórico del 9 de octubre del resultado posterior; 33 de 140 archivos de pruebas de navegador aprobaron en una misma imagen web, pero **no** se ejecutó ni aprobó la suite completa. Los tres checks de UX, formularios/roles y regresión final siguen abiertos. Las firmas antivirus locales vencidas bloquean las pruebas de nuevas cargas; no se afirma que esas pruebas pasaron. Las cifras deben fecharse y confrontarse de nuevo con el proyecto antes de una versión posterior.

Fuentes principales dentro del proyecto: [PENDIENTES-WEB-2026-10-16.md](PENDIENTES-WEB-2026-10-16.md), [REVISION_UX_WEB.md](REVISION_UX_WEB.md), [TRAZABILIDAD.md](TRAZABILIDAD.md), [WEB_ACEPTACION.md](WEB_ACEPTACION.md), [VALIDACION.md](VALIDACION.md) y documentos técnicos del módulo citado por cada plan. Los cuatro textos extraídos en [sources](sources) ayudan a buscar requisitos, pero los Word de `entregables-originales` son la referencia de formato. No usar datos del ZIP ajeno de ejemplo de base de datos, credenciales locales ni datos personales en los entregables.

## Plan por documento

| Original | Instrucciones específicas |
| --- | --- |
| Documentación de pruebas | [01 plan de pruebas](planes-documentales/01_Documentacion_de_pruebas_SRD.md) |
| Procedimiento de implementación | [02 plan de implementación](planes-documentales/02_Procedimiento_de_implementacion_SRD.md) |
| Acciones correctivas, preventivas y de mejoramiento | [03 plan de acciones](planes-documentales/03_Acciones_correctivas_preventivas_mejoramiento_SRD.md) |
| Manual técnico | [04 plan técnico](planes-documentales/04_Manual_tecnico_SRD.md) |
| Manual de instalación | [05 plan de instalación](planes-documentales/05_Manual_de_instalacion_SRD.md) |
| Manual de usuario final | [06 plan de usuario](planes-documentales/06_Manual_de_usuario_final_SRD.md) |
| Artículo de investigación en español | [07 plan del artículo ES](planes-documentales/07_Articulo_investigacion_SRD_ES.md) |
| Research article in English | [07 research article EN plan](planes-documentales/07_Articulo_investigacion_SRD_EN.md) |
| SRS | [01 plan SRS](planes-documentales/01_SRD_Especificacion_de_Requisitos_SRS.md) |
| Análisis | [02 plan de análisis](planes-documentales/02_SRD_Analisis_del_Software.md) |
| Propuesta técnica | [03 plan de propuesta](planes-documentales/03_SRD_Propuesta_Tecnica.md) |
| Diseño | [04 plan de diseño](planes-documentales/04_SRD_Diseno_del_Software.md) |

Cada plan es una instrucción de edición, **no** texto ya incorporado al Word. Chat debe verificar los hechos contra las fuentes indicadas y registrar cualquier diferencia encontrada antes de publicar una nueva versión.
