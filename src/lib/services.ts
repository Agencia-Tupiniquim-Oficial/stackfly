import 'server-only';

import { createAnalyzer, type Analyzer } from '@/lib/analyzer/analyze';
import { getBrowser } from '@/lib/analyzer/browser';
import { collectPageData } from '@/lib/analyzer/collect';
import { MemoryResultCache, RedisResultCache } from '@/lib/cache/result-cache';
import { config } from '@/lib/config';
import { loadDataset } from '@/lib/fingerprints/dataset';
import { collectJsPaths } from '@/lib/fingerprints/matcher';
import { getRedis } from '@/lib/redis';
import { defaultAddressPolicy } from '@/lib/security/ip';
import { MemoryRateLimiter, RedisRateLimiter, type RateLimiter } from '@/lib/security/rate-limit';

// Instâncias de produção, criadas uma vez por instância da função.

let analyzer: Analyzer | null = null;
let rateLimiter: RateLimiter | null = null;
let jsPaths: string[] | null = null;

export function getAnalyzer(): Analyzer {
  if (!analyzer) {
    const redis = getRedis();
    analyzer = createAnalyzer({
      cache: redis ? new RedisResultCache(redis, config.cacheTtlMs) : new MemoryResultCache(config.cacheTtlMs),
      dataset: loadDataset,
      policy: defaultAddressPolicy,
      // Um navegador por instância, uma análise por vez nele (o Chromium da
      // Vercel roda em processo único). As demais esperam na fila.
      maxConcurrent: 1,
      totalTimeoutMs: config.totalTimeoutMs,
      collect: async (url, { deadlineMs }) => {
        jsPaths ??= collectJsPaths(loadDataset().technologies);
        const handle = await getBrowser();
        return collectPageData(url, {
          handle,
          policy: defaultAddressPolicy,
          jsPaths,
          navigationTimeoutMs: config.navigationTimeoutMs,
          settleTimeoutMs: config.settleTimeoutMs,
          deadlineMs,
          maxDownloadBytes: config.maxDownloadBytes,
        });
      },
    });
  }
  return analyzer;
}

export function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    const redis = getRedis();
    rateLimiter = redis
      ? new RedisRateLimiter(redis, config.rateLimitWindowMs, config.rateLimitMax)
      : new MemoryRateLimiter(config.rateLimitWindowMs, config.rateLimitMax);
  }
  return rateLimiter;
}
