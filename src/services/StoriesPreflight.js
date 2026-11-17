'use strict';
/**
 * Diagnóstico local y de solo lectura. No consulta Meta ni publica.
 * Nunca incluye tokens o secretos en los resultados.
 */
const { configuracionStories } = require('./StoriesBrands');
const { evaluarHorarioStory } = require('./StoriesScheduler');
function diagnosticarStory(marca, env = process.env, fecha = new Date()) {
  const cfg = configuracionStories(marca, env);
  const horario = evaluarHorarioStory(marca, fecha, env);
  return {
    marca,
    activada: cfg.enabled,
    paginaConfigurada: /^\d+$/.test(String(cfg.pageId || '')),
    tokenPresente: Boolean(cfg.pageToken),
    horaCentral: cfg.horaCentral,
    horario: horario.razon,
    preparadaLocalmente: cfg.ready && /^\d+$/.test(String(cfg.pageId || '')),
    metaVerificado: false,
    publicacionAutomaticaActiva: false,
    aviso: 'Este diagnóstico no verifica permisos de Meta ni activa el scheduler.'
  };
}
module.exports = { diagnosticarStory };
