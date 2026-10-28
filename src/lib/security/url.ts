import { isIP } from 'node:net';
import { StackflyError } from '@/lib/errors';
import { ALLOWED_PORTS, isPublicAddress } from './ip';

const MAX_URL_LENGTH = 2048;

// Nomes que nunca resolvem para algo público. É só uma camada extra com
// mensagem de erro melhor — a proteção de verdade é a checagem de IP depois
// da resolução DNS (resolve.ts) e no proxy de saída (egress-proxy.ts).
const BLOCKED_HOST_SUFFIXES = ['localhost', 'local', 'internal', 'intranet', 'lan', 'home.arpa'];

const EXPLICIT_SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i;
// Esquemas que não usam "//" mas não podem virar "https://javascript:..."
const BARE_SCHEME = /^(javascript|data|file|about|blob|chrome|view-source|mailto|ftp|ws|wss):/i;

export interface TargetUrl {
  /** URL parseada, sem fragmento. */
  url: URL;
  /** Chave canônica de cache: URLs equivalentes geram a mesma chave. */
  cacheKey: string;
  /** URL como a API sempre devolveu em `url` (entrada + https:// se faltava). */
  display: string;
  port: number;
}

/** Normalização histórica da API — preservada no campo `url` da resposta. */
export function legacyNormalize(input: string): string {
  const url = input.trim();
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function invalid(message = 'Informe uma URL válida.') {
  return new StackflyError('INVALID_URL', message);
}

function blocked() {
  return new StackflyError('BLOCKED_TARGET', 'O endereço informado aponta para um destino não permitido.');
}

/**
 * Valida a sintaxe da URL e bloqueia destinos óbvios (IP literal privado,
 * localhost, portas fora da lista). Não faz DNS — isso fica para
 * resolveAllowedAddresses(), chamada logo em seguida.
 */
export function parseTargetUrl(raw: unknown): TargetUrl {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new StackflyError('MISSING_URL', 'Informe ?url= com o site a analisar.');
  }
  const input = raw.trim();
  if (input.length > MAX_URL_LENGTH) throw invalid('URL muito longa.');

  const scheme = input.match(EXPLICIT_SCHEME)?.[1] ?? input.match(BARE_SCHEME)?.[1];
  if (scheme && !/^https?$/i.test(scheme)) {
    throw new StackflyError('UNSUPPORTED_PROTOCOL', 'Apenas URLs http:// e https:// são aceitas.');
  }

  const display = legacyNormalize(input);
  let url: URL;
  try {
    url = new URL(display);
  } catch {
    throw invalid();
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new StackflyError('UNSUPPORTED_PROTOCOL', 'Apenas URLs http:// e https:// são aceitas.');
  }
  if (url.username || url.password) throw invalid('URLs com usuário/senha não são aceitas.');

  // O parser WHATWG já normaliza representações alternativas de IPv4
  // (2130706433, 0x7f.1, 127.1 → 127.0.0.1) e lowercase no host.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host) throw invalid();

  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) throw blocked();

  if (isIP(host)) {
    if (!isPublicAddress(host)) throw blocked();
  } else {
    const bare = host.replace(/\.$/, '');
    if (!bare.includes('.')) throw blocked(); // nomes de rede interna ("intranet", "db")
    if (BLOCKED_HOST_SUFFIXES.some((s) => bare === s || bare.endsWith(`.${s}`))) throw blocked();
  }

  url.hash = '';
  return { url, cacheKey: url.href, display, port };
}
