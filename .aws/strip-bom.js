const fs = require('fs');
let raw = fs.readFileSync('D:/2025.2/DA/food_suggest/.aws/td-yolo-15.json', 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
JSON.parse(raw);
fs.writeFileSync('D:/2025.2/DA/food_suggest/.aws/td-yolo-15-clean.json', raw);
console.log('cleaned');