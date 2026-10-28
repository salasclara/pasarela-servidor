'use strict';

/**
 * Stories Engine — configuraciones por marca, SIN ejecución automática.
 * Todas las marcas permanecen desactivadas hasta pruebas autorizadas.
 * Los tokens nunca se guardan en este archivo.
 */
const STORIES_BRANDS = Object.freeze({
  pasarela: {
    nombre: 'Pasarela Studio Internacional',
    enabledEnv: 'STORIES_PASARELA_ENABLED',
    pageTokenEnv: 'FACEBOOK_PAGE_TOKEN',
    pageIdEnv: 'FACEBOOK_PAGE_ID',
    pageIdDefault: '160291140702239',
    horaCentral: 18,
    fuente: 'articulo_editorial',
    estilo: { titulo: 'PASARELA', fondo: '#7B2D3E', acento: '#E7C47B' }
  },
  amar_es: {
    nombre: 'Amar Es',
    enabledEnv: 'STORIES_AMAR_ES_ENABLED',
    pageTokenEnv: 'AMAR_ES_TOKEN',
    pageIdEnv: 'AMAR_ES_PAGE_ID',
    pageIdDefault: '529892146881748',
    horaCentral: null,
    fuente: 'publicacion_amor',
    estilo: { titulo: 'AMAR ES', fondo: '#9B4063', acento: '#FFE0EA' }
  },
  maravillas: {
    nombre: 'Maravillas del Reino',
    enabledEnv: 'STORIES_MARAVILLAS_ENABLED',
    pageTokenEnv: 'COMUNIDAD_FE_PAGE_TOKEN',
    pageIdEnv: 'MARAVILLAS_PAGE_ID',
    horaCentral: null,
    fuente: 'publicacion_fe',
    estilo: { titulo: 'MARAVILLAS DEL REINO', fondo: '#55386D', acento: '#F4D69B' }
  },
  fancy: {
    nombre: 'Fancy by Roxette',
    enabledEnv: 'STORIES_FANCY_ENABLED',
    pageTokenEnv: 'FANCY_BY_TOKEN',
    pageIdEnv: 'FANCY_PAGE_ID',
    pageIdDefault: '2645809545432358',
    horaCentral: null,
    fuente: 'resena_web_aprobada',
    estilo: { titulo: 'FANCY BY ROXETTE', fondo: '#23252B', acento: '#E8D3B3' }
  },
  rocimar: {
    nombre: 'Noticias con Rocimar Morales',
    enabledEnv: 'STORIES_ROCIMAR_ENABLED',
    pageTokenEnv: 'ROCIMAR_PAGE_TOKEN',
    pageIdEnv: 'ROCIMAR_PAGE_ID',
    horaCentral: null,
    fuente: 'noticia_web_verificada',
    estilo: { titulo: 'NOTICIAS CON ROCIMAR', fondo: '#17385A', acento: '#FFFFFF' }
  }
});

function configuracionStories(brand, env = process.env) {
  const cfg = STORIES_BRANDS[brand];
  if (!cfg) throw new Error('Marca Stories desconocida: ' + brand);
  const enabled = String(env[cfg.enabledEnv] || '').toLowerCase() === 'true';
  return {
    ...cfg,
    enabled,
    pageId: env[cfg.pageIdEnv] || cfg.pageIdDefault || null,
    pageToken: env[cfg.pageTokenEnv] || null,
    ready: enabled && Boolean(env[cfg.pageIdEnv] || cfg.pageIdDefault) && Boolean(env[cfg.pageTokenEnv])
  };
}

module.exports = { STORIES_BRANDS, configuracionStories };
