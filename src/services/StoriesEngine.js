'use strict';

/**
 * Stories Engine — orquestación sin scheduler ni efectos al importar.
 * Activación explícita por marca. No genera imágenes adicionales con IA.
 */
const { configuracionStories } = require('./StoriesBrands');
const { crearHistoriaPasarela, publicarHistoriaFacebook } = require('./PasarelaStories');

function fechaHoraCentral(fecha = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(fecha);
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { dia: obj.year + '-' + obj.month + '-' + obj.day, hora: Number(obj.hour), minuto: Number(obj.minute) };
}

function validarContenidoStory({ titulo, imagenBuffer, origen, verificado, derechosImagen }) {
  if (!String(titulo || '').trim()) throw new Error('Historia sin título');
  if (!Buffer.isBuffer(imagenBuffer) || imagenBuffer.length < 5000) throw new Error('Imagen inválida');
  if (!origen) throw new Error('Falta origen editorial');
  if (verificado !== true) throw new Error('Contenido no aprobado/verificado');
  if (derechosImagen !== true) throw new Error('Derechos de imagen no confirmados');
}

async function ejecutarStory({ marca, contenido, env = process.env, publicar = false, publicarFn = publicarHistoriaFacebook }) {
  const config = configuracionStories(marca, env);
  if (!config.enabled) return { ok: false, omitido: true, razon: 'DESACTIVADO' };
  if (!config.ready) return { ok: false, omitido: true, razon: 'CREDENCIALES_INCOMPLETAS' };
  validarContenidoStory(contenido);
  const imagen = await crearHistoriaPasarela({
    imagenBuffer: contenido.imagenBuffer,
    titulo: contenido.titulo,
    categoria: config.estilo.titulo
  });
  if (!publicar) return { ok: true, dryRun: true, bytes: imagen.length, marca };
  const resultado = await publicarFn({ pageId: config.pageId, pageToken: config.pageToken, imageBuffer: imagen });
  return { ok: true, marca, ...resultado };
}

module.exports = { fechaHoraCentral, validarContenidoStory, ejecutarStory };
