const fs = require('fs');
let raw = fs.readFileSync('D:/2025.2/DA/food_suggest/.aws/manifest2.json', 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
const manifest = JSON.parse(raw);
const out = {
  repositoryName: 'cooksmart-yolo',
  imageTag: 'latest',
  imageManifest: JSON.stringify(manifest)
};
fs.writeFileSync('D:/2025.2/DA/food_suggest/.aws/ecr-put-latest.json', JSON.stringify(out));
console.log('ok');
