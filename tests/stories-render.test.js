'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createCanvas } = require('@napi-rs/canvas');
const { crearHistoriaPasarela } = require('../src/services/PasarelaStories');
const { configuracionStories } = require('../src/services/StoriesBrands');

test('genera Story vertical JPEG real sin Meta ni IA', async () => {
  const c=createCanvas(600,900), ctx=c.getContext('2d');
  ctx.fillStyle='#805065';ctx.fillRect(0,0,600,900);
  ctx.fillStyle='#f7ddaa';ctx.fillRect(120,180,360,420);
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
