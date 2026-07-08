/**
 * Lambda handler cho backend API (Express).
 *
 * aws-lambda-web-adapter doc HTTP request tu port 3000 (do express listen)
 * va tu forward den Lambda runtime. Handler nay chi la stub de Lambda runtime
 * resolve CMD, tra ve 200 OK.
 *
 * Neu muon khong dung web-adapter, wrap bang serverless-http:
 *     import serverless from 'serverless-http';
 *     import app from './app';
 *     export const handler = serverless(app);
 */
import type { Context } from './types/aws-lambda';

export const handler = async (event: any, context: Context) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'cooksmart-backend-api',
      status: 'ok',
      message: 'Use web-adapter port 3000 for actual requests',
    }),
  };
};
