/**
 * Integração com Chromium real (puppeteer local). Rodar com `npm run test:browser`.
 *
 * Os sites de teste são servidores HTTP locais. Como o analisador bloqueia
 * loopback, a política de rede é injetada para liberar APENAS as portas dos
 * fixtures — o "serviço interno" (porta secreta) continua bloqueado, e o teste
 * verifica que ele não recebe nenhuma requisição.
 */
import http from 'node:http';
import type net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, type BrowserHandle } from '@/lib/analyzer/browser';
import { collectPageData, type CollectOptions } from '@/lib/analyzer/collect';
import { collectJsPaths, detectTechnologies } from '@/lib/fingerprints/matcher';
import type { AddressPolicy } from '@/lib/security/ip';
import type { Resolver } from '@/lib/security/resolve';
import { technologies } from '../helpers/dataset';

let site: http.Server;
let secret: http.Server;
let sitePort: number;
let secretPort: number;
let closedPort: number;
const secretHits: string[] = [];

const WORDPRESS_HTML = `<!doctype html><html><head>
<meta name="generator" content="WordPress 6.5.2">
<link rel="stylesheet" href="/wp-content/themes/x/style.css">
<script src="/wp-includes/js/jquery/jquery.min.js?ver=3.7.1"></script>
</head><body><div class="wp-block-group"><div class="wp-block-paragraph">oi</div></div></body></html>`;

const CSR_HTML = `<!doctype html><html><head></head><body><div id="root"></div>
<script>
setTimeout(() => {
  window.React = { version: '18.3.1' };
  const el = document.createElement('div');
  el.setAttribute('data-reactroot', '');
  el.textContent = 'renderizado no cliente';
  document.getElementById('root').appendChild(el);
}, 300);
</script></body></html>`;

function ssrfHtml() {
  const s = `http://127.0.0.1:${secretPort}`;
  return `<!doctype html><html><head>
<script src="${s}/script.js"></script>
<link rel="stylesheet" href="http://localhost:${secretPort}/style.css">
<link rel="prefetch" href="${s}/prefetch">
</head><body>
<iframe src="${s}/iframe"></iframe>
<iframe src="http://[::1]:${secretPort}/iframe6"></iframe>
<iframe src="http://internal.test:${secretPort}/rebind"></iframe>
<object data="${s}/object"></object>
<script>
  fetch('${s}/fetch').catch(() => {});
  fetch('http://internal.test:${sitePort}/rebind-same-port').catch(() => {});
  try { new WebSocket('ws://127.0.0.1:${secretPort}/ws'); } catch (e) {}
  try { navigator.sendBeacon('${s}/beacon', 'x'); } catch (e) {}
  try { new Worker('${s}/worker.js'); } catch (e) {}
  const x = new XMLHttpRequest(); x.open('GET', '${s}/xhr'); x.send();
  document.title = 'rtc:' + typeof RTCPeerConnection;
</script>
</body></html>`;
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port)));
}

beforeAll(async () => {
  secret = http.createServer((req, res) => {
    secretHits.push(req.url ?? '');
    res.end('segredo');
  });
  site = http.createServer((req, res) => {
    switch (req.url) {
      case '/wp':
        res.writeHead(200, { 'content-type': 'text/html', 'x-powered-by': 'PHP/8.2.10', server: 'nginx/1.24.0' });
        return res.end(WORDPRESS_HTML);
      case '/csr':
        return res.writeHead(200, { 'content-type': 'text/html' }).end(CSR_HTML);
      case '/ssrf':
        return res.writeHead(200, { 'content-type': 'text/html' }).end(ssrfHtml());
      case '/redirect':
        return res.writeHead(302, { location: '/wp' }).end();
      case '/evil-redirect':
        return res.writeHead(302, { location: `http://127.0.0.1:${secretPort}/admin` }).end();
      case '/loop':
        return res.writeHead(200, { 'content-type': 'text/html' }).end('<script>while(true){}</script>');
      case '/set-cookie':
        res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'vazou=1; Path=/' });
        return res.end('<html><body>cookie</body></html>');
      case '/slow':
        return; // nunca responde
      default:
        return res.writeHead(404).end();
    }
  });
  [sitePort, secretPort] = await Promise.all([listen(site), listen(secret)]);

  // Porta que estava aberta e foi fechada: conexão recusada.
  const tmp = http.createServer();
  closedPort = await listen(tmp);
  await new Promise<void>((r) => tmp.close(() => r()));
});

afterAll(async () => {
  site?.closeAllConnections();
  site?.close();
  secret?.close();
});

// Libera só loopback nas portas dos fixtures (nunca a porta secreta).
const policy: AddressPolicy = (ip, port) => ip === '127.0.0.1' && (port === sitePort || port === closedPort);
// "internal.test" resolve para loopback, como um DNS rebinding faria.
const resolver: Resolver = async (host) => {
  if (host === 'internal.test' || host === 'site.test') return [{ address: '127.0.0.1', family: 4 }];
  throw new Error('ENOTFOUND');
};

let handle: BrowserHandle;

function options(overrides: Partial<CollectOptions> = {}): CollectOptions {
  return {
    handle,
    policy,
    resolver,
    jsPaths: collectJsPaths(technologies),
    navigationTimeoutMs: 10_000,
    settleTimeoutMs: 2_000,
    deadlineMs: 20_000,
    maxDownloadBytes: 10 * 1024 * 1024,
    ...overrides,
  };
}

const url = (path: string) => `http://site.test:${sitePort}${path}`;

// Na Vercel o @sparticuz/chromium roda com --single-process (só o contexto
// padrão funciona, um renderer para tudo). A suíte roda nos dois modos — a
// primeira versão só era testada no modo normal e quebrou em produção.
// O --single-process só é exercitado no Linux: no Windows o Chromium não dá
// suporte a esse modo e cai de forma aleatória (não reflete a Vercel).
const MODES: Array<[string, string[]]> = [
  ['modo normal', []],
  ...(process.platform === 'linux'
    ? ([['--single-process (como na Vercel)', ['--single-process', '--no-zygote']]] as Array<[string, string[]]>)
    : []),
];

describe.each(MODES)('análise com Chromium real — %s', (_mode, extraArgs) => {
  beforeAll(async () => {
    handle = await launchBrowser(extraArgs);
  });

  afterAll(async () => {
    await handle?.browser.close().catch(() => undefined);
  });

  // Faz o papel do getBrowser(): relança se o navegador foi derrubado.
  async function ensureBrowser() {
    if (!handle.browser.connected) handle = await launchBrowser(extraArgs);
  }

  it('detecta WordPress (com versão), PHP, Nginx e infere MySQL', async () => {
    const page = await collectPageData(url('/wp'), options());
    const det = Object.fromEntries(detectTechnologies(technologies, page).map((d) => [d.name, d]));
    expect(det.WordPress.version).toBe('6.5.2');
    expect(det.PHP.version).toBe('8.2.10');
    expect(det.Nginx.version).toBe('1.24.0');
    expect(det.MySQL.implied).toBe(true);
    expect(page.headersLower['x-powered-by']).toBe('PHP/8.2.10');
  });

  it('detecta tecnologia renderizada no cliente (globais JS e DOM gerado por JS)', async () => {
    const page = await collectPageData(url('/csr'), options());
    expect(page.html).toContain('data-reactroot');
    const react = detectTechnologies(technologies, page).find((d) => d.name === 'React');
    expect(react?.version).toBe('18.3.1');
  });

  it('segue redirecionamento e reporta a URL final', async () => {
    const page = await collectPageData(url('/redirect'), options());
    expect(page.finalUrl).toBe(url('/wp'));
    expect(detectTechnologies(technologies, page).map((d) => d.name)).toContain('WordPress');
  });

  it('nenhum recurso da página alcança o serviço interno', async () => {
    const before = secretHits.length;
    const page = await collectPageData(url('/ssrf'), options());
    expect(page.finalUrl).toBe(url('/ssrf'));
    // dá tempo para requisições tardias (worker, websocket, beacon)
    await new Promise((r) => setTimeout(r, 2_000));
    expect(secretHits.slice(before)).toEqual([]);
    // WebRTC (UDP fora do proxy) fica indisponível para a página.
    expect(page.html).toContain('<title>rtc:undefined</title>');
  });

  it('controle: com a porta secreta liberada, o teste acima detectaria o vazamento', async () => {
    const before = secretHits.length;
    const leaky: AddressPolicy = (ip, port) => policy(ip, port) || port === secretPort;
    await collectPageData(url('/ssrf'), options({ policy: leaky }));
    const expected = ['/script.js', '/iframe', '/fetch', '/xhr'];
    // Sob carga, parte das requisições chega depois que a coleta termina.
    await expect
      .poll(() => secretHits.slice(before), { timeout: 5_000, interval: 100 })
      .toEqual(expect.arrayContaining(expected));
  });

  it('redirect para destino bloqueado → BLOCKED_TARGET', async () => {
    const before = secretHits.length;
    await expect(collectPageData(url('/evil-redirect'), options())).rejects.toMatchObject({ code: 'BLOCKED_TARGET' });
    expect(secretHits.slice(before)).toEqual([]);
  });

  it('site que não responde → TIMEOUT', async () => {
    await expect(collectPageData(url('/slow'), options({ navigationTimeoutMs: 2_000 }))).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('site inacessível (conexão recusada) → NAVIGATION_FAILED', async () => {
    await expect(collectPageData(`http://127.0.0.1:${closedPort}/`, options())).rejects.toMatchObject({
      code: 'NAVIGATION_FAILED',
    });
  });

  it('cookies de uma análise não vazam para a próxima', async () => {
    const first = await collectPageData(url('/set-cookie'), options());
    expect(first.cookies.vazou).toBe('1');
    const second = await collectPageData(url('/wp'), options());
    expect(second.cookies).not.toHaveProperty('vazou');
  });

  it('análises seguidas no mesmo navegador funcionam', async () => {
    for (let i = 0; i < 3; i++) {
      const page = await collectPageData(url('/wp'), options());
      expect(detectTechnologies(technologies, page).map((d) => d.name)).toContain('WordPress');
    }
  });

  it('página com loop infinito estoura o prazo e a análise seguinte funciona', async () => {
    await expect(
      collectPageData(url('/loop'), options({ navigationTimeoutMs: 3_000, deadlineMs: 4_000 })),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });

    await ensureBrowser();
    const page = await collectPageData(url('/wp'), options());
    expect(detectTechnologies(technologies, page).map((d) => d.name)).toContain('WordPress');
  });
});
