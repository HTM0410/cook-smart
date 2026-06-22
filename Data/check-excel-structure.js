#!/usr/bin/env node
/**
 * Kiem tra cau truc file Excel export
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Tim file trong output folder
const outputDir = path.join(__dirname, 'output');
const files = fs.readdirSync(outputDir).filter(f => f.includes('database-export') && f.endsWith('.xlsx'));

console.log('='.repeat(60));
console.log('KIEM TRA CAU TRUC FILE EXCEL EXPORT');
console.log('='.repeat(60));
console.log('');

files.forEach(file => {
  const filePath = path.join(outputDir, file);
  console.log('FILE:', file);
  console.log('-'.repeat(60));
  
  try {
    const workbook = XLSX.readFile(filePath);
    
    workbook.SheetNames.forEach((sheetName, i) => {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      const headers = data.length > 0 ? Object.keys(data[0]) : [];
      
      console.log('');
      console.log(`${i + 1}. Sheet: ${sheetName}`);
      console.log(`   So dong: ${data.length}`);
      console.log(`   Cac cot: ${headers.join(', ')}`);
      
      // Show sample data
      if (data.length > 0) {
        console.log('   Du lieu mau (dong 1):');
        const sample = data[0];
        Object.entries(sample).slice(0, 5).forEach(([key, value]) => {
          const val = String(value).substring(0, 50);
          console.log(`      - ${key}: ${val}${String(value).length > 50 ? '...' : ''}`);
        });
      }
    });
    
    console.log('');
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error('Loi doc file:', err.message);
  }
});
