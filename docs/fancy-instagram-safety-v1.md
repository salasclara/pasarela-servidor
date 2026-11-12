# Fancy Instagram: seguridad previa a la integración web-first

El servidor ya disponía de `FancyInstagramPublisher.js` y de una ruta manual `/test-fancy-instagram-publish`. No es necesario crear un segundo publicador.

## Corrección

- `GET /test-fancy-instagram-publish` **solo consulta** si faltan credenciales. Ya no publica imágenes aunque se proporcionen parámetros `image` o `caption` en la URL.
- Publicación de prueba: **POST** exclusivamente; deshabilitada por defecto. Requiere `FANCY_INSTAGRAM_TEST_PUBLISH_ENABLED=yes` y secreto independiente `FANCY_INSTAGRAM_TEST_SECRET` transmitido en cabecera `Authorization: Bearer ...`, nunca en la URL.
- Toda imagen debe estar en `https://www.fancybyroxette.com/images/`, `/media/` o `/home/`, con extensión jpg/jpeg/png, y debe contar con confirmaciones editoriales y de derechos de imagen.
- No se devuelve el error completo de Meta al navegador para evitar información sensible.
- Sin esas variables **no hay publicaciones a Instagram**. No cambiamos token, feed, cron, servidores ni variables de Railway.

## Pendiente

Es necesario publicar una imagen HOME original/licenciada en el sitio, comprobar que sea públicamente descargable por Meta, verificar `FANCY_INSTAGRAM_USER_ID` y permisos de Instagram Content Publishing, realizar una prueba autorizada y registrar sus IDs/estados en PostgreSQL. Después incorporar a la cola web-first existente con idempotencia y revisión editorial. Nunca activar una publicación IG desde GET.

**Nota**: El POST controlado no es aún el flujo definitivo de Instagram; la conexión a la cola PostgreSQL permanece pendiente.
