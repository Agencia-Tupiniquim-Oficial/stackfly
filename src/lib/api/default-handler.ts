import 'server-only';

import { config } from '@/lib/config';
import { getAnalyzer, getApiKeyRateLimiter, getRateLimiter } from '@/lib/services';
import { createStackHandler } from './stack-handler';

export const handleStackRequest = createStackHandler({
  analyzer: getAnalyzer,
  rateLimiter: getRateLimiter,
  apiKeyRateLimiter: config.apiKeyRateLimitMax > 0 ? getApiKeyRateLimiter : undefined,
  validApiKeys: config.apiKeys.length > 0
    ? Object.fromEntries(config.apiKeys.map((k) => [k, true] as const))
    : undefined,
  trustProxyHeaders: config.trustProxyHeaders,
});
