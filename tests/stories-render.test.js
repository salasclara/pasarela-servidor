'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createCanvas } = require('@napi-rs/canvas');
const { crearHistoriaPasarela } = require('../src/services/PasarelaStories');
const { configuracionStories } = require('../src/services/StoriesBrands');

test('genera Story vertical JPEG real sin Meta ni IA', async () => {
  const c=createCanvas(600,900), ctx=c.getContext('2d');
  // Fondo ilustrado de prueba a sangre; no es fotografía ni material para publicar.
  const bg=ctx.createLinearGradient(0,0,600,900);
  bg.addColorStop(0,'#b8a8a2');bg.addColorStop(0.5,'#70505f');bg.addColorStop(1,'#302634');
  ctx.fillStyle=bg;ctx.fillRect(0,0,600,900);
  ctx.fillStyle='#d6c1ae';ctx.beginPath();ctx.ellipse(300,240,90,125,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#211c28';ctx.beginPath();ctx.ellipse(300,152,105,75,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#151821';ctx.beginPath();ctx.moveTo(200,345);ctx.lineTo(400,345);
  ctx.lineTo(530,900);ctx.lineTo(70,900);ctx.closePath();ctx.fill();
  ctx.fillStyle='#f5d6b4';ctx.fillRect(273,342,54,75);
  const input=await c.encode('jpeg');
  const estilo=configuracionStories('pasarela',{}).estilo;
  assert.equal(estilo.fondo,'#FF008A');
  assert.equal(estilo.titulo,'PASARELA STUDIO INTERNACIONAL');
  const output=await crearHistoriaPasarela({imagenBuffer:input,titulo:'La moda latina conquista nuevos escenarios en Dallas',categoria:'EDITORIAL',marca:estilo.titulo,fondo:estilo.fondo,acento:estilo.acento});
  assert.ok(output.length>5000);
  assert.equal(output[0],0xff);assert.equal(output[1],0xd8);
  const {loadImage}=require('@napi-rs/canvas');
  const img=await loadImage(output);
  assert.equal(img.width,1080);assert.equal(img.height,1920);
  if (process.env.STORY_PREVIEW_PATH) fs.writeFileSync(process.env.STORY_PREVIEW_PATH,output);
});
