import 'server-only';

import type { Browser, HTTPRequest, Page } from 'puppeteer-core';
import { StackflyError, isStackflyError } from '@/lib/errors';
import type { PageData } from '@/lib/fingerprints/types';
import { startEgressProxy } from '@/lib/security/egress-proxy';
import type { AddressPolicy } from '@/lib/security/ip';
import type { Resolver } from '@/lib/security/resolve';
import { killBrowser } from './browser';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Limites do que é coletado da página (o matcher roda regex sobre isso).
const MAX_HTML_CHARS = 2_000_000;
const MAX_SCRIPTS = 500;
const MAX_META = 300;
const MAX_COOKIES = 300;
const MAX_JS_VALUE_CHARS = 200;

// Imagens, mídia e fontes não alimentam nenhum canal de detecção.
const SKIPPED_RESOURCE_TYPES = new Set(['image', 'media', 'font']);
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'data:', 'blob:']);

export interface CollectOptions {
  browser: Browser;
  policy: AddressPolicy;
  resolver?: Resolver;
  jsPaths: string[];
  navigationTimeoutMs: number;
  settleTimeoutMs: number;
  /** Prazo duro da coleta; ao estourar, o contexto (ou o navegador) é derrubado. */
  deadlineMs: number;
  maxDownloadBytes: number;
}

export type CollectPageData = (url: string, options: CollectOptions) => Promise<PageData>;

function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === 'TimeoutError';
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return null;
  }
}

async function disableWebRtc(page: Page) {
  // Reforço da flag --force-webrtc-ip-handling-policy: sem RTCPeerConnection
  // a página não consegue nem tentar ICE/STUN para endereços internos.
  await page.evaluateOnNewDocument(() => {
    for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel']) {
      try {
        Object.defineProperty(window, name, { value: undefined, configurable: false, writable: false });
      } catch {
        // propriedade já definida como não configurável
      }
    }
  });
}

async function collectFromPage(page: Page, url: string, options: CollectOptions): Promise<PageData> {
  page.setDefaultTimeout(options.navigationTimeoutMs);

  await page.setUserAgent({ userAgent: USER_AGENT });
  await disableWebRtc(page);
  await page.setRequestInterception(true);
  page.on('request', (req: HTTPRequest) => {
    if (req.isInterceptResolutionHandled()) return;
    let scheme: string;
    try {
      scheme = new URL(req.url()).protocol;
    } catch {
      void req.abort('blockedbyclient');
      return;
    }
    if (!ALLOWED_SCHEMES.has(scheme) || SKIPPED_RESOURCE_TYPES.has(req.resourceType())) {
      void req.abort('blockedbyclient');
      return;
    }
    void req.continue();
  });

  let mainResponseHeaders: Record<string, string> = {};
  page.on('response', (response) => {
    if (response.url() === url || response.request().resourceType() === 'document') {
      if (Object.keys(mainResponseHeaders).length === 0) {
        mainResponseHeaders = response.headers();
      }
    }
  });

  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.navigationTimeoutMs });
  if (response) {
    mainResponseHeaders = { ...response.headers(), ...mainResponseHeaders };
  }

  // A versão original esperava `networkidle2` dentro do goto e falhava se a
  // rede nunca acalmasse (sites com polling). Agora a navegação em si tem
  // timeout, e a espera pela rede é um "melhor esforço" com teto próprio.
  if (options.settleTimeoutMs > 0) {
    try {
      await page.waitForNetworkIdle({ idleTime: 500, concurrency: 2, timeout: options.settleTimeoutMs });
    } catch (err) {
      if (!isTimeoutError(err)) throw err;
    }
  }

  const finalUrl = page.url();
  if (!/^https?:/i.test(finalUrl)) {
    throw new StackflyError('NAVIGATION_FAILED', 'O site redirecionou para um endereço não suportado.');
  }

  const html = (await page.content()).slice(0, MAX_HTML_CHARS);

  const scriptSrcs = await page.evaluate(
    (max) => Array.from(document.querySelectorAll('script[src]'), (s) => (s as HTMLScriptElement).src).slice(0, max),
    MAX_SCRIPTS,
  );

  const metaTags = await page.evaluate((max) => {
    const result: Record<string, string> = {};
    Array.from(document.querySelectorAll('meta[name], meta[property]'))
      .slice(0, max)
      .forEach((m) => {
        const key = (m.getAttribute('name') || m.getAttribute('property') || '').toLowerCase();
        if (key) result[key] = (m.getAttribute('content') || '').slice(0, 1000);
      });
    return result;
  }, MAX_META);

  const cookies = await page.cookies();
  const cookieMap: Record<string, string> = {};
  cookies.slice(0, MAX_COOKIES).forEach((c) => {
    cookieMap[c.name.toLowerCase()] = c.value;
  });

  // Checa a presença de variáveis globais conhecidas (window.wp, window.React etc.)
  const jsGlobals = await page.evaluate(
    (paths, maxChars) => {
      const found: Record<string, string> = {};
      for (const path of paths) {
        try {
          const value = path
            .split('.')
            .reduce<unknown>((obj, key) => (obj == null ? undefined : (obj as Record<string, unknown>)[key]), window);
          if (value !== undefined) found[path] = String(value).slice(0, maxChars);
        } catch {
          // ignora paths que geram erro de acesso
        }
      }
      return found;
    },
    options.jsPaths,
    MAX_JS_VALUE_CHARS,
  );

  const headersLower: Record<string, string> = {};
  for (const [k, v] of Object.entries(mainResponseHeaders)) headersLower[k.toLowerCase()] = v;

  return {
    html,
    headersLower,
    meta: metaTags,
    cookies: cookieMap,
    jsGlobals,
    scriptSrc: scriptSrcs,
    scriptSrcJoined: scriptSrcs.join('\n'),
    finalUrl,
  };
}

/**
 * Abre a URL num BrowserContext isolado, com proxy de saída próprio, coleta os
 * dados que o matcher precisa e libera tudo no final.
 */
export const collectPageData: CollectPageData = async (url, options) => {
  const { browser } = options;
  const proxy = await startEgressProxy({
    policy: options.policy,
    resolver: options.resolver,
    maxBytes: options.maxDownloadBytes,
  });

  let context: Awaited<ReturnType<Browser['createBrowserContext']>> | null = null;
  // Último documento que o frame principal tentou abrir (acompanha redirects).
  let lastMainFrameUrl = url;
  let deadlineTimer: NodeJS.Timeout | undefined;

  const deadline = new Promise<never>((_, reject) => {
    deadlineTimer = setTimeout(() => {
      reject(new StackflyError('TIMEOUT', 'O site demorou demais para responder.'));
    }, options.deadlineMs);
  });

  try {
    context = await browser.createBrowserContext({
      proxyServer: proxy.url,
      proxyBypassList: ['<-loopback>'],
    });
    const page = await context.newPage();
    page.on('request', (req) => {
      if (req.isNavigationRequest() && req.frame() === page.mainFrame()) lastMainFrameUrl = req.url();
    });

    return await Promise.race([collectFromPage(page, url, options), deadline]);
  } catch (err) {
    const mainHost = hostOf(lastMainFrameUrl);
    if (mainHost && proxy.blockedHosts.has(mainHost)) {
      throw new StackflyError('BLOCKED_TARGET', 'O site redirecionou para um destino não permitido.', { cause: err });
    }
    if (proxy.budgetExceeded) {
      throw new StackflyError('NAVIGATION_FAILED', 'O site excedeu o limite de dados da análise.', { cause: err });
    }
    if (isStackflyError(err)) throw err;
    if (isTimeoutError(err)) {
      throw new StackflyError('TIMEOUT', 'O site demorou demais para responder.', { cause: err });
    }
    throw new StackflyError('NAVIGATION_FAILED', 'Não foi possível carregar o site informado.', { cause: err });
  } finally {
    clearTimeout(deadlineTimer);
    if (context) {
      const closed = await Promise.race([
        context.close().then(() => true, () => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
      ]);
      // Contexto não fechou (renderer travado): derruba o navegador inteiro.
      if (!closed) await killBrowser(browser);
    }
    await proxy.close();
  }
};
