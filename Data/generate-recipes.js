#!/usr/bin/env node
/*
  Generate 100 sample recipes for MVP import
  Output: Data/output/generated-<timestamp>/recipes.json and recipes.xlsx
*/

const fs = require('fs');
const path = require('path');

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const nouns = ['Gà', 'Bò', 'Heo', 'Cá', 'Tôm', 'Mực', 'Đậu phụ', 'Nấm', 'Rau củ', 'Bí đỏ'];
const styles = ['xào', 'kho', 'nướng', 'hầm', 'ram', 'chiên giòn', 'trộn', 'sốt bơ tỏi', 'sốt cay', 'sốt chua ngọt'];
const units = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cốc'];
const ingredientsPool = ['Hành tây', 'Tỏi', 'Gừng', 'Ớt', 'Muối', 'Tiêu', 'Đường', 'Nước mắm', 'Dầu ăn', 'Bơ', 'Sữa', 'Bột mì', 'Rau mùi', 'Hành lá', 'Cà rốt', 'Khoai tây', 'Cần tây'];

const stepTemplates = [
  'Sơ chế nguyên liệu chính, rửa sạch và cắt miếng vừa ăn.',
  'Băm nhỏ tỏi, gừng; cắt lát hành tây và các loại rau củ.',
  'Ướp {main} với {season} trong {mins} phút.',
  'Đun nóng dầu, phi thơm tỏi và hành.',
  'Cho {main} vào xào săn trong {mins} phút.',
  'Thêm {liquid} và nấu lửa nhỏ {mins} phút cho thấm vị.',
  'Nêm nếm lại với {season} cho vừa ăn.',
  'Tắt bếp, rắc hành lá/rau mùi và dọn ra đĩa.'
];
const seasons = ['muối, tiêu', 'nước mắm, tiêu', 'xì dầu, đường', 'muối, bột ngọt'];
const liquids = ['nước lọc', 'nước dùng gà', 'nước dừa', 'sữa tươi'];

function makeRecipe(i, usedNames) {
  const main = randomChoice(nouns);
  const style = randomChoice(styles);
  let base = `${main} ${style}`;
  let name = base;
  let suffix = 2;
  while (usedNames.has(name)) {
    name = `${base} (${suffix})`;
    suffix++;
  }
  usedNames.add(name);
  const desc = `Món ${main.toLowerCase()} ${style} đơn giản cho bữa ăn hằng ngày.`;
  const prep = randomInt(5, 30);
  const cook = randomInt(10, 60);
  const servings = randomInt(2, 6);
  const difficulty = cook + prep <= 30 ? 'easy' : cook + prep <= 60 ? 'medium' : 'hard';

  const ingCount = randomInt(6, 12);
  const chosen = [];
  for (let k = 0; k < ingCount; k++) {
    const ing = randomChoice(ingredientsPool);
    chosen.push({
      ingredient_name: ing,
      quantity: String(randomInt(1, 500)),
      unit: randomChoice(units),
      note: ''
    });
  }

  const steps = [];
  const season = randomChoice(seasons);
  const liquid = randomChoice(liquids);
  const order = [0,1,2,3,4,5,6,7];
  for (let idx = 0; idx < order.length; idx++) {
    const tmpl = stepTemplates[order[idx]];
    const mins = randomInt(5, 15);
    const text = tmpl
      .replace('{main}', main.toLowerCase())
      .replace('{season}', season)
      .replace('{liquid}', liquid)
      .replace('{mins}', String(mins));
    steps.push({ step_number: idx + 1, instruction: text, duration_minutes: mins });
  }

  return {
    recipe: {
      recipe_name: name,
      description: desc,
      image_url: '',
      prep_time: prep,
      cook_time: cook,
      servings,
      difficulty,
      status: 'public'
    },
    categories: ['MVP'],
    ingredients: chosen,
    steps,
    nutrition: {
      calories: randomInt(200, 800),
      protein_g: randomInt(10, 40),
      carbs_g: randomInt(10, 60),
      fat_g: randomInt(5, 40)
    }
  };
}

function toCsv(rows, headers) {
  const esc = (v) => {
    const s = (v ?? '').toString();
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(','));
  return lines.join('\n');
}

function main() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join('Data', 'output', `generated-${ts}`);
  fs.mkdirSync(outDir, { recursive: true });

  const usedNames = new Set();
  const items = Array.from({ length: 100 }, (_, i) => makeRecipe(i, usedNames));
  const jsonPath = path.join(outDir, 'recipes.json');
  fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2), 'utf8');

  // Also create an Excel via xlsx if available, else CSVs
  let xlsxDone = false;
  try {
    const XLSX = require('xlsx');
    const recRows = items.map(it => ({
      recipe_name: it.recipe.recipe_name,
      description: it.recipe.description,
      image_url: it.recipe.image_url,
      prep_time: it.recipe.prep_time,
      cook_time: it.recipe.cook_time,
      servings: it.recipe.servings,
      difficulty: it.recipe.difficulty
    }));
    const ingRows = [];
    const stepRows = [];
    for (const it of items) {
      for (const ing of it.ingredients) {
        ingRows.push({
          recipe_name: it.recipe.recipe_name,
          ingredient_name: ing.ingredient_name,
          quantity: ing.quantity,
          unit: ing.unit,
          note: ing.note
        });
      }
      for (const st of it.steps) {
        stepRows.push({
          recipe_name: it.recipe.recipe_name,
          step_number: st.step_number,
          instruction: st.instruction,
          duration_minutes: st.duration_minutes
        });
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recRows), 'Recipes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ingRows), 'Ingredients');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stepRows), 'Steps');
    const xlsxPath = path.join(outDir, 'recipes.xlsx');
    XLSX.writeFile(wb, xlsxPath);
    xlsxDone = true;
  } catch (e) {}

  if (!xlsxDone) {
    const recHeaders = ['recipe_name','description','image_url','prep_time','cook_time','servings','difficulty'];
    const ingHeaders = ['recipe_name','ingredient_name','quantity','unit','note'];
    const stepHeaders = ['recipe_name','step_number','instruction','duration_minutes'];
    const recRows = items.map(it => ({
      recipe_name: it.recipe.recipe_name,
      description: it.recipe.description,
      image_url: it.recipe.image_url,
      prep_time: it.recipe.prep_time,
      cook_time: it.recipe.cook_time,
      servings: it.recipe.servings,
      difficulty: it.recipe.difficulty
    }));
    const ingRows = [];
    const stepRows = [];
    for (const it of items) {
      for (const ing of it.ingredients) {
        ingRows.push({ recipe_name: it.recipe.recipe_name, ingredient_name: ing.ingredient_name, quantity: ing.quantity, unit: ing.unit, note: ing.note });
      }
      for (const st of it.steps) {
        stepRows.push({ recipe_name: it.recipe.recipe_name, step_number: st.step_number, instruction: st.instruction, duration_minutes: st.duration_minutes });
      }
    }
    fs.writeFileSync(path.join(outDir, 'recipes.csv'), toCsv(recRows, recHeaders), 'utf8');
    fs.writeFileSync(path.join(outDir, 'ingredients.csv'), toCsv(ingRows, ingHeaders), 'utf8');
    fs.writeFileSync(path.join(outDir, 'steps.csv'), toCsv(stepRows, stepHeaders), 'utf8');
  }

  console.log('Generated sample data at:', outDir);
}

main();


