const path = require('path');
const envPath = path.join(__dirname, '..', 'src', 'backend', '.env');
require('dotenv').config({ path: envPath });
const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
  });
  await client.connect();

  const checks = [
    `SELECT MAX(id) AS max_id, COUNT(*) AS total FROM users`,
    `SELECT MAX(id) AS max_id, COUNT(*) AS total FROM user_favorites`,
    `SELECT pg_get_serial_sequence('users', 'id') AS users_seq`,
    `SELECT pg_get_serial_sequence('user_favorites', 'id') AS favorites_seq`,
    `SELECT last_value, is_called FROM users_id_seq`,
    `SELECT last_value, is_called FROM user_favorites_id_seq`,
  ];

  for (const sql of checks) {
    try {
      const r = await client.query(sql);
      console.log('SQL:', sql);
      console.log(JSON.stringify(r.rows, null, 2));
      console.log('---');
    } catch (e) {
      console.log('Error for:', sql, e.message);
    }
  }

  // Fix sequences
  try {
    await client.query(`SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 1), true)`);
    console.log('Reset users sequence OK');
  } catch (e) {
    console.log('Reset users err:', e.message);
  }

  try {
    await client.query(`SELECT setval('user_favorites_id_seq', GREATEST((SELECT MAX(id) FROM user_favorites), 1), true)`);
    console.log('Reset user_favorites sequence OK');
  } catch (e) {
    console.log('Reset user_favorites err:', e.message);
  }

  await client.end();
})();