#!/usr/bin/env node
/**
 * Upload ảnh món ăn lên Cloudinary
 * 
 * Cách dùng:
 *   node Data/upload-images-cloudinary.js
 * 
 * Options:
 *   --dir       Thư mục chứa ảnh (mặc định: Data/images/recipes)
 *   --folder    Folder trên Cloudinary (mặc định: food-suggest/recipes)
 *   --update-db Cập nhật image_url trong database sau khi upload
 */

require('dotenv').config({ path: require('path').join(__dirname, '../src/backend/.env') });

const fs = require('fs');
const path = require('path');

let cloudinary;
try {
  cloudinary = require('cloudinary').v2;
} catch (err) {
  console.error('❌ Cần cài đặt cloudinary: npm install cloudinary');
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
const params = {
  dir: path.join(__dirname, 'images', 'recipes'),
  folder: 'food-suggest/recipes',
  updateDb: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir') params.dir = args[++i];
  if (args[i] === '--folder') params.folder = args[++i];
  if (args[i] === '--update-db') params.updateDb = true;
}

// Configure Cloudinary
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error('❌ Thiếu cấu hình Cloudinary trong .env');
  console.log('');
  console.log('Thêm vào file src/backend/.env:');
  console.log('  CLOUDINARY_CLOUD_NAME=your_cloud_name');
  console.log('  CLOUDINARY_API_KEY=your_api_key');
  console.log('  CLOUDINARY_API_SECRET=your_api_secret');
  console.log('');
  console.log('Đăng ký tài khoản miễn phí tại: https://cloudinary.com');
  process.exit(1);
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret
});

// Supported image extensions
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

async function uploadImages() {
  console.log('📂 Thư mục ảnh:', params.dir);
  console.log('☁️  Cloudinary folder:', params.folder);
  console.log('');

  // Check if directory exists
  if (!fs.existsSync(params.dir)) {
    console.log('📁 Tạo thư mục:', params.dir);
    fs.mkdirSync(params.dir, { recursive: true });
    console.log('');
    console.log('⚠️  Thư mục trống. Hãy thêm ảnh vào thư mục rồi chạy lại script.');
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

  // Upload each file
  const uploadedFiles = [];
  const errors = [];

  for (const file of files) {
    const filePath = path.join(params.dir, file);
    const baseName = path.basename(file, path.extname(file));

    console.log(`⬆️  Uploading: ${file}`);

    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: params.folder,
        public_id: baseName,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 800, height: 600, crop: 'fill', quality: 'auto:good' }
        ]
      });

      console.log(`   ✅ URL: ${result.secure_url}`);
      uploadedFiles.push({
        filename: file,
        url: result.secure_url,
        public_id: result.public_id
      });

    } catch (error) {
      console.error(`   ❌ Lỗi: ${error.message}`);
      errors.push({ file, error: error.message });
    }
  }

  console.log('');
  console.log('📊 Kết quả:');
  console.log(`   ✅ Upload thành công: ${uploadedFiles.length}`);
  console.log(`   ❌ Lỗi: ${errors.length}`);

  // Save mapping file
  const mappingPath = path.join(params.dir, 'cloudinary-images.json');
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

  try {
    await sequelize.authenticate();

    for (const upload of uploadedFiles) {
      const baseName = path.basename(upload.filename, path.extname(upload.filename));

      await sequelize.query(`
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
