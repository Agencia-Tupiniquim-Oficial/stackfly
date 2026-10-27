import 'server-only';

import { config } from '@/lib/config';
import { getAnalyzer, getRateLimiter } from '@/lib/services';
import { createStackHandler } from './stack-handler';

export const handleStackRequest = createStackHandler({
  analyzer: getAnalyzer,
  rateLimiter: getRateLimiter,
  trustProxyHeaders: config.trustProxyHeaders,
});
