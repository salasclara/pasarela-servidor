'use strict';

/**
 * Canal controlado para una Story ya aprobada.
 * Registro previo obligatorio para publicar. No reintenta estados inciertos.
 * No hay scheduler ni ejecución al importar.
 */
const { crearClaveStory, horaCentral } = require('./StoriesScheduler');
const { reservarStory, marcarPublicada, marcarIncierta } = require('./StoriesRegistry');
const { ejecutarStory } = require('./StoriesEngine');
const { configuracionStories } = require('./StoriesBrands');
const { validarContenidoStory } = require('./StoriesEngine');

async function procesarStoryAprobada({ pool, marca, contenido, idContenido, fecha = new Date(), env = process.env, publicar = false, publicarFn }) {
  if (!pool || typeof pool.query !== 'function') throw new Error('Falta registro PostgreSQL');
  if (!contenido || contenido.verificado !== true || contenido.derechosImagen !== true) {
    return { ok: false, omitido: true, razon: 'SIN_APROBACION_EDITORIAL' };
  }
  const cfg = configuracionStories(marca, env);
  if (!cfg.enabled || !cfg.ready) return { ok: false, omitido: true, razon: !cfg.enabled ? 'DESACTIVADO' : 'CREDENCIALES_INCOMPLETAS' };
  validarContenidoStory(contenido);
  if (!publicar) {
    return ejecutarStory({ marca, contenido, env, publicar: false, publicarFn });
  }
  const fechaCentral = horaCentral(fecha).dia;
  const clave = crearClaveStory(marca, fechaCentral, idContenido);
  const reservada = await reservarStory(pool, { clave, marca, contenidoId: String(idContenido), fechaCentral });
  if (!reservada) return { ok: false, omitido: true, razon: 'YA_RESERVADA', clave };
  try {
    const resultado = await ejecutarStory({ marca, contenido, env, publicar: true, publicarFn });
    if (!resultado.ok) {
      await marcarIncierta(pool, clave, resultado.razon || 'No publicada');
      return resultado;
    }
    if (!resultado.storyId) throw new Error('Meta no confirmó el identificador de la Historia');
    await marcarPublicada(pool, clave, resultado.storyId);
    return { ...resultado, clave };
  } catch (error) {
    await marcarIncierta(pool, clave, error.message);
    throw error;
  }
}

module.exports = { procesarStoryAprobada };
