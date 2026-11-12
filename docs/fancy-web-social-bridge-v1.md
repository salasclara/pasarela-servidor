# Fancy Engine V1 — puente web → Facebook (rama de validación)

## Estado

Este módulo **NO está conectado a server.js, al cron, ni a Railway**. No se ha activado distribución automática. La publicación manual de la reseña de cocina del 12-nov-2026 funcionó y quedó registrada como published en la tabla fancy_v1_distribution_jobs. Ese caso no debe reenviarse.

## Flujo preparado

1. Publicar un artículo HOME aprobado en el repositorio web y verificar su HTML real en Vercel.
2. Registrar en editorial-feed.json el artículo con reviewed_by y approved_at. La aprobación social es independiente: distributionApproved=true y revision=1 solo cuando el operador lo haya confirmado expresamente.
3. El puente lee https://www.fancybyroxette.com/editorial-feed.json, acepta únicamente entradas published de HOME con aprobación social y revisión, comprueba URL canónica y título HTML.
4. En modo LIVE_STAGE registra un trabajo en fancy_v1_distribution_jobs mediante INSERT ... ON CONFLICT DO NOTHING, sin publicarlo.
5. Solamente cuando se habilita específicamente LIVE_SEND, el flujo intenta enviar los trabajos aprobados a Facebook; published y outcome_unknown nunca se reintentan. La cola persiste ID externo y estado.

## Comandos futuros (NO ejecutar aún en producción)

Simulación (lectura web, sin escribir en DB ni Meta):
node scripts/fancy-web-social-bridge-v1.js

Preparar trabajos sin publicar (requiere variables DATABASE_URL y FANCY_BY_TOKEN):
FANCY_BRIDGE_LIVE=yes node scripts/fancy-web-social-bridge-v1.js

Envío de entradas expresamente aprobadas (requiere autorización operacional, prueba controlada y credencial Meta estable):
FANCY_BRIDGE_LIVE=yes FANCY_BRIDGE_AUTO_SEND=yes FANCY_BRIDGE_CONFIRM=PUBLICAR-ARTICULOS-APROBADOS-FANCY-V1 node scripts/fancy-web-social-bridge-v1.js

Estos comandos no se han vinculado a ningún programador ni activado en Railway. La corrida del bridge no crea artículos; usa el feed generado por el publicador existente. La primera corrida con el feed actual (que contiene solo un borrador) no debe publicar nada.

## Pendiente antes de activar

- CI en verde y segunda prueba end-to-end con un **artículo nuevo aprobado** (no reutilizar cocina).
- Confirmar vigencia y renovación del token de página; un token corto de Graph API Explorer no es adecuado para automatización continua.
- Verificar estado noindex, condiciones de uso de Vercel Hobby para uso comercial, política de imágenes de afiliados y enlaces comerciales.
- Verificar Instagram mediante flujo específico de medios y permisos; Facebook link posts no se trasladan automáticamente a Instagram.
- Probar idempotencia ante redescargas, errores y reinicios en Railway.
- Solo entonces conectar el ejecutor aislado al scheduler existente con interruptor desactivado por defecto; no modificar cron multipágina hasta completar pruebas.

## Prueba integral aislada (sin publicaciones reales)

- `test/fancy-web-social-bridge-postgres-v1.test.js` prepara un artículo HOME nuevo en un feed web simulado, verifica HTML/canonical, usa una transacción de PostgreSQL temporal y un publicador Meta simulado. Comprueba preparación, envío autorizado ficticio y ausencia de duplicados; termina con ROLLBACK.
- `scripts/fancy-facebook-token-check-v1.js` verifica únicamente la identidad de página del token, sin revelar credenciales ni publicar. Comando futuro de diagnóstico (solo después de integrar PR): `node scripts/fancy-facebook-token-check-v1.js`.
- Graph API Explorer puede generar tokens de corta duración: una identidad correcta no prueba expiración, renovabilidad ni permisos permanentes. Debe comprobarse una credencial apta para producción antes de cualquier cron.
- La automatización en esta rama todavía **NO dispone de cron**, no ha hecho publicación externa adicional y no edita el calendario del servidor.

## Programador aislado, protegido y apagado por defecto

- `server.js` solo carga `FancyWebSocialScheduleV1` si `FANCY_WEB_SOCIAL_SCHEDULER_ENABLED=yes`. **Esta variable NO fue creada ni activada en Railway**; sin ella no cambia el funcionamiento existente.
- Programación preparada: 10:15–10:19 a.m. hora `America/Chicago`, una ejecución al día por proceso, independiente de las rutinas actuales de 9:00/15:00/21:00 y la rotación Fancy de las 12:00. Un reinicio puede volver a iniciar la ventana; PostgreSQL controla duplicados.
- Con solo `FANCY_WEB_SOCIAL_SCHEDULER_ENABLED=yes`, el sistema valida el token y solo registra entradas `pending_review`; no envía a Facebook.
- El envío requiere **además** `FANCY_WEB_SOCIAL_SEND_ENABLED=yes` y `FANCY_BRIDGE_CONFIRM=PUBLICAR-ARTICULOS-APROBADOS-FANCY-V1`. Sin los tres interruptores, no hay publicación programada.
- Antes de habilitar cualquiera, comprobar la vigencia del token de página, completar revisión de derechos/enlaces, segundo artículo real de prueba, permisos y políticas comerciales; no configurar esos interruptores como solución de prueba.
- La prueba aislada de programación verifica horario de verano/invierno, controles desactivados, verificación de identidad, y cierre de conexiones.
