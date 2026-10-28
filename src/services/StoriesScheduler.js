'use strict';

/**
 * Planificador de Stories: lógica pura. No publica ni activa tareas.
 * Fecha/hora en America/Chicago, sin cálculos manuales de DST.
 */
const { configuracionStories } = require('./StoriesBrands');

function horaCentral(fecha = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(fecha);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { dia: p.year + '-' + p.month + '-' + p.day, hora: Number(p.hour), minuto: Number(p.minute) };
}

function crearClaveStory(marca, fechaCentral, idContenido) {
  if (!/^[a-z_]+$/.test(marca || '') || !/^\d{4}-\d{2}-\d{2}$/.test(fechaCentral || '') || !String(idContenido || '').trim()) {
    throw new Error('Faltan identificadores de Story');
  }
  return marca + ':' + fechaCentral + ':' + encodeURIComponent(String(idContenido).trim());
}

function evaluarHorarioStory(marca, fecha = new Date(), env = process.env) {
  const cfg = configuracionStories(marca, env);
  const ahora = horaCentral(fecha);
  if (!cfg.enabled) return { ejecutar: false, razon: 'DESACTIVADO', ahora };
  if (!cfg.ready) return { ejecutar: false, razon: 'CREDENCIALES_INCOMPLETAS', ahora };
  if (!Number.isInteger(cfg.horaCentral)) return { ejecutar: false, razon: 'SIN_HORARIO', ahora };
  if (ahora.hora !== cfg.horaCentral || ahora.minuto >= 10) return { ejecutar: false, razon: 'FUERA_DE_HORARIO', ahora };
  return { ejecutar: true, razon: 'EN_VENTANA', ahora };
}

module.exports = { horaCentral, crearClaveStory, evaluarHorarioStory };
