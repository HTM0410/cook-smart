/**
 * YOLO Label Mapping Configuration
 * Maps YOLO snake_case labels to exact Vietnamese ingredient names from database
 * 59 classes từ YOLO model đã train - map chính xác với tên trong database (811 ingredients)
 */

export interface LabelMapping {
  yoloLabel: string;
  ingredientName: string;
  category: string;
}

// Mapping YOLO labels to exact Vietnamese ingredient names from database
// Danh sách 59 class: train.yaml names
export const YOLO_LABEL_MAPPING: Record<string, LabelMapping> = {
  // Thịt (Meat)
  'thit_bo': { yoloLabel: 'thit_bo', ingredientName: 'Thịt bò', category: 'Thịt' },
  'thit_ga': { yoloLabel: 'thit_ga', ingredientName: 'Thịt gà', category: 'Thịt' },
  'thit_heo': { yoloLabel: 'thit_heo', ingredientName: 'Thịt heo', category: 'Thịt' },

  // Hải sản (Seafood)
  'ca': { yoloLabel: 'ca', ingredientName: 'Cá', category: 'Hải sản' },
  'ca_hoi': { yoloLabel: 'ca_hoi', ingredientName: 'Cá Hồi', category: 'Hải sản' },
  'tom': { yoloLabel: 'tom', ingredientName: 'Tôm', category: 'Hải sản' },
  'muc': { yoloLabel: 'muc', ingredientName: 'Mực', category: 'Hải sản' },
  'cua': { yoloLabel: 'cua', ingredientName: 'Cua', category: 'Hải sản' },
  'ngao': { yoloLabel: 'ngao', ingredientName: 'Nghêu', category: 'Hải sản' },
  'hau': { yoloLabel: 'hau', ingredientName: 'Hàu', category: 'Hải sản' },
  'bach_tuoc': { yoloLabel: 'bach_tuoc', ingredientName: 'Bạch tuộc', category: 'Hải sản' },

  // Trứng (Eggs)
  'trung_ga': { yoloLabel: 'trung_ga', ingredientName: 'Trứng gà', category: 'Trứng' },
  'trung_cut': { yoloLabel: 'trung_cut', ingredientName: 'Trứng cút', category: 'Trứng' },

  // Rau củ (Vegetables) - 24 classes
  'ca_chua': { yoloLabel: 'ca_chua', ingredientName: 'Cà chua', category: 'Rau củ quả' },
  'ca_rot': { yoloLabel: 'ca_rot', ingredientName: 'Cà rốt', category: 'Rau củ quả' },
  'ca_tim': { yoloLabel: 'ca_tim', ingredientName: 'Cà tím', category: 'Rau củ quả' },
  'bap_cai': { yoloLabel: 'bap_cai', ingredientName: 'Bắp cải', category: 'Rau củ quả' },
  'cai_thao': { yoloLabel: 'cai_thao', ingredientName: 'Cải thảo', category: 'Rau củ quả' },
  'rau_cai': { yoloLabel: 'rau_cai', ingredientName: 'Rau cải', category: 'Rau củ quả' },
  'rau_muong': { yoloLabel: 'rau_muong', ingredientName: 'Rau muống', category: 'Rau củ quả' },
  'rau_mong_toi': { yoloLabel: 'rau_mong_toi', ingredientName: 'Mồng tơi', category: 'Rau củ quả' },
  'xa_lach': { yoloLabel: 'xa_lach', ingredientName: 'Rau Xà Lách', category: 'Rau củ quả' },
  'dua_leo': { yoloLabel: 'dua_leo', ingredientName: 'Dưa leo', category: 'Rau củ quả' },
  'hanh_tay': { yoloLabel: 'hanh_tay', ingredientName: 'Hành tây', category: 'Rau củ quả' },
  'hanh_tim': { yoloLabel: 'hanh_tim', ingredientName: 'Hành tím', category: 'Rau củ quả' },
  'khoai_tay': { yoloLabel: 'khoai_tay', ingredientName: 'Khoai tây', category: 'Rau củ quả' },
  'khoai_lang': { yoloLabel: 'khoai_lang', ingredientName: 'Khoai lang', category: 'Rau củ quả' },
  'bap_ngo': { yoloLabel: 'bap_ngo', ingredientName: 'Bắp Ngô', category: 'Rau củ quả' },
  'bi_ngo': { yoloLabel: 'bi_ngo', ingredientName: 'Bí ngòi', category: 'Rau củ quả' },
  'cu_cai': { yoloLabel: 'cu_cai', ingredientName: 'Củ Cải', category: 'Rau củ quả' },
  'muop': { yoloLabel: 'muop', ingredientName: 'Mướp', category: 'Rau củ quả' },
  'su_su': { yoloLabel: 'su_su', ingredientName: 'Su Su', category: 'Rau củ quả' },
  'kho_qua': { yoloLabel: 'kho_qua', ingredientName: 'Khổ qua', category: 'Rau củ quả' },

  // Rau thơm & Gia vị (Herbs & Spices) - 10 classes
  'bac_ha': { yoloLabel: 'bac_ha', ingredientName: 'Bạc hà', category: 'Gia vị' },
  'rau_hung': { yoloLabel: 'rau_hung', ingredientName: 'Húng Lủi', category: 'Gia vị' },
  'rau_mui': { yoloLabel: 'rau_mui', ingredientName: 'Rau mùi', category: 'Gia vị' },
  'rau_ram': { yoloLabel: 'rau_ram', ingredientName: 'Rau răm', category: 'Gia vị' },
  'toi': { yoloLabel: 'toi', ingredientName: 'Tỏi', category: 'Gia vị' },
  'gung': { yoloLabel: 'gung', ingredientName: 'Gừng', category: 'Gia vị' },
  'ot': { yoloLabel: 'ot', ingredientName: 'Ớt', category: 'Gia vị' },
  'ot_chuong': { yoloLabel: 'ot_chuong', ingredientName: 'Ớt chuông', category: 'Gia vị' },
  'thi_la': { yoloLabel: 'thi_la', ingredientName: 'Thì là', category: 'Gia vị' },
  'chanh': { yoloLabel: 'chanh', ingredientName: 'Chanh', category: 'Gia vị' },
  'rieng': { yoloLabel: 'rieng', ingredientName: 'Riềng', category: 'Gia vị' },

  // Nấm (Mushrooms) - 3 classes
  'nam_bao_ngu': { yoloLabel: 'nam_bao_ngu', ingredientName: 'Nấm bào ngư', category: 'Nấm' },
  'nam_huong': { yoloLabel: 'nam_huong', ingredientName: 'Nấm hương', category: 'Nấm' },
  'nam_kim_cham': { yoloLabel: 'nam_kim_cham', ingredientName: 'Nấm kim châm', category: 'Nấm' },

  // Đậu (Legumes) - 1 class
  'dau_hu': { yoloLabel: 'dau_hu', ingredientName: 'Đậu Hũ', category: 'Đậu & sản phẩm từ đậu' },

  // Trái cây (Fruits) - 6 classes
  'cam': { yoloLabel: 'cam', ingredientName: 'Cam', category: 'Trái cây' },
  'chuoi': { yoloLabel: 'chuoi', ingredientName: 'Chuối', category: 'Trái cây' },
  'dua-': { yoloLabel: 'dua-', ingredientName: 'Dứa', category: 'Trái cây' },
  'xoai': { yoloLabel: 'xoai', ingredientName: 'Xoài', category: 'Trái cây' },
  'tao': { yoloLabel: 'tao', ingredientName: 'Táo', category: 'Trái cây' },
  'dua_hau': { yoloLabel: 'dua_hau', ingredientName: 'Dưa Hấu', category: 'Trái cây' },
  'thanh_long': { yoloLabel: 'thanh_long', ingredientName: 'Thanh long', category: 'Trái cây' },

  // Ngũ cốc & Bánh (Grains & Bread) - 3 classes
  'banh_mi': { yoloLabel: 'banh_mi', ingredientName: 'Bánh mì', category: 'Ngũ cốc' },
  'bun': { yoloLabel: 'bun', ingredientName: 'Bún', category: 'Ngũ cốc' },
  'gao': { yoloLabel: 'gao', ingredientName: 'Gạo', category: 'Ngũ cốc' },

  // Các loại khác - 1 class
  'xuc_xich': { yoloLabel: 'xuc_xich', ingredientName: 'Xúc Xích', category: 'Thịt' },
};

// ============================================
// Utility Functions
// ============================================

// Get all supported YOLO labels
export function getAllYoloLabels(): string[] {
  return Object.keys(YOLO_LABEL_MAPPING);
}

// Get exact ingredient name from database by YOLO label
export function getIngredientName(yoloLabel: string): string | null {
  const mapping = YOLO_LABEL_MAPPING[yoloLabel];
  return mapping?.ingredientName || null;
}

// Get mapping by YOLO label
export function getLabelMapping(yoloLabel: string): LabelMapping | undefined {
  return YOLO_LABEL_MAPPING[yoloLabel];
}

// Get category by YOLO label
export function getCategory(yoloLabel: string): string | null {
  const mapping = YOLO_LABEL_MAPPING[yoloLabel];
  return mapping?.category || null;
}

// Convert YOLO label to exact database ingredient name
export function yoloLabelToIngredientName(yoloLabel: string): string | null {
  return getIngredientName(yoloLabel);
}

// Convert array of YOLO labels to database ingredient names
export function yoloLabelsToIngredientNames(yoloLabels: string[]): string[] {
  return yoloLabels
    .map(label => getIngredientName(label))
    .filter((name): name is string => name !== null);
}

// Check if label is supported
export function isSupportedLabel(label: string): boolean {
  return label in YOLO_LABEL_MAPPING;
}

// Get all labels grouped by category
export function getLabelsByCategory(): Record<string, LabelMapping[]> {
  const grouped: Record<string, LabelMapping[]> = {};
  
  for (const mapping of Object.values(YOLO_LABEL_MAPPING)) {
    const category = mapping.category || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(mapping);
  }
  
  return grouped;
}

// Get category statistics
export function getCategoryStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const mapping of Object.values(YOLO_LABEL_MAPPING)) {
    stats[mapping.category] = (stats[mapping.category] || 0) + 1;
  }
  return stats;
}

export default YOLO_LABEL_MAPPING;
