# Fancy Engine V1 — generación de borradores HOME con IA

## Principio

Es una **extensión del publicador web-first ya existente**, no un motor alterno. La IA **solo redacta propuestas**. Los borradores nuevos requieren revisión editorial, de productos, licencias de imágenes y divulgación de afiliados ANTES de entrar en el publicador de GitHub/Vercel. La distribución de Facebook/Instagram tiene aprobación independiente.

## Archivos

- `src/services/FancyEditorialDraftGeneratorV1.js`: temas HOME revisados, conexión con el modelo Anthropic ya usado por `server.js`, validación estricta de título, resumen, secciones, enlaces y estado.
- `src/services/FancyDraftReviewStoreV1.js`: almacena propuestas ÚNICAMENTE en la rama `fancy-editorial-drafts` del repositorio `salasclara/pasarela-servidor`, nunca en `main` ni en la web.
- `scripts/fancy-generate-home-draft-v1.js`: entrada manual con simulación por defecto.
- `test/fancy-editorial-draft-generator-v1.test.js`: prueba con IA y GitHub simulados, sin credenciales reales ni efectos externos.

## Cómo se ejecutará una vez integrado en Railway

Simular/ver el próximo tema disponible (solo leer feed HOME):

```sh
/mise/installs/node/22.23.4/bin/node /app/scripts/fancy-generate-home-draft-v1.js
```

Generar un borrador con IA y **solo mostrarlo**, sin guardarlo ni publicarlo (requiere `ANTHROPIC_API_KEY` configurado y llamado expresamente):

```sh
FANCY_EDITORIAL_GENERATE=yes /mise/installs/node/22.23.4/bin/node /app/scripts/fancy-generate-home-draft-v1.js
```

Guardar el borrador generado únicamente en la rama de revisión en GitHub, sin publicar (requiere `FANCY_EDITORIAL_GITHUB_TOKEN` con Contents write para **pasarela-servidor**, no para la web pública):

```sh
FANCY_EDITORIAL_GENERATE=yes FANCY_EDITORIAL_SAVE_REVIEW=yes /mise/installs/node/22.23.4/bin/node /app/scripts/fancy-generate-home-draft-v1.js
```

## Aprobación editorial

1. Revisar el borrador desde GitHub en `fancy-editorial-drafts/editorial-drafts/<slug>.json`. No confundir con `main`.
2. Validar originalidad, calidad, hechos, riesgos, marcas, productos, afiliados y derechos de imagen. Los campos de validación comercial se mantienen en `false` hasta revisión real.
3. Tras aprobación humana, usar el publicador **existente** `scripts/fancy-web-pilot-v1.js` en modo controlado para publicar en GitHub/Vercel y agregar al feed. **No existe todavía un enlace automático entre la rama de revisión y el publicador.**
4. Aprobar por separado la distribución a Facebook; el programador solo examina el feed publicado.

## Restricciones de seguridad

- Ningún import inicia tareas o cron. No se cambia `server.js`, ni las variables actuales de Railway.
- El generador jamás modifica `editorial-feed.json`, `fancy_v1_distribution_jobs`, `FANCY_BY_TOKEN` o la web pública.
- No hay imágenes de producto, links afiliados, precios ni reseñas inventadas.
- La rama de revisión puede ser visible en GitHub según permisos del repositorio; no introducir secretos ni datos personales.
- Los temas se eligen de una cola HOME definida en código y se rechazan si la URL ya existe o no es verificablemente 404.
- Modelo `claude-sonnet-4-6` reutilizando la credencial de Anthropic actual. La ejecución real puede generar costo de API; **no activada de forma periódica**.
- Falta construir una interfaz de aprobación editorial/pipeline de revisión, un gestor de temas y la integración de Instagram. No considerar V1 completada por esta etapa.
