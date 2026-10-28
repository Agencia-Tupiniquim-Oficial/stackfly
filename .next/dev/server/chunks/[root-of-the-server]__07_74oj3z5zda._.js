module.exports = [
(()=>{"use strict";return[
"[project]/src/app/api/v1/stack/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "OPTIONS",
    ()=>OPTIONS,
    "dynamic",
    ()=>dynamic,
    "maxDuration",
    ()=>maxDuration,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$default$2d$handler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api/default-handler.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$stack$2d$handler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api/stack-handler.ts [app-route] (ecmascript)");
;
;
const runtime = 'nodejs';
const dynamic = 'force-dynamic';
const maxDuration = 60;
async function GET(request) {
    const url = new URL(request.url).searchParams.get('url');
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$default$2d$handler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["handleStackRequest"])(request, url);
}
function OPTIONS() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$stack$2d$handler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["corsPreflight"])();
}
}),
"[project]/src/lib/analyzer/analyze.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createAnalyzer",
    ()=>createAnalyzer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/errors.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fingerprints$2f$result$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/fingerprints/result.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fingerprints$2f$matcher$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/fingerprints/matcher.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$resolve$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/resolve.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyzer$2f$semaphore$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analyzer/semaphore.ts [app-route] (ecmascript)");
;
;
;
;
;
function createAnalyzer(deps) {
    const semaphore = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyzer$2f$semaphore$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Semaphore"](deps.maxConcurrent);
    const inFlight = new Map();
    async function readCache(key) {
        try {
            return await deps.cache.get(key);
        } catch (err) {
            console.error('[stackfly] leitura do cache falhou; seguindo sem cache:', err);
            return null;
        }
    }
    async function writeCache(key, value) {
        try {
            await deps.cache.set(key, value);
        } catch (err) {
            console.error('[stackfly] escrita no cache falhou:', err);
        }
    }
    async function run(target) {
        const startedAt = Date.now();
        const release = await semaphore.acquire(Math.floor(deps.totalTimeoutMs / 2));
        try {
            const remaining = deps.totalTimeoutMs - (Date.now() - startedAt);
            const pageData = await deps.collect(target.url.href, {
                deadlineMs: remaining
            });
            let result;
            try {
                const { technologies, categories } = deps.dataset();
                const detections = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fingerprints$2f$matcher$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["detectTechnologies"])(technologies, pageData);
                result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fingerprints$2f$result$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildStackResult"])({
                    url: target.display,
                    finalUrl: pageData.finalUrl
                }, detections, categories);
            } catch (err) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('INTERNAL_ERROR', 'Falha ao processar as fingerprints.', {
                    cause: err
                });
            }
            await writeCache(target.cacheKey, result);
            return result;
        } finally{
            release();
        }
    }
    return async function analyze(target) {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$resolve$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveAllowedAddresses"])(target.url.hostname, target.port, deps.policy, deps.resolver);
        const cached = await readCache(target.cacheKey);
        if (cached) return {
            ...cached,
            url: target.display,
            cached: true
        };
        let pending = inFlight.get(target.cacheKey);
        if (!pending) {
            pending = run(target).finally(()=>inFlight.delete(target.cacheKey));
            inFlight.set(target.cacheKey, pending);
        }
        try {
            const result = await pending;
            return {
                ...result,
                url: target.display
            };
        } catch (err) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isStackflyError"])(err)) throw err;
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('INTERNAL_ERROR', 'Erro interno ao analisar o site.', {
                cause: err
            });
        }
    };
}
}),
"[project]/src/lib/analyzer/browser.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getBrowser",
    ()=>getBrowser,
    "isServerlessRuntime",
    ()=>isServerlessRuntime,
    "killBrowser",
    ()=>killBrowser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/errors.ts [app-route] (ecmascript)");
;
;
// Flags que reforçam o isolamento de rede (ver security/egress-proxy.ts):
// todo tráfego precisa passar pelo proxy de saída de cada análise.
const NETWORK_LOCKDOWN_ARGS = [
    // Proxy padrão "buraco negro": se alguma requisição escapar do proxy do
    // contexto, ela vai para uma porta fechada em vez da rede.
    '--proxy-server=http://127.0.0.1:9',
    // Por padrão o Chromium não usa proxy para localhost/127.0.0.1. "<-loopback>"
    // desliga essa exceção, então até loopback passa pelo proxy (e é recusado).
    '--proxy-bypass-list=<-loopback>',
    '--disable-quic',
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    '--dns-prefetch-disable',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--disable-sync',
    '--no-pings',
    '--disable-features=NetworkPrediction,PrivateNetworkAccessPermissionPrompt'
];
// Flags do @sparticuz/chromium que enfraquecem o isolamento entre origens e
// não são necessárias para o Chromium rodar na Vercel.
const UNSAFE_SERVERLESS_ARGS = new Set([
    '--disable-web-security',
    '--allow-running-insecure-content',
    '--disable-site-isolation-trials'
]);
const LAUNCH_TIMEOUT_MS = 20_000;
// Teto para qualquer chamada CDP; o prazo da análise é menor que isso.
const PROTOCOL_TIMEOUT_MS = 30_000;
function isServerlessRuntime() {
    return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}
async function launch() {
    const common = {
        headless: 'shell',
        timeout: LAUNCH_TIMEOUT_MS,
        protocolTimeout: PROTOCOL_TIMEOUT_MS,
        defaultViewport: {
            width: 1366,
            height: 768
        }
    };
    if (isServerlessRuntime()) {
        // Vercel/Lambda: Chromium empacotado pelo @sparticuz/chromium (descompactado em /tmp).
        const [{ default: chromium }, puppeteer] = await Promise.all([
            __turbopack_context__.A("[externals]/@sparticuz/chromium [external] (@sparticuz/chromium, esm_import, [project]/node_modules/@sparticuz/chromium, async loader)"),
            __turbopack_context__.A("[externals]/puppeteer-core [external] (puppeteer-core, esm_import, [project]/node_modules/puppeteer-core, async loader)")
        ]);
        chromium.setGraphicsMode = false; // sem WebGL/SwiftShader: menos /tmp e cold start menor
        const args = chromium.args.filter((a)=>!UNSAFE_SERVERLESS_ARGS.has(a));
        return puppeteer.launch({
            ...common,
            args: [
                ...args,
                ...NETWORK_LOCKDOWN_ARGS
            ],
            executablePath: await chromium.executablePath()
        });
    }
    const extraArgs = process.env.CHROME_NO_SANDBOX === 'true' ? [
        '--no-sandbox',
        '--disable-setuid-sandbox'
    ] : [];
    const args = [
        ...NETWORK_LOCKDOWN_ARGS,
        '--disable-dev-shm-usage',
        ...extraArgs
    ];
    if (process.env.CHROME_EXECUTABLE_PATH) {
        const puppeteer = await __turbopack_context__.A("[externals]/puppeteer-core [external] (puppeteer-core, esm_import, [project]/node_modules/puppeteer-core, async loader)");
        return puppeteer.launch({
            ...common,
            args,
            executablePath: process.env.CHROME_EXECUTABLE_PATH
        });
    }
    // Desenvolvimento local: `puppeteer` (devDependency) traz o próprio Chrome.
    // O import fica fora do bundle para não ser rastreado no deploy.
    const pkg = 'puppeteer';
    const { default: puppeteer } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ pkg);
    return puppeteer.launch({
        ...common,
        args
    });
}
let browserPromise = null;
async function getBrowser() {
    if (!browserPromise) {
        browserPromise = launch().then((browser)=>{
            browser.once('disconnected', ()=>{
                browserPromise = null;
            });
            return browser;
        }).catch((err)=>{
            browserPromise = null;
            console.error('[stackfly] falha ao iniciar o Chromium:', err);
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('BROWSER_UNAVAILABLE', 'O navegador de análise está indisponível no momento.', {
                cause: err
            });
        });
    }
    return browserPromise;
}
async function killBrowser(browser) {
    browserPromise = null;
    const proc = browser.process();
    try {
        proc?.kill('SIGKILL');
    } catch (err) {
        console.error('[stackfly] falha ao matar o processo do Chromium:', err);
    }
    await browser.disconnect().catch(()=>undefined);
}
}),
"[project]/src/lib/analyzer/collect.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "collectPageData",
    ()=>collectPageData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/errors.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$egress$2d$proxy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/egress-proxy.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyzer$2f$browser$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analyzer/browser.ts [app-route] (ecmascript)");
;
;
;
;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
// Limites do que é coletado da página (o matcher roda regex sobre isso).
const MAX_HTML_CHARS = 2_000_000;
const MAX_SCRIPTS = 500;
const MAX_META = 300;
const MAX_COOKIES = 300;
const MAX_JS_VALUE_CHARS = 200;
// Imagens, mídia e fontes não alimentam nenhum canal de detecção.
const SKIPPED_RESOURCE_TYPES = new Set([
    'image',
    'media',
    'font'
]);
const ALLOWED_SCHEMES = new Set([
    'http:',
    'https:',
    'data:',
    'blob:'
]);
function isTimeoutError(err) {
    return err instanceof Error && err.name === 'TimeoutError';
}
function hostOf(url) {
    try {
        return new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    } catch  {
        return null;
    }
}
async function disableWebRtc(page) {
    // Reforço da flag --force-webrtc-ip-handling-policy: sem RTCPeerConnection
    // a página não consegue nem tentar ICE/STUN para endereços internos.
    await page.evaluateOnNewDocument(()=>{
        for (const name of [
            'RTCPeerConnection',
            'webkitRTCPeerConnection',
            'RTCDataChannel'
        ]){
            try {
                Object.defineProperty(window, name, {
                    value: undefined,
                    configurable: false,
                    writable: false
                });
            } catch  {
            // propriedade já definida como não configurável
            }
        }
    });
}
async function collectFromPage(page, url, options) {
    page.setDefaultTimeout(options.navigationTimeoutMs);
    await page.setUserAgent({
        userAgent: USER_AGENT
    });
    await disableWebRtc(page);
    await page.setRequestInterception(true);
    page.on('request', (req)=>{
        if (req.isInterceptResolutionHandled()) return;
        let scheme;
        try {
            scheme = new URL(req.url()).protocol;
        } catch  {
            void req.abort('blockedbyclient');
            return;
        }
        if (!ALLOWED_SCHEMES.has(scheme) || SKIPPED_RESOURCE_TYPES.has(req.resourceType())) {
            void req.abort('blockedbyclient');
            return;
        }
        void req.continue();
    });
    let mainResponseHeaders = {};
    page.on('response', (response)=>{
        if (response.url() === url || response.request().resourceType() === 'document') {
            if (Object.keys(mainResponseHeaders).length === 0) {
                mainResponseHeaders = response.headers();
            }
        }
    });
    const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: options.navigationTimeoutMs
    });
    if (response) {
        mainResponseHeaders = {
            ...response.headers(),
            ...mainResponseHeaders
        };
    }
    // A versão original esperava `networkidle2` dentro do goto e falhava se a
    // rede nunca acalmasse (sites com polling). Agora a navegação em si tem
    // timeout, e a espera pela rede é um "melhor esforço" com teto próprio.
    if (options.settleTimeoutMs > 0) {
        try {
            await page.waitForNetworkIdle({
                idleTime: 500,
                concurrency: 2,
                timeout: options.settleTimeoutMs
            });
        } catch (err) {
            if (!isTimeoutError(err)) throw err;
        }
    }
    const finalUrl = page.url();
    if (!/^https?:/i.test(finalUrl)) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('NAVIGATION_FAILED', 'O site redirecionou para um endereço não suportado.');
    }
    const html = (await page.content()).slice(0, MAX_HTML_CHARS);
    const scriptSrcs = await page.evaluate((max)=>Array.from(document.querySelectorAll('script[src]'), (s)=>s.src).slice(0, max), MAX_SCRIPTS);
    const metaTags = await page.evaluate((max)=>{
        const result = {};
        Array.from(document.querySelectorAll('meta[name], meta[property]')).slice(0, max).forEach((m)=>{
            const key = (m.getAttribute('name') || m.getAttribute('property') || '').toLowerCase();
            if (key) result[key] = (m.getAttribute('content') || '').slice(0, 1000);
        });
        return result;
    }, MAX_META);
    const cookies = await page.cookies();
    const cookieMap = {};
    cookies.slice(0, MAX_COOKIES).forEach((c)=>{
        cookieMap[c.name.toLowerCase()] = c.value;
    });
    // Checa a presença de variáveis globais conhecidas (window.wp, window.React etc.)
    const jsGlobals = await page.evaluate((paths, maxChars)=>{
        const found = {};
        for (const path of paths){
            try {
                const value = path.split('.').reduce((obj, key)=>obj == null ? undefined : obj[key], window);
                if (value !== undefined) found[path] = String(value).slice(0, maxChars);
            } catch  {
            // ignora paths que geram erro de acesso
            }
        }
        return found;
    }, options.jsPaths, MAX_JS_VALUE_CHARS);
    const headersLower = {};
    for (const [k, v] of Object.entries(mainResponseHeaders))headersLower[k.toLowerCase()] = v;
    return {
        html,
        headersLower,
        meta: metaTags,
        cookies: cookieMap,
        jsGlobals,
        scriptSrc: scriptSrcs,
        scriptSrcJoined: scriptSrcs.join('\n'),
        finalUrl
    };
}
const collectPageData = async (url, options)=>{
    const { browser } = options;
    const proxy = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$egress$2d$proxy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["startEgressProxy"])({
        policy: options.policy,
        resolver: options.resolver,
        maxBytes: options.maxDownloadBytes
    });
    let context = null;
    // Último documento que o frame principal tentou abrir (acompanha redirects).
    let lastMainFrameUrl = url;
    let deadlineTimer;
    const deadline = new Promise((_, reject)=>{
        deadlineTimer = setTimeout(()=>{
            reject(new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('TIMEOUT', 'O site demorou demais para responder.'));
        }, options.deadlineMs);
    });
    try {
        context = await browser.createBrowserContext({
            proxyServer: proxy.url,
            proxyBypassList: [
                '<-loopback>'
            ]
        });
        const page = await context.newPage();
        page.on('request', (req)=>{
            if (req.isNavigationRequest() && req.frame() === page.mainFrame()) lastMainFrameUrl = req.url();
        });
        return await Promise.race([
            collectFromPage(page, url, options),
            deadline
        ]);
    } catch (err) {
        const mainHost = hostOf(lastMainFrameUrl);
        if (mainHost && proxy.blockedHosts.has(mainHost)) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('BLOCKED_TARGET', 'O site redirecionou para um destino não permitido.', {
                cause: err
            });
        }
        if (proxy.budgetExceeded) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('NAVIGATION_FAILED', 'O site excedeu o limite de dados da análise.', {
                cause: err
            });
        }
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isStackflyError"])(err)) throw err;
        if (isTimeoutError(err)) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('TIMEOUT', 'O site demorou demais para responder.', {
                cause: err
            });
        }
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('NAVIGATION_FAILED', 'Não foi possível carregar o site informado.', {
            cause: err
        });
    } finally{
        clearTimeout(deadlineTimer);
        if (context) {
            const closed = await Promise.race([
                context.close().then(()=>true, ()=>false),
                new Promise((resolve)=>setTimeout(()=>resolve(false), 5_000))
            ]);
            // Contexto não fechou (renderer travado): derruba o navegador inteiro.
            if (!closed) await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyzer$2f$browser$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["killBrowser"])(browser);
        }
        await proxy.close();
    }
};
}),
"[project]/src/lib/analyzer/semaphore.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Semaphore",
    ()=>Semaphore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/errors.ts [app-route] (ecmascript)");
;
class Semaphore {
    max;
    active;
    queue;
    constructor(max){
        this.max = max;
        this.active = 0;
        this.queue = [];
    }
    async acquire(timeoutMs) {
        if (this.active < this.max) {
            this.active++;
            return this.releaser();
        }
        return new Promise((resolve, reject)=>{
            const grant = ()=>{
                clearTimeout(timer);
                this.active++;
                resolve(this.releaser());
            };
            const timer = setTimeout(()=>{
                this.queue = this.queue.filter((g)=>g !== grant);
                reject(new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('SERVER_BUSY', 'Muitas análises em andamento. Tente novamente em instantes.'));
            }, timeoutMs);
            this.queue.push(grant);
        });
    }
    releaser() {
        let released = false;
        return ()=>{
            if (released) return;
            released = true;
            this.active--;
            this.queue.shift()?.();
        };
    }
}
}),
"[project]/src/lib/api/default-handler.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "handleStackRequest",
    ()=>handleStackRequest
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$services$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/services.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$stack$2d$handler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api/stack-handler.ts [app-route] (ecmascript)");
;
;
;
;
const handleStackRequest = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$stack$2d$handler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createStackHandler"])({
    analyzer: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$services$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAnalyzer"],
    rateLimiter: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$services$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getRateLimiter"],
    trustProxyHeaders: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["config"].trustProxyHeaders
});
}),
"[project]/src/lib/api/stack-handler.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CORS_HEADERS",
    ()=>CORS_HEADERS,
    "corsPreflight",
    ()=>corsPreflight,
    "createStackHandler",
    ()=>createStackHandler
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/errors.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$client$2d$ip$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/client-ip.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$url$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/url.ts [app-route] (ecmascript)");
;
;
;
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers': 'RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After'
};
// Mesmos cabeçalhos do express-rate-limit com `standardHeaders: true`.
function rateLimitHeaders(rl) {
    return {
        'RateLimit-Limit': String(rl.limit),
        'RateLimit-Remaining': String(rl.remaining),
        'RateLimit-Reset': String(Math.ceil(rl.resetMs / 1000))
    };
}
function json(body, status, headers = {}) {
    return Response.json(body, {
        status,
        headers: {
            ...CORS_HEADERS,
            'Cache-Control': 'no-store',
            ...headers
        }
    });
}
function errorResponse(err, headers = {}) {
    const body = {
        error: err.message,
        code: err.code
    };
    return json(body, err.status, headers);
}
function createStackHandler(deps) {
    return async function handle(request, rawUrl) {
        const clientId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$client$2d$ip$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getClientId"])(request.headers, {
            trustProxyHeaders: deps.trustProxyHeaders
        });
        let rl;
        try {
            rl = await deps.rateLimiter().check(clientId);
        } catch (err) {
            console.error('[stackfly] rate limit indisponível:', err);
            return errorResponse(new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('INTERNAL_ERROR', 'Erro interno. Tente novamente.'));
        }
        const rlHeaders = rateLimitHeaders(rl);
        if (!rl.allowed) {
            return errorResponse(new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('RATE_LIMITED', 'Limite de requisições excedido. Tente novamente em instantes.'), {
                ...rlHeaders,
                'Retry-After': String(Math.ceil(rl.resetMs / 1000))
            });
        }
        try {
            const target = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$url$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseTargetUrl"])(rawUrl);
            const result = await deps.analyzer()(target);
            return json(result, 200, rlHeaders);
        } catch (err) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isStackflyError"])(err)) {
                if (err.status >= 500) console.error(`[stackfly] ${err.code}:`, err.cause ?? err);
                return errorResponse(err, rlHeaders);
            }
            console.error('[stackfly] erro inesperado:', err);
            return errorResponse(new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('INTERNAL_ERROR', 'Erro interno ao analisar o site.'), rlHeaders);
        }
    };
}
function corsPreflight() {
    return new Response(null, {
        status: 204,
        headers: {
            ...CORS_HEADERS,
            'Access-Control-Max-Age': '86400'
        }
    });
}
}),
"[project]/src/lib/cache/result-cache.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MemoryResultCache",
    ()=>MemoryResultCache,
    "RedisResultCache",
    ()=>RedisResultCache
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
class MemoryResultCache {
    ttlMs;
    maxEntries;
    store;
    constructor(ttlMs, maxEntries = 500){
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
        this.store = new Map();
    }
    async get(key) {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }
    async set(key, value) {
        // Limite de memória: descarta a entrada mais antiga (ordem de inserção do Map).
        if (this.store.size >= this.maxEntries && !this.store.has(key)) {
            const oldest = this.store.keys().next().value;
            if (oldest !== undefined) this.store.delete(oldest);
        }
        this.store.set(key, {
            value,
            expiresAt: Date.now() + this.ttlMs
        });
    }
}
class RedisResultCache {
    redis;
    ttlMs;
    constructor(redis, ttlMs){
        this.redis = redis;
        this.ttlMs = ttlMs;
    }
    redisKey(key) {
        return `stackfly:v1:result:${(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHash"])('sha256').update(key).digest('hex')}`;
    }
    async get(key) {
        return await this.redis.get(this.redisKey(key)) ?? null;
    }
    async set(key, value) {
        await this.redis.set(this.redisKey(key), value, {
            px: this.ttlMs
        });
    }
}
}),
"[project]/src/lib/config.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config
]);
;
function intFromEnv(name, fallback, { min = 1 } = {}) {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '') return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min) {
        console.warn(`[stackfly] ${name}="${raw}" inválido; usando ${fallback}.`);
        return fallback;
    }
    return Math.floor(value);
}
const config = {
    cacheTtlMs: intFromEnv('CACHE_TTL_MS', 60 * 60 * 1000),
    rateLimitWindowMs: intFromEnv('RATE_LIMIT_WINDOW_MS', 60 * 1000),
    // API pública e aberta: limite conservador por IP, já que qualquer um pode chamar.
    rateLimitMax: intFromEnv('RATE_LIMIT_MAX', 10),
    navigationTimeoutMs: intFromEnv('ANALYSIS_NAVIGATION_TIMEOUT_MS', 25_000),
    // Depois do DOMContentLoaded, espera a rede "acalmar" por no máximo esse tempo.
    settleTimeoutMs: intFromEnv('ANALYSIS_SETTLE_TIMEOUT_MS', 5_000, {
        min: 0
    }),
    // Prazo total de uma análise (fila + navegador + coleta). Precisa caber no
    // maxDuration da rota (60s).
    totalTimeoutMs: intFromEnv('ANALYSIS_TOTAL_TIMEOUT_MS', 45_000),
    maxConcurrentAnalyses: intFromEnv('MAX_CONCURRENT_ANALYSES', 2),
    // Total de bytes baixados pela página analisada (todas as requisições).
    maxDownloadBytes: intFromEnv('ANALYSIS_MAX_DOWNLOAD_BYTES', 30 * 1024 * 1024),
    trustProxyHeaders: process.env.TRUST_PROXY_HEADERS === 'true'
};
}),
"[project]/src/lib/errors.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StackflyError",
    ()=>StackflyError,
    "isStackflyError",
    ()=>isStackflyError
]);
const STATUS_BY_CODE = {
    MISSING_URL: 400,
    INVALID_URL: 400,
    UNSUPPORTED_PROTOCOL: 400,
    BLOCKED_TARGET: 403,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
    DNS_RESOLUTION_FAILED: 502,
    NAVIGATION_FAILED: 502,
    SERVER_BUSY: 503,
    BROWSER_UNAVAILABLE: 503,
    TIMEOUT: 504
};
class StackflyError extends Error {
    code;
    constructor(code, message, options){
        super(message, options);
        this.name = 'StackflyError';
        this.code = code;
    }
    get status() {
        return STATUS_BY_CODE[this.code];
    }
}
function isStackflyError(err) {
    return err instanceof StackflyError;
}
}),
"[project]/src/lib/fingerprints/dataset.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "loadDataset",
    ()=>loadDataset
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
;
;
;
// O dataset (~2,6 MB) fica em /data e é lido do disco uma única vez por
// instância. Não usamos `import x from '*.json'` porque o TypeScript tentaria
// inferir tipos para 7.600+ objetos. Na Vercel, o next.config.ts inclui
// data/** no bundle da função via outputFileTracingIncludes.
const DATA_DIR = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(process.cwd(), 'data');
let cached = null;
function loadDataset() {
    if (!cached) {
        cached = {
            technologies: JSON.parse(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["default"].readFileSync(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(DATA_DIR, 'technologies.json'), 'utf8')),
            categories: JSON.parse(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["default"].readFileSync(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(DATA_DIR, 'categories.json'), 'utf8'))
        };
    }
    return cached;
}
}),
"[project]/src/lib/fingerprints/matcher.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Motor de matching de fingerprints, no formato usado pelo ruleset
 * open-source da Wappalyzer (technologies.json).
 *
 * Cada padrão pode vir como string simples ou como string com metadados
 * separados por ";", por exemplo:
 *   "^WordPress(?: ([\\d.]+))?\\;version:\\1"
 *   "someRegex\\;confidence:50"
 *
 * Portado de server/matcher.js sem mudar a semântica. A única diferença é que
 * os padrões são compilados uma vez por dataset (antes eram recompilados a
 * cada requisição) — o teste de regressão em tests/matcher.test.ts compara a
 * saída com a do matcher original.
 */ __turbopack_context__.s([
    "collectJsPaths",
    ()=>collectJsPaths,
    "detectTechnologies",
    ()=>detectTechnologies,
    "parsePattern",
    ()=>parsePattern
]);
function parsePattern(pattern) {
    const parts = String(pattern).split('\\;');
    const regexStr = parts.shift() ?? '';
    const meta = {
        confidence: 100
    };
    for (const part of parts){
        const [key, value] = part.split(':');
        if (key === 'version') meta.version = value;
        else if (key === 'confidence') meta.confidence = parseInt(value, 10) || 100;
    }
    let regex = null;
    if (regexStr) {
        try {
            // Wappalyzer usa regex case-insensitive por padrão
            regex = new RegExp(regexStr, 'i');
        } catch  {
            regex = null; // alguns padrões usam sintaxe PCRE incompatível com JS; ignora
        }
    }
    return {
        regexStr,
        regex,
        ...meta
    };
}
// Resolve "\1", "\2" etc. dentro da string de versão usando os grupos capturados
function resolveVersion(versionTemplate, match) {
    if (!versionTemplate || !match) return undefined;
    const resolved = versionTemplate.replace(/\\(\d)/g, (_, idx)=>match[Number(idx)] || '');
    return resolved.trim() || undefined;
}
// Testa um valor (string) contra um padrão já parseado
function testPattern(value, parsed) {
    if (!parsed.regex || typeof value !== 'string') return null;
    const match = value.match(parsed.regex);
    if (!match) return null;
    return {
        confidence: parsed.confidence,
        version: resolveVersion(parsed.version, match)
    };
}
// Normaliza um campo do fingerprint (string | array | objeto) em uma lista de
// { key, patterns } prontos pra testar
function normalizeField(field) {
    if (!field) return [];
    if (typeof field === 'string') {
        return [
            {
                key: null,
                patterns: [
                    parsePattern(field)
                ]
            }
        ];
    }
    if (Array.isArray(field)) {
        return [
            {
                key: null,
                patterns: field.map(parsePattern)
            }
        ];
    }
    if (typeof field === 'object') {
        return Object.entries(field).map(([key, val])=>({
                key,
                patterns: (Array.isArray(val) ? val : [
                    val
                ]).map(parsePattern)
            }));
    }
    return [];
}
function compileTechnology(name, tech) {
    return {
        name,
        tech,
        checks: [
            {
                channel: 'headersLower',
                groups: normalizeField(tech.headers),
                byKey: true,
                lowerKey: true
            },
            {
                channel: 'meta',
                groups: normalizeField(tech.meta),
                byKey: true,
                lowerKey: true
            },
            {
                channel: 'cookies',
                groups: normalizeField(tech.cookies),
                byKey: true,
                lowerKey: true
            },
            {
                channel: 'jsGlobals',
                groups: normalizeField(tech.js),
                byKey: true,
                lowerKey: false
            },
            {
                channel: 'html',
                groups: normalizeField(tech.html),
                byKey: false,
                lowerKey: false
            },
            {
                channel: 'scriptSrcJoined',
                groups: normalizeField(tech.scriptSrc || tech.script),
                byKey: false,
                lowerKey: false
            }
        ]
    };
}
const compiledByDataset = new WeakMap();
function getCompiled(technologies) {
    let compiled = compiledByDataset.get(technologies);
    if (!compiled) {
        compiled = Object.entries(technologies).map(([name, tech])=>compileTechnology(name, tech));
        compiledByDataset.set(technologies, compiled);
    }
    return compiled;
}
function collectJsPaths(technologies) {
    const paths = new Set();
    for (const tech of Object.values(technologies)){
        if (tech.js && typeof tech.js === 'object') {
            for (const key of Object.keys(tech.js))paths.add(key);
        }
    }
    return Array.from(paths);
}
// Decide se `candidate` deve substituir `current` como melhor match:
// confiança maior sempre vence; em empate, prioriza quem trouxe versão.
function isBetterMatch(candidate, current) {
    if (!current) return true;
    if (candidate.confidence !== current.confidence) return candidate.confidence > current.confidence;
    return !current.version && !!candidate.version;
}
function toImpliesList(implies) {
    if (Array.isArray(implies)) return implies;
    return implies ? [
        implies
    ] : [];
}
function detectTechnologies(technologies, page) {
    const results = new Map();
    for (const { name, tech, checks } of getCompiled(technologies)){
        let best = null;
        for (const check of checks){
            const data = page[check.channel];
            for (const { key, patterns } of check.groups){
                for (const parsed of patterns){
                    if (check.byKey) {
                        if (!key) continue;
                        const lookupKey = check.lowerKey ? key.toLowerCase() : key;
                        const value = data ? data[lookupKey] : undefined;
                        if (value === undefined) continue;
                        // presença de chave (js globals) sem regex útil ainda conta como match
                        const result = parsed.regexStr ? testPattern(String(value), parsed) : {
                            confidence: parsed.confidence,
                            version: undefined
                        };
                        if (result && isBetterMatch(result, best)) best = result;
                    } else {
                        if (!data) continue;
                        const result = testPattern(data, parsed);
                        if (result && isBetterMatch(result, best)) best = result;
                    }
                }
            }
        }
        if (best) {
            results.set(name, {
                name,
                confidence: best.confidence,
                version: best.version,
                categories: tech.cats || [],
                website: tech.website,
                icon: tech.icon,
                implies: toImpliesList(tech.implies)
            });
        }
    }
    // Resolve tecnologias "implicadas" (ex: WordPress implica PHP + MySQL)
    const implied = new Set();
    for (const detection of results.values()){
        for (const impliedName of detection.implies){
            const cleanName = impliedName.split('\\;')[0];
            if (!results.has(cleanName)) implied.add(cleanName);
        }
    }
    for (const impliedName of implied){
        const tech = technologies[impliedName];
        if (tech) {
            results.set(impliedName, {
                name: impliedName,
                confidence: 100,
                version: undefined,
                categories: tech.cats || [],
                website: tech.website,
                icon: tech.icon,
                implied: true,
                implies: []
            });
        }
    }
    return Array.from(results.values()).sort((a, b)=>b.confidence - a.confidence);
}
}),
"[project]/src/lib/fingerprints/result.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildStackResult",
    ()=>buildStackResult
]);
const FALLBACK_CATEGORY = 'Outros';
function categoryNames(det, categories) {
    return (det.categories.length ? det.categories : [
        0
    ]).map((id)=>categories[String(id)]?.name || FALLBACK_CATEGORY);
}
function toPublic(det, categories) {
    return {
        name: det.name,
        categories: categoryNames(det, categories),
        confidence: det.confidence,
        version: det.version || null,
        website: det.website || null,
        implied: !!det.implied
    };
}
function buildStackResult(input, detections, categories) {
    const technologies = detections.map((d)=>toPublic(d, categories));
    const grouped = {};
    for (const tech of technologies){
        for (const catName of tech.categories){
            (grouped[catName] ??= []).push(tech);
        }
    }
    return {
        url: input.url,
        finalUrl: input.finalUrl,
        analyzedAt: new Date().toISOString(),
        count: technologies.length,
        technologies,
        grouped,
        cached: false
    };
}
}),
"[project]/src/lib/redis.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getRedis",
    ()=>getRedis
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$upstash$2f$redis$2f$nodejs$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@upstash/redis/nodejs.mjs [app-route] (ecmascript) <locals>");
;
;
let client;
function getRedis() {
    if (client === undefined) {
        const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
        client = url && token ? new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$upstash$2f$redis$2f$nodejs$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Redis"]({
            url,
            token
        }) : null;
        if (!client && process.env.VERCEL_ENV === 'production') {
            console.warn('[stackfly] Redis não configurado: cache e rate limit ficam em memória, por instância. ' + 'Configure UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN para limites compartilhados.');
        }
    }
    return client;
}
}),
"[project]/src/lib/security/client-ip.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getClientId",
    ()=>getClientId
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:net [external] (node:net, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$ip$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/ip.ts [app-route] (ecmascript)");
;
;
function getClientId(headers, { trustProxyHeaders = false } = {}) {
    const onVercel = Boolean(process.env.VERCEL);
    if (!onVercel && !trustProxyHeaders) return 'local';
    const raw = headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0] || '';
    const ip = raw.trim();
    const family = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__["isIP"])(ip);
    if (family === 4) return ip;
    if (family === 6) {
        const groups = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$ip$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["expandIPv6"])(ip);
        if (groups) return `${groups.slice(0, 4).map((g)=>g.toString(16)).join(':')}::/64`;
    }
    return 'unknown';
}
}),
"[project]/src/lib/security/egress-proxy.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "startEgressProxy",
    ()=>startEgressProxy
]);
/**
 * Proxy HTTP local por onde passa TODO o tráfego do Chromium durante uma análise.
 *
 * Por que um proxy e não só `page.setRequestInterception`?
 *  - Interceptação vê a URL, mas quem resolve o DNS e conecta é o Chromium.
 *    Um domínio com TTL 0 pode responder IP público na checagem e
 *    169.254.169.254 na conexão (DNS rebinding).
 *  - Aqui o proxy resolve o nome, valida TODOS os IPs e conecta no IP já
 *    validado. O Chromium nunca resolve nomes por conta própria (com proxy
 *    HTTP configurado, quem resolve é o proxy).
 *  - Cobre tudo que sai pela pilha de rede do navegador: documento, redirects
 *    (cada salto é uma nova requisição), sub-recursos, iframes, fetch/XHR,
 *    workers, WebSockets (vão por CONNECT) e beacons.
 *
 * O que NÃO passa por aqui (e é tratado em browser.ts): QUIC/HTTP3 (desligado),
 * UDP do WebRTC (desligado via flag) e DNS prefetch (desligado).
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http__$5b$external$5d$__$28$node$3a$http$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:http [external] (node:http, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:net [external] (node:net, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$resolve$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/resolve.ts [app-route] (ecmascript)");
;
;
;
const CONNECT_TIMEOUT_MS = 10_000;
const IDLE_SOCKET_TIMEOUT_MS = 30_000;
// Cabeçalhos hop-by-hop que não devem ser repassados ao destino.
const HOP_BY_HOP = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'proxy-connection',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade'
]);
function parseAuthority(authority) {
    const m = authority.match(/^\[([^\]]+)\]:(\d+)$/) ?? authority.match(/^([^:]+):(\d+)$/);
    if (!m) return null;
    const port = Number(m[2]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return {
        host: m[1].toLowerCase(),
        port
    };
}
async function startEgressProxy(options) {
    const { policy, resolver, maxBytes } = options;
    const sockets = new Set();
    const blockedHosts = new Set();
    let bytesReceived = 0;
    let budgetExceeded = false;
    const track = (socket)=>{
        sockets.add(socket);
        socket.once('close', ()=>sockets.delete(socket));
    };
    const destroyAll = ()=>{
        for (const s of sockets)s.destroy();
    };
    // Conta bytes vindos do destino; estourou o orçamento → derruba tudo.
    const countBytes = (chunk)=>{
        bytesReceived += chunk.length;
        if (bytesReceived > maxBytes && !budgetExceeded) {
            budgetExceeded = true;
            destroyAll();
        }
    };
    async function connectUpstream(host, port) {
        let addresses;
        try {
            addresses = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$resolve$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveAllowedAddresses"])(host, port, policy, resolver);
        } catch (err) {
            if (err instanceof __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$resolve$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BlockedDestinationError"]) blockedHosts.add(host);
            throw err;
        }
        // Conecta no IP validado — nunca no nome.
        const { address } = addresses[0];
        return new Promise((resolve, reject)=>{
            const upstream = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__["default"].connect({
                host: address,
                port
            });
            track(upstream);
            upstream.setTimeout(CONNECT_TIMEOUT_MS, ()=>upstream.destroy(new Error('connect timeout')));
            upstream.once('connect', ()=>{
                upstream.setTimeout(IDLE_SOCKET_TIMEOUT_MS, ()=>upstream.destroy());
                resolve(upstream);
            });
            upstream.once('error', reject);
        });
    }
    const server = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http__$5b$external$5d$__$28$node$3a$http$2c$__cjs$29$__["default"].createServer();
    server.on('connection', (socket)=>track(socket));
    server.on('clientError', (_err, socket)=>socket.destroy());
    // HTTPS e WebSockets: túnel CONNECT host:porta. O TLS continua ponta a ponta
    // (o Chromium valida o certificado do nome original).
    server.on('connect', async (req, client, head)=>{
        client.on('error', ()=>client.destroy());
        const target = parseAuthority(req.url ?? '');
        if (!target || budgetExceeded) {
            client.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            return;
        }
        let upstream;
        try {
            upstream = await connectUpstream(target.host, target.port);
        } catch (err) {
            const status = err instanceof __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$resolve$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BlockedDestinationError"] ? '403 Forbidden' : '502 Bad Gateway';
            client.end(`HTTP/1.1 ${status}\r\n\r\n`);
            return;
        }
        if (client.destroyed) {
            upstream.destroy();
            return;
        }
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        upstream.on('data', countBytes);
        upstream.pipe(client);
        client.pipe(upstream);
        upstream.on('error', ()=>client.destroy());
        upstream.on('close', ()=>client.destroy());
        client.on('close', ()=>upstream.destroy());
    });
    // HTTP simples: o Chromium manda a requisição em "absolute-form"
    // (GET http://host/caminho). Repassamos para o IP validado.
    server.on('request', async (req, res)=>{
        let target;
        try {
            target = new URL(req.url ?? '');
        } catch  {
            res.writeHead(400).end();
            return;
        }
        // Atenção: para HTTP simples, qualquer resposta que o proxy mandar é
        // tratada pelo Chromium como se fosse a página do site (um 403 daqui
        // viraria uma "análise bem-sucedida" de uma página vazia). Por isso, em
        // caso de recusa/falha, a conexão é derrubada — o navegador vê erro de
        // rede, como com o CONNECT recusado.
        if (target.protocol !== 'http:' || budgetExceeded) {
            req.socket.destroy();
            return;
        }
        const port = target.port ? Number(target.port) : 80;
        const host = target.hostname.replace(/^\[|\]$/g, '').toLowerCase();
        let upstreamSocket;
        try {
            upstreamSocket = await connectUpstream(host, port);
        } catch  {
            req.socket.destroy();
            return;
        }
        const headers = {};
        for (const [name, value] of Object.entries(req.headers)){
            if (!HOP_BY_HOP.has(name) && value !== undefined) headers[name] = value;
        }
        headers.host = target.host;
        const upstreamReq = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http__$5b$external$5d$__$28$node$3a$http$2c$__cjs$29$__["default"].request({
            createConnection: ()=>upstreamSocket,
            method: req.method,
            path: `${target.pathname}${target.search}`,
            headers,
            setHost: false
        });
        upstreamReq.on('response', (upstreamRes)=>{
            const resHeaders = {};
            for (const [name, value] of Object.entries(upstreamRes.headers)){
                if (!HOP_BY_HOP.has(name) && value !== undefined) resHeaders[name] = value;
            }
            res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.statusMessage, resHeaders);
            upstreamRes.on('data', countBytes);
            upstreamRes.pipe(res);
            upstreamRes.on('error', ()=>res.destroy());
        });
        upstreamReq.on('error', ()=>req.socket.destroy());
        res.on('close', ()=>upstreamReq.destroy());
        req.pipe(upstreamReq);
    });
    // ws:// em texto puro chegaria como Upgrade; o Chromium usa CONNECT para
    // WebSockets via proxy, então qualquer Upgrade aqui é recusado.
    server.on('upgrade', (_req, socket)=>socket.destroy());
    await new Promise((resolve, reject)=>{
        server.once('error', reject);
        server.listen(0, '127.0.0.1', ()=>resolve());
    });
    const { port } = server.address();
    return {
        url: `http://127.0.0.1:${port}`,
        blockedHosts,
        get budgetExceeded () {
            return budgetExceeded;
        },
        get bytesReceived () {
            return bytesReceived;
        },
        close: ()=>new Promise((resolve)=>{
                destroyAll();
                server.close(()=>resolve());
            })
    };
}
}),
"[project]/src/lib/security/ip.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ALLOWED_PORTS",
    ()=>ALLOWED_PORTS,
    "defaultAddressPolicy",
    ()=>defaultAddressPolicy,
    "expandIPv6",
    ()=>expandIPv6,
    "isPublicAddress",
    ()=>isPublicAddress
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:net [external] (node:net, cjs)");
;
// Faixas que nunca devem ser acessadas pelo analisador: loopback, redes
// privadas, link-local (inclui o endpoint de metadados 169.254.169.254),
// CGNAT, multicast, documentação, reservadas etc.
const blockedV4 = new __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__["BlockList"]();
for (const [net, prefix] of [
    [
        '0.0.0.0',
        8
    ],
    [
        '10.0.0.0',
        8
    ],
    [
        '100.64.0.0',
        10
    ],
    [
        '127.0.0.0',
        8
    ],
    [
        '169.254.0.0',
        16
    ],
    [
        '172.16.0.0',
        12
    ],
    [
        '192.0.0.0',
        24
    ],
    [
        '192.0.2.0',
        24
    ],
    [
        '192.88.99.0',
        24
    ],
    [
        '192.168.0.0',
        16
    ],
    [
        '198.18.0.0',
        15
    ],
    [
        '198.51.100.0',
        24
    ],
    [
        '203.0.113.0',
        24
    ],
    [
        '224.0.0.0',
        4
    ],
    [
        '240.0.0.0',
        4
    ]
]){
    blockedV4.addSubnet(net, prefix, 'ipv4');
}
// Para IPv6 só aceitamos unicast global (2000::/3), menos as faixas especiais
// dentro dele. Endereços com IPv4 embutido são tratados à parte.
const globalUnicastV6 = new __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__["BlockList"]();
globalUnicastV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__["BlockList"]();
for (const [net, prefix] of [
    [
        '2001::',
        23
    ],
    [
        '2001:db8::',
        32
    ],
    [
        '2002::',
        16
    ],
    [
        '3fff::',
        20
    ]
]){
    blockedV6.addSubnet(net, prefix, 'ipv6');
}
function expandIPv6(address) {
    let addr = address.toLowerCase();
    if (addr.includes('%')) return null; // zone id — só faz sentido em link-local
    const v4Match = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
    if (v4Match) {
        const octets = v4Match[1].split('.').map(Number);
        if (octets.some((o)=>o > 255)) return null;
        const hi = (octets[0] << 8 | octets[1]).toString(16);
        const lo = (octets[2] << 8 | octets[3]).toString(16);
        addr = addr.slice(0, -v4Match[1].length) + `${hi}:${lo}`;
    }
    const halves = addr.split('::');
    if (halves.length > 2) return null;
    const head = halves[0] ? halves[0].split(':') : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const missing = 8 - head.length - tail.length;
    if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
    const groups = [
        ...head,
        ...Array(halves.length === 2 ? missing : 0).fill('0'),
        ...tail
    ];
    const parsed = groups.map((g)=>/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN);
    return parsed.some(Number.isNaN) ? null : parsed;
}
function embeddedV4(groups) {
    const [a, b] = [
        groups[6],
        groups[7]
    ];
    return `${a >> 8}.${a & 0xff}.${b >> 8}.${b & 0xff}`;
}
function isPublicAddress(ip) {
    const family = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__["isIP"])(ip);
    if (family === 4) return !blockedV4.check(ip, 'ipv4');
    if (family !== 6) return false;
    const groups = expandIPv6(ip);
    if (!groups) return false;
    const first80Zero = groups.slice(0, 5).every((g)=>g === 0);
    // ::ffff:a.b.c.d (IPv4-mapped) e ::a.b.c.d (IPv4-compatible, obsoleto)
    if (first80Zero && (groups[5] === 0xffff || groups[5] === 0)) {
        if (groups[5] === 0) return false; // inclui :: e ::1
        return isPublicAddress(embeddedV4(groups));
    }
    // NAT64 (64:ff9b::/96): o destino real é o IPv4 embutido
    if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((g)=>g === 0)) {
        return isPublicAddress(embeddedV4(groups));
    }
    const canonical = groups.map((g)=>g.toString(16)).join(':');
    return globalUnicastV6.check(canonical, 'ipv6') && !blockedV6.check(canonical, 'ipv6');
}
const ALLOWED_PORTS = new Set([
    80,
    443,
    8080,
    8443
]);
const defaultAddressPolicy = (ip, port)=>ALLOWED_PORTS.has(port) && isPublicAddress(ip);
}),
"[project]/src/lib/security/rate-limit.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MemoryRateLimiter",
    ()=>MemoryRateLimiter,
    "RedisRateLimiter",
    ()=>RedisRateLimiter
]);
// Janela fixa, como o MemoryStore do express-rate-limit usado antes:
// N requisições por IP a cada `windowMs`.
function windowOf(windowMs, now = Date.now()) {
    const index = Math.floor(now / windowMs);
    return {
        index,
        resetMs: (index + 1) * windowMs - now
    };
}
function toResult(count, max, resetMs) {
    return {
        allowed: count <= max,
        limit: max,
        remaining: Math.max(0, max - count),
        resetMs
    };
}
class MemoryRateLimiter {
    windowMs;
    max;
    hits;
    constructor(windowMs, max){
        this.windowMs = windowMs;
        this.max = max;
        this.hits = new Map();
    }
    async check(id) {
        const { index, resetMs } = windowOf(this.windowMs);
        const entry = this.hits.get(id);
        const count = entry && entry.index === index ? entry.count + 1 : 1;
        this.hits.set(id, {
            index,
            count
        });
        if (this.hits.size > 10_000) this.prune(index);
        return toResult(count, this.max, resetMs);
    }
    prune(currentIndex) {
        for (const [key, entry] of this.hits){
            if (entry.index !== currentIndex) this.hits.delete(key);
        }
    }
}
class RedisRateLimiter {
    redis;
    windowMs;
    max;
    fallback;
    constructor(redis, windowMs, max){
        this.redis = redis;
        this.windowMs = windowMs;
        this.max = max;
        this.fallback = new MemoryRateLimiter(windowMs, max);
    }
    async check(id) {
        const { index, resetMs } = windowOf(this.windowMs);
        const key = `stackfly:v1:rl:${index}:${id}`;
        try {
            const [count] = await this.redis.multi().incr(key).pexpire(key, this.windowMs * 2).exec();
            return toResult(count, this.max, resetMs);
        } catch (err) {
            // Redis fora do ar não pode desligar o limite: cai para o limite local.
            console.error('[stackfly] rate limit no Redis falhou; usando limite em memória:', err);
            return this.fallback.check(id);
        }
    }
}
}),
"[project]/src/lib/security/resolve.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BlockedDestinationError",
    ()=>BlockedDestinationError,
    "resolveAllowedAddresses",
    ()=>resolveAllowedAddresses,
    "systemResolver",
    ()=>systemResolver
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$dns$2f$promises__$5b$external$5d$__$28$node$3a$dns$2f$promises$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:dns/promises [external] (node:dns/promises, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:net [external] (node:net, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/errors.ts [app-route] (ecmascript)");
;
;
;
const systemResolver = (hostname)=>(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$dns$2f$promises__$5b$external$5d$__$28$node$3a$dns$2f$promises$2c$__cjs$29$__["lookup"])(hostname, {
        all: true,
        verbatim: true
    });
const DNS_TIMEOUT_MS = 5_000;
class BlockedDestinationError extends __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"] {
    host;
    constructor(host){
        super('BLOCKED_TARGET', 'O endereço informado aponta para um destino não permitido.'), this.host = host;
    }
}
function withTimeout(promise, ms) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject)=>{
            timer = setTimeout(()=>reject(new Error(`DNS lookup timeout after ${ms}ms`)), ms);
        })
    ]).finally(()=>clearTimeout(timer));
}
async function resolveAllowedAddresses(hostname, port, policy, resolver = systemResolver) {
    const host = hostname.replace(/^\[|\]$/g, '');
    let addresses;
    if ((0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__["isIP"])(host)) {
        addresses = [
            {
                address: host,
                family: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__["isIP"])(host)
            }
        ];
    } else {
        try {
            addresses = await withTimeout(resolver(host), DNS_TIMEOUT_MS);
        } catch (err) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('DNS_RESOLUTION_FAILED', 'Não foi possível resolver o domínio informado.', {
                cause: err
            });
        }
    }
    if (addresses.length === 0) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('DNS_RESOLUTION_FAILED', 'Não foi possível resolver o domínio informado.');
    }
    if (!addresses.every(({ address })=>policy(address, port))) {
        throw new BlockedDestinationError(host);
    }
    return addresses;
}
}),
"[project]/src/lib/security/url.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "legacyNormalize",
    ()=>legacyNormalize,
    "parseTargetUrl",
    ()=>parseTargetUrl
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:net [external] (node:net, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/errors.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$ip$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/ip.ts [app-route] (ecmascript)");
;
;
;
const MAX_URL_LENGTH = 2048;
// Nomes que nunca resolvem para algo público. É só uma camada extra com
// mensagem de erro melhor — a proteção de verdade é a checagem de IP depois
// da resolução DNS (resolve.ts) e no proxy de saída (egress-proxy.ts).
const BLOCKED_HOST_SUFFIXES = [
    'localhost',
    'local',
    'internal',
    'intranet',
    'lan',
    'home.arpa'
];
const EXPLICIT_SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i;
// Esquemas que não usam "//" mas não podem virar "https://javascript:..."
const BARE_SCHEME = /^(javascript|data|file|about|blob|chrome|view-source|mailto|ftp|ws|wss):/i;
function legacyNormalize(input) {
    const url = input.trim();
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
function invalid(message = 'Informe uma URL válida.') {
    return new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('INVALID_URL', message);
}
function blocked() {
    return new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('BLOCKED_TARGET', 'O endereço informado aponta para um destino não permitido.');
}
function parseTargetUrl(raw) {
    if (typeof raw !== 'string' || raw.trim() === '') {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('MISSING_URL', 'Informe ?url= com o site a analisar.');
    }
    const input = raw.trim();
    if (input.length > MAX_URL_LENGTH) throw invalid('URL muito longa.');
    const scheme = input.match(EXPLICIT_SCHEME)?.[1] ?? input.match(BARE_SCHEME)?.[1];
    if (scheme && !/^https?$/i.test(scheme)) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('UNSUPPORTED_PROTOCOL', 'Apenas URLs http:// e https:// são aceitas.');
    }
    const display = legacyNormalize(input);
    let url;
    try {
        url = new URL(display);
    } catch  {
        throw invalid();
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StackflyError"]('UNSUPPORTED_PROTOCOL', 'Apenas URLs http:// e https:// são aceitas.');
    }
    if (url.username || url.password) throw invalid('URLs com usuário/senha não são aceitas.');
    // O parser WHATWG já normaliza representações alternativas de IPv4
    // (2130706433, 0x7f.1, 127.1 → 127.0.0.1) e lowercase no host.
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!host) throw invalid();
    const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$ip$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ALLOWED_PORTS"].has(port)) throw blocked();
    if ((0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$net__$5b$external$5d$__$28$node$3a$net$2c$__cjs$29$__["isIP"])(host)) {
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$ip$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isPublicAddress"])(host)) throw blocked();
    } else {
        const bare = host.replace(/\.$/, '');
        if (!bare.includes('.')) throw blocked(); // nomes de rede interna ("intranet", "db")
        if (BLOCKED_HOST_SUFFIXES.some((s)=>bare === s || bare.endsWith(`.${s}`))) throw blocked();
    }
    url.hash = '';
    return {
        url,
        cacheKey: url.href,
        display,
        port
    };
}
}),
"[project]/src/lib/services.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAnalyzer",
    ()=>getAnalyzer,
    "getRateLimiter",
    ()=>getRateLimiter
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyzer$2f$analyze$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analyzer/analyze.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyzer$2f$browser$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analyzer/browser.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyzer$2f$collect$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analyzer/collect.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$cache$2f$result$2d$cache$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/cache/result-cache.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fingerprints$2f$dataset$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/fingerprints/dataset.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fingerprints$2f$matcher$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/fingerprints/matcher.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$redis$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/redis.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$ip$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/ip.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$rate$2d$limit$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/rate-limit.ts [app-route] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
// Instâncias de produção, criadas uma vez por instância da função.
let analyzer = null;
let rateLimiter = null;
let jsPaths = null;
function getAnalyzer() {
    if (!analyzer) {
        const redis = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$redis$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getRedis"])();
        analyzer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyzer$2f$analyze$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createAnalyzer"])({
            cache: redis ? new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$cache$2f$result$2d$cache$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["RedisResultCache"](redis, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["config"].cacheTtlMs) : new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$cache$2f$result$2d$cache$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["MemoryResultCache"](__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["config"].cacheTtlMs),
            dataset: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fingerprints$2f$dataset$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["loadDataset"],
            policy: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$ip$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["defaultAddressPolicy"],
            maxConcurrent: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["config"].maxConcurrentAnalyses,
            totalTimeoutMs: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["config"].totalTimeoutMs,
            collect: async (url, { deadlineMs })=>{
                jsPaths ??= (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fingerprints$2f$matcher$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["collectJsPaths"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fingerprints$2f$dataset$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["loadDataset"])().technologies);
                const browser = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyzer$2f$browser$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getBrowser"])();
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyzer$2f$collect$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["collectPageData"])(url, {
                    browser,
                    policy: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$ip$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["defaultAddressPolicy"],
                    jsPaths,
                    navigationTimeoutMs: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["config"].navigationTimeoutMs,
                    settleTimeoutMs: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["config"].settleTimeoutMs,
                    deadlineMs,
                    maxDownloadBytes: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["config"].maxDownloadBytes
                });
            }
        });
    }
    return analyzer;
}
function getRateLimiter() {
    if (!rateLimiter) {
        const redis = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$redis$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getRedis"])();
        rateLimiter = redis ? new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$rate$2d$limit$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["RedisRateLimiter"](redis, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["config"].rateLimitWindowMs, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["config"].rateLimitMax) : new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$rate$2d$limit$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["MemoryRateLimiter"](__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["config"].rateLimitWindowMs, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["config"].rateLimitMax);
    }
    return rateLimiter;
}
}),
]})(),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[externals]/node:dns/promises [external] (node:dns/promises, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:dns/promises", () => require("node:dns/promises"));

module.exports = mod;
}),
"[externals]/node:fs [external] (node:fs, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:fs", () => require("node:fs"));

module.exports = mod;
}),
"[externals]/node:http [external] (node:http, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:http", () => require("node:http"));

module.exports = mod;
}),
"[externals]/node:net [external] (node:net, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:net", () => require("node:net"));

module.exports = mod;
}),
"[externals]/node:path [external] (node:path, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:path", () => require("node:path"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__07_74oj3z5zda._.js.map