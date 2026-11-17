'use strict';

/**
 * Registro idempotente de Stories en PostgreSQL.
 * Solo se ejecuta mediante llamadas explícitas; no hay migraciones al importar.
 * La reserva bloquea duplicados, incluidos intentos concurrentes.
 */
const TABLE = 'stories_publicaciones';

async function crearTablaStories(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stories_publicaciones (
      clave TEXT PRIMARY KEY,
      marca TEXT NOT NULL,
      contenido_id TEXT NOT NULL,
      fecha_central DATE NOT NULL,
      estado TEXT NOT NULL CHECK (estado IN ('pending','published','failed','uncertain')),
      facebook_story_id TEXT,
      error TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function reservarStory(pool, { clave, marca, contenidoId, fechaCentral }) {
  if (![clave, marca, contenidoId, fechaCentral].every(x => typeof x === 'string' && x.trim())) {
    throw new Error('Identificadores incompletos');
  }
  const res = await pool.query(
    `INSERT INTO ${TABLE} (clave, marca, contenido_id, fecha_central, estado)
     VALUES ($1,$2,$3,$4,'pending')
     ON CONFLICT (clave) DO NOTHING RETURNING clave`,
    [clave, marca, contenidoId, fechaCentral]
  );
  return res.rowCount === 1;
}

async function marcarPublicada(pool, clave, storyId) {
  if (!storyId) throw new Error('Falta storyId');
  return pool.query(
    `UPDATE ${TABLE} SET estado='published', facebook_story_id=$2, error=NULL, actualizado_en=NOW()
     WHERE clave=$1 AND estado='pending'`, [clave, String(storyId)]
  );
}

async function marcarIncierta(pool, clave, error) {
  return pool.query(
    `UPDATE ${TABLE} SET estado='uncertain', error=$2, actualizado_en=NOW()
     WHERE clave=$1 AND estado='pending'`, [clave, String(error || 'Resultado Meta sin confirmar').slice(0,500)]
  );
}

async function consultarStory(pool, clave) {
  const res = await pool.query(`SELECT clave, marca, estado, facebook_story_id, error FROM ${TABLE} WHERE clave=$1`, [clave]);
  return res.rows[0] || null;
}

module.exports = { crearTablaStories, reservarStory, marcarPublicada, marcarIncierta, consultarStory };
