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
