require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');
const fs = require('fs');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

function parseCSV(filePath) {
  // Thử đọc với các encoding khác nhau
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    try {
      content = fs.readFileSync(filePath, 'utf16le');
    } catch (e2) {
      content = fs.readFileSync(filePath, 'latin1');
    }
  }
  
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    throw new Error('CSV file phải có ít nhất 1 dòng header và 1 dòng dữ liệu');
  }

  // Parse header - xử lý encoding issues và tab separator
  const headerLine = lines[0];
  const isTabSeparated = headerLine.includes('\t');
  const separator = isTabSeparated ? '\t' : ',';
  
  const headers = headerLine.split(separator).map(h => h.trim());
  
  console.log(`📋 Detected separator: ${isTabSeparated ? 'TAB' : 'COMMA'}`);
  console.log(`📋 Raw headers: ${JSON.stringify(headers)}`);
  
  // Normalize header names - xử lý encoding issues
  const normalizedHeaders = headers.map(h => {
    // Xử lý encoding issues với các ký tự đặc biệt
    const normalized = h
      .replace(/Tn/g, 'Tên')
      .replace(/danh m?c/g, 'danh mục')
      .replace(/Lo?i/g, 'Loại')
      .replace(/M t?/g, 'Mô tả');
    
    if (normalized.includes('Category ID') || normalized.includes('category_id') || normalized.includes('ID')) {
      return 'Category ID';
    }
    if (normalized.includes('Tên') || normalized.includes('Ten') || normalized.includes('danh mục') || normalized.includes('danh muc')) {
      return 'Tên danh mục';
    }
    if (normalized.includes('Loại') || normalized.includes('Loai') || normalized.includes('Type') || normalized.includes('type')) {
      return 'Loại';
    }
    if (normalized.includes('Mô tả') || normalized.includes('Mo ta') || normalized.includes('description')) {
      return 'Mô tả';
    }
    return normalized;
  });
  
  console.log(`📋 Normalized headers: ${JSON.stringify(normalizedHeaders)}\n`);
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(separator).map(v => v.trim());
    
    if (values.length < normalizedHeaders.length) {
      console.warn(`⚠️  Row ${i + 1} có số cột không khớp (${values.length} vs ${normalizedHeaders.length}), bỏ qua`);
      continue;
    }
    
    const row = {};
    normalizedHeaders.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    // Tìm các giá trị từ row (có thể dùng header gốc hoặc normalized)
    const id = row['Category ID'] || values[0] || '';
    const name = row['Tên danh mục'] || values[1] || '';
    const type = row['Loại'] || values[2] || '';
    
    // Chỉ thêm row nếu có đủ dữ liệu cần thiết
    const hasId = id && id.trim() !== '';
    const hasName = name && name.trim() !== '';
    const hasType = type && type.trim() !== '';
    
    if (hasId && hasName && hasType) {
      // Tạo row với normalized keys
      data.push({
        'Category ID': id.trim(),
        'Tên danh mục': name.trim(),
        'Loại': type.trim(),
        'Mô tả': row['Mô tả'] || values[3] || null
      });
    } else {
      console.warn(`⚠️  Row ${i + 1} thiếu dữ liệu, bỏ qua:`, { id, name, type });
    }
  }

  return { headers: normalizedHeaders, data };
}

async function importCategoriesFromCSV(csvFilePath) {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Kiểm tra file tồn tại
    if (!fs.existsSync(csvFilePath)) {
      console.error(`❌ File không tồn tại: ${csvFilePath}`);
      process.exit(1);
    }

    console.log(`📂 Reading CSV file: ${csvFilePath}\n`);

    // Parse CSV
    const { headers, data } = parseCSV(csvFilePath);
    console.log(`📋 Found ${data.length} categories in CSV file`);
    console.log(`📋 Headers: ${headers.join(', ')}\n`);

    if (data.length === 0) {
      console.error('❌ CSV file không có dữ liệu!');
      process.exit(1);
    }

    // Validate và parse dữ liệu
    console.log('🔍 Validating data...');
    const categories = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      const id = row['Category ID'] || row['category_id'] || row['CategoryID'];
      const categoryName = row['Tên danh mục'] || row['category_name'] || row['Category Name'];
      const categoryType = row['Loại'] || row['category_type'] || row['Type'];

      if (!id || !categoryName || !categoryType) {
        errors.push({
          row: i + 2,
          data: row,
          error: 'Thiếu Category ID, Tên danh mục hoặc Loại'
        });
        continue;
      }

      const parsedId = parseInt(id);
      const normalizedType = categoryType.toLowerCase().trim();

      if (isNaN(parsedId)) {
        errors.push({
          row: i + 2,
          data: row,
          error: 'Category ID không phải là số hợp lệ'
        });
        continue;
      }

      if (!['cuisine', 'course', 'tag'].includes(normalizedType)) {
        errors.push({
          row: i + 2,
          data: row,
          error: `Loại không hợp lệ: ${categoryType}. Phải là: cuisine, course, hoặc tag`
        });
        continue;
      }

      categories.push({
        id: parsedId,
        category_name: categoryName.trim(),
        category_type: normalizedType,
        description: row['Mô tả'] || row['description'] || null
      });
    }

    if (errors.length > 0) {
      console.warn(`⚠️  Found ${errors.length} invalid rows:`);
      errors.slice(0, 10).forEach(err => {
        console.warn(`   - Row ${err.row}: ${err.error}`);
      });
      if (errors.length > 10) {
        console.warn(`   ... và ${errors.length - 10} lỗi khác`);
      }
      console.log('');
    }

    console.log(`✅ Valid categories: ${categories.length} / ${data.length}\n`);

    if (categories.length === 0) {
      console.error('❌ Không có dữ liệu hợp lệ để import!');
      process.exit(1);
    }

    // Import/Update categories
    console.log('📥 Importing/Updating categories...');
    let insertCount = 0;
    let updateCount = 0;
    let errorCount = 0;
    const importErrors = [];

    const transaction = await sequelize.transaction();

    try {
      for (const category of categories) {
        try {
          // Kiểm tra category đã tồn tại chưa
          const existing = await sequelize.query(`
            SELECT id FROM recipe_categories WHERE id = :id
          `, {
            replacements: { id: category.id },
            type: sequelize.QueryTypes.SELECT,
            transaction
          });

          const exists = Array.isArray(existing) && existing.length > 0;

          if (exists) {
            // Update existing category - sử dụng ON CONFLICT để tránh unique constraint
            await sequelize.query(`
              UPDATE recipe_categories 
              SET category_name = :category_name,
                  category_type = :category_type,
                  description = :description,
                  updated_at = NOW()
              WHERE id = :id
            `, {
              replacements: {
                id: category.id,
                category_name: category.category_name,
                category_type: category.category_type,
                description: category.description
              },
              type: sequelize.QueryTypes.UPDATE,
              transaction
            });
            updateCount++;
          } else {
            // Insert new category - sử dụng ON CONFLICT để xử lý duplicate
            await sequelize.query(`
              INSERT INTO recipe_categories (id, category_name, category_type, description, created_at, updated_at)
              VALUES (:id, :category_name, :category_type, :description, NOW(), NOW())
              ON CONFLICT (id) DO UPDATE SET
                category_name = EXCLUDED.category_name,
                category_type = EXCLUDED.category_type,
                description = EXCLUDED.description,
                updated_at = NOW()
            `, {
              replacements: {
                id: category.id,
                category_name: category.category_name,
                category_type: category.category_type,
                description: category.description
              },
              type: sequelize.QueryTypes.INSERT,
              transaction
            });
            insertCount++;
          }
        } catch (error) {
          errorCount++;
          importErrors.push({
            id: category.id,
            category_name: category.category_name,
            error: error.message
          });
          // Log chi tiết lỗi để debug
          if (errorCount <= 3) {
            console.error(`   Error details for ID ${category.id}:`, error);
          }
        }
      }

      await transaction.commit();
      console.log(`✅ Import completed!\n`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    // Báo cáo kết quả
    console.log('📊 Import Summary:');
    console.log(`   ✅ Inserted: ${insertCount} categories`);
    console.log(`   ✅ Updated: ${updateCount} categories`);
    console.log(`   ❌ Errors: ${errorCount} categories`);
    
    if (importErrors.length > 0) {
      console.log('\n❌ Import errors:');
      importErrors.slice(0, 10).forEach(err => {
        console.log(`   - ID ${err.id} (${err.category_name}): ${err.error}`);
      });
      if (importErrors.length > 10) {
        console.log(`   ... và ${importErrors.length - 10} lỗi khác`);
      }
    }

    // Kiểm tra kết quả
    const result = await sequelize.query(`
      SELECT COUNT(*) as count FROM recipe_categories
    `, { type: sequelize.QueryTypes.SELECT });

    const count = Array.isArray(result) && result.length > 0 ? result[0].count : 0;
    console.log(`\n📈 Total categories in database: ${count}`);

    // Hiển thị danh sách categories theo loại
    const [stats] = await sequelize.query(`
      SELECT category_type, COUNT(*) as count 
      FROM recipe_categories 
      GROUP BY category_type
      ORDER BY category_type
    `, { type: sequelize.QueryTypes.SELECT });

    if (Array.isArray(stats) && stats.length > 0) {
      console.log('\n📊 Categories by type:');
      stats.forEach(stat => {
        console.log(`   - ${stat.category_type}: ${stat.count} categories`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Lấy file path từ command line argument
const csvFilePath = process.argv[2];

if (!csvFilePath) {
  console.error('❌ Vui lòng cung cấp đường dẫn file CSV!');
  console.log('💡 Usage: node import-categories-from-csv.js <path-to-csv-file>');
  process.exit(1);
}

importCategoriesFromCSV(csvFilePath);
