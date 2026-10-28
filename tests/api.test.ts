import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnalyzer, type AnalyzerDeps } from '@/lib/analyzer/analyze';
import { createStackHandler } from '@/lib/api/stack-handler';
import { MemoryResultCache, type ResultCache } from '@/lib/cache/result-cache';
import { StackflyError } from '@/lib/errors';
import type { PageData } from '@/lib/fingerprints/types';
import { getClientId } from '@/lib/security/client-ip';
import { defaultAddressPolicy } from '@/lib/security/ip';
import { MemoryRateLimiter } from '@/lib/security/rate-limit';
import type { Resolver } from '@/lib/security/resolve';
import { categories, loadPageFixture, technologies } from './helpers/dataset';

const publicResolver: Resolver = async (host) =>
  host.endsWith('.privado.test') ? [{ address: '10.0.0.7', family: 4 }] : [{ address: '93.184.215.14', family: 4 }];

function makeAnalyzer(overrides: Partial<AnalyzerDeps> = {}) {
  const collect = vi.fn<AnalyzerDeps['collect']>(async (url) => ({ ...loadPageFixture('wordpress'), finalUrl: url }));
  const analyzer = createAnalyzer({
    cache: new MemoryResultCache(60_000),
    dataset: () => ({ technologies, categories }),
    collect,
    policy: defaultAddressPolicy,
    resolver: publicResolver,
    maxConcurrent: 2,
    totalTimeoutMs: 10_000,
    ...overrides,
  });
  return { analyzer, collect: (overrides.collect as typeof collect) ?? collect };
}

function makeHandler(opts: { analyzerOverrides?: Partial<AnalyzerDeps>; max?: number } = {}) {
  const { analyzer, collect } = makeAnalyzer(opts.analyzerOverrides);
  const limiter = new MemoryRateLimiter(60_000, opts.max ?? 100);
  const handle = createStackHandler({ analyzer: () => analyzer, rateLimiter: () => limiter });
  const get = (url?: string) => {
    const qs = url === undefined ? '' : `?url=${encodeURIComponent(url)}`;
    return handle(new Request(`http://localhost/api/v1/stack${qs}`), url ?? null);
  };
  return { get, collect };
}

describe('GET /api/v1/stack', () => {
  it('200 com o contrato JSON da API', async () => {
    const { get } = makeHandler();
    const res = await get('exemplo.com.br');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('ratelimit-limit')).toBe('100');

    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      ['analyzedAt', 'cached', 'count', 'finalUrl', 'grouped', 'technologies', 'url'].sort(),
    );
    expect(body.url).toBe('https://exemplo.com.br');
    expect(body.finalUrl).toBe('https://exemplo.com.br/');
    expect(body.cached).toBe(false);
    expect(body.technologies.map((t: { name: string }) => t.name)).toContain('WordPress');
    expect(body.grouped.CMS[0]).toMatchObject({ name: 'WordPress', categories: ['CMS', 'Blogs'] });
  });

  it.each([
    [undefined, 400, 'MISSING_URL'],
    ['https://exa mple.com', 400, 'INVALID_URL'],
    ['ftp://exemplo.com', 400, 'UNSUPPORTED_PROTOCOL'],
    ['http://169.254.169.254/latest/meta-data/', 403, 'BLOCKED_TARGET'],
    ['http://localhost:3000', 403, 'BLOCKED_TARGET'],
    ['https://interno.privado.test', 403, 'BLOCKED_TARGET'], // só descobre após DNS
  ])('%s → %i %s', async (url, status, code) => {
    const { get, collect } = makeHandler();
    const res = await get(url);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: expect.any(String), code });
    expect(collect).not.toHaveBeenCalled();
  });

  it.each([
    [new StackflyError('TIMEOUT', 'O site demorou demais para responder.'), 504, 'TIMEOUT'],
    [new StackflyError('NAVIGATION_FAILED', 'Não foi possível carregar o site informado.'), 502, 'NAVIGATION_FAILED'],
    [new StackflyError('BROWSER_UNAVAILABLE', 'Navegador indisponível.'), 503, 'BROWSER_UNAVAILABLE'],
    [new Error('net::ERR_SOMETHING at /var/task/node_modules/secret.js'), 500, 'INTERNAL_ERROR'],
  ])('falha na análise (%s) → %i sem resultado falso', async (error, status, code) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const collect = vi.fn(async () => {
      throw error;
    });
    const { get } = makeHandler({ analyzerOverrides: { collect } });
    const res = await get('exemplo.com');
    const body = await res.json();
    expect(res.status).toBe(status);
    expect(body.code).toBe(code);
    expect(body).not.toHaveProperty('technologies');
    // Nada de stack trace / caminho interno na resposta.
    expect(JSON.stringify(body)).not.toMatch(/node_modules|\/var\/task|at /);
  });

  it('erro ao processar fingerprints → 500 INTERNAL_ERROR', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { get } = makeHandler({
      analyzerOverrides: {
        dataset: () => {
          throw new Error('technologies.json corrompido');
        },
      },
    });
    const res = await get('exemplo.com');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Falha ao processar as fingerprints.', code: 'INTERNAL_ERROR' });
  });

  it('429 depois do limite, com Retry-After e RateLimit-*', async () => {
    const { get } = makeHandler({ max: 2 });
    expect((await get('exemplo.com')).status).toBe(200);
    expect((await get('exemplo.com')).status).toBe(200);
    const res = await get('exemplo.com');
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: 'RATE_LIMITED' });
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(res.headers.get('ratelimit-remaining')).toBe('0');
  });

  it('requisições inválidas também contam no rate limit', async () => {
    const { get } = makeHandler({ max: 1 });
    expect((await get()).status).toBe(400);
    expect((await get('exemplo.com')).status).toBe(429);
  });
});

describe('cache', () => {
  it('segunda chamada vem do cache (cached: true) e não abre o navegador de novo', async () => {
    const { get, collect } = makeHandler();
    const first = await (await get('exemplo.com')).json();
    const second = await (await get('https://EXEMPLO.com/')).json();
    expect(collect).toHaveBeenCalledTimes(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.analyzedAt).toBe(first.analyzedAt);
    // `url` reflete a entrada desta requisição, não a da que populou o cache.
    expect(second.url).toBe('https://EXEMPLO.com/');
  });

  it('falhas não são cacheadas', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let calls = 0;
    const collect = vi.fn(async (url: string): Promise<PageData> => {
      if (++calls === 1) throw new StackflyError('TIMEOUT', 'O site demorou demais para responder.');
      return { ...loadPageFixture('wordpress'), finalUrl: url };
    });
    const { get } = makeHandler({ analyzerOverrides: { collect } });
    expect((await get('exemplo.com')).status).toBe(504);
    expect((await get('exemplo.com')).status).toBe(200);
    expect(collect).toHaveBeenCalledTimes(2);
  });

  it('expira depois do TTL', async () => {
    vi.useFakeTimers();
    try {
      const cache = new MemoryResultCache(1_000);
      await cache.set('k', { count: 0 } as never);
      expect(await cache.get('k')).not.toBeNull();
      vi.advanceTimersByTime(1_001);
      expect(await cache.get('k')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cache fora do ar não derruba a análise', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken: ResultCache = {
      get: async () => {
        throw new Error('redis down');
      },
      set: async () => {
        throw new Error('redis down');
      },
    };
    const { get } = makeHandler({ analyzerOverrides: { cache: broken } });
    expect((await get('exemplo.com')).status).toBe(200);
  });
});

describe('concorrência', () => {
  it('requisições simultâneas para a mesma URL fazem uma só análise', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const collect = vi.fn(async (url: string) => {
      await gate;
      return { ...loadPageFixture('wordpress'), finalUrl: url };
    });
    const { get } = makeHandler({ analyzerOverrides: { collect } });
    const pending = [get('exemplo.com'), get('https://exemplo.com/'), get('exemplo.com')];
    await new Promise((r) => setTimeout(r, 20));
    release();
    const statuses = (await Promise.all(pending)).map((r) => r.status);
    expect(statuses).toEqual([200, 200, 200]);
    expect(collect).toHaveBeenCalledTimes(1);
  });

  it('fila cheia por tempo demais → 503 SERVER_BUSY', async () => {
    const collect = vi.fn(() => new Promise<PageData>(() => undefined)); // nunca termina
    const { get } = makeHandler({ analyzerOverrides: { collect, maxConcurrent: 1, totalTimeoutMs: 200 } });
    void get('a.com');
    const res = await get('b.com');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: 'SERVER_BUSY' });
  });
});

describe('identificação do cliente (rate limit por IP)', () => {
  const original = process.env.VERCEL;
  beforeEach(() => {
    delete process.env.VERCEL;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = original;
  });

  it('fora da Vercel ignora cabeçalhos de proxy (falsificáveis)', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8' });
    expect(getClientId(h)).toBe('local');
  });

  it('na Vercel usa x-real-ip (definido pela borda)', () => {
    process.env.VERCEL = '1';
    expect(getClientId(new Headers({ 'x-real-ip': '5.6.7.8', 'x-forwarded-for': '9.9.9.9' }))).toBe('5.6.7.8');
    expect(getClientId(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
    expect(getClientId(new Headers())).toBe('unknown');
  });

  it('agrupa IPv6 por /64', () => {
    process.env.VERCEL = '1';
    const a = getClientId(new Headers({ 'x-real-ip': '2804:14c:1:2:aaaa::1' }));
    const b = getClientId(new Headers({ 'x-real-ip': '2804:14c:1:2:bbbb::2' }));
    expect(a).toBe(b);
  });

  it('com TRUST_PROXY_HEADERS lê x-forwarded-for', () => {
    expect(getClientId(new Headers({ 'x-forwarded-for': '1.2.3.4' }), { trustProxyHeaders: true })).toBe('1.2.3.4');
  });
});
