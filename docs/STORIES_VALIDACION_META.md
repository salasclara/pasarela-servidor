# Pasarela Stories — validación previa a producción

## Confirmado en GitHub Actions
- Pruebas unitarias de reglas, calendario y registro.
- Render JPEG 1080 × 1920 en archivo descargable de GitHub Actions.
- Pruebas de Graph API con `fetchFn` simulado, **sin tráfico a Meta**.

## Cómo revisar el diseño
1. Abrir el PR #53 y su última ejecución de **Stories Engine — pruebas seguras**.
2. En **Artifacts**, descargar `pasarela-story-preview`.
3. Abrir el JPEG y revisar tipografía, recortes, contraste y márgenes en móvil.
4. El fondo es sintético, no es una noticia ni una fotografía autorizada. El visto bueno del diseño no aprueba derechos de imágenes de terceros.

## Verificación de Meta (pendiente; no ejecutar desde CI)
- Confirmar ID de página, permisos de aplicación y token vigente **sin revelar el token**.
- Verificar la versión vigente de Graph API y que la aplicación puede crear Facebook Page photo Stories.
- En entorno controlado y con aprobación explícita, realizar una publicación real de prueba; verificar en la página el resultado y guardar el identificador.
- Un fallo o timeout después de la carga puede dejar resultado incierto: revisar manualmente antes de repetir. Nunca reintentar ciegamente.

## Antes de activar las 18:00 Central
- Confirmar que el artículo se guardó en `noticias` con `publicado=true`.
- Elegir una imagen propia o con licencia verificable; no asumir permisos de imágenes RSS.
- Proveer `imagenBuffer`, `origen`, `verificado:true` y `derechosImagen:true` solo después de revisión editorial.
- Inicializar `crearTablaStories(pool)` antes de cualquier reserva.
- Conectar el scheduler existente a `evaluarHorarioStory('pasarela')` y `procesarStoryAprobada` en un PR posterior, con pruebas de integración y bandera desactivada.
- Activar `STORIES_PASARELA_ENABLED=true` solo tras la prueba real y la autorización.
- Fancy y Rocimar deben respetar el origen web y las verificaciones de sus propios servidores.

**Este PR sigue siendo preparatorio: no modifica `server.js`, no instala tareas programadas y no publica.**
