import type { Redis } from '@upstash/redis';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** ms até a janela atual acabar. */
  resetMs: number;
}

export interface RateLimiter {
  check(id: string): Promise<RateLimitResult>;
}

// Janela fixa, como o MemoryStore do express-rate-limit usado antes:
// N requisições por IP a cada `windowMs`.
function windowOf(windowMs: number, now = Date.now()) {
  const index = Math.floor(now / windowMs);
  return { index, resetMs: (index + 1) * windowMs - now };
}

function toResult(count: number, max: number, resetMs: number): RateLimitResult {
  return { allowed: count <= max, limit: max, remaining: Math.max(0, max - count), resetMs };
}

/** Só por instância — usado em dev ou quando o Redis não está configurado. */
export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { index: number; count: number }>();

  constructor(
    private windowMs: number,
    private max: number,
  ) {}

  async check(id: string) {
    const { index, resetMs } = windowOf(this.windowMs);
    const entry = this.hits.get(id);
    const count = entry && entry.index === index ? entry.count + 1 : 1;
    this.hits.set(id, { index, count });
    if (this.hits.size > 10_000) this.prune(index);
    return toResult(count, this.max, resetMs);
  }

  private prune(currentIndex: number) {
    for (const [key, entry] of this.hits) {
      if (entry.index !== currentIndex) this.hits.delete(key);
    }
  }
}

/**
 * Compartilhado entre todas as instâncias da Vercel. Uma chave por IP e por
 * janela; INCR + PEXPIRE na mesma transação para a chave nunca ficar sem TTL.
 */
export class RedisRateLimiter implements RateLimiter {
  private fallback: MemoryRateLimiter;

  constructor(
    private redis: Redis,
    private windowMs: number,
    private max: number,
  ) {
    this.fallback = new MemoryRateLimiter(windowMs, max);
  }

  async check(id: string) {
    const { index, resetMs } = windowOf(this.windowMs);
    const key = `stackfly:v1:rl:${index}:${id}`;
    try {
      const [count] = await this.redis.multi().incr(key).pexpire(key, this.windowMs * 2).exec<[number, number]>();
      return toResult(count, this.max, resetMs);
    } catch (err) {
      // Redis fora do ar não pode desligar o limite: cai para o limite local.
      console.error('[stackfly] rate limit no Redis falhou; usando limite em memória:', err);
      return this.fallback.check(id);
    }
  }
}
