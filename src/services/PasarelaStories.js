'use strict';

/**
 * Pasarela Stories — módulo aislado, NO activado en producción.
 * Facebook Page photo Story: subir foto no publicada y crear photo_story.
 * Ninguna función se ejecuta al importar este módulo.
 * Requiere token de página con pages_manage_posts y permisos adecuados.
 * La publicación cruzada a Instagram NO se asume.
 */

// Cargar canvas solo cuando se renderiza una imagen; las validaciones no lo requieren.

function recortarTexto(texto, max = 105) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}

async function crearHistoriaPasarela({ imagenBuffer, titulo, categoria = 'MODA · ESTILO · CULTURA', marca = 'PASARELA', fondo = '#FF008A', acento = '#FFFFFF' }) {
  if (!Buffer.isBuffer(imagenBuffer) || imagenBuffer.length < 5000) {
    throw new Error('Se necesita una imagen válida con derechos de uso');
  }
  const { createCanvas, loadImage } = require('@napi-rs/canvas');
  const W = 1080, H = 1920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const img = await loadImage(imagenBuffer);
  const scale = Math.max(W / img.width, H / img.height);
  const iw = img.width * scale, ih = img.height * scale;
  ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);

  // Referencia Pasarela: foto completa, bandas fucsia y titulares blancos.
  const grad = ctx.createLinearGradient(0, 780, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0.90)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, 125);
  ctx.fillRect(0, H - 125, W, 125);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '36px sans-serif';
  ctx.fillText(recortarTexto(marca, 45).toUpperCase(), W / 2, 78);
  ctx.textAlign = 'left';
  ctx.fillStyle = fondo;
  ctx.fillRect(65, 1330, 215, 55);
  ctx.fillStyle = acento;
  ctx.font = 'bold 25px sans-serif';
  ctx.fillText(recortarTexto(categoria, 13).toUpperCase(), 83, 1367);
  const words = recortarTexto(titulo, 100).split(' ');
  const lines = [];
  let line = '';
  ctx.font = 'bold 68px sans-serif';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width > 940 && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  ctx.fillStyle = '#FFFFFF';
  lines.slice(0, 4).forEach((value, index) => ctx.fillText(value, 65, 1470 + index * 82));
  ctx.textAlign = 'center';
  ctx.font = '23px sans-serif';
  ctx.fillText('PASARELA STUDIO INTERNACIONAL  ·  pasarelastudiointer.com', W / 2, H - 52);
  return canvas.toBuffer('image/jpeg', 88);
}

async function publicarHistoriaFacebook({ pageId, pageToken, imageBuffer, graphVersion = 'v26.0', fetchFn = fetch }) {
  if (!/^\d+$/.test(String(pageId || '')) || !pageToken || !Buffer.isBuffer(imageBuffer)) {
    throw new Error('Faltan pageId, pageToken o imageBuffer');
  }
  if (imageBuffer.length > 4 * 1024 * 1024) throw new Error('Historia superior a 4 MB');
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new Error('Versión Graph API inválida');
  const base = 'https://graph.facebook.com/' + graphVersion + '/' + pageId;
  const form = new FormData();
  form.append('published', 'false');
  form.append('source', new Blob([imageBuffer], { type: 'image/jpeg' }), 'pasarela-story.jpg');
  const uploaded = await fetchFn(base + '/photos', {
    method: 'POST', headers: { Authorization: 'Bearer ' + pageToken }, body: form
  });
  const photo = await uploaded.json();
  if (!uploaded.ok || !photo.id) throw new Error('Error al cargar foto: ' + (photo.error?.message || uploaded.status));
  const params = new URLSearchParams({ photo_id: String(photo.id) });
  const posted = await fetchFn(base + '/photo_stories', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + pageToken, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const story = await posted.json();
  if (!posted.ok || story.error || !story.post_id) {
    throw new Error('Error al publicar Historia: ' + (story.error?.message || posted.status));
  }
  return { photoId: photo.id, storyId: story.post_id };
}

module.exports = { crearHistoriaPasarela, publicarHistoriaFacebook };
