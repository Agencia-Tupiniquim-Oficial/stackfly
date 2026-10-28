import type { ResultCache } from '@/lib/cache/result-cache';
import { StackflyError, isStackflyError } from '@/lib/errors';
import { buildStackResult } from '@/lib/fingerprints/result';
import { detectTechnologies } from '@/lib/fingerprints/matcher';
import type { CategoryDataset, PageData, TechnologyDataset } from '@/lib/fingerprints/types';
import type { AddressPolicy } from '@/lib/security/ip';
import { resolveAllowedAddresses, type Resolver } from '@/lib/security/resolve';
import type { TargetUrl } from '@/lib/security/url';
import type { StackResult } from '@/types/stack';
import { Semaphore } from './semaphore';

export interface AnalyzerDeps {
  cache: ResultCache;
  dataset: () => { technologies: TechnologyDataset; categories: CategoryDataset };
  /** Abre a página e coleta os dados (Puppeteer em produção, fake nos testes). */
  collect: (url: string, budget: { deadlineMs: number }) => Promise<PageData>;
  policy: AddressPolicy;
  resolver?: Resolver;
  maxConcurrent: number;
  totalTimeoutMs: number;
}

export type Analyzer = (target: TargetUrl) => Promise<StackResult>;

/**
 * Fluxo de uma análise:
 *   1. valida o destino resolvendo o DNS (erro rápido e claro para IP privado);
 *   2. cache por URL canônica;
 *   3. junta requisições simultâneas para a mesma URL nesta instância;
 *   4. fila de concorrência → navegador → matcher;
 *   5. grava no cache só resultados de sucesso.
 */
export function createAnalyzer(deps: AnalyzerDeps): Analyzer {
  const semaphore = new Semaphore(deps.maxConcurrent);
  const inFlight = new Map<string, Promise<StackResult>>();

  async function readCache(key: string): Promise<StackResult | null> {
    try {
      return await deps.cache.get(key);
    } catch (err) {
      console.error('[stackfly] leitura do cache falhou; seguindo sem cache:', err);
      return null;
    }
  }

  async function writeCache(key: string, value: StackResult) {
    try {
      await deps.cache.set(key, value);
    } catch (err) {
      console.error('[stackfly] escrita no cache falhou:', err);
    }
  }

  async function run(target: TargetUrl): Promise<StackResult> {
    const startedAt = Date.now();
    const release = await semaphore.acquire(Math.floor(deps.totalTimeoutMs / 2));
    try {
      const remaining = deps.totalTimeoutMs - (Date.now() - startedAt);
      const pageData = await deps.collect(target.url.href, { deadlineMs: remaining });

      let result: StackResult;
      try {
        const { technologies, categories } = deps.dataset();
        const detections = detectTechnologies(technologies, pageData);
        result = buildStackResult({ url: target.display, finalUrl: pageData.finalUrl }, detections, categories);
      } catch (err) {
        throw new StackflyError('INTERNAL_ERROR', 'Falha ao processar as fingerprints.', { cause: err });
      }

      await writeCache(target.cacheKey, result);
      return result;
    } finally {
      release();
    }
  }

  return async function analyze(target) {
    await resolveAllowedAddresses(target.url.hostname, target.port, deps.policy, deps.resolver);

    const cached = await readCache(target.cacheKey);
    if (cached) return { ...cached, url: target.display, cached: true };

    let pending = inFlight.get(target.cacheKey);
    if (!pending) {
      pending = run(target).finally(() => inFlight.delete(target.cacheKey));
      inFlight.set(target.cacheKey, pending);
    }

    try {
      const result = await pending;
      return { ...result, url: target.display };
    } catch (err) {
      if (isStackflyError(err)) throw err;
      throw new StackflyError('INTERNAL_ERROR', 'Erro interno ao analisar o site.', { cause: err });
    }
  };
}
