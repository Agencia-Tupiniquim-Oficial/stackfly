import 'server-only';

import type { Browser, LaunchOptions, Page } from 'puppeteer-core';
import { StackflyError } from '@/lib/errors';
import { startEgressProxy, type EgressProxy } from '@/lib/security/egress-proxy';

// Flags que reforçam o isolamento de rede (ver security/egress-proxy.ts):
// todo tráfego precisa passar pelo proxy de saída.
function networkLockdownArgs(proxyUrl: string) {
  return [
    `--proxy-server=${proxyUrl}`,
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
}

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

/** Navegador + o proxy de saída por onde passa todo o tráfego dele. */
export interface BrowserHandle {
  browser: Browser;
  proxy: EgressProxy;
  /**
   * Página em branco que nunca navega nem é fechada. Com --single-process,
   * fechar a última página encerra o Chromium; ela mantém o processo vivo
   * entre análises.
   */
  anchor: Page;
}

export function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function launch(proxy: EgressProxy, extraArgs: string[]): Promise<Browser> {
  const common: LaunchOptions = {
    headless: 'shell',
    timeout: LAUNCH_TIMEOUT_MS,
    protocolTimeout: PROTOCOL_TIMEOUT_MS,
    defaultViewport: { width: 1366, height: 768 },
  };
  const lockdown = networkLockdownArgs(proxy.url);

  if (isServerlessRuntime()) {
    // Vercel/Lambda: Chromium empacotado pelo @sparticuz/chromium (descompactado
    // em /tmp). Ele roda com --single-process: só o contexto padrão funciona.
    const [{ default: chromium }, puppeteer] = await Promise.all([
      import('@sparticuz/chromium'),
      import('puppeteer-core'),
    ]);
    chromium.setGraphicsMode = false; // sem WebGL/SwiftShader: menos /tmp e cold start menor
    const args = chromium.args.filter((a) => !UNSAFE_SERVERLESS_ARGS.has(a));
    return puppeteer.launch({
      ...common,
      args: [...args, ...lockdown],
      executablePath: await chromium.executablePath(),
    });
  }

  const sandboxArgs = process.env.CHROME_NO_SANDBOX === 'true' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];
  const args = [...lockdown, '--disable-dev-shm-usage', ...sandboxArgs, ...extraArgs];

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

/**
 * Lança um navegador com proxy próprio. `extraArgs` (só fora da Vercel) serve
 * aos testes, ex.: ['--single-process'] para reproduzir o ambiente serverless.
 */
export async function launchBrowser(extraArgs: string[] = []): Promise<BrowserHandle> {
  const proxy = await startEgressProxy();
  try {
    const browser = await launch(proxy, extraArgs);
    browser.once('disconnected', () => void proxy.close());
    const [anchor] = await browser.pages();
    return { browser, proxy, anchor: anchor ?? (await browser.newPage()) };
  } catch (err) {
    await proxy.close();
    throw err;
  }
}

let handlePromise: Promise<BrowserHandle> | null = null;

/**
 * Um único navegador por instância, reaproveitado entre requisições. Se o
 * processo cair, a próxima chamada lança outro.
 */
export async function getBrowser(): Promise<BrowserHandle> {
  if (!handlePromise) {
    handlePromise = launchBrowser()
      .then((handle) => {
        handle.browser.once('disconnected', () => {
          handlePromise = null;
        });
        return handle;
      })
      .catch((err) => {
        handlePromise = null;
        console.error('[stackfly] falha ao iniciar o Chromium:', err);
        throw new StackflyError('BROWSER_UNAVAILABLE', 'O navegador de análise está indisponível no momento.', {
          cause: err,
        });
      });
  }
  return handlePromise;
}

/**
 * Último recurso quando uma página trava o navegador (com --single-process,
 * um loop infinito em JS bloqueia tudo). Mata o processo e força relançar.
 */
export async function killBrowser({ browser, proxy }: BrowserHandle): Promise<void> {
  handlePromise = null;
  try {
    browser.process()?.kill('SIGKILL');
  } catch (err) {
    console.error('[stackfly] falha ao matar o processo do Chromium:', err);
  }
  await browser.disconnect().catch(() => undefined);
  await proxy.close();
}
