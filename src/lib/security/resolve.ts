import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { StackflyError } from '@/lib/errors';
import type { AddressPolicy } from './ip';

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

// getaddrinfo do sistema — o mesmo caminho que o Chromium usaria.
export const systemResolver: Resolver = (hostname) => lookup(hostname, { all: true, verbatim: true });

const DNS_TIMEOUT_MS = 5_000;

export class BlockedDestinationError extends StackflyError {
  constructor(readonly host: string) {
    super('BLOCKED_TARGET', 'O endereço informado aponta para um destino não permitido.');
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`DNS lookup timeout after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Resolve o host e exige que TODOS os endereços sejam permitidos pela política.
 * Rejeitar respostas "mistas" (um IP público + um privado) evita que o
 * destino real dependa de qual registro for escolhido na conexão.
 *
 * Retorna os endereços validados — quem conecta deve usar exatamente eles
 * (e não resolver o nome de novo), senão abre espaço para DNS rebinding.
 */
export async function resolveAllowedAddresses(
  hostname: string,
  port: number,
  policy: AddressPolicy,
  resolver: Resolver = systemResolver,
): Promise<ResolvedAddress[]> {
  const host = hostname.replace(/^\[|\]$/g, '');

  let addresses: ResolvedAddress[];
  if (isIP(host)) {
    addresses = [{ address: host, family: isIP(host) }];
  } else {
    try {
      addresses = await withTimeout(resolver(host), DNS_TIMEOUT_MS);
    } catch (err) {
      throw new StackflyError('DNS_RESOLUTION_FAILED', 'Não foi possível resolver o domínio informado.', { cause: err });
    }
  }

  if (addresses.length === 0) {
    throw new StackflyError('DNS_RESOLUTION_FAILED', 'Não foi possível resolver o domínio informado.');
  }
  if (!addresses.every(({ address }) => policy(address, port))) {
    throw new BlockedDestinationError(host);
  }
  return addresses;
}
