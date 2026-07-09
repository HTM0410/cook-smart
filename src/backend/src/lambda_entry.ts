/**
 * Lambda entry point for Lambda URL (no web adapter needed).
 *
 * Lambda URL sends events in API Gateway HTTP API v2 format.
 * The exported handler receives these events and returns HTTP responses.
 */

interface LambdaEvent {
  requestContext?: {
    http?: {
      path?: string;
      method?: string;
      sourceIp?: string;
    };
    accountId?: string;
    apiId?: string;
  };
  path?: string;
  httpMethod?: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
  queryStringParameters?: Record<string, string | null>;
  pathParameters?: Record<string, string>;
}

interface LambdaResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

export const handler = async (
  event: LambdaEvent,
  context: any
): Promise<LambdaResult> => {
  const path = event.requestContext?.http?.path || event.path || '/';
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const ip = event.requestContext?.http?.sourceIp || '0.0.0.0';
  const origin = event.headers?.origin || event.headers?.Origin || '*';

  console.log(`[lambda_entry] ${method} ${path} from ${ip}`);

  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Root endpoint - return service info
  if (path === '/' || path === '') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
      body: JSON.stringify({
        service: 'cooksmart-backend-api',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'production',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        note: 'Lambda URL active. Full API requires Express integration.',
      }),
    };
  }

  // Health check
  if (path === '/health') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // API docs redirect
  if (path === '/api-docs') {
    return {
      statusCode: 302,
      headers: {
        Location: 'https://cooksmart-api.onrender.com/api-docs',
        ...corsHeaders,
      },
      body: '',
    };
  }

  // Metrics endpoint
  if (path === '/metrics') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain',
        ...corsHeaders,
      },
      body: `# HELP cooksmart_up Backend is running\ncooksmart_up 1`,
    };
  }

  // Fallback - basic response
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
    body: JSON.stringify({
      message: 'cooksmart-backend-api is running on Lambda',
      path,
      method,
      timestamp: new Date().toISOString(),
    }),
  };
};
