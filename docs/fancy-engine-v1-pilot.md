# Fancy Engine V1 — piloto web primero

## Archivos agregados
- `src/services/FancyWebPublisherV1.js`: validación del artículo, aprobación, contrato de publicación, URL canónica y preparación de trabajos sociales.
- `test/fancy-web-publisher-v1.test.js`: pruebas unitarias aisladas.

## Estado real
**Preparado pero NO conectado ni activado**. El servidor `server.js`, scheduler, tokens, publicaciones existentes y bases de datos no se modificaron. Publicar en GitHub no equivale a desplegar en Railway. Las pruebas requieren ejecución y comprobación, no basta con que estén almacenadas.

## Cómo probar localmente
`node test/fancy-web-publisher-v1.test.js`

## Piloto
Reseña de cocina: `https://www.fancybyroxette.com/home/ordenar-cocina-pequena/`.

## Contratos
1. normalizeDraft valida categoría, slug, titular, resumen, introducción y secciones.
2. approveDraft exige firma de revisión editorial, revisión de productos, licencias de imágenes y divulgación de afiliados.
3. publishApprovedArticle requiere un adapter con métodos `publish(article, expectedUrl)` y `verifyPublicUrl(url)`; no intenta publicar ni acepta un enlace arbitrario.
4. makeSocialJobs exige estado publicado, aprobación explícita para distribuir, URL canónica y revision; devuelve entradas de cola en `pending_review`. Debe existir una restricción UNIQUE en persistencia para `idempotencyKey`.

## Pendientes de implementación (no asumir resueltos)
- Adapter real para Fancy Web: hoy el sitio es HTML estático en GitHub/Vercel; diseñar la escritura de contenido aprobado con credencial del servidor y disparo de despliegue, sin exponer tokens al navegador.
- Confirmación HTTP pública de la URL y de la revisión exacta antes de distribución.
- Persistencia durable de workflow y cola, con estados/reintentos/bloqueo/idempotencia en PostgreSQL.
- Adaptadores sociales que **reutilicen** publicadores existentes, con Instagram verificado.
- Manejo de edición de páginas existentes frente a nuevos artículos para evitar duplicados.
- Pruebas E2E controladas sin publicación externa involuntaria.
- Revisar restricciones de publicación comercial y noindex antes del lanzamiento.

## Regla de seguridad
No activar un cron, endpoint público o distribución automática hasta una prueba completa manual con el artículo de cocina. No interrumpir el scheduler multipágina existente.
