-- Seed data for Recipe Categories
-- This file contains sample categories for cuisine, course, and tags

-- Cuisine Categories (Phong cách ẩm thực)
INSERT INTO recipe_categories (category_name, category_type, description, created_at, updated_at) VALUES
('Việt Nam', 'cuisine', 'Món ăn truyền thống Việt Nam', NOW(), NOW()),
('Châu Âu', 'cuisine', 'Món ăn châu Âu (Pháp, Ý, Đức...)', NOW(), NOW()),
('Nhật Bản', 'cuisine', 'Món ăn Nhật Bản', NOW(), NOW()),
('Hàn Quốc', 'cuisine', 'Món ăn Hàn Quốc', NOW(), NOW()),
('Trung Quốc', 'cuisine', 'Món ăn Trung Quốc', NOW(), NOW()),
('Thái Lan', 'cuisine', 'Món ăn Thái Lan', NOW(), NOW()),
('Mỹ', 'cuisine', 'Món ăn Mỹ', NOW(), NOW()),
('Mexico', 'cuisine', 'Món ăn Mexico', NOW(), NOW()),
('Ấn Độ', 'cuisine', 'Món ăn Ấn Độ', NOW(), NOW()),
('Địa Trung Hải', 'cuisine', 'Món ăn Địa Trung Hải', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Course Categories (Loại món theo bữa ăn và cách chế biến)
INSERT INTO recipe_categories (category_name, category_type, description, created_at, updated_at) VALUES
('Món chính', 'course', 'Món ăn chính trong bữa ăn', NOW(), NOW()),
('Món phụ', 'course', 'Món ăn phụ, món kèm', NOW(), NOW()),
('Khai vị', 'course', 'Món khai vị, món đầu tiên', NOW(), NOW()),
('Tráng miệng', 'course', 'Món tráng miệng, món ngọt', NOW(), NOW()),
-- Cách chế biến
('Kho', 'course', 'Món kho, rim', NOW(), NOW()),
('Chiên', 'course', 'Món chiên, rán', NOW(), NOW()),
('Xào', 'course', 'Món xào', NOW(), NOW()),
('Nướng', 'course', 'Món nướng, BBQ', NOW(), NOW()),
('Gỏi/Nộm', 'course', 'Món gỏi, nộm, salad', NOW(), NOW()),
('Canh/Súp', 'course', 'Món canh, súp', NOW(), NOW()),
('Hấp', 'course', 'Món hấp', NOW(), NOW()),
('Lẩu', 'course', 'Món lẩu', NOW(), NOW()),
('Món luộc', 'course', 'Món luộc', NOW(), NOW()),
('Cách chế biến khác', 'course', 'Các cách chế biến khác', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Tag Categories (Tính chất món)
INSERT INTO recipe_categories (category_name, category_type, description, created_at, updated_at) VALUES
('Healthy', 'tag', 'Món ăn tốt cho sức khỏe', NOW(), NOW()),
('Low-carb', 'tag', 'Món ăn ít carbohydrate', NOW(), NOW()),
('Ăn kiêng', 'tag', 'Món ăn phù hợp cho người ăn kiêng', NOW(), NOW()),
('Dễ nấu', 'tag', 'Món ăn dễ làm, phù hợp người mới bắt đầu', NOW(), NOW()),
('Nhanh', 'tag', 'Món ăn nấu nhanh, dưới 30 phút', NOW(), NOW()),
('Vegetarian', 'tag', 'Món chay', NOW(), NOW()),
('Vegan', 'tag', 'Món thuần chay', NOW(), NOW()),
('Gluten-free', 'tag', 'Món không chứa gluten', NOW(), NOW()),
('High protein', 'tag', 'Món giàu đạm', NOW(), NOW()),
('Low calorie', 'tag', 'Món ít calo', NOW(), NOW()),
('Spicy', 'tag', 'Món cay', NOW(), NOW()),
('Sweet', 'tag', 'Món ngọt', NOW(), NOW()),
('Savory', 'tag', 'Món mặn', NOW(), NOW()),
('Comfort food', 'tag', 'Món ăn thoải mái, dễ chịu', NOW(), NOW()),
('Gourmet', 'tag', 'Món cao cấp, gourmet', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

