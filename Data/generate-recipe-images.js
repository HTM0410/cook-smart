#!/usr/bin/env node
'use strict';

/**
 * Generate AI images for recipes using supported image generation APIs.
 *
 * Providers:
 *   - openai   (default) → requires OPENAI_API_KEY, uses gpt-image-1
 *   - stability           → requires STABILITY_API_KEY, uses Stable Diffusion XL
 *
 * Usage:
 *   OPENAI_API_KEY=... node Data/generate-recipe-images.js \
 *     --dataset Data/output/schema-YYYY/dataset.json \
 *     --out images \
 *     --public-base https://cdn.example.com/recipes
 *
 * Notes:
 * - Requires Node 18+ for global fetch and the `xlsx` package installed.
 * - Images are generated sequentially to stay within rate limits.
 * - By default, the script leaves the original dataset untouched and writes
 *   an updated copy with local/hosted image URLs plus an Excel export.
 */

const fs = require('fs');
const path = require('path');

let XLSX;
try {
  XLSX = require('xlsx');
} catch (err) {
  console.error('Missing dependency "xlsx". Install with `npm install` before running this tool.');
  process.exit(1);
}

const env = process.env;

const DEFAULT_MODEL = 'gpt-image-1';
const DEFAULT_STABILITY_ENGINE = 'stable-diffusion-xl-1024-v1-0';
const DEFAULT_SIZE = '1024x1024';
const DEFAULT_DELAY_MS = 1_500;

const params = {
  datasetPath: '',
  outDir: '',
  overwrite: false,
  provider: (env.RECIPE_IMAGE_PROVIDER || 'openai').toLowerCase(),
  model: DEFAULT_MODEL,
  size: DEFAULT_SIZE,
  stabilityEngine: env.RECIPE_IMAGE_ENGINE || env.STABILITY_ENGINE || DEFAULT_STABILITY_ENGINE,
  width: Number(env.RECIPE_IMAGE_WIDTH || 1024),
  height: Number(env.RECIPE_IMAGE_HEIGHT || 1024),
  steps: Number(env.RECIPE_IMAGE_STEPS || 30),
  cfgScale: Number(env.RECIPE_IMAGE_CFG || 7),
  apiUrl: env.RECIPE_IMAGE_API_URL || '',
  apiKey:
    env.OPENAI_API_KEY ||
    env.RECIPE_IMAGE_API_KEY ||
    env.STABILITY_API_KEY ||
    env.STABILITY_IMAGE_KEY ||
    '',
  delayMs: Number(env.RECIPE_IMAGE_DELAY_MS || DEFAULT_DELAY_MS),
  publicBaseUrl: '',
  appendPrompt: '',
  updatedDatasetName: 'dataset-with-images.json'
};

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const next = args[i + 1];
    switch (key) {
      case 'dataset':
        params.datasetPath = next;
        i++;
        break;
      case 'out':
        params.outDir = next;
        i++;
        break;
      case 'model':
        params.model = next;
        i++;
        break;
      case 'provider':
        params.provider = next.toLowerCase();
        i++;
        break;
      case 'engine':
        params.stabilityEngine = next;
        i++;
        break;
      case 'width':
        params.width = Number(next);
        i++;
        break;
      case 'height':
        params.height = Number(next);
        i++;
        break;
      case 'steps':
        params.steps = Number(next);
        i++;
        break;
      case 'cfg':
        params.cfgScale = Number(next);
        i++;
        break;
      case 'size':
        params.size = next;
        i++;
        break;
      case 'api-url':
        params.apiUrl = next;
        i++;
        break;
      case 'delay':
        params.delayMs = Number(next);
        i++;
        break;
      case 'public-base':
        params.publicBaseUrl = next;
        i++;
        break;
      case 'append-prompt':
        params.appendPrompt = next;
        i++;
        break;
      case 'overwrite':
        params.overwrite = true;
        break;
      case 'updated-dataset':
        params.updatedDatasetName = next;
        i++;
        break;
      default:
        console.warn(`Unknown option: --${key}`);
        break;
    }
  }
}

if (!params.datasetPath) {
  console.error('Missing required --dataset <path-to-dataset.json>');
  process.exit(1);
}

if (!['openai', 'stability'].includes(params.provider)) {
  console.error(`Unsupported provider "${params.provider}". Use "openai" or "stability".`);
  process.exit(1);
}

if (!params.apiKey) {
  const hint =
    params.provider === 'stability'
      ? 'Set STABILITY_API_KEY or RECIPE_IMAGE_API_KEY.'
      : 'Set OPENAI_API_KEY or RECIPE_IMAGE_API_KEY.';
  console.error(`Missing API key for provider "${params.provider}". ${hint}`);
  process.exit(1);
}

const datasetPath = path.resolve(params.datasetPath);
if (!fs.existsSync(datasetPath)) {
  console.error(`Dataset not found: ${datasetPath}`);
  process.exit(1);
}

if (!params.apiUrl) {
  params.apiUrl =
    params.provider === 'stability'
      ? `https://api.stability.ai/v1/generation/${params.stabilityEngine}/text-to-image`
      : 'https://api.openai.com/v1/images/generations';
}

const datasetDir = path.dirname(datasetPath);
const imagesDir = path.resolve(datasetDir, params.outDir || 'images');
fs.mkdirSync(imagesDir, { recursive: true });

const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toAsciiLower = (value) =>
  value
    ? value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
    : '';

const mainTranslations = {
  'Ức gà': 'chicken breast',
  'Đùi gà': 'chicken thigh',
  'Cánh gà': 'chicken wings',
  'Thịt bò thăn': 'beef tenderloin',
  'Thịt bò ba chỉ': 'marbled beef belly',
  'Tôm sú': 'tiger prawns',
  'Tôm thẻ': 'whiteleg shrimp',
  'Cá hồi': 'salmon fillet',
  'Cá ngừ': 'tuna steak',
  'Cá basa': 'basa fish fillet',
  'Đậu phụ non': 'silken tofu',
  'Đậu phụ chiên': 'crispy fried tofu',
  'Nấm hương': 'shiitake mushrooms',
  'Nấm kim châm': 'enoki mushrooms',
  'Bí đỏ': 'pumpkin',
  'Khoai tây': 'potatoes',
  'Bông cải xanh': 'broccoli',
  'Rau bina': 'spinach',
  'Mì ý': 'spaghetti pasta',
  'Bún gạo': 'rice vermicelli'
};

const methodTranslations = {
  'áp chảo': 'pan-seared',
  'nướng lò': 'oven-roasted',
  'xào': 'stir-fried',
  'om': 'slow-braised',
  'hấp': 'steam-cooked',
  'ram': 'caramel-glazed',
  'chiên giòn': 'crispy fried',
  'trộn salad': 'fresh salad of',
  'kho tiêu': 'black pepper braised',
  'hầm thảo mộc': 'herb-stewed'
};

const flavorTranslations = {
  'sốt bơ tỏi': 'a rich garlic butter sauce',
  'sốt chanh mật ong': 'a honey lemon glaze',
  'sốt tiêu đen': 'a bold black pepper sauce',
  'sốt teriyaki': 'a glossy teriyaki glaze',
  'rang muối ớt': 'a spicy chili salt seasoning',
  'chanh sả': 'bright lemongrass citrus aromas',
  'thảo mộc Địa Trung Hải': 'fragrant Mediterranean herbs',
  'sốt cà chua': 'a rustic tomato sauce',
  'sốt me': 'a tangy tamarind glaze',
  'mật ong gừng': 'warm ginger honey syrup',
  'sa tế tôm': 'spicy shrimp satay oil',
  'sốt bơ chanh dây': 'a silky passionfruit butter sauce'
};

const parseRecipeComponents = (recipeName) => {
  if (!recipeName) return { main: null, method: null, flavor: null };
  const mainKey =
    Object.keys(mainTranslations).find((vn) => recipeName.startsWith(`${vn} `)) ?? null;
  const methodKey =
    Object.keys(methodTranslations).find((vn) => recipeName.includes(` ${vn} `)) ?? null;
  const flavorKey =
    Object.keys(flavorTranslations).find((vn) => recipeName.endsWith(vn)) ?? null;
  return { main: mainKey, method: methodKey, flavor: flavorKey };
};

const capitalize = (text) => (!text ? '' : text.charAt(0).toUpperCase() + text.slice(1));

const buildRecipePrompts = (recipe) => {
  const name = recipe.recipe_name || 'Món ăn';
  const { main, method, flavor } = parseRecipeComponents(name);

  const mainEn = mainTranslations[main ?? ''] || toAsciiLower(main || name);
  const methodEn = methodTranslations[method ?? ''] || '';
  const flavorEn = flavorTranslations[flavor ?? ''] || '';

  const core =
    methodEn === 'fresh salad of'
      ? `${methodEn} ${mainEn}`
      : `${methodEn ? methodEn + ' ' : ''}${mainEn}`;

  const finishing = flavorEn ? `finished with ${flavorEn}` : '';

  const englishPromptParts = [
    'Ultra realistic food photography, 45-degree angle, natural diffused lighting, shallow depth of field.',
    `Dish: ${capitalize(core.trim())}${finishing ? `, ${finishing}` : ''}.`,
    'Styled for modern Vietnamese cuisine, meticulous plating on ceramic tableware, garnished with fresh herbs, high-resolution 8K render.'
  ];
  if (params.appendPrompt) englishPromptParts.push(params.appendPrompt);
  const englishPrompt = englishPromptParts.join(' ');

  const vietnamesePromptParts = [
    'Ảnh món ăn chất lượng cao, góc chụp 45°, ánh sáng tự nhiên.',
    `Tên món: ${name}.`
  ];
  if (recipe.description) vietnamesePromptParts.push(`Mô tả: ${recipe.description}.`);
  if (params.appendPrompt) vietnamesePromptParts.push(params.appendPrompt);
  const vietnamesePrompt = vietnamesePromptParts.filter(Boolean).join(' ');

  return {
    englishPrompt,
    vietnamesePrompt,
    components: { main, method, flavor },
    englishCore: core.trim()
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const recipesData = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
if (!Array.isArray(recipesData.recipes)) {
  console.error('Invalid dataset: missing recipes array.');
  process.exit(1);
}

async function callOpenAIImageAPI(prompt) {
  const response = await fetch(params.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      model: params.model,
      prompt,
      size: params.size,
      n: 1,
      response_format: 'b64_json'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Image API failed (${response.status}): ${errText}`);
  }

  const payload = await response.json();
  const base64 = payload?.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error('Image API returned no base64 data.');
  }

  return {
    buffer: Buffer.from(base64, 'base64'),
    meta: {
      model: params.model
    }
  };
}

async function callStabilityImageAPI(prompt) {
  const body = {
    text_prompts: [{ text: prompt }],
    cfg_scale: params.cfgScale,
    height: params.height,
    width: params.width,
    samples: 1,
    steps: params.steps
  };

  const response = await fetch(params.apiUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Stability API failed (${response.status}): ${errText}`);
  }

  const payload = await response.json();
  const artifact = payload?.artifacts?.find((a) => a.base64);
  if (!artifact?.base64) {
    throw new Error('Stability API returned no base64 data.');
  }

  return {
    buffer: Buffer.from(artifact.base64, 'base64'),
    meta: {
      engine: params.stabilityEngine,
      seed: artifact.seed,
      finishReason: artifact.finishReason
    }
  };
}

async function generateImageFor(recipe) {
  const slug = slugify(recipe.recipe_name || `recipe-${recipe.id}`);
  const fileName = `${slug || `recipe-${recipe.id}`}.png`;
  const filePath = path.join(imagesDir, fileName);

  if (!params.overwrite && fs.existsSync(filePath)) {
    return { fileName, filePath, skipped: true };
  }

  const { englishPrompt, vietnamesePrompt, components, englishCore } = buildRecipePrompts(recipe);
  const prompt = englishPrompt;

  console.log(`→ Generating image for: ${recipe.recipe_name}`);

  const { buffer, meta } =
    params.provider === 'stability'
      ? await callStabilityImageAPI(prompt)
      : await callOpenAIImageAPI(prompt);

  fs.writeFileSync(filePath, buffer);

  return {
    fileName,
    filePath,
    skipped: false,
    prompt,
    promptVi: vietnamesePrompt,
    promptComponents: components,
    promptCoreEn: englishCore,
    meta
  };
}

async function main() {
  const failures = [];
  const results = [];

  for (let i = 0; i < recipesData.recipes.length; i++) {
    const recipe = recipesData.recipes[i];
    try {
      const result = await generateImageFor(recipe);
      if (result.prompt) {
        recipe.image_prompt = result.prompt;
      }
      if (result.promptVi) {
        recipe.image_prompt_vi = result.promptVi;
      }
      if (result.promptComponents) {
        recipe.image_prompt_components = result.promptComponents;
      }
      if (result.promptCoreEn) {
        recipe.image_prompt_core_en = result.promptCoreEn;
      }
      recipe.image_provider = params.provider;
      if (result.meta?.model) {
        recipe.image_model = result.meta.model;
      }
      if (result.meta?.engine) {
        recipe.image_engine = result.meta.engine;
      }
      if (result.meta?.seed !== undefined) {
        recipe.image_seed = result.meta.seed;
      }
      if (result.meta?.finishReason) {
        recipe.image_finish_reason = result.meta.finishReason;
      }
      results.push(result);
    } catch (err) {
      console.error(`✖ Failed to generate image for "${recipe.recipe_name}": ${err.message}`);
      failures.push({ recipe: recipe.recipe_name, error: err.message });
      continue;
    }

    if (params.delayMs > 0 && i < recipesData.recipes.length - 1) {
      await sleep(params.delayMs);
    }
  }

  const toPublicUrl = (fileName) => {
    if (!fileName) return '';
    if (params.publicBaseUrl) {
      return `${params.publicBaseUrl.replace(/\/$/, '')}/${fileName}`;
    }
    const relative = path.relative(datasetDir, path.join(imagesDir, fileName)).replace(/\\/g, '/');
    return relative.startsWith('.') ? relative : `./${relative}`;
  };

  for (const recipe of recipesData.recipes) {
    const slug = slugify(recipe.recipe_name || `recipe-${recipe.id}`);
    const fileName = `${slug || `recipe-${recipe.id}`}.png`;
    if (fs.existsSync(path.join(imagesDir, fileName))) {
      recipe.image_url = toPublicUrl(fileName);
    }
  }

  const updatedJsonPath = path.join(datasetDir, params.updatedDatasetName);
  fs.writeFileSync(updatedJsonPath, JSON.stringify(recipesData, null, 2), 'utf8');

  const workbook = XLSX.utils.book_new();
  Object.entries(recipesData).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    const worksheet = XLSX.utils.json_to_sheet(value);
    XLSX.utils.book_append_sheet(workbook, worksheet, key);
  });
  const updatedExcelPath = path.join(datasetDir, params.updatedDatasetName.replace(/\.json$/i, '.xlsx'));
  XLSX.writeFile(workbook, updatedExcelPath);

  console.log('');
  console.log('Image generation complete.');
  console.log(`- Images dir       : ${imagesDir}`);
  console.log(`- Updated dataset  : ${updatedJsonPath}`);
  console.log(`- Updated workbook : ${updatedExcelPath}`);
  if (failures.length > 0) {
    console.log('');
    console.log('Some recipes failed to generate:');
    failures.forEach((f) => console.log(`  • ${f.recipe}: ${f.error}`));
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.stack || err.message}`);
  process.exit(1);
});
