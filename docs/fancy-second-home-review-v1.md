# Segunda reseña HOME — Revisión editorial

**Título:** Cómo organizar los cajones de la cocina sin comprar nada primero

**Slug propuesto:** `organizar-cajones-cocina-sin-comprar`

**Categoría:** HOME

**Estado actual:** BORRADOR, pendiente de aprobación editorial de la propietaria.

**URL futura (NO activa hasta publicar):** `https://www.fancybyroxette.com/home/organizar-cajones-cocina-sin-comprar/`

## Objetivo y contenido

La reseña explica cómo ordenar cajones sin comprar organizadores al principio: vaciar solo uno, agrupar por función, priorizar lo cotidiano, probar la distribución una semana y medir antes de adquirir separadores. Es una reseña práctica sin marcas ni enlaces afiliados.

El texto estructurado vive en `test/fixtures/fancy-home-cajones-review-v1.json` y se transforma al HTML del sitio con el publicador existente. No presupone productos verificados ni imágenes licenciadas de terceros.

## Revisión antes de publicar

- Confirmar que el texto sea fiel a la voz HOME de Fancy By Roxette.
- Confirmar el título, URL, que no usa imágenes ajenas, y que no hay productos ni precios que verificar.
- Ejecutar simulación con el publicador sin habilitar LIVE.
- Para publicación web real: requiere permiso GitHub Contents write sobre `salasclara/fancy-by-roxette-web`, autorización explícita y verificación de HTML de Vercel.
- Tras publicar, comprobar que aparece en el índice HOME; nunca usar aprobación social implícita.
- Distribución Facebook requiere autorización independiente después de verificar el enlace y ejecutar staging. El scheduler automático sigue desactivado.

## Visibilidad en buscadores

Se corrige en este PR `noindex,nofollow` a `index,follow` para **nuevas páginas** generadas por el adaptador. No modifica páginas ya publicadas. Esta etiqueta permite indexación, pero no garantiza que Google indexe: revisar también robots.txt, cabeceras HTTP y canónicas.

## No se ha hecho

- No se publicó esta segunda reseña en la web pública.
- No se hicieron nuevos envíos a Facebook ni Instagram.
- No se cambió Railway, cron, bases de datos ni credenciales.
