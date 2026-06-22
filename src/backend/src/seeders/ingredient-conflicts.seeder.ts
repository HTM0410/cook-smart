import { sequelize } from '../config/database-supabase';
import { Ingredient, IngredientConflict } from '../models';
import { Op } from 'sequelize';

interface ConflictData {
  ingredientName1: string;
  ingredientName2: string;
  conflictReason: string;
  severity: 'low' | 'medium' | 'high';
}

const ingredientConflicts: ConflictData[] = [
  // Nguyên liệu tương khắc phổ biến trong ẩm thực Việt
  {
    ingredientName1: 'Trứng',
    ingredientName2: 'Sữa',
    conflictReason: 'Trứng chứa protein khi kết hợp với casein trong sữa có thể gây khó tiêu, ảnh hưởng hấp thu dinh dưỡng.',
    severity: 'medium',
  },
  {
    ingredientName1: 'Cá',
    ingredientName2: 'Sữa',
    conflictReason: 'Cá và sữa khi kết hợp có thể gây đầy bụng, khó tiêu và làm mất đi hương vị tự nhiên của cá.',
    severity: 'medium',
  },
  {
    ingredientName1: 'Thịt bò',
    ingredientName2: 'Thịt chó',
    conflictReason: 'Hai loại thịt có tính nhiệt khác nhau, kết hợp có thể gây nóng trong, khó tiêu hóa.',
    severity: 'high',
  },
  {
    ingredientName1: 'Rau muống',
    ingredientName2: 'Sữa',
    conflictReason: 'Rau muống chứa nhiều vitamin C, kết hợp với sữa có thể làm mất chất dinh dưỡng và gây đầy bụng.',
    severity: 'low',
  },
  {
    ingredientName1: 'Cua',
    ingredientName2: 'Trứng',
    conflictReason: 'Cua và trứng đều là thực phẩm giàu đạm, kết hợp có thể gây quá tải cho hệ tiêu hóa.',
    severity: 'medium',
  },
  {
    ingredientName1: 'Tôm',
    ingredientName2: 'Thịt bò',
    conflictReason: 'Tôm giàu canxi và i-ốt, kết hợp với thịt bò có thể gây đầy bụng và khó tiêu.',
    severity: 'medium',
  },
  {
    ingredientName1: 'Cá',
    ingredientName2: 'Thịt vịt',
    conflictReason: 'Cá và thịt vịt đều có tính hàn, kết hợp có thể gây lạnh bụng, đầy hơi.',
    severity: 'medium',
  },
  {
    ingredientName1: 'Hành tây',
    ingredientName2: 'Mật ong',
    conflictReason: 'Hành tây có tính nóng, kết hợp với mật ong có thể gây nóng trong, nổi mụn.',
    severity: 'low',
  },
  {
    ingredientName1: 'Cà chua',
    ingredientName2: 'Dưa leo',
    conflictReason: 'Cà chua chứa axit tartaric, dưa leo có men tiêu hóa, kết hợp có thể gây khó tiêu.',
    severity: 'low',
  },
  {
    ingredientName1: 'Thịt gà',
    ingredientName2: 'Thịt trâu',
    conflictReason: 'Hai loại thịt có tính nhiệt khác biệt, kết hợp có thể gây đầy bụng và khó tiêu.',
    severity: 'medium',
  },
  {
    ingredientName1: 'Nước lẩu',
    ingredientName2: 'Rau sống',
    conflictReason: 'Nước lẩu thường rất nóng và có nhiều gia vị, ăn với rau sống lạnh có thể gây lạnh bụng.',
    severity: 'low',
  },
  {
    ingredientName1: 'Thịt heo',
    ingredientName2: 'Nấm',
    conflictReason: 'Thịt heo và nấm đều là thực phẩm giàu đạm, kết hợp nhiều có thể gây quá tải cho thận.',
    severity: 'low',
  },
  {
    ingredientName1: 'Chuối',
    ingredientName2: 'Sữa',
    conflictReason: 'Chuối chứa axit tannic, kết hợp với sữa có thể gây đầy bụng và khó tiêu.',
    severity: 'medium',
  },
  {
    ingredientName1: 'Xoài',
    ingredientName2: 'Sữa chua',
    conflictReason: 'Xoài chưa chín chứa axit, kết hợp với sữa chua có thể gây khó tiêu và đau bụng.',
    severity: 'medium',
  },
  {
    ingredientName1: 'Cơm',
    ingredientName2: 'Bánh mì',
    conflictReason: 'Cơm và bánh mì đều chứa tinh bột, ăn quá nhiều tinh bột cùng lúc có thể gây đầy hơi.',
    severity: 'low',
  },
];

async function seedIngredientConflicts() {
  try {
    console.log('🔄 Bắt đầu seed dữ liệu nguyên liệu tương khắc...');

    await sequelize.authenticate();
    console.log('✅ Kết nối database thành công');

    let createdCount = 0;
    let skippedCount = 0;

    for (const conflict of ingredientConflicts) {
      const ingredient1 = await Ingredient.findOne({
        where: {
          ingredientName: {
            [Op.like]: `%${conflict.ingredientName1}%`,
          },
        },
      });

      const ingredient2 = await Ingredient.findOne({
        where: {
          ingredientName: {
            [Op.like]: `%${conflict.ingredientName2}%`,
          },
        },
      });

      if (!ingredient1 || !ingredient2) {
        console.log(`⚠️ Không tìm thấy nguyên liệu: ${conflict.ingredientName1} hoặc ${conflict.ingredientName2}`);
        skippedCount++;
        continue;
      }

      const existing = await IngredientConflict.findOne({
        where: {
          [Op.or]: [
            {
              ingredientId1: ingredient1.id,
              ingredientId2: ingredient2.id,
            },
            {
              ingredientId1: ingredient2.id,
              ingredientId2: ingredient1.id,
            },
          ],
        },
      });

      if (existing) {
        console.log(`⚠️ Đã tồn tại: ${conflict.ingredientName1} vs ${conflict.ingredientName2}`);
        skippedCount++;
        continue;
      }

      await IngredientConflict.create({
        ingredientId1: ingredient1.id,
        ingredientId2: ingredient2.id,
        conflictReason: conflict.conflictReason,
        severity: conflict.severity,
      });

      console.log(`✅ Đã thêm: ${conflict.ingredientName1} (ID:${ingredient1.id}) vs ${conflict.ingredientName2} (ID:${ingredient2.id}) - ${conflict.severity}`);
      createdCount++;
    }

    console.log(`\n📊 Kết quả seed:`);
    console.log(`   - Đã tạo: ${createdCount} cặp tương khắc`);
    console.log(`   - Đã bỏ qua: ${skippedCount} cặp (đã tồn tại hoặc thiếu nguyên liệu)`);
    console.log('✅ Hoàn thành seed dữ liệu nguyên liệu tương khắc!');

  } catch (error) {
    console.error('❌ Lỗi khi seed dữ liệu:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

seedIngredientConflicts()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
