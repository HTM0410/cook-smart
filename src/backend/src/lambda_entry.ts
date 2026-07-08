// Lambda runtime wrapper cho backend.
// Web-adapter se forward HTTP request den Express dang chay o port 3000.
// Can dam bao Express listen tren 3000 song song voi Lambda handler.

import './server';  // Start Express o port 3000
import { handler } from './lambda_handler';

export { handler };
