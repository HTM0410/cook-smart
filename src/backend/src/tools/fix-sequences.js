/* eslint-disable */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { Client } = require('pg');

(async () => {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error('Missing SUPABASE_DB_URL');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  console.log('Connected');

  const checks = [
    `SELECT MAX(id) AS max_id, COUNT(*) AS total FROM users`,
    `SELECT MAX(id) AS max_id, COUNT(*) AS total FROM user_favorites`,
    `SELECT pg_get_serial_sequence('users', 'id') AS users_seq`,
    `SELECT pg_get_serial_sequence('user_favorites', 'id') AS favorites_seq`,
    `SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'user_favorites' AND column_name = 'id'`,
    `SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id'`,
  ];

  for (const sql of checks) {
    const r = await client.query(sql);
    console.log('SQL:', sql);
    console.log(JSON.stringify(r.rows, null, 2));
    console.log('---');
  }

  // Diagnose & fix sequences
  try {
    const seqRow = await client.query(`SELECT pg_get_serial_sequence('user_favorites', 'id') AS s`);
    const seqName = seqRow.rows[0]?.s;
    console.log('Existing sequence for user_favorites.id:', seqName);

    if (!seqName) {
      console.log('Creating sequence user_favorites_id_seq and linking it to id column...');
      const maxId = (await client.query(`SELECT COALESCE(MAX(id), 0) AS m FROM user_favorites`)).rows[0].m;
      // Skip primary key if already exists
      await client.query(`CREATE SEQUENCE user_favorites_id_seq START WITH ${Number(maxId) + 1} INCREMENT BY 1`);
      await client.query(`ALTER TABLE user_favorites ALTER COLUMN id SET DEFAULT nextval('user_favorites_id_seq')`);
      console.log('user_favorites.id is now AUTO_INCREMENT via user_favorites_id_seq starting at', Number(maxId) + 1);
    } else {
      const r = await client.query(`SELECT setval($1, GREATEST((SELECT MAX(id) FROM user_favorites), 1), true) AS v`, [seqName]);
      console.log('Reset user_favorites sequence to:', r.rows[0].v, 'via', seqName);
    }
  } catch (e) {
    console.log('Reset user_favorites err:', e.message);
  }

  try {
    const seqRow2 = await client.query(`SELECT pg_get_serial_sequence('users', 'id') AS s`);
    const seqName2 = seqRow2.rows[0]?.s;
    console.log('Existing sequence for users.id:', seqName2);

    if (!seqName2) {
      console.log('Creating sequence users_id_seq and linking it to users.id column...');
      const maxId2 = (await client.query(`SELECT COALESCE(MAX(id), 0) AS m FROM users`)).rows[0].m;
      await client.query(`CREATE SEQUENCE users_id_seq START WITH ${Number(maxId2) + 1} INCREMENT BY 1`);
      await client.query(`ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq')`);
      console.log('users.id is now AUTO_INCREMENT via users_id_seq starting at', Number(maxId2) + 1);
    }
  } catch (e) {
    console.log('Reset users err:', e.message);
  }

  await client.end();
})();