#!/usr/bin/env node
/**
 * Import dữ liệu đã export từ Supabase (folder supabase-mcp-export/) vào Postgres local.
 *
 * Yêu cầu: DB local đã tạo schema bằng file `supabase-mcp-export/00_create_schema_postgres.sql`
 *
 * Chạy:
 *   node Data/import-supabase-export-to-local-postgres.js
 *
 * ENV optional:
 *   LOCAL_PG_URL=postgresql://postgres:password@localhost:5433/food_suggest
 *   EXPORT_DIR=H:/food.suggest/supabase-mcp-export
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const LOCAL_PG_URL =
  process.env.LOCAL_PG_URL || 'postgresql://postgres:Hoanghhk123@localhost:5433/food_suggest';
const EXPORT_DIR = process.env.EXPORT_DIR || path.join(__dirname, '..', 'supabase-mcp-export');

const TABLE_ORDER = [
  'admins',
  'users',
  'ingredient_categories',
  'ingredients',
  'recipe_categories',
  'recipes',
  'recipe_steps',
  'recipe_ingredients',
  'recipe_category_map',
  'comments',
  'comment_likes',
  'commentlikes',
  'recipe_reviews',
  'user_favorites',
  'pending_ingredients',
  'search_keywords'
];

function readJsonFile(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    const msg = e?.message || String(e);
    throw new Error(`JSON.parse lỗi ở file: ${p}\n${msg}`);
  }
}

function extractRowsFromExport(obj) {
  // dạng export: [{ data: [ ... ] }]
  if (Array.isArray(obj) && obj.length && obj[0] && Array.isArray(obj[0].data)) return obj[0].data;
  // dạng mcp wrapper: { result: "...<untrusted-data>JSON</untrusted-data>..." }
  if (obj && typeof obj === 'object' && typeof obj.result === 'string') {
    // Tránh match nhầm cụm "<untrusted-data-...> boundaries" ở phần mô tả.
    // Tag thật sự luôn bắt đầu ngay sau một newline: "\n<untrusted-data-...>\n"
    const m = obj.result.match(/\n<untrusted-data-[^>]+>\s*([\s\S]*?)\s*<\/untrusted-data-[^>]+>/);
    if (!m) throw new Error('Không tìm thấy <untrusted-data> trong file MCP export');
    const inner = JSON.parse(m[1]);
    if (Array.isArray(inner) && inner.length && inner[0] && Array.isArray(inner[0].data)) return inner[0].data;
    throw new Error('Định dạng JSON bên trong <untrusted-data> không đúng');
  }
  throw new Error('Định dạng export không hỗ trợ');
}

function findExportFileForTable(table) {
  const direct = path.join(EXPORT_DIR, `public.${table}.json`);
  const mcp = path.join(EXPORT_DIR, `public.${table}.mcp.json.txt`);
  if (fs.existsSync(direct)) return direct;
  if (fs.existsSync(mcp)) return mcp;
  // một số file đặt tên hơi khác (đã tạo): *.mcp.json.txt
  const mcpAlt = path.join(EXPORT_DIR, `public.${table}.mcp.json.txt`);
  if (fs.existsSync(mcpAlt)) return mcpAlt;
  return null;
}

async function getTableColumns(client, table) {
  const res = await client.query(
    `
    select column_name
    from information_schema.columns
    where table_schema='public' and table_name=$1
    order by ordinal_position
    `,
    [table]
  );
  return res.rows.map(r => r.column_name);
}

function buildInsert(table, cols) {
  const quoted = cols.map(c => `"${c}"`).join(', ');
  const params = cols.map((_, i) => `$${i + 1}`).join(', ');
  return `insert into public."${table}" (${quoted}) values (${params})`;
}

async function setIdentityToMax(client, table) {
  // set identity/sequence về max(id)+1 nếu có cột id
  const hasId = await client.query(
    `select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name='id'`,
    [table]
  );
  if (!hasId.rowCount) return;

  // pg_get_serial_sequence không hoạt động với IDENTITY, nên dùng setval trên sequence hệ thống nếu có.
  // Tuy nhiên identity vẫn tạo sequence: <table>_id_seq (thường). Thử setval nếu tồn tại.
  const seqName = `${table}_id_seq`;
  const seqExists = await client.query(
    `select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='S' and c.relname=$1`,
    [seqName]
  );
  if (!seqExists.rowCount) return;

  await client.query(
    `select setval('public.${seqName}', coalesce((select max(id) from public."${table}"), 0) + 1, false)`
  );
}

async function main() {
  if (!fs.existsSync(EXPORT_DIR)) {
    console.error('❌ Không tìm thấy EXPORT_DIR:', EXPORT_DIR);
    process.exit(1);
  }

  const client = new Client({ connectionString: LOCAL_PG_URL });
  await client.connect();

  try {
    console.log('✅ Kết nối local postgres OK');
    console.log('📂 Export dir:', path.resolve(EXPORT_DIR));

    // tắt FK tạm để import dễ (cần quyền superuser; user postgres OK)
    await client.query('begin');
    await client.query("set session_replication_role = 'replica'");

    for (const table of TABLE_ORDER) {
      const file = findExportFileForTable(table);
      if (!file) {
        console.log(`⚠️  Bỏ qua (không có file): ${table}`);
        continue;
      }

      console.log(`📄 File: ${file}`);
      const raw = readJsonFile(file);
      const rows = extractRowsFromExport(raw);
      console.log(`⬇️  ${table}: ${rows.length} rows`);

      if (!rows.length) continue;

      const dbCols = await getTableColumns(client, table);
      const insertCols = dbCols.filter(c => rows[0] && Object.prototype.hasOwnProperty.call(rows[0], c));
      const insertSql = buildInsert(table, insertCols);

      // truncate trước khi insert để chạy lại không bị duplicate
      await client.query(`truncate table public."${table}" restart identity cascade`);

      for (const row of rows) {
        const values = insertCols.map(c => row[c] === undefined ? null : row[c]);
        await client.query(insertSql, values);
      }
    }

    await client.query("set session_replication_role = 'origin'");
    await client.query('commit');

    // chỉnh sequence/identity về max(id)
    for (const table of TABLE_ORDER) {
      await setIdentityToMax(client, table);
    }

    console.log('🎉 Import xong.');
  } catch (e) {
    try {
      await client.query('rollback');
    } catch {}
    console.error('❌ Import lỗi:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();

