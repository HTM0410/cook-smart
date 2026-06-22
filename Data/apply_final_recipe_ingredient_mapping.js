#!/usr/bin/env node
/**
 * Chốt (apply) file recipe ingredient sau chuẩn hoá unit+quantity (moderate + converted)
 * thành file FINAL để dùng downstream.
 *
 * Input:
 * - ingredient_unified_output/recipe_ingredient_mapping_unit_moderate_converted.csv
 * - ingredient_unified_output/recipe_ingredient_units_catalog_moderate_converted.csv
 *
 * Output (không sửa file gốc):
 * - ingredient_unified_output/recipe_ingredient_mapping_final.csv
 * - ingredient_unified_output/recipe_ingredient_units_catalog_final.csv
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');

const IN_MAP = path.join(OUT_DIR, 'recipe_ingredient_mapping_unit_moderate_converted.csv');
const IN_UNITS = path.join(OUT_DIR, 'recipe_ingredient_units_catalog_moderate_converted.csv');

const OUT_MAP = path.join(OUT_DIR, 'recipe_ingredient_mapping_final.csv');
const OUT_UNITS = path.join(OUT_DIR, 'recipe_ingredient_units_catalog_final.csv');

function main() {
  if (!fs.existsSync(IN_MAP)) throw new Error('Missing input: ' + IN_MAP);
  if (!fs.existsSync(IN_UNITS)) throw new Error('Missing input: ' + IN_UNITS);

  fs.copyFileSync(IN_MAP, OUT_MAP);
  fs.copyFileSync(IN_UNITS, OUT_UNITS);

  console.log('Wrote', OUT_MAP);
  console.log('Wrote', OUT_UNITS);
}

main();

