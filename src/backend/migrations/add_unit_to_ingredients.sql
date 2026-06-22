-- Add unit column to ingredients table
ALTER TABLE ingredients 
ADD COLUMN unit VARCHAR(50) NULL AFTER description;

-- Update existing ingredients with default units based on category
UPDATE ingredients 
SET unit = 'gram' 
WHERE category_id IN (2, 3) AND unit IS NULL; -- Thịt, Hải sản

UPDATE ingredients 
SET unit = 'gram' 
WHERE category_id = 1 AND unit IS NULL; -- Rau củ

UPDATE ingredients 
SET unit = 'ml' 
WHERE category_id = 4 AND unit IS NULL; -- Sản phẩm từ sữa

UPDATE ingredients 
SET unit = 'muỗng canh' 
WHERE category_id = 5 AND unit IS NULL; -- Gia vị

UPDATE ingredients 
SET unit = 'gram' 
WHERE category_id = 6 AND unit IS NULL; -- Ngũ cốc

UPDATE ingredients 
SET unit = 'ml' 
WHERE category_id = 7 AND unit IS NULL; -- Dầu ăn

UPDATE ingredients 
SET unit = 'ml' 
WHERE category_id = 8 AND unit IS NULL; -- Nước chấm

