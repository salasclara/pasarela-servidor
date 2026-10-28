# Stories Engine — preparación técnica (PR #53)

**Estado:** no activado; este PR no modifica `server.js` ni configura cron. Ninguna historia se publica al desplegar estos archivos.

## Arquitectura
- `StoriesBrands.js`: marcas, colores, tokens por variable de entorno y activación independiente. Ningún token se guarda en el repositorio.
- `PasarelaStories.js`: composición 1080 × 1920 usando `@napi-rs/canvas`, carga de foto sin publicar y envío a `/{page-id}/photo_stories`.
- `StoriesEngine.js`: validación de título, imagen, origen, verificación editorial y derechos de imagen; modo simulación (`publicar:false`); reloj Central con `America/Chicago`.

## Requisitos antes de activar
1. Validar con Meta que la aplicación y el token de **cada página** autorizan la publicación de photo Stories. Confirmar versión de Graph API, respuesta y permisos con prueba real controlada.
2. Confirmar fuente y derechos de cada imagen. **No** convertir imágenes RSS de terceros en Historias sin permiso.
3. Integrar el contenido ya publicado de cada motor (Pasarela artículo, Amar Es, Maravillas, Fancy reseña web, Rocimar noticia verificada). No volver a redactar ni generar imágenes por defecto.
4. Implementar persistencia de idempotencia por `marca + fechaCentral + articuloId` en PostgreSQL y estados `pending/published/failed`. Evitar reintentos ciegos si el resultado de Facebook es incierto.
5. Ejecutar prueba de render y de publicación con página controlada; registrar ID y errores sin exponer tokens.
6. Solo entonces conectar scheduler de Pasarela a las 18:00 Central y habilitar `STORIES_PASARELA_ENABLED=true`. Las otras marcas permanecen desactivadas hasta validar su integración.
7. Instagram requiere integración propia y permisos específicos. No asumir que publicar en Facebook publica en Instagram ni viceversa.

## Precauciones
- El render genérico es una primera plantilla; revisar tipografía, legibilidad y derechos antes de producción.
- `publicar:true` es una operación real: **no usar en pruebas automáticas**.
- `ready` indica configuración local presente, **no** permisos Meta verificados.
- Los tokens reales nunca deben pegarse en issues, PR, capturas ni logs.
- Fancy mantiene web → redes; Rocimar mantiene noticia web verificada → redes.
