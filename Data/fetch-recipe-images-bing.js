#!/usr/bin/env node
'use strict';

/**
 * Fetch representative recipe images from Bing Image Search.
 *
 * Requirements:
 *   - Node.js 18+ (for global fetch, Buffer.from base64, etc.)
 *   - An active Bing Image Search API key (Azure Cognitive Services).
 *   - Internet access (not available in this environment; run locally).
 *
 * Example:
 *   export BING_IMAGE_KEY="..."
 *   node Data/fetch-recipe-images-bing.js \
 *     --dataset Data/output/schema-YYYY/dataset.json \
 *     --out images-bing \
 *     --public-base https://cdn.example.com/recipes
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

const params = {
  datasetPath: '',
  outDir: '',
  publicBaseUrl: '',
  overwrite: false,
  safeSearch: 'Strict',
  market: 'vi-VN',
  count: 1,
  delayMs: Number(process.env.BING_IMAGE_DELAY_MS || 1500),
  updatedDatasetName: 'dataset-with-bing-images.json'
};

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!arg.startsWith('--')) continue;
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
    case 'public-base':
      params.publicBaseUrl = next;
      i++;
      break;
    case 'overwrite':
      params.overwrite = true;
      break;
    case 'safe-search':
      params.safeSearch = next;
      i++;
      break;
    case 'market':
      params.market = next;
      i++;
      break;
    case 'count':
      params.count = Number(next);
      i++;
      break;
    case 'delay':
      params.delayMs = Number(next);
      i++;
      break;
    case 'updated-dataset':
      params.updatedDatasetName = next;
      i++;
      break;
    default:
      console.warn(`Unknown option --${key}`);
      break;
  }
}

const apiKey = process.env.BING_IMAGE_KEY || process.env.AZURE_BING_IMAGE_KEY || '';
if (!apiKey) {
  console.error('Missing Bing Image Search API key. Export BING_IMAGE_KEY before running.');
  process.exit(1);
}

if (!params.datasetPath) {
  console.error('Missing --dataset path to dataset.json');
  process.exit(1);
}

const datasetPath = path.resolve(params.datasetPath);
if (!fs.existsSync(datasetPath)) {
  console.error(`Dataset not found: ${datasetPath}`);
  process.exit(1);
}

const datasetDir = path.dirname(datasetPath);
const imagesDir = path.resolve(datasetDir, params.outDir || 'images-bing');
fs.mkdirSync(imagesDir, { recursive: true });

const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const recipes = Array.isArray(dataset.recipes) ? dataset.recipes : [];
if (recipes.length === 0) {
  console.error('Dataset has no recipes array.');
  process.exit(1);
}

const fetchImageUrl = async (recipe) => {
  const query = encodeURIComponent(recipe.recipe_name || `món ăn ${recipe.id}`);
  const url = new URL('https://api.bing.microsoft.com/v7.0/images/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', params.count);
  url.searchParams.set('safeSearch', params.safeSearch);
  url.searchParams.set('mkt', params.market);
  url.searchParams.set('imageType', 'Photo');
  url.searchParams.set('aspect', 'Wide');

  const response = await fetch(url, {
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Bing API returned ${response.status}: ${errText}`);
  }

  const payload = await response.json();
  if (!payload.value || payload.value.length === 0) {
    throw new Error('No image results found');
  }

  return payload.value[0].contentUrl;
};

const downloadImage = async (url, filePath) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
};

async function main() {
  const failures = [];

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    const slug = slugify(recipe.recipe_name || `recipe-${recipe.id}`);
    const fileName = `${slug || `recipe-${recipe.id}`}.jpg`;
    const filePath = path.join(imagesDir, fileName);

    if (!params.overwrite && fs.existsSync(filePath)) {
      recipe.image_url = params.publicBaseUrl
        ? `${params.publicBaseUrl.replace(/\/$/, '')}/${fileName}`
        : `./${path.relative(datasetDir, filePath).replace(/\\/g, '/')}`;
      continue;
    }

    try {
      console.log(`→ Searching image for: ${recipe.recipe_name}`);
      const imageUrl = await fetchImageUrl(recipe);
      console.log(`  Found: ${imageUrl}`);
      await downloadImage(imageUrl, filePath);
      recipe.image_source = imageUrl;
      recipe.image_url = params.publicBaseUrl
        ? `${params.publicBaseUrl.replace(/\/$/, '')}/${fileName}`
        : `./${path.relative(datasetDir, filePath).replace(/\\/g, '/')}`;
    } catch (err) {
      console.error(`✖ Failed for "${recipe.recipe_name}": ${err.message}`);
      failures.push({ recipe: recipe.recipe_name, error: err.message });
    }

    if (params.delayMs > 0 && i < recipes.length - 1) {
      await sleep(params.delayMs);
    }
  }

  const updatedJsonPath = path.join(datasetDir, params.updatedDatasetName);
  fs.writeFileSync(updatedJsonPath, JSON.stringify(dataset, null, 2), 'utf8');

  const workbook = XLSX.utils.book_new();
  Object.entries(dataset).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(value), key);
  });
  const updatedExcelPath = path.join(datasetDir, params.updatedDatasetName.replace(/\.json$/i, '.xlsx'));
  XLSX.writeFile(workbook, updatedExcelPath);

  console.log('');
  console.log('Image search complete.');
  console.log(`- Images dir       : ${imagesDir}`);
  console.log(`- Updated dataset  : ${updatedJsonPath}`);
  console.log(`- Updated workbook : ${updatedExcelPath}`);
  if (failures.length > 0) {
    console.log('');
    console.log('Some recipes failed to download:');
    failures.forEach((f) => console.log(`  • ${f.recipe}: ${f.error}`));
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.stack || err.message}`);
  process.exit(1);
});
