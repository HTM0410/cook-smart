// Railway entry point - redirect to compiled server
// Force rebuild v2: Using Supabase PostgreSQL
console.log('📦 index.js: Starting...');
console.log('📁 Current directory:', process.cwd());
console.log('📁 __dirname:', __dirname);

// Check if dist/server.js exists
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'dist', 'server.js');

console.log('🔍 Checking for dist/server.js at:', serverPath);
if (fs.existsSync(serverPath)) {
  console.log('✅ dist/server.js exists');
  console.log('🚀 Loading dist/server.js...');
  
  try {
    require(serverPath);
    console.log('✅ dist/server.js loaded successfully');
  } catch (error) {
    console.error('❌ ERROR loading dist/server.js:');
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    if (error.code) {
      console.error('❌ Error code:', error.code);
    }
    console.error('💡 This usually means:');
    console.error('   1. Missing module (check package.json)');
    console.error('   2. Import/require error');
    console.error('   3. Syntax error in compiled code');
    process.exit(1);
  }
} else {
  console.error('❌ dist/server.js NOT FOUND!');
  console.error('💡 This usually means:');
  console.error('   1. Build failed (check Build Logs)');
  console.error('   2. postinstall script did not run');
  console.error('   3. TypeScript compilation failed');
  console.error('💡 Try running: npm run build');
  process.exit(1);
}

