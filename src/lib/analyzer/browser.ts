import 'server-only';

import type { Browser, LaunchOptions } from 'puppeteer-core';
import { StackflyError } from '@/lib/errors';

// Flags que reforçam o isolamento de rede (ver security/egress-proxy.ts):
// todo tráfego precisa passar pelo proxy de saída de cada análise.
const NETWORK_LOCKDOWN_ARGS = [
  // Proxy padrão "buraco negro": se alguma requisição escapar do proxy do
  // contexto, ela vai para uma porta fechada em vez da rede.
  '--proxy-server=http://127.0.0.1:9',
  // Por padrão o Chromium não usa proxy para localhost/127.0.0.1. "<-loopback>"
  // desliga essa exceção, então até loopback passa pelo proxy (e é recusado).
  '--proxy-bypass-list=<-loopback>',
  '--disable-quic', // HTTP/3 é UDP e não passaria pelo proxy HTTP
  '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
  '--dns-prefetch-disable',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-domain-reliability',
  '--disable-sync',
  '--no-pings',
  '--disable-features=NetworkPrediction,PrivateNetworkAccessPermissionPrompt',
];

// Flags do @sparticuz/chromium que enfraquecem o isolamento entre origens e
// não são necessárias para o Chromium rodar na Vercel.
const UNSAFE_SERVERLESS_ARGS = new Set([
  '--disable-web-security',
  '--allow-running-insecure-content',
  '--disable-site-isolation-trials',
]);

const LAUNCH_TIMEOUT_MS = 20_000;
// Teto para qualquer chamada CDP; o prazo da análise é menor que isso.
const PROTOCOL_TIMEOUT_MS = 30_000;

export function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function launch(): Promise<Browser> {
  const common: LaunchOptions = {
    headless: 'shell',
    timeout: LAUNCH_TIMEOUT_MS,
    protocolTimeout: PROTOCOL_TIMEOUT_MS,
    defaultViewport: { width: 1366, height: 768 },
  };

  if (isServerlessRuntime()) {
    // Vercel/Lambda: Chromium empacotado pelo @sparticuz/chromium (descompactado em /tmp).
    const [{ default: chromium }, puppeteer] = await Promise.all([
      import('@sparticuz/chromium'),
      import('puppeteer-core'),
    ]);
    chromium.setGraphicsMode = false; // sem WebGL/SwiftShader: menos /tmp e cold start menor
    const args = chromium.args.filter((a) => !UNSAFE_SERVERLESS_ARGS.has(a));
    return puppeteer.launch({
      ...common,
      args: [...args, ...NETWORK_LOCKDOWN_ARGS],
      executablePath: await chromium.executablePath(),
    });
  }

  const extraArgs = process.env.CHROME_NO_SANDBOX === 'true' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];
  const args = [...NETWORK_LOCKDOWN_ARGS, '--disable-dev-shm-usage', ...extraArgs];

  if (process.env.CHROME_EXECUTABLE_PATH) {
    const puppeteer = await import('puppeteer-core');
    return puppeteer.launch({ ...common, args, executablePath: process.env.CHROME_EXECUTABLE_PATH });
  }

  // Desenvolvimento local: `puppeteer` (devDependency) traz o próprio Chrome.
  // O import fica fora do bundle para não ser rastreado no deploy.
  const pkg = 'puppeteer';
  const { default: puppeteer } = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ pkg)) as {
    default: typeof import('puppeteer-core');
  };
  return puppeteer.launch({ ...common, args });
}

let browserPromise: Promise<Browser> | null = null;

/**
 * Um único navegador por instância, reaproveitado entre requisições (cada
 * análise usa um BrowserContext próprio). Se o processo cair, a próxima
 * chamada lança outro.
 */
export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launch()
      .then((browser) => {
        browser.once('disconnected', () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        console.error('[stackfly] falha ao iniciar o Chromium:', err);
        throw new StackflyError('BROWSER_UNAVAILABLE', 'O navegador de análise está indisponível no momento.', {
          cause: err,
        });
      });
  }
  return browserPromise;
}

/**
 * Último recurso quando uma página trava o navegador (com --single-process,
 * um loop infinito em JS bloqueia tudo). Mata o processo e força relançar.
 */
export async function killBrowser(browser: Browser): Promise<void> {
  browserPromise = null;
  const proc = browser.process();
  try {
    proc?.kill('SIGKILL');
  } catch (err) {
    console.error('[stackfly] falha ao matar o processo do Chromium:', err);
  }
  await browser.disconnect().catch(() => undefined);
}
