'use strict';

/**
 * Adaptador editorial Pasarela: solo recupera contenido ya publicado.
 * No publica nada, no descarga imágenes ni altera la tabla noticias.
 * Las imágenes se proporcionan desde un origen autorizado.
 */
async function obtenerArticuloPasarela(pool, { slug } = {}) {
  if (!pool || typeof pool.query !== 'function') throw new Error('Falta conexión a PostgreSQL');
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,180}$/.test(slug)) {
    throw new Error('Slug de artículo inválido');
  }
  const result = await pool.query(
    `SELECT titulo, slug, imagen, contenido
       FROM noticias
      WHERE slug = $1 AND publicado = true
      LIMIT 1`,
    [slug]
  );
  const noticia = result.rows[0];
  if (!noticia) return null;
  return {
    idContenido: noticia.slug,
    titulo: noticia.titulo,
    url: 'https://pasarelastudiointer.com/noticias/' + noticia.slug,
    imagenUrl: noticia.imagen || null,
    extracto: String(noticia.contenido || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220),
    // La existencia en la web NO certifica permisos de imagen ni verificación.
    verificado: false,
    derechosImagen: false
  };
}

module.exports = { obtenerArticuloPasarela };
