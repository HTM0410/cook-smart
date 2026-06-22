#!/usr/bin/env node
/**
 * Tạo file Excel mẫu để nhập công thức nấu ăn
 * Chạy: node Data/templates/RECIPE_TEMPLATE.xlsx.js
 */

const fs = require('fs');
const path = require('path');

let XLSX;
try {
  XLSX = require('xlsx');
} catch (err) {
  console.error('Cần cài đặt xlsx: npm install xlsx');
  process.exit(1);
}

const outputDir = path.join(__dirname);
fs.mkdirSync(outputDir, { recursive: true });

// =======================================
// Sheet 1: RECIPES - Thông tin công thức
// =======================================
const recipesHeader = [
  'recipe_id',         // ID tạm để liên kết (VD: R001, R002)
  'recipe_name',       // Tên món ăn (bắt buộc)
  'description',       // Mô tả chi tiết
  'image_filename',    // Tên file ảnh (VD: pho-bo.jpg) - để trống nếu dùng URL
  'image_url',         // URL ảnh từ internet (ưu tiên hơn filename)
  'prep_time',         // Thời gian chuẩn bị (phút)
  'cook_time',         // Thời gian nấu (phút)
  'servings',          // Số khẩu phần
  'difficulty',        // easy / medium / hard
  'status',            // visible / hidden
  'categories'         // Danh mục, phân cách bằng dấu phẩy (VD: "Món Việt, Bữa sáng")
];

const recipesSample = [
  {
    recipe_id: 'R001',
    recipe_name: 'Phở Bò Hà Nội',
    description: 'Món phở truyền thống với nước dùng đậm đà từ xương bò, ăn kèm rau thơm và gia vị.',
    image_filename: 'pho-bo.jpg',
    image_url: '',
    prep_time: 30,
    cook_time: 180,
    servings: 4,
    difficulty: 'medium',
    status: 'visible',
    categories: 'Món Việt, Bữa sáng, Soup'
  },
  {
    recipe_id: 'R002',
    recipe_name: 'Bánh Mì Thịt Nướng',
    description: 'Bánh mì giòn rụm kẹp thịt nướng thơm lừng, rau củ tươi mát.',
    image_filename: '',
    image_url: 'https://example.com/images/banh-mi.jpg',
    prep_time: 20,
    cook_time: 15,
    servings: 2,
    difficulty: 'easy',
    status: 'visible',
    categories: 'Món Việt, Street Food'
  },
  {
    recipe_id: 'R003',
    recipe_name: 'Bún Chả Hà Nội',
    description: 'Bún ăn kèm chả viên và thịt nướng, nước mắm pha chua ngọt.',
    image_filename: 'bun-cha.jpg',
    image_url: '',
    prep_time: 40,
    cook_time: 30,
    servings: 4,
    difficulty: 'medium',
    status: 'visible',
    categories: 'Món Việt, Bữa trưa'
  }
];

// =======================================
// Sheet 2: INGREDIENTS - Nguyên liệu
// =======================================
const ingredientsHeader = [
  'recipe_id',         // Liên kết với recipe (VD: R001)
  'ingredient_name',   // Tên nguyên liệu (bắt buộc)
  'quantity',          // Số lượng (VD: 500, 1/2, một ít)
  'unit',              // Đơn vị (g, kg, ml, tbsp, cốc, v.v.)
  'notes',             // Ghi chú thêm
  'category'           // Danh mục nguyên liệu (Thịt, Rau củ, Gia vị, v.v.)
];

const ingredientsSample = [
  // Phở Bò
  { recipe_id: 'R001', ingredient_name: 'Xương bò', quantity: '1', unit: 'kg', notes: 'Rửa sạch, chần qua', category: 'Thịt' },
  { recipe_id: 'R001', ingredient_name: 'Thịt bò thăn', quantity: '300', unit: 'g', notes: 'Thái lát mỏng', category: 'Thịt' },
  { recipe_id: 'R001', ingredient_name: 'Bánh phở', quantity: '400', unit: 'g', notes: 'Loại tươi hoặc khô', category: 'Tinh bột' },
  { recipe_id: 'R001', ingredient_name: 'Hành tây', quantity: '1', unit: 'củ', notes: 'Nướng thơm', category: 'Rau củ' },
  { recipe_id: 'R001', ingredient_name: 'Gừng', quantity: '50', unit: 'g', notes: 'Nướng thơm', category: 'Gia vị' },
  { recipe_id: 'R001', ingredient_name: 'Quế', quantity: '2', unit: 'thanh', notes: '', category: 'Gia vị' },
  { recipe_id: 'R001', ingredient_name: 'Hoa hồi', quantity: '3', unit: 'cánh', notes: '', category: 'Gia vị' },
  { recipe_id: 'R001', ingredient_name: 'Nước mắm', quantity: '3', unit: 'tbsp', notes: '', category: 'Gia vị' },
  { recipe_id: 'R001', ingredient_name: 'Hành lá', quantity: '1', unit: 'bó', notes: 'Thái nhỏ', category: 'Rau củ' },
  { recipe_id: 'R001', ingredient_name: 'Rau mùi', quantity: '1', unit: 'bó', notes: '', category: 'Rau củ' },
  
  // Bánh Mì
  { recipe_id: 'R002', ingredient_name: 'Bánh mì', quantity: '2', unit: 'ổ', notes: 'Loại giòn', category: 'Tinh bột' },
  { recipe_id: 'R002', ingredient_name: 'Thịt heo', quantity: '200', unit: 'g', notes: 'Ba chỉ hoặc nạc vai', category: 'Thịt' },
  { recipe_id: 'R002', ingredient_name: 'Đồ chua', quantity: '100', unit: 'g', notes: 'Cà rốt, củ cải', category: 'Rau củ' },
  { recipe_id: 'R002', ingredient_name: 'Dưa leo', quantity: '1', unit: 'quả', notes: 'Thái dọc', category: 'Rau củ' },
  { recipe_id: 'R002', ingredient_name: 'Rau mùi', quantity: '1', unit: 'nắm', notes: '', category: 'Rau củ' },
  { recipe_id: 'R002', ingredient_name: 'Sả', quantity: '2', unit: 'cây', notes: 'Băm nhỏ', category: 'Gia vị' },
  
  // Bún Chả
  { recipe_id: 'R003', ingredient_name: 'Thịt ba chỉ', quantity: '300', unit: 'g', notes: 'Thái miếng vừa', category: 'Thịt' },
  { recipe_id: 'R003', ingredient_name: 'Thịt nạc vai', quantity: '200', unit: 'g', notes: 'Xay nhuyễn làm chả', category: 'Thịt' },
  { recipe_id: 'R003', ingredient_name: 'Bún', quantity: '400', unit: 'g', notes: 'Loại tươi', category: 'Tinh bột' },
  { recipe_id: 'R003', ingredient_name: 'Nước mắm', quantity: '4', unit: 'tbsp', notes: '', category: 'Gia vị' },
  { recipe_id: 'R003', ingredient_name: 'Đường', quantity: '2', unit: 'tbsp', notes: '', category: 'Gia vị' },
  { recipe_id: 'R003', ingredient_name: 'Giấm', quantity: '2', unit: 'tbsp', notes: '', category: 'Gia vị' },
  { recipe_id: 'R003', ingredient_name: 'Tỏi', quantity: '3', unit: 'tép', notes: 'Băm nhỏ', category: 'Gia vị' },
  { recipe_id: 'R003', ingredient_name: 'Ớt', quantity: '2', unit: 'quả', notes: 'Thái lát', category: 'Gia vị' }
];

// =======================================
// Sheet 3: STEPS - Các bước thực hiện
// =======================================
const stepsHeader = [
  'recipe_id',         // Liên kết với recipe
  'step_number',       // Số thứ tự bước (1, 2, 3...)
  'instruction',       // Hướng dẫn chi tiết (bắt buộc)
  'step_image_filename', // Ảnh minh họa bước (tùy chọn)
  'duration_minutes'   // Thời gian ước tính (phút)
];

const stepsSample = [
  // Phở Bò
  { recipe_id: 'R001', step_number: 1, instruction: 'Rửa sạch xương bò, chần qua nước sôi để loại bỏ bọt bẩn. Vớt ra, rửa lại với nước lạnh.', step_image_filename: '', duration_minutes: 15 },
  { recipe_id: 'R001', step_number: 2, instruction: 'Nướng hành tây và gừng trên bếp gas hoặc trong lò cho đến khi thơm và hơi cháy xém.', step_image_filename: 'pho-step2.jpg', duration_minutes: 10 },
  { recipe_id: 'R001', step_number: 3, instruction: 'Cho xương vào nồi lớn với 4 lít nước. Thêm hành, gừng đã nướng, quế, hoa hồi. Đun sôi rồi hạ lửa nhỏ, hầm 3 tiếng.', step_image_filename: '', duration_minutes: 180 },
  { recipe_id: 'R001', step_number: 4, instruction: 'Nêm nước mắm, muối, đường cho vừa ăn. Lọc bỏ xác, giữ lại nước dùng trong.', step_image_filename: '', duration_minutes: 10 },
  { recipe_id: 'R001', step_number: 5, instruction: 'Trần bánh phở qua nước sôi, cho vào tô. Xếp thịt bò thái mỏng lên trên, chan nước dùng nóng. Rắc hành lá, rau mùi và dọn ra.', step_image_filename: 'pho-final.jpg', duration_minutes: 5 },
  
  // Bánh Mì
  { recipe_id: 'R002', step_number: 1, instruction: 'Ướp thịt với sả băm, tỏi, nước mắm, đường, tiêu trong 30 phút.', step_image_filename: '', duration_minutes: 30 },
  { recipe_id: 'R002', step_number: 2, instruction: 'Nướng thịt trên vỉ hoặc chảo cho đến khi chín vàng, thơm lừng.', step_image_filename: '', duration_minutes: 15 },
  { recipe_id: 'R002', step_number: 3, instruction: 'Nướng bánh mì cho giòn, rạch dọc. Phết pate và mayonnaise.', step_image_filename: '', duration_minutes: 5 },
  { recipe_id: 'R002', step_number: 4, instruction: 'Cho thịt nướng, đồ chua, dưa leo, rau mùi vào bánh mì. Rưới nước sốt và dọn ra.', step_image_filename: '', duration_minutes: 3 },
  
  // Bún Chả
  { recipe_id: 'R003', step_number: 1, instruction: 'Ướp thịt ba chỉ với nước mắm, đường, tỏi, tiêu trong 1 tiếng.', step_image_filename: '', duration_minutes: 60 },
  { recipe_id: 'R003', step_number: 2, instruction: 'Trộn thịt xay với gia vị, viên thành từng viên chả nhỏ.', step_image_filename: '', duration_minutes: 15 },
  { recipe_id: 'R003', step_number: 3, instruction: 'Nướng thịt và chả trên than hoặc vỉ nướng cho đến khi chín vàng, thơm.', step_image_filename: 'buncha-step3.jpg', duration_minutes: 20 },
  { recipe_id: 'R003', step_number: 4, instruction: 'Pha nước mắm: 4 tbsp nước mắm + 4 tbsp đường + 4 tbsp giấm + 8 tbsp nước ấm + tỏi ớt băm.', step_image_filename: '', duration_minutes: 5 },
  { recipe_id: 'R003', step_number: 5, instruction: 'Bày bún ra đĩa, thịt nướng và chả vào bát nước mắm pha. Ăn kèm rau sống.', step_image_filename: '', duration_minutes: 5 }
];

// =======================================
// Sheet 4: HƯỚNG DẪN
// =======================================
const guideData = [
  ['📋 HƯỚNG DẪN NHẬP DỮ LIỆU CÔNG THỨC NẤU ĂN'],
  [''],
  ['🔹 SHEET "Recipes" - Thông tin chính'],
  ['Cột', 'Mô tả', 'Bắt buộc', 'Ví dụ'],
  ['recipe_id', 'ID tạm để liên kết với ingredients & steps', 'Có', 'R001, R002'],
  ['recipe_name', 'Tên món ăn (tối đa 150 ký tự)', 'Có', 'Phở Bò Hà Nội'],
  ['description', 'Mô tả chi tiết về món ăn', 'Không', ''],
  ['image_filename', 'Tên file ảnh nếu upload riêng', 'Không', 'pho-bo.jpg'],
  ['image_url', 'URL ảnh từ internet (ưu tiên hơn filename)', 'Không', 'https://...'],
  ['prep_time', 'Thời gian chuẩn bị (phút)', 'Có', '30'],
  ['cook_time', 'Thời gian nấu (phút)', 'Có', '60'],
  ['servings', 'Số khẩu phần', 'Có', '4'],
  ['difficulty', 'Độ khó: easy, medium, hard', 'Có', 'medium'],
  ['status', 'Trạng thái: visible hoặc hidden', 'Có', 'visible'],
  ['categories', 'Danh mục, phân cách bằng dấu phẩy', 'Không', 'Món Việt, Bữa sáng'],
  [''],
  ['🔹 SHEET "Ingredients" - Nguyên liệu'],
  ['Cột', 'Mô tả', 'Bắt buộc', 'Ví dụ'],
  ['recipe_id', 'Liên kết với recipe', 'Có', 'R001'],
  ['ingredient_name', 'Tên nguyên liệu', 'Có', 'Thịt bò'],
  ['quantity', 'Số lượng', 'Có', '500, 1/2, một ít'],
  ['unit', 'Đơn vị: g, kg, ml, tbsp, cốc, quả...', 'Không', 'g'],
  ['notes', 'Ghi chú thêm', 'Không', 'Thái lát mỏng'],
  ['category', 'Danh mục: Thịt, Rau củ, Gia vị...', 'Không', 'Thịt'],
  [''],
  ['🔹 SHEET "Steps" - Các bước thực hiện'],
  ['Cột', 'Mô tả', 'Bắt buộc', 'Ví dụ'],
  ['recipe_id', 'Liên kết với recipe', 'Có', 'R001'],
  ['step_number', 'Số thứ tự bước (1, 2, 3...)', 'Có', '1'],
  ['instruction', 'Hướng dẫn chi tiết', 'Có', 'Rửa sạch nguyên liệu...'],
  ['step_image_filename', 'Ảnh minh họa bước (tùy chọn)', 'Không', 'step1.jpg'],
  ['duration_minutes', 'Thời gian ước tính (phút)', 'Không', '10'],
  [''],
  ['📷 CÁCH XỬ LÝ ẢNH'],
  [''],
  ['CÁCH 1: Dùng URL từ Internet (Đơn giản nhất)'],
  ['- Tìm ảnh món ăn trên Google Images, Unsplash, Pexels'],
  ['- Copy URL ảnh và dán vào cột image_url'],
  ['- Ưu điểm: Không cần upload, nhanh chóng'],
  ['- Nhược điểm: Ảnh có thể bị xóa hoặc thay đổi'],
  [''],
  ['CÁCH 2: Upload lên Supabase Storage (Khuyến nghị)'],
  ['1. Đặt tên file: ten-mon-an.jpg (không dấu, dùng dấu gạch ngang)'],
  ['2. Đặt ảnh vào thư mục: Data/images/recipes/'],
  ['3. Chạy script upload: node Data/upload-images-supabase.js'],
  ['4. Script sẽ tự động cập nhật image_url trong database'],
  [''],
  ['CÁCH 3: Upload lên Cloudinary'],
  ['1. Cấu hình CLOUDINARY_* trong file .env'],
  ['2. Đặt ảnh vào thư mục: Data/images/recipes/'],
  ['3. Chạy script: node Data/upload-images-cloudinary.js'],
  [''],
  ['📝 LƯU Ý QUAN TRỌNG'],
  ['- Kích thước ảnh khuyến nghị: 800x600 hoặc 1200x800 pixels'],
  ['- Định dạng: JPG hoặc PNG'],
  ['- Dung lượng: Dưới 2MB mỗi ảnh'],
  ['- Tên file không dấu, dùng dấu gạch ngang thay khoảng trắng'],
  [''],
  ['🚀 SAU KHI ĐIỀN XONG'],
  ['1. Lưu file Excel'],
  ['2. Đặt file vào: Data/input/'],
  ['3. Chạy lệnh: node Data/import-recipes-from-excel.js'],
  ['4. Kiểm tra log để xem kết quả import']
];

// =======================================
// Tạo Workbook
// =======================================
const wb = XLSX.utils.book_new();

// Sheet Recipes
const recipesWs = XLSX.utils.json_to_sheet(recipesSample);
XLSX.utils.book_append_sheet(wb, recipesWs, 'Recipes');

// Sheet Ingredients
const ingredientsWs = XLSX.utils.json_to_sheet(ingredientsSample);
XLSX.utils.book_append_sheet(wb, ingredientsWs, 'Ingredients');

// Sheet Steps
const stepsWs = XLSX.utils.json_to_sheet(stepsSample);
XLSX.utils.book_append_sheet(wb, stepsWs, 'Steps');

// Sheet Hướng dẫn
const guideWs = XLSX.utils.aoa_to_sheet(guideData);
guideWs['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 12 }, { wch: 30 }];
XLSX.utils.book_append_sheet(wb, guideWs, 'Huong_Dan');

// Lưu file
const outputPath = path.join(outputDir, 'RECIPE_TEMPLATE.xlsx');
XLSX.writeFile(wb, outputPath);

console.log('✅ Đã tạo file Excel mẫu tại:', outputPath);
console.log('');
console.log('📋 File gồm 4 sheets:');
console.log('   1. Recipes - Thông tin công thức chính');
console.log('   2. Ingredients - Nguyên liệu');
console.log('   3. Steps - Các bước thực hiện');
console.log('   4. Huong_Dan - Hướng dẫn nhập liệu');
