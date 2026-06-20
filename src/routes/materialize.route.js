const express = require('express');
const router = express.Router();

router.post('/materialize', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const { idea } = req.body || {};

  if (!idea || typeof idea !== 'string' || !idea.trim()) {
    return res.status(400).json({
      success: false,
      error: 'IDEA_REQUIRED',
      message: 'El campo "idea" es obligatorio.'
    });
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `Eres el motor editorial de PASARELA, revista de moda y talento latina con 37 años en Dallas, Texas. Devuelves ÚNICAMENTE JSON puro, sin markdown, sin texto adicional. La categoría DEBE ser exactamente una de: MODA, BELLEZA, TALENTO, EVENTOS, LIFESTYLE, EXCLUSIVAS. Titular en MAYÚSCULAS máx 8 palabras. Gancho: 2-3 líneas emocionales separadas por \\n, estilo fashion magazine, en minúscula. Hero: UNA palabra en MAYÚSCULAS. Formato exacto: {"categoria":"MODA","titular":"...","gancho":"...\\n...\\n...","hero":"..."}`,
      messages: [{ role: 'user', content: `Idea: "${idea.trim().slice(0, 500)}"` }]
    });

    const raw = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    const editorial = JSON.parse(raw);

    const valid = ['MODA','BELLEZA','TALENTO','EVENTOS','LIFESTYLE','EXCLUSIVAS'];
    const categoria = valid.includes((editorial.categoria || '').toUpperCase())
      ? editorial.categoria.toUpperCase()
      : 'EXCLUSIVAS';

    const n = new Date();
    const pdpId = `PDP-${String(n.getFullYear()).slice(2)}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*9000)+1000)}`;

    return res.status(200).json({
      success: true,
      data: {
        categoria,
        titular: editorial.titular || 'PASARELA',
        gancho: editorial.gancho || 'El estilo es una declaración.',
        hero: editorial.hero || 'PODER',
        pdpId
      }
    });

  } catch (error) {
    console.error('MATERIALIZE_ERROR:', error);
    return res.status(500).json({
      success: false,
      error: 'MATERIALIZE_FAILED',
      message: error.message
    });
  }
});

module.exports = router;