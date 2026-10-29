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
  const grad = ctx.createLinearGradient(0, 900, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0.83)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 850, W, H - 850);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, 125);
  ctx.fillRect(0, H - 125, W, 125);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 40px DejaVu Sans';
  ctx.fillText(recortarTexto(marca, 45).toUpperCase(), W / 2, 78, 980);
  ctx.textAlign = 'left';
  ctx.fillStyle = fondo;
  ctx.fillRect(65, 1330, 215, 55);
  ctx.fillStyle = acento;
  ctx.font = 'bold 27px DejaVu Sans';
  ctx.fillText(recortarTexto(categoria, 13).toUpperCase(), 83, 1367);
  // Ajustar el titular a un máximo de cuatro líneas sin recortar palabras.
  const words = recortarTexto(titulo, 110).split(' ');
  let lines = [];
  let fontSize = 76;
  for (; fontSize >= 52; fontSize -= 4) {
    ctx.font = 'bold ' + fontSize + 'px DejaVu Sans';
    lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > 940 && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 4) break;
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold ' + fontSize + 'px DejaVu Sans';
  const lineHeight = fontSize * 1.15;
  const startY = Math.min(1450, 1730 - (lines.length - 1) * lineHeight);
  lines.slice(0, 4).forEach((value, index) =>
    ctx.fillText(value, 65, startY + index * lineHeight, 940));
  ctx.textAlign = 'center';
  ctx.font = 'bold 27px DejaVu Sans';
  ctx.fillText('pasarelastudiointer.com', W / 2, H - 52);
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


/**
 * Portada editorial independiente: sin foto de terceros ni retratos generados.
 * Diseñada para microreseñas de tendencias; no publica por sí sola.
 */
async function crearHistoriaEditorialPasarela({
  titulo, subtitulo = '', categoria = 'TENDENCIAS',
  tema = 'SCARLET POWER', fondo = '#FF008A'
}) {
  if (!String(titulo || '').trim()) throw new Error('Falta titular editorial');
  const { createCanvas } = require('@napi-rs/canvas');
  const W = 1080, H = 1920, c = createCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#09080C'; ctx.fillRect(0, 0, W, H);
  // Arte abstracto geométrico original: no reproduce imágenes de terceros.
  const grad = ctx.createLinearGradient(0, 380, W, 1540);
  grad.addColorStop(0, '#240810'); grad.addColorStop(0.6, '#701126'); grad.addColorStop(1, '#13060C');
  ctx.fillStyle = grad; ctx.fillRect(0, 340, W, 1250);
  ctx.save(); ctx.globalAlpha = 0.42; ctx.translate(750, 970); ctx.rotate(-0.38);
  ctx.fillStyle = '#C51B3D'; ctx.fillRect(-165, -660, 330, 1320);
  ctx.fillStyle = '#FD5A78'; ctx.fillRect(80, -660, 90, 1320);
  ctx.restore();
  ctx.fillStyle = '#09080C'; ctx.fillRect(0, 0, W, 325);
  ctx.fillStyle = fondo; ctx.font = 'bold 104px DejaVu Sans';
  ctx.textAlign = 'center'; ctx.fillText('PASARELA', W / 2, 202, 910);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 27px DejaVu Sans';
  ctx.fillText('STUDIO INTERNACIONAL', W / 2, 260, 850);
  ctx.fillStyle = fondo; ctx.fillRect(76, 410, 360, 5);
  ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 33px DejaVu Sans'; ctx.fillText(recortarTexto(categoria, 20).toUpperCase(), 76, 394, 850);
  // Bloque opaco para lectura, manteniendo zona segura inferior.
  ctx.fillStyle = 'rgba(0,0,0,0.80)'; ctx.fillRect(0, 1110, W, 600);
  const words = recortarTexto(titulo, 90).toUpperCase().split(' ');
  let lines = [], fontSize = 80;
  for (; fontSize >= 46; fontSize -= 2) {
    ctx.font = 'bold ' + fontSize + 'px DejaVu Sans';
    lines = []; let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > 900 && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= 3 && lines.every(x => ctx.measureText(x).width <= 900)) break;
  }
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold ' + fontSize + 'px DejaVu Sans';
  lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, 76, 1210 + i * fontSize * 1.2));
  const y = 1240 + Math.min(3, lines.length) * fontSize * 1.2;
  ctx.font = '32px DejaVu Sans'; ctx.fillStyle = '#F0DDE5';
  const sub = recortarTexto(subtitulo, 85);
  if (sub) ctx.fillText(sub, 76, Math.min(y, 1600), 910);
  ctx.fillStyle = fondo; ctx.fillRect(76, 1745, 928, 4);
  ctx.font = 'bold 31px DejaVu Sans'; ctx.fillText(recortarTexto(tema, 32).toUpperCase(), 76, 1810, 900);
  ctx.fillStyle = '#FFFFFF'; ctx.font = '27px DejaVu Sans';
  ctx.fillText('pasarelastudiointer.com', 76, 1860, 900);
  return c.toBuffer('image/jpeg', 88);
}

module.exports = { crearHistoriaPasarela, crearHistoriaEditorialPasarela, publicarHistoriaFacebook };
