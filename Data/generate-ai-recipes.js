#!/usr/bin/env node
/*
  Generate AI-enhanced recipes (uses OpenAI-compatible API if available).
  Env:
    OPENAI_API_KEY or OPENROUTER_API_KEY (optional)
    OPENAI_BASE_URL (optional)
  Fallback: diversified template generator when no API key is present.
*/

const fs = require('fs');
const path = require('path');

const HAS_AI = !!(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY);
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const cuisines = ['Việt Nam','Thái','Hàn','Nhật','Trung Hoa','Âu','Địa Trung Hải','Mexico'];
const mains = ['Gà','Bò','Heo','Cá','Tôm','Mực','Đậu phụ','Nấm','Rau củ'];

function tsOutDir() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join('Data', 'output', `ai-${ts}`);
  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}

async function callAI(prompt) {
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
      const res = await model.generateContent([
        { text: 'Bạn là bếp trưởng, tạo công thức món ăn tiếng Việt chuẩn để import DB.' },
        { text: prompt }
      ]);
      return res.response.text();
    } catch (e) {
      throw new Error('Gemini error: ' + e.message);
    }
  }
  const key = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,
  };
  if (process.env.OPENROUTER_API_KEY) {
    headers['HTTP-Referer'] = 'https://food-suggest.local';
    headers['X-Title'] = 'CookSmart AI Recipe Generator';
  }
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: 'Bạn là bếp trưởng, tạo công thức món ăn tiếng Việt, đủ nguyên liệu (tách quantity/unit), 8 bước rõ ràng, thời gian ước tính, phù hợp import DB.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    })
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseFromAI(text) {
  try {
    const json = JSON.parse(text);
    return Array.isArray(json) ? json : [json];
  } catch {}
  // basic fallback if AI returns text blocks - not robust, but acceptable
  return [];
}

function diversifiedFallback(n = 20) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const cuisine = cuisines[i % cuisines.length];
    const main = mains[i % mains.length];
    const style = ['xào sả ớt','om riềng mẻ','nướng mật ong','kho tiêu','hấp gừng','rang muối','sốt me','sốt bơ tỏi'][i % 8];
    const name = `${main} ${style} kiểu ${cuisine}`;
    const ing = [
      { ingredient_name: `${main}`, quantity: '400', unit: 'g', note: '' },
      { ingredient_name: 'Tỏi', quantity: '3', unit: 'tép', note: 'băm' },
      { ingredient_name: 'Hành tím', quantity: '2', unit: 'củ', note: 'băm' },
      { ingredient_name: 'Dầu ăn', quantity: '2', unit: 'tbsp', note: '' },
      { ingredient_name: 'Muối', quantity: '1/2', unit: 'tsp', note: '' },
      { ingredient_name: 'Tiêu', quantity: '1/4', unit: 'tsp', note: '' }
    ];
    const steps = Array.from({ length: 8 }, (_, k) => ({ step_number: k+1, instruction: `Thực hiện bước ${k+1} cho món ${name}.`, duration_minutes: 5 + (k%3)*3 }));
    items.push({
      recipe: { recipe_name: name, description: `Biến tấu ${cuisine} với ${main.toLowerCase()} ${style}.`, image_url: '', prep_time: 15, cook_time: 25, servings: 3, difficulty: 'medium', status: 'public' },
      categories: [cuisine],
      ingredients: ing,
      steps,
      nutrition: { calories: 520, protein_g: 35, carbs_g: 30, fat_g: 25 }
    });
  }
  return items;
}

async function main() {
  const outDir = tsOutDir();
  let items = [];
  if (HAS_AI) {
    try {
      const prompt = `Hãy tạo JSON Array 20 công thức tiếng Việt. Mỗi phần tử có dạng: {"recipe": {"recipe_name","description","image_url":"","prep_time":int,"cook_time":int,"servings":int,"difficulty":"easy|medium|hard","status":"public"}, "categories":["..."], "ingredients": [{"ingredient_name","quantity","unit","note"}], "steps": [{"step_number":int, "instruction", "duration_minutes":int}], "nutrition": {"calories":int,"protein_g":int,"carbs_g":int,"fat_g":int}}. Không giải thích, chỉ trả JSON hợp lệ.`;
      const aiText = await callAI(prompt);
      items = parseFromAI(aiText);
    } catch (e) {
      console.warn('AI unavailable, using fallback:', e.message);
      items = diversifiedFallback(20);
    }
  } else {
    items = diversifiedFallback(20);
  }

  const jsonPath = path.join(outDir, 'ai-recipes.json');
  fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2), 'utf8');

  // try write xlsx
  try {
    const XLSX = require('xlsx');
    const recRows = items.map(it => ({
      recipe_name: it.recipe.recipe_name,
      description: it.recipe.description,
      prep_time: it.recipe.prep_time,
      cook_time: it.recipe.cook_time,
      servings: it.recipe.servings,
      difficulty: it.recipe.difficulty
    }));
    const ingRows = []; const stepRows = [];
    for (const it of items) {
      for (const ing of it.ingredients) ingRows.push({ recipe_name: it.recipe.recipe_name, ...ing });
      for (const st of it.steps) stepRows.push({ recipe_name: it.recipe.recipe_name, ...st });
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recRows), 'Recipes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ingRows), 'Ingredients');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stepRows), 'Steps');
    const xlsxPath = path.join(outDir, 'ai-recipes.xlsx');
    XLSX.writeFile(wb, xlsxPath);
  } catch {}

  console.log('AI recipes generated at:', outDir);
}

if (typeof fetch !== 'function') {
  global.fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
}

main();


