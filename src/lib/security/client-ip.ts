import { isIP } from 'node:net';
import { expandIPv6 } from './ip';

/**
 * Identifica o cliente para o rate limit.
 *
 * Na Vercel, a borda sobrescreve `x-real-ip` e `x-forwarded-for` com o IP que
 * ela viu de fato — um valor enviado pelo cliente não chega à função. Fora da
 * Vercel esses cabeçalhos são falsificáveis, então só são lidos com
 * TRUST_PROXY_HEADERS=true (quando há um proxy confiável na frente).
 * Sem proxy confiável, todos os clientes caem no mesmo balde ("local").
 *
 * IPv6 é agrupado por /64: um único cliente costuma controlar o /64 inteiro e
 * poderia trocar de endereço a cada requisição.
 */
export function getClientId(headers: Headers, { trustProxyHeaders = false } = {}): string {
  const onVercel = Boolean(process.env.VERCEL);
  if (!onVercel && !trustProxyHeaders) return 'local';

  const raw = headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0] || '';
  const ip = raw.trim();
  const family = isIP(ip);
  if (family === 4) return ip;
  if (family === 6) {
    const groups = expandIPv6(ip);
    if (groups) return `${groups.slice(0, 4).map((g) => g.toString(16)).join(':')}::/64`;
  }
  return 'unknown';
}
