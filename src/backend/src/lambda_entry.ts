/**
 * Lambda entry point: chay Express tren port 3000 (web-adapter se forward request).
 *
 * - KHONG import server.ts (vi no tu server.listen() o top level → conflict Lambda)
 * - Import truc tiep app tu app.ts (da export app)
 * - Listen tren PORT ma aws-lambda-web-adapter mong doi (mac dinh 3000)
 * - Khi web-adapter goi Lambda runtime, no forward HTTP request den port nay
 */

import app from './app';
import { createServer } from 'http';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const server = createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`[lambda_entry] Express listening on ${HOST}:${PORT}`);
}).on('error', (err: Error & { code?: string }) => {
  console.error(`[lambda_entry] Server error: ${err.code} ${err.message}`);
  if (err.code === 'EADDRINUSE') {
    console.error(`[lambda_entry] Port ${PORT} in use, exiting`);
    process.exit(1);
  }
});

// Lambda handler stub (web-adapter se forward HTTP request den port ${PORT})
export const handler = async (event: any, context: any) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'cooksmart-backend-api',
      status: 'ok',
      note: 'Use web-adapter port ' + PORT,
    }),
  };
};
