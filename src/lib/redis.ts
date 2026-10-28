import 'server-only';

import { Redis } from '@upstash/redis';

let client: Redis | null | undefined;

/**
 * Cliente Redis (Upstash, via REST — funciona em serverless sem conexão
 * persistente). Aceita tanto os nomes da integração do Marketplace da Vercel
 * (KV_REST_API_*) quanto os do Upstash direto (UPSTASH_REDIS_REST_*).
 * Sem variáveis configuradas → null, e o app usa armazenamento em memória.
 */
export function getRedis(): Redis | null {
  if (client === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    client = url && token ? new Redis({ url, token }) : null;
    if (!client && process.env.VERCEL_ENV === 'production') {
      console.warn(
        '[stackfly] Redis não configurado: cache e rate limit ficam em memória, por instância. ' +
          'Configure UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN para limites compartilhados.',
      );
    }
  }
  return client;
}
