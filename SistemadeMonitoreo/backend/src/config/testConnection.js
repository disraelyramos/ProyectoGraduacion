const pool = require('./db');

async function test() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('📅 Hora actual del servidor DB:', res.rows[0].now);
  } catch (err) {
    console.error('❌ Error probando conexión:', err);
  } finally {
    pool.end();
  }
}

test();
