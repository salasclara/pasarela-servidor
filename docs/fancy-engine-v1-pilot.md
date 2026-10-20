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


## Avance 2 — Adaptador GitHub/Vercel (20-oct-2026)
- Archivo: `src/services/FancyGitHubWebAdapterV1.js` (sin importación en server.js).
- Genera HTML para **nuevos** artículos HOME, reutilizando `styles.css` y vínculos legales.
- `createGitHubWebAdapter()` tiene `dryRun=true` por defecto. Sin actividad externa ni credenciales activas.
- Para ejecutar publicaciones reales necesitará un GitHub token de permisos mínimos, guardado exclusivamente en entorno seguro, y una invocación separada tras aprobación. No existe esa invocación todavía.
- Antes de escribir, rechaza cualquier archivo ya existente; por tanto no modificará `home/ordenar-cocina-pequena/index.html`.
- Verifica que el HTML servido por el dominio público corresponda exactamente al HTML preparado. Es un bloqueo intencional contra distribuir algo que Vercel aún no ha desplegado.
- Prueba escrita: `node test/fancy-github-web-adapter-v1.test.js` (ejecución pendiente). La simulación **nunca** satisface `verifyPublicUrl`.
- Limitación: la plantilla actual es editorial sin fichas comerciales; la publicación de reseñas con productos requiere extender el esquema y validar cada enlace, el contenido y el aviso de afiliado.
- Limitación: actualización y revisiones de páginas existentes, estado durable de publicación y cola social todavía pendientes.
- No hay cambios en `server.js`, tareas Railway, PostgreSQL ni redes sociales.


## Avance 3 — ejecución piloto bajo aprobación
- La usuaria comprobó visualmente la ruta de prueba creada por GitHub: `https://www.fancybyroxette.com/home/piloto-editorial-fancy-v1/` (GitHub → Vercel).
- `scripts/fancy-web-pilot-v1.js` y `test/fixtures/fancy-v1-sample.json`: ejecución manual de un artículo **nuevo** (`piloto-automatico-fancy-v1`) en modo simulación por defecto.
- Requiere `FANCY_APPROVED_BY` y tres verificaciones editoriales. En simulación: `FANCY_APPROVED_BY=editor node scripts/fancy-web-pilot-v1.js`.
- Solo para ejecución controlada aprobada: `FANCY_ENABLE_LIVE_PUBLISH=yes` y `FANCY_WEB_GITHUB_TOKEN` con permisos mínimos para escribir en `salasclara/fancy-by-roxette-web`. Nunca escribir el token en archivos o conversaciones. Una cuenta sin acceso de escritura a ese repo no funcionará.
- El token **no está configurado por este cambio** y no se intentó publicación real con el adaptador.
- La confirmación del despliegue reintenta hasta 12 verificaciones y compara el hash SHA-256 del HTML exacto; la falla **no** da permiso para redes sociales.
- La prueba automática del ejecutor usa solo simulación y no expone credenciales.
- No conectar el comando al scheduler y no publicar duplicados ni sobrescribir páginas. El script sigue dentro de la rama de validación.
