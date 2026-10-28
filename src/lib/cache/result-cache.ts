import { createHash } from 'node:crypto';
import type { Redis } from '@upstash/redis';
import type { StackResult } from '@/types/stack';

export interface ResultCache {
  get(key: string): Promise<StackResult | null>;
  set(key: string, value: StackResult): Promise<void>;
}

/**
 * Cache simples em memória com TTL (o mesmo da versão Express). Só vale
 * dentro de uma instância: na Vercel cada instância tem o seu e ele some no
 * cold start. Por isso em produção o padrão é o RedisResultCache.
 */
export class MemoryResultCache implements ResultCache {
  private store = new Map<string, { value: StackResult; expiresAt: number }>();

  constructor(
    private ttlMs: number,
    private maxEntries = 500,
  ) {}

  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: StackResult) {
    // Limite de memória: descarta a entrada mais antiga (ordem de inserção do Map).
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

export class RedisResultCache implements ResultCache {
  constructor(
    private redis: Redis,
    private ttlMs: number,
  ) {}

  private redisKey(key: string) {
    return `stackfly:v1:result:${createHash('sha256').update(key).digest('hex')}`;
  }

  async get(key: string) {
    return (await this.redis.get<StackResult>(this.redisKey(key))) ?? null;
  }

  async set(key: string, value: StackResult) {
    await this.redis.set(this.redisKey(key), value, { px: this.ttlMs });
  }
}
