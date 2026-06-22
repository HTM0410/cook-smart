require('dotenv').config({ path: '../src/backend/.env' });
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function invalidateCommentCache() {
  try {
    console.log('🔗 Connecting to Redis...');
    
    // Invalidate all comment caches
    const keys = await redis.keys('comments:*');
    
    if (keys.length > 0) {
      console.log(`🗑️  Found ${keys.length} comment cache keys to delete`);
      await redis.del(...keys);
      console.log('✅ Đã xóa tất cả comment cache!');
    } else {
      console.log('ℹ️  Không có comment cache nào để xóa');
    }
    
    await redis.quit();
    console.log('✅ Hoàn thành!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await redis.quit();
    process.exit(1);
  }
}

invalidateCommentCache();
