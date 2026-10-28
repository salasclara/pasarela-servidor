'use strict';

/**
 * Pasarela Stories — módulo aislado, NO activado en producción.
 * Facebook Page photo Story: subir foto no publicada y crear photo_story.
 * Ninguna función se ejecuta al importar este módulo.
 * Requiere token de página con pages_manage_posts y permisos adecuados.
 * La publicación cruzada a Instagram NO se asume.
 */

const { createCanvas, loadImage } = require('@napi-rs/canvas');

function recortarTexto(texto, max = 105) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}

async function crearHistoriaPasarela({ imagenBuffer, titulo, categoria = 'MODA · ESTILO · CULTURA' }) {
  if (!Buffer.isBuffer(imagenBuffer) || imagenBuffer.length < 5000) {
    throw new Error('Se necesita una imagen válida con derechos de uso');
  }
  const W = 1080, H = 1920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const img = await loadImage(imagenBuffer);
  const scale = Math.max(W / img.width, H / img.height);
  const iw = img.width * scale, ih = img.height * scale;
  ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);

  const grad = ctx.createLinearGradient(0, 780, 0, H);
  grad.addColorStop(0, 'rgba(27,10,18,0)');
  grad.addColorStop(0.48, 'rgba(54,15,30,0.76)');
  grad.addColorStop(1, 'rgba(42,9,22,0.97)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Mantener texto fuera de la zona superior/inferior de controles de Stories.
  ctx.fillStyle = '#7B2D3E';
  ctx.fillRect(55, 190, 970, 100);
  ctx.fillStyle = '#E7C47B';
  ctx.textAlign = 'center';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('PASARELA', 540, 255);
  ctx.fillStyle = '#FFF8EF';
  ctx.font = 'bold 27px sans-serif';
  ctx.fillText(recortarTexto(categoria, 45).toUpperCase(), 540, 1350);

  const words = recortarTexto(titulo, 88).split(' ');
  const lines = [];
  let line = '';
  ctx.font = 'bold 67px sans-serif';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width > 915 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  ctx.fillStyle = '#FFFFFF';
  const shown = lines.slice(0, 4);
  shown.forEach((value, index) => ctx.fillText(value, 540, 1460 + index * 85));

  ctx.fillStyle = '#E7C47B';
  ctx.fillRect(365, 1810, 350, 3);
  return canvas.toBuffer('image/jpeg', { quality: 0.88 });
}

async function publicarHistoriaFacebook({ pageId, pageToken, imageBuffer, graphVersion = 'v26.0' }) {
  if (!/^\d+$/.test(String(pageId || '')) || !pageToken || !Buffer.isBuffer(imageBuffer)) {
    throw new Error('Faltan pageId, pageToken o imageBuffer');
  }
  if (imageBuffer.length > 4 * 1024 * 1024) throw new Error('Historia superior a 4 MB');
  const base = 'https://graph.facebook.com/' + graphVersion + '/' + pageId;
  const form = new FormData();
  form.append('published', 'false');
  form.append('source', new Blob([imageBuffer], { type: 'image/jpeg' }), 'pasarela-story.jpg');
  const uploaded = await fetch(base + '/photos', {
    method: 'POST', headers: { Authorization: 'Bearer ' + pageToken }, body: form
  });
  const photo = await uploaded.json();
  if (!uploaded.ok || !photo.id) throw new Error('Error al cargar foto: ' + (photo.error?.message || uploaded.status));
  const params = new URLSearchParams({ photo_id: String(photo.id) });
  const posted = await fetch(base + '/photo_stories', {
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
