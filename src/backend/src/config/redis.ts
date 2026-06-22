import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let redisClient: Redis | null = null;

if (REDIS_ENABLED) {
  try {
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      commandTimeout: 3000,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.log('⚠️ Redis connection failed, using in-memory cache');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redisClient.on('error', (err: Error) => {
      if (err.message.includes('ECONNREFUSED')) {
        // Suppress ECONNREFUSED errors to avoid spam
        return;
      }
      console.error('❌ Redis error:', err.message);
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    // Try to connect
    redisClient.connect().catch((err: Error) => {
      console.error('⚠️ Redis initial connection failed:', err.message);
      console.log('📝 Using in-memory cache fallback');
    });
  } catch (error) {
    console.error('⚠️ Redis initialization error:', (error as Error).message);
    console.log('📝 Using in-memory cache fallback');
    redisClient = null;
  }
} else {
  console.log('📝 Redis disabled, using in-memory cache');
  console.log('🔄 Proceeding to database connection...');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (redisClient) {
    await redisClient.quit();
  }
});

export { redisClient };
export default redisClient;