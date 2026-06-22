// Netlify Function adapter for Express app
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import serverless from 'serverless-http';
import path from 'path';
import { createRequire } from 'module';

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Import Express app from backend (compiled to CommonJS)
// Note: This requires backend to be built first (npm run build in src/backend)
const backendAppPath = path.join(process.cwd(), 'src/backend/dist/app.js');
const backendApp = require(backendAppPath);
const app = backendApp.default || backendApp;
const initializeDatabase = backendApp.initializeDatabase || (async () => {
  console.log('⚠️ Database initialization function not found');
  return Promise.resolve();
});

// Wrap Express app with serverless-http
const serverlessHandler = serverless(app, {
  binary: ['image/*', 'application/octet-stream']
});

// Database initialization flag
let dbInitialized = false;

// Netlify Function handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Initialize database on first request (lazy initialization)
  if (!dbInitialized) {
    try {
      await initializeDatabase();
      dbInitialized = true;
      console.log('✅ Database initialized for Netlify Function');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      // Don't throw - allow function to continue (database might be initialized later)
    }
  }

  // Extend Lambda timeout for database operations
  context.callbackWaitsForEmptyEventLoop = false;

  // Call serverless-http handler
  try {
    const result = await serverlessHandler(event, context);
    return result;
  } catch (error) {
    console.error('❌ Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      }
    };
  }
};
