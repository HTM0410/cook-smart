#!/usr/bin/env node
/**
 * Export toàn bộ dữ liệu từ Supabase Postgres về local (JSON theo từng bảng).
 *
 * Cách dùng (khuyến nghị):
 *   cd Data
 *   npm i
 *   node export-supabase-db.js --out ./supabase-export/db
 *
 * ENV:
 *   SUPABASE_DB_URL=postgresql://user:pass@host:5432/postgres
 *   (hoặc) SUPABASE_DB_HOST, SUPABASE_DB_USER, SUPABASE_DB_PASS, SUPABASE_DB_PORT, SUPABASE_DB_NAME
 *
 * Options:
 *   --out <dir>        Thư mục output (mặc định: Data/supabase-export/db)
 *   --schemas <list>   Danh sách schema, phân tách bởi dấu phẩy (mặc định: public)
 *   --batch <n>        Số dòng mỗi batch khi đọc (mặc định: 10000)
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config();

function parseArgs(argv) {
  const args = argv.slice(2);
  const outDefault = path.join(__dirname, 'supabase-export', 'db');
  const opts = { out: outDefault, schemas: ['public'], batch: 10000 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') opts.out = args[++i];
    else if (args[i] === '--schemas') opts.schemas = String(args[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (args[i] === '--batch') opts.batch = Number(args[++i]) || opts.batch;
  }
  return opts;
}

function buildDbUrlFromEnv() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const host = process.env.SUPABASE_DB_HOST;
  if (!host) return null;
  const user = process.env.SUPABASE_DB_USER || 'postgres';
  const pass = process.env.SUPABASE_DB_PASS || '';
  const port = process.env.SUPABASE_DB_PORT || 5432;
  const db = process.env.SUPABASE_DB_NAME || 'postgres';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function safeFilePart(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function listTables(client, schemas) {
  const res = await client.query(
    `
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema = ANY($1)
    ORDER BY table_schema, table_name
    `,
    [schemas]
  );
  return res.rows;
}

async function exportTable(client, { table_schema, table_name }, outDir, batchSize) {
  const schemaDir = path.join(outDir, safeFilePart(table_schema));
  ensureDir(schemaDir);

  const filePath = path.join(schemaDir, `${safeFilePart(table_name)}.json`);
  const metaPath = path.join(schemaDir, `${safeFilePart(table_name)}.meta.json`);

  const qualified = `"${table_schema}"."${table_name}"`;

  const countRes = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${qualified}`);
  const total = Number(countRes.rows?.[0]?.count ?? 0);

  const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });
  stream.write('[\n');

  let exported = 0;
  let offset = 0;
  let first = true;

  while (exported < total) {
    const res = await client.query(
      `SELECT * FROM ${qualified} ORDER BY ctid LIMIT $1 OFFSET $2`,
      [batchSize, offset]
    );

    if (!res.rows.length) break;
    for (const row of res.rows) {
      const json = JSON.stringify(row);
      if (!first) stream.write(',\n');
      stream.write(json);
      first = false;
      exported++;
    }
    offset += res.rows.length;
    if (res.rows.length < batchSize) break;
  }

  stream.write('\n]\n');
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    stream.end();
  });

  const meta = {
    table_schema,
    table_name,
    qualified,
    total_rows: total,
    exported_rows: exported,
    exported_at: new Date().toISOString()
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  return meta;
}

async function main() {
  const opts = parseArgs(process.argv);
  const dbUrl = buildDbUrlFromEnv();

  if (!dbUrl) {
    console.error('❌ Thiếu cấu hình DB.');
    console.error('Cần set SUPABASE_DB_URL hoặc SUPABASE_DB_HOST/SUPABASE_DB_USER/SUPABASE_DB_PASS trong ENV.');
    process.exit(1);
  }

  ensureDir(opts.out);

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    const tables = await listTables(client, opts.schemas);
    if (!tables.length) {
      console.log('⚠️  Không tìm thấy bảng nào trong schemas:', opts.schemas.join(', '));
      return;
    }

    const summary = {
      exported_at: new Date().toISOString(),
      schemas: opts.schemas,
      out: path.resolve(opts.out),
      batch: opts.batch,
      tables: []
    };

    console.log(`📦 Sẽ export ${tables.length} bảng (${opts.schemas.join(', ')})...`);

    for (const t of tables) {
      console.log(`⬇️  Export ${t.table_schema}.${t.table_name}`);
      const meta = await exportTable(client, t, opts.out, opts.batch);
      summary.tables.push(meta);
    }

    const summaryPath = path.join(opts.out, '_export-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log('✅ Xong. Summary:', summaryPath);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi export:', err?.message || err);
  process.exit(1);
});

