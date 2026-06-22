#!/usr/bin/env node
/**
 * Tự động tìm và tải ảnh miễn phí từ Unsplash/Pexels cho công thức
 * 
 * Cách dùng:
 *   node Data/fetch-free-images.js --source unsplash --file Data/input/my-recipes.xlsx
 * 
 * Options:
 *   --file      File Excel chứa công thức
 *   --source    Nguồn ảnh: unsplash, pexels (mặc định: unsplash)
 *   --out       Thư mục lưu ảnh (mặc định: Data/images/recipes)
 *   --delay     Delay giữa các request (ms, mặc định: 1000)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../src/backend/.env') });

const fs = require('fs');
const path = require('path');
const https = require('https');

let XLSX;
try {
  XLSX = require('xlsx');
} catch (err) {
  console.error('❌ Cần cài đặt xlsx: npm install xlsx');
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
const params = {
  file: '',
  source: 'unsplash',
  outDir: path.join(__dirname, 'images', 'recipes'),
  delay: 1000
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file') params.file = args[++i];
  if (args[i] === '--source') params.source = args[++i];
  if (args[i] === '--out') params.outDir = args[++i];
  if (args[i] === '--delay') params.delay = parseInt(args[++i], 10);
}

// API Keys
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

// Slugify function
function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Download image
async function downloadImage(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    
    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

// Fetch from Unsplash
async function fetchFromUnsplash(query) {
  if (!UNSPLASH_ACCESS_KEY) {
    throw new Error('Thiếu UNSPLASH_ACCESS_KEY trong .env');
  }

  const searchQuery = encodeURIComponent(`${query} food dish`);
  const url = `https://api.unsplash.com/search/photos?query=${searchQuery}&per_page=1&orientation=landscape`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error('Không tìm thấy ảnh');
  }

  return {
    url: data.results[0].urls.regular,
    credit: data.results[0].user.name,
    source: 'unsplash'
  };
}

// Fetch from Pexels
async function fetchFromPexels(query) {
  if (!PEXELS_API_KEY) {
    throw new Error('Thiếu PEXELS_API_KEY trong .env');
  }

  const searchQuery = encodeURIComponent(`${query} food`);
  const url = `https://api.pexels.com/v1/search?query=${searchQuery}&per_page=1&orientation=landscape`;

  const response = await fetch(url, {
    headers: {
      'Authorization': PEXELS_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.photos || data.photos.length === 0) {
    throw new Error('Không tìm thấy ảnh');
  }

  return {
    url: data.photos[0].src.large,
    credit: data.photos[0].photographer,
    source: 'pexels'
  };
}

// Main function
async function main() {
  console.log('📷 Fetch Free Images Tool');
  console.log('========================');
  console.log('');

  // Validate API key
  if (params.source === 'unsplash' && !UNSPLASH_ACCESS_KEY) {
    console.error('❌ Thiếu UNSPLASH_ACCESS_KEY trong .env');
    console.log('');
    console.log('Đăng ký API key miễn phí tại: https://unsplash.com/developers');
    console.log('Thêm vào src/backend/.env:');
    console.log('  UNSPLASH_ACCESS_KEY=your_access_key');
    process.exit(1);
  }

  if (params.source === 'pexels' && !PEXELS_API_KEY) {
    console.error('❌ Thiếu PEXELS_API_KEY trong .env');
    console.log('');
    console.log('Đăng ký API key miễn phí tại: https://www.pexels.com/api/');
    console.log('Thêm vào src/backend/.env:');
    console.log('  PEXELS_API_KEY=your_api_key');
    process.exit(1);
  }

  // Read Excel file
  if (!params.file) {
    console.error('❌ Thiếu --file');
    console.log('Cách dùng: node Data/fetch-free-images.js --file <path-to-excel>');
    process.exit(1);
  }

  const filePath = path.resolve(params.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File không tồn tại: ${filePath}`);
    process.exit(1);
  }

  console.log('📂 File:', filePath);
  console.log('🌐 Nguồn:', params.source);
  console.log('📁 Output:', params.outDir);
  console.log('');

  // Create output directory
  fs.mkdirSync(params.outDir, { recursive: true });

  // Read recipes
  const workbook = XLSX.readFile(filePath);
  const recipesSheet = workbook.Sheets['Recipes'];
  if (!recipesSheet) {
    console.error('❌ Không tìm thấy sheet "Recipes"');
    process.exit(1);
  }

  const recipes = XLSX.utils.sheet_to_json(recipesSheet);
  console.log(`📋 Tìm thấy ${recipes.length} công thức`);
  console.log('');

  // Filter recipes without images
  const recipesNeedImages = recipes.filter(r => !r.image_url && !r.image_filename);
  console.log(`🔍 ${recipesNeedImages.length} công thức cần ảnh`);
  console.log('');

  // Fetch images
  const results = [];
  const errors = [];

  for (let i = 0; i < recipesNeedImages.length; i++) {
    const recipe = recipesNeedImages[i];
    const slug = slugify(recipe.recipe_name);
    const fileName = `${slug}.jpg`;
    const outputPath = path.join(params.outDir, fileName);

    // Skip if already downloaded
    if (fs.existsSync(outputPath)) {
      console.log(`⏭️  Đã có: ${recipe.recipe_name}`);
      results.push({
        recipe_id: recipe.recipe_id,
        recipe_name: recipe.recipe_name,
        filename: fileName,
        status: 'skipped'
      });
      continue;
    }

    console.log(`🔎 [${i + 1}/${recipesNeedImages.length}] ${recipe.recipe_name}`);

    try {
      // Fetch image URL
      const fetchFn = params.source === 'unsplash' ? fetchFromUnsplash : fetchFromPexels;
      const imageData = await fetchFn(recipe.recipe_name);

      console.log(`   📥 Downloading from ${imageData.source}...`);
      await downloadImage(imageData.url, outputPath);

      console.log(`   ✅ Saved: ${fileName}`);
      console.log(`   📸 Credit: ${imageData.credit}`);

      results.push({
        recipe_id: recipe.recipe_id,
        recipe_name: recipe.recipe_name,
        filename: fileName,
        credit: imageData.credit,
        source: imageData.source,
        status: 'success'
      });

    } catch (error) {
      console.log(`   ❌ Lỗi: ${error.message}`);
      errors.push({
        recipe_id: recipe.recipe_id,
        recipe_name: recipe.recipe_name,
        error: error.message
      });
    }

    // Rate limiting
    if (i < recipesNeedImages.length - 1) {
      await sleep(params.delay);
    }
  }

  // Update Excel with filenames
  console.log('');
  console.log('📝 Cập nhật Excel...');

  for (const result of results) {
    if (result.status === 'success') {
      const recipeIndex = recipes.findIndex(r => r.recipe_id === result.recipe_id);
      if (recipeIndex >= 0) {
        recipes[recipeIndex].image_filename = result.filename;
      }
    }
  }

  // Write updated Excel
  const updatedSheet = XLSX.utils.json_to_sheet(recipes);
  workbook.Sheets['Recipes'] = updatedSheet;
  
  const updatedFilePath = filePath.replace('.xlsx', '-with-images.xlsx');
  XLSX.writeFile(workbook, updatedFilePath);
  console.log(`✅ Đã lưu: ${updatedFilePath}`);

  // Save results
  const resultsPath = path.join(params.outDir, 'fetch-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({ results, errors }, null, 2));

  // Summary
  console.log('');
  console.log('📊 Kết quả:');
  console.log(`   ✅ Thành công: ${results.filter(r => r.status === 'success').length}`);
  console.log(`   ⏭️  Đã có sẵn: ${results.filter(r => r.status === 'skipped').length}`);
  console.log(`   ❌ Lỗi: ${errors.length}`);

  if (errors.length > 0) {
    console.log('');
    console.log('❌ Các công thức không tìm được ảnh:');
    errors.forEach(e => console.log(`   - ${e.recipe_name}: ${e.error}`));
  }

  console.log('');
  console.log('📁 Ảnh đã lưu tại:', params.outDir);
  console.log('📋 File Excel cập nhật:', updatedFilePath);
}

main().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
