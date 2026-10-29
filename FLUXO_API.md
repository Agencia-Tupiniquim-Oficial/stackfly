# Fluxo de API — Stackfly

Como uma requisição entra no sistema e chega até a resposta final com as
tecnologias detectadas.

---

## Visão geral

```
Cliente (interface web / curl / app)
        │
        │  GET  /api/v1/stack?url=…   ← API pública e interface web
        │  POST /api/analyze          ← rota legada (mesma lógica)
        ▼
 [ Route Handler — src/app/api/v1/stack/route.ts ]   (runtime Node.js, maxDuration 60s)
        │
        ▼
 [ lib/api/stack-handler.ts ]
        │  1. rate limit por IP (Redis ou memória)       → 429
        │  2. parseTargetUrl(): sintaxe, esquema, porta,
        │     IP literal privado, localhost              → 400 / 403
        ▼
 [ lib/analyzer/analyze.ts ]
        │  3. resolve DNS e exige que TODOS os IPs sejam públicos → 403 / 502
        │  4. cache por URL canônica ── hit ──► resposta (cached: true)
        │  5. junta requisições simultâneas pra mesma URL
        │  6. fila: uma análise por vez por instância → 503 se esperar demais
        ▼
 [ lib/analyzer/collect.ts ]  (Chromium via Puppeteer)
        │  • página nova por análise; cookies e cache apagados no final
        │  • todo tráfego passa pelo proxy de saída (lib/security/egress-proxy.ts),
        │    com uma sessão por análise: resolve DNS → valida IP → conecta no
        │    IP validado; sem sessão aberta, o proxy recusa tudo
        │  • goto (DOMContentLoaded) + espera a rede acalmar (melhor esforço)
        │  • coleta HTML, headers, meta, cookies, script[src], globais JS
        │  • prazo duro: estourou → fecha a página (ou mata o Chromium) → 504
        ▼
 [ lib/fingerprints/matcher.ts ]
        │  • 6 canais: headers, meta, cookies, jsGlobals, html, scriptSrc
        │  • versão e confiança via metadados do padrão (\;version:\1)
        │  • expande tecnologias implicadas (WordPress → PHP, MySQL)
        ▼
 [ lib/fingerprints/result.ts ]
        │  • agrupa por categoria (categories.json)
        │  • grava no cache só se deu certo
        ▼
   Resposta JSON
```

---

## Proteção contra SSRF

A URL vem do usuário e é aberta por um navegador de verdade, que por sua vez
carrega o que a página mandar. Por isso a validação acontece em camadas:

| Camada | Onde | O que bloqueia |
|---|---|---|
| Sintaxe | `security/url.ts` | esquemas ≠ http/https, credenciais na URL, portas fora de 80/443/8080/8443, IP literal privado (inclusive `2130706433`, `0x7f.1`, `[::ffff:127.0.0.1]`, NAT64), `localhost`, `*.internal`, nomes sem ponto |
| DNS | `security/resolve.ts` | domínios que resolvem para IP não público (ex.: `127.0.0.1.nip.io`), respostas mistas |
| Rede do navegador | `security/egress-proxy.ts` | **toda** conexão do Chromium: documento, cada salto de redirect, sub-recursos, iframes, fetch/XHR, workers, WebSockets, beacons. O proxy resolve o nome, valida o IP e conecta no IP validado — o Chromium nunca resolve DNS sozinho, o que fecha o DNS rebinding |
| Flags do Chromium | `analyzer/browser.ts` | QUIC desligado (UDP não passaria pelo proxy), WebRTC sem UDP fora do proxy, sem DNS prefetch, `<-loopback>` (loopback também passa pelo proxy), proxy padrão "buraco negro" |
| Página | `analyzer/collect.ts` | só http/https/data/blob; `RTCPeerConnection` removido |

Os testes em `tests/browser/` abrem uma página maliciosa que tenta alcançar
um serviço local por todos esses caminhos e verificam que ele não recebe
nenhuma requisição (com um teste de controle provando que, sem a proteção, ele
receberia).

---

## Coleta de dados

| Canal | Como é coletado |
|-------|-----------------|
| `html` | `page.content()` depois do carregamento (até 2 MB) |
| `headersLower` | headers HTTP do documento principal, em minúsculas |
| `meta` | `meta[name]`, `meta[property]` |
| `cookies` | cookies da página → mapa `nome_minúsculo → valor` |
| `jsGlobals` | percorre `window.wp`, `window.React.version` etc. (lista extraída do dataset) |
| `scriptSrc` | `script[src]` (até 500) |
| `finalUrl` | URL após redirecionamentos |

Imagens, mídia e fontes não são baixadas (nenhum canal usa).

---

## Formato dos padrões

```
"regex\;version:\1\;confidence:75"
```

- A parte antes do primeiro `\;` é a regex (case-insensitive).
- `version:\1` → usa o grupo de captura como versão.
- `confidence:N` → confiança parcial (padrão 100).
- Chave presente sem regex (ex.: `"wp.ajax": ""`) conta como match.

Para cada tecnologia vale o melhor match (maior confiança; em empate, o que
trouxe versão). Depois, as tecnologias em `implies` que não foram detectadas
entram com `implied: true` (um nível).

---

## Estrutura da resposta e erros

Veja [`API_DOCS.md`](./API_DOCS.md).

---

## Arquivos envolvidos

```
src/app/api/v1/stack/route.ts   — rota pública (GET)
src/app/api/analyze/route.ts    — rota legada (POST)
src/lib/api/stack-handler.ts    — rate limit, validação, erros → JSON
src/lib/analyzer/analyze.ts     — orquestração (DNS, cache, deduplicação, fila)
src/lib/analyzer/browser.ts     — inicialização do Chromium (Vercel x local)
src/lib/analyzer/collect.ts     — Puppeteer: coleta da página
src/lib/security/*              — URL, IPs, DNS, proxy de saída, rate limit, IP do cliente
src/lib/cache/result-cache.ts   — cache (Redis ou memória)
src/lib/fingerprints/*          — dataset, matcher, montagem do resultado
data/technologies.json          — fingerprints (enthec/webappanalyzer)
data/categories.json            — ID de categoria → nome
```
