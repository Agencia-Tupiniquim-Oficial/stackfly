# Stackfly

Ferramenta web + API pública, estilo Wappalyzer, pra identificar as
tecnologias usadas por um site: CMS, frameworks JS, e-commerce, analytics,
CDN, servidor etc. Nasceu pra apoiar as atividades de diagnóstico de site da
agência, e também expõe os dados como API aberta.

## Como funciona

1. Você informa uma URL na interface (ou chama a API).
2. O backend (Next.js + Puppeteer) valida o destino, abre a página num
   Chromium headless isolado e captura os headers HTTP, o HTML renderizado,
   cookies, `src` de scripts e variáveis JS conhecidas (`window.wp`,
   `window.React` etc.).
3. Esses dados são testados contra o dataset de fingerprints em
   `data/technologies.json` — **7.613 tecnologias**, vindas do fork
   open-source mantido pela comunidade (`enthec/webappanalyzer`), já que o
   repositório original da Wappalyzer fechou o código em 2023.
4. O resultado aparece agrupado por categoria, com nível de confiança e
   versão detectada (quando disponível).

Detalhes do fluxo e das camadas de segurança: [`FLUXO_API.md`](./FLUXO_API.md).
Contrato da API: [`API_DOCS.md`](./API_DOCS.md).

## Estrutura

```
src/
  app/
    page.tsx, layout.tsx, globals.css  → interface
    api/v1/stack/route.ts              → API pública (GET)
    api/analyze/route.ts               → rota legada (POST)
  components/                          → formulário e resultado (React)
  lib/
    analyzer/     → orquestração, Chromium, coleta da página
    fingerprints/ → dataset, matcher, montagem da resposta
    security/     → validação de URL, IPs, DNS, proxy de saída, rate limit
    cache/        → cache de resultados (Redis ou memória)
  types/          → tipos do contrato público
data/
  technologies.json → fingerprints (7.613 tecnologias)
  categories.json   → nomes das categorias
tests/              → unitários (vitest) e integração com Chromium (tests/browser)
```

## 1. Instalação

Requer **Node.js 22** (o `@sparticuz/chromium` exige `^22.17` ou `>=24`).

```bash
npm install
```

O `puppeteer` (devDependency) é quem fornece o Chrome para desenvolvimento
local. Versões recentes do npm não rodam scripts de `postinstall` sem
aprovação; se o Chrome não foi baixado, rode:

```bash
npx puppeteer browsers install chrome-headless-shell
```

> No npm 11.2.0 existe um bug do instalador (`Cannot read properties of null
> (reading 'edgesOut')`) com as dependências de teste. Se acontecer, atualize
> o npm ou rode `npx npm@latest install`.

## 2. Rodando localmente

```bash
npm run dev       # http://localhost:3000
```

Ou em modo produção:

```bash
npm run build
npm start
```

## 3. Variáveis de ambiente

Nenhuma é obrigatória para rodar localmente. Copie `.env.example` para
`.env.local` e ajuste o que precisar. As principais:

| Variável | Padrão | Para quê |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (ou `KV_REST_API_URL` / `KV_REST_API_TOKEN`) | — | Cache e rate limit compartilhados entre instâncias. **Recomendado em produção.** |
| `CACHE_TTL_MS` | `3600000` | Tempo de cache por URL |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `10` / `60000` | Rate limit por IP |
| `ANALYSIS_TOTAL_TIMEOUT_MS` | `45000` | Prazo total de uma análise |

Lista completa e comentada em [`.env.example`](./.env.example). Nenhuma
dessas variáveis vai para o navegador (não há nenhuma `NEXT_PUBLIC_*`).

## 4. Testes

```bash
npm test              # unitários: matcher, segurança, proxy, API, cache, rate limit
npm run test:browser  # integração com Chromium real (precisa do Chrome local)
npm run typecheck
npm run lint
```

- `tests/matcher.test.ts` compara o matcher com a saída do matcher original
  (`server/matcher.js`, versão Express) em `tests/fixtures/expected/`. Para
  gerar a saída de um fixture novo com o código antigo:
  `git show 312fbce:server/matcher.js > /tmp/matcher.js`.
- `tests/browser/` sobe sites de teste locais (WordPress, app renderizado no
  cliente, redirect, site lento, site fora do ar, página maliciosa) e roda o
  analisador de verdade. A página maliciosa tenta alcançar um "serviço
  interno" por script, iframe, fetch, XHR, WebSocket, worker, beacon,
  redirect e DNS rebinding — o teste exige zero acessos.

## 5. Build

```bash
npm run build
```

## 6. Deploy na Vercel

1. Em vercel.com → **Add New → Project**, importe o repositório. O
   `vercel.json` fixa o framework (Next.js) e o diretório de saída (`.next`),
   sobrescrevendo configurações antigas do painel (o projeto já esteve
   configurado como site estático com saída em `public`).
2. **Node.js:** a versão vem do `engines` do `package.json` (`22.x`).
3. **Redis (recomendado):** em **Storage / Marketplace**, adicione
   **Upstash for Redis** e conecte ao projeto. As variáveis
   `KV_REST_API_URL`/`KV_REST_API_TOKEN` são criadas automaticamente. Sem
   isso, cache e rate limit ficam por instância (um aviso aparece no log).
4. Opcional: ajuste as variáveis da seção 3 em **Settings → Environment
   Variables**.
5. Deploy. Teste com
   `curl "https://SEU-PROJETO.vercel.app/api/v1/stack?url=wordpress.org"`.

### Como o Chromium roda na Vercel

- `puppeteer-core@25.11.0` + `@sparticuz/chromium@153.0.0` — os dois
  correspondem ao Chrome 153; **atualize os dois juntos**.
- O binário (≈ 67 MB comprimido) vai no bundle da função via
  `outputFileTracingIncludes` em `next.config.ts`; a função fica com ≈ 73 MB
  (limite da Vercel: 250 MB). Na primeira execução de cada instância ele é
  descompactado em `/tmp` (cold start de alguns segundos).
- A rota usa runtime Node.js e `maxDuration = 60` — dentro do limite de todos
  os planos. O prazo interno da análise é 45s.
- Memória: o `@sparticuz/chromium` recomenda ≥ 1600 MB. No Hobby a memória é
  fixa (2 GB); no Pro dá para ajustar em **Settings → Functions**.
- Um navegador por instância, reaproveitado entre requisições, fazendo uma
  análise por vez (o Chromium da Vercel roda com `--single-process`, que não
  suporta contextos isolados). Cada análise abre uma sessão no proxy de saída
  e, no final, a página é fechada e cookies/cache são apagados.

## 7. Problemas comuns do Puppeteer

| Sintoma | Causa provável / solução |
|---|---|
| `503 BROWSER_UNAVAILABLE` localmente | Chrome não baixado: `npx puppeteer browsers install chrome-headless-shell`, ou aponte `CHROME_EXECUTABLE_PATH` para um Chrome/Chromium instalado |
| `503 BROWSER_UNAVAILABLE` na Vercel | Veja o log da função. `ENOENT ... chromium.br` → os binários não entraram no bundle (confira `outputFileTracingIncludes`). Erro de versão/protocolo → `puppeteer-core` e `@sparticuz/chromium` desalinhados |
| Erro de sandbox em Docker/Linux como root | `CHROME_NO_SANDBOX=true` |
| `504 TIMEOUT` frequente | Site lento ou com anti-bot. Ajuste `ANALYSIS_NAVIGATION_TIMEOUT_MS` (mantendo `ANALYSIS_TOTAL_TIMEOUT_MS` < 60s) |
| `503 SERVER_BUSY` | Fila longa na mesma instância (cada instância faz uma análise por vez). Normalmente passa sozinho; a Vercel abre novas instâncias com o volume |
| `NAVIGATION_FAILED` com `Target closed` no log | Página criada em `BrowserContext` separado: não funciona com `--single-process`. Use o contexto padrão (ver `collect.ts`) |
| Site detecta poucas tecnologias | Anti-bot/CAPTCHA bloqueando o headless; ou a tecnologia só aparece após interação |

## Limitações conhecidas

- **Serverless:** o `@sparticuz/chromium` roda com `--single-process`. Uma
  página que trava o JS (loop infinito) trava o navegador da instância; o
  prazo da análise detecta isso, mata o processo e o próximo pedido relança
  o Chromium. Por causa do processo único, cada instância faz uma análise
  por vez; picos de tráfego dependem de a Vercel abrir mais instâncias.
- **Rate limit:** janela fixa por IP (como antes). IPv6 é agrupado por /64.
  Sem Redis, cada instância conta separado. Para abuso em larga escala,
  combine com as regras de rate limit do **Vercel Firewall**.
- **Deduplicação** de análises simultâneas para a mesma URL vale só dentro
  de uma instância.
- **Detecção:** o matcher usa 6 canais (headers, meta, cookies, JS, HTML,
  scriptSrc). Campos do dataset como `dom`, `css`, `xhr`, `dns`, `requires`
  e `excludes` são preservados no JSON, mas — como na versão anterior — não
  são avaliados. `implies` é resolvido em um nível: uma tecnologia inferida
  não gera novas inferências.
- **Vulnerabilidade conhecida:** `npm audit` aponta o `zod` usado pelo
  `chromium-bidi` (dependência do Puppeteer). Esse caminho só é usado com o
  protocolo WebDriver BiDi; o Stackfly usa CDP. A correção exige
  `puppeteer-core` ≥ 25.13 (Chrome 155+), e o `@sparticuz/chromium` mais
  recente é o 153 — atualizar só um dos dois quebra a compatibilidade.
- Sites que dependem fortemente de anti-bot/CAPTCHA podem bloquear o
  Chromium headless.
- O dataset é uma "foto" do ruleset da comunidade.

## Atualizando o dataset de fingerprints

Baixe de novo o fork mantido pela comunidade e re-gere o `technologies.json`:

```bash
git clone --depth 1 https://github.com/enthec/webappanalyzer.git /tmp/wappalyzer-src
python3 - <<'PYEOF'
import json, glob
merged = {}
for f in sorted(glob.glob('/tmp/wappalyzer-src/src/technologies/*.json')):
    merged.update(json.load(open(f)))
json.dump(merged, open('data/technologies.json', 'w'), ensure_ascii=False)
PYEOF
npm test   # o teste de contagem (7.613) vai falhar: atualize o número esperado
```

## Licença do dataset

O `data/technologies.json` deriva do repositório `enthec/webappanalyzer`,
licenciado sob GPL-3.0. Mantenha a atribuição se for redistribuir.
