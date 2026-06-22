#!/usr/bin/env node
/**
 * Tải toàn bộ Supabase Storage về local.
 *
 * Cách dùng:
 *   cd Data
 *   npm i
 *   node export-supabase-storage.js --out ./supabase-export/storage
 *
 * ENV (bắt buộc):
 *   SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Options:
 *   --out <dir>          Thư mục output (mặc định: Data/supabase-export/storage)
 *   --buckets <list>     Chỉ tải các bucket này (phân tách bởi dấu phẩy)
 *   --concurrency <n>    Số file tải song song (mặc định: 5)
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

function parseArgs(argv) {
  const args = argv.slice(2);
  const outDefault = path.join(__dirname, 'supabase-export', 'storage');
  const opts = { out: outDefault, buckets: null, concurrency: 5 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') opts.out = args[++i];
    else if (args[i] === '--buckets') {
      const list = String(args[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
      opts.buckets = list.length ? list : null;
    } else if (args[i] === '--concurrency') opts.concurrency = Number(args[++i]) || opts.concurrency;
  }
  return opts;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function safePathPart(s) {
  return String(s).replace(/[<>:"|?*\u0000-\u001F]/g, '_');
}

async function listAllObjects(supabase, bucket, prefix = '') {
  const all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' }
    });
    if (error) throw error;
    if (!data?.length) break;

    for (const item of data) {
      if (item.id && item.name) {
        all.push({ ...item, fullPath: prefix ? `${prefix}/${item.name}` : item.name });
      } else if (item.name) {
        // folder marker (supabase list trả về item không có id)
        const nextPrefix = prefix ? `${prefix}/${item.name}` : item.name;
        const nested = await listAllObjects(supabase, bucket, nextPrefix);
        all.push(...nested);
      }
    }

    offset += data.length;
    if (data.length < limit) break;
  }
  return all;
}

async function downloadOne(supabase, bucket, objectPath, destPath) {
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error) throw error;
  const arrayBuffer = await data.arrayBuffer();
  ensureDir(path.dirname(destPath));
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

async function runWithConcurrency(items, concurrency, worker) {
  let idx = 0;
  const results = { ok: 0, fail: 0, errors: [] };

  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const current = idx++;
      if (current >= items.length) return;
      const item = items[current];
      try {
        await worker(item);
        results.ok++;
      } catch (e) {
        results.fail++;
        results.errors.push({
          item,
          error: e?.message || String(e)
        });
      }
    }
  });

  await Promise.all(runners);
  return results;
}

async function main() {
  const opts = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Thiếu ENV.');
    console.error('Cần set SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  ensureDir(opts.out);

  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  if (bucketErr) throw bucketErr;

  const selectedBuckets = (opts.buckets?.length ? buckets.filter(b => opts.buckets.includes(b.name)) : buckets) || [];
  if (!selectedBuckets.length) {
    console.log('⚠️  Không có bucket nào để tải.');
    return;
  }

  const manifest = {
    exported_at: new Date().toISOString(),
    out: path.resolve(opts.out),
    buckets: []
  };

  for (const b of selectedBuckets) {
    console.log(`📦 Bucket: ${b.name}`);
    const objects = await listAllObjects(supabase, b.name, '');
    console.log(`   ↳ Objects: ${objects.length}`);

    const bucketOut = path.join(opts.out, safePathPart(b.name));
    ensureDir(bucketOut);

    const downloads = objects.map(o => ({
      bucket: b.name,
      objectPath: o.fullPath,
      destPath: path.join(bucketOut, ...o.fullPath.split('/').map(safePathPart))
    }));

    const res = await runWithConcurrency(downloads, opts.concurrency, async (d) => {
      await downloadOne(supabase, d.bucket, d.objectPath, d.destPath);
    });

    const bucketMeta = {
      name: b.name,
      object_count: objects.length,
      downloaded_ok: res.ok,
      downloaded_fail: res.fail
    };
    manifest.buckets.push(bucketMeta);

    const errorPath = path.join(bucketOut, '_errors.json');
    if (res.fail) fs.writeFileSync(errorPath, JSON.stringify(res.errors, null, 2));
  }

  const manifestPath = path.join(opts.out, '_storage-export-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✅ Xong. Manifest:', manifestPath);
}

main().catch((err) => {
  console.error('❌ Lỗi export storage:', err?.message || err);
  process.exit(1);
});

