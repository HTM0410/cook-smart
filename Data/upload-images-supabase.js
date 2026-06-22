#!/usr/bin/env node
/**
 * Upload ảnh món ăn lên Supabase Storage
 * 
 * Cách dùng:
 *   node Data/upload-images-supabase.js
 * 
 * Options:
 *   --dir       Thư mục chứa ảnh (mặc định: Data/images/recipes)
 *   --bucket    Tên bucket trên Supabase (mặc định: recipe-images)
 *   --update-db Cập nhật image_url trong database sau khi upload
 */

require('dotenv').config({ path: require('path').join(__dirname, '../src/backend/.env') });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse arguments
const args = process.argv.slice(2);
const params = {
  dir: path.join(__dirname, 'images', 'recipes'),
  bucket: 'recipe-images',
  updateDb: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir') params.dir = args[++i];
  if (args[i] === '--bucket') params.bucket = args[++i];
  if (args[i] === '--update-db') params.updateDb = true;
}

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || `https://${process.env.SUPABASE_DB_HOST?.replace('db.', '')?.replace('.supabase.co', '')}.supabase.co`;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Thiếu SUPABASE_SERVICE_ROLE_KEY hoặc SUPABASE_ANON_KEY trong .env');
  console.log('');
  console.log('Thêm vào file src/backend/.env:');
  console.log('  SUPABASE_URL=https://your-project.supabase.co');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Supported image extensions
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

async function uploadImages() {
  console.log('📂 Thư mục ảnh:', params.dir);
  console.log('☁️  Bucket:', params.bucket);
  console.log('');

  // Check if directory exists
  if (!fs.existsSync(params.dir)) {
    console.log('📁 Tạo thư mục:', params.dir);
    fs.mkdirSync(params.dir, { recursive: true });
    console.log('');
    console.log('⚠️  Thư mục trống. Hãy thêm ảnh vào thư mục rồi chạy lại script.');
    console.log('');
    console.log('Hướng dẫn:');
    console.log('1. Đặt ảnh món ăn vào:', params.dir);
    console.log('2. Tên file: ten-mon-an.jpg (không dấu, dùng dấu gạch ngang)');
    console.log('3. Chạy lại: node Data/upload-images-supabase.js');
    return;
  }

  // Get all image files
  const files = fs.readdirSync(params.dir)
    .filter(f => imageExtensions.includes(path.extname(f).toLowerCase()));

  if (files.length === 0) {
    console.log('⚠️  Không tìm thấy ảnh trong thư mục');
    return;
  }

  console.log(`📷 Tìm thấy ${files.length} ảnh`);
  console.log('');

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === params.bucket);

  if (!bucketExists) {
    console.log('📁 Tạo bucket:', params.bucket);
    const { error } = await supabase.storage.createBucket(params.bucket, {
      public: true,
      fileSizeLimit: 5242880 // 5MB
    });
    if (error) {
      console.error('❌ Không thể tạo bucket:', error.message);
      return;
    }
  }

  // Upload each file
  const uploadedFiles = [];
  const errors = [];

  for (const file of files) {
    const filePath = path.join(params.dir, file);
    const fileBuffer = fs.readFileSync(filePath);
    const contentType = getContentType(file);

    console.log(`⬆️  Uploading: ${file}`);

    const { data, error } = await supabase.storage
      .from(params.bucket)
      .upload(file, fileBuffer, {
        contentType,
        upsert: true
      });

    if (error) {
      console.error(`   ❌ Lỗi: ${error.message}`);
      errors.push({ file, error: error.message });
    } else {
      const { data: urlData } = supabase.storage
        .from(params.bucket)
        .getPublicUrl(file);

      console.log(`   ✅ URL: ${urlData.publicUrl}`);
      uploadedFiles.push({
        filename: file,
        url: urlData.publicUrl
      });
    }
  }

  console.log('');
  console.log('📊 Kết quả:');
  console.log(`   ✅ Upload thành công: ${uploadedFiles.length}`);
  console.log(`   ❌ Lỗi: ${errors.length}`);

  // Save mapping file
  const mappingPath = path.join(params.dir, 'uploaded-images.json');
  fs.writeFileSync(mappingPath, JSON.stringify(uploadedFiles, null, 2));
  console.log('');
  console.log('💾 Đã lưu danh sách URL tại:', mappingPath);

  // Update database if requested
  if (params.updateDb && uploadedFiles.length > 0) {
    console.log('');
    console.log('🔄 Cập nhật database...');
    await updateDatabase(uploadedFiles);
  }
}

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return types[ext] || 'application/octet-stream';
}

async function updateDatabase(uploadedFiles) {
  const { Sequelize, DataTypes } = require('sequelize');

  const dbUrl = process.env.SUPABASE_DB_URL ||
    `postgresql://${process.env.SUPABASE_DB_USER || 'postgres'}:${process.env.SUPABASE_DB_PASS}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT || 5432}/${process.env.SUPABASE_DB_NAME || 'postgres'}`;

  const sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false }
    }
  });

  const Recipe = sequelize.define('Recipe', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    recipeName: { type: DataTypes.STRING(150), field: 'recipe_name' },
    imageUrl: { type: DataTypes.STRING(255), field: 'image_url' }
  }, { tableName: 'recipes', underscored: true });

  try {
    await sequelize.authenticate();

    for (const upload of uploadedFiles) {
      // Match by filename (without extension) to recipe name
      const baseName = path.basename(upload.filename, path.extname(upload.filename));
      const searchName = baseName.replace(/-/g, ' ');

      // Update recipes that have matching image_filename or similar name
      const [count] = await sequelize.query(`
        UPDATE recipes 
        SET image_url = :url
        WHERE image_url LIKE :pattern
        OR LOWER(REPLACE(recipe_name, ' ', '-')) = LOWER(:baseName)
      `, {
        replacements: {
          url: upload.url,
          pattern: `%${upload.filename}`,
          baseName: baseName
        }
      });

      console.log(`   ✓ ${upload.filename}`);
    }

    console.log('✅ Đã cập nhật database');

  } catch (error) {
    console.error('❌ Lỗi cập nhật database:', error.message);
  } finally {
    await sequelize.close();
  }
}

uploadImages().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
