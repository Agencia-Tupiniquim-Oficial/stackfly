# Fluxo de API — Stackfly

Como uma requisição entra no sistema e chega até a resposta final com as tecnologias detectadas.

---

## Visão geral

```
Cliente (browser / curl / app)
        │
        │  POST /api/analyze          ← UI web (mesma origem)
        │  GET  /api/v1/stack?url=…   ← API pública
        ▼
   [ Express server.js ]
        │
        ├── Cache hit? ──── sim ──► retorna resultado em memória (cached: true)
        │
        └── Cache miss
              │
              ▼
        [ analyze.js — fetchPageData() ]
              │  Puppeteer (Chromium headless)
              │  • carrega a URL alvo (networkidle2, timeout 30s)
              │  • coleta HTML, headers, meta tags, cookies, srcs de scripts
              │  • avalia variáveis globais JS no contexto da página
              ▼
        [ matcher.js — detectTechnologies() ]
              │  Fingerprints do Wappalyzer (technologies.json)
              │  • testa 6 canais: headers, meta, cookies, jsGlobals, html, scriptSrc
              │  • resolve versão e confiança via regex com metadados (;\version:\1)
              │  • expande tecnologias implicadas (ex: WordPress → PHP, MySQL)
              ▼
        [ server.js — analyzeUrl() ]
              │  • agrupa detecções por categoria (categories.json)
              │  • salva resultado no TtlCache (TTL 1h padrão)
              ▼
        Resposta JSON
```

---

## Etapas detalhadas

### 1. Entrada — duas rotas, mesma lógica

| Rota | Método | Caller típico | Proteção |
|------|--------|---------------|----------|
| `/api/analyze` | `POST` body `{ url }` | UI web (index.html) | sem rate limit (mesma origem) |
| `/api/v1/stack?url=` | `GET` query string | qualquer cliente externo | rate limit 10 req/min por IP · CORS aberto |

Ambas chamam `analyzeUrl(rawUrl)` — ponto único de lógica.

---

### 2. Normalização de URL

```
"exemplo.com.br"  →  "https://exemplo.com.br"
```

`normalizeUrl()` adiciona `https://` se o esquema estiver ausente. Nenhuma validação adicional — URLs inválidas deixam o Puppeteer falhar na etapa seguinte (erro 500/502 para o cliente).

---

### 3. Verificação de cache (`TtlCache`)

- Chave: URL normalizada.
- Hit → resposta imediata com `cached: true`, sem abrir Puppeteer.
- Miss → segue para `fetchPageData()`.
- TTL padrão: **1 hora** (env `CACHE_TTL_MS`).
- Backend: `Map` em memória. Sem persistência entre restarts.

---

### 4. Coleta de dados — `fetchPageData()` (`analyze.js`)

Abre um browser Chromium headless via Puppeteer e coleta:

| Canal | Como é coletado |
|-------|-----------------|
| `html` | `page.content()` após carregamento completo |
| `headersLower` | evento `response` + `page.goto()` — headers HTTP do documento raiz, normalizados para lowercase |
| `meta` | `page.evaluate` → `querySelectorAll('meta[name], meta[property]')` |
| `cookies` | `page.cookies()` → mapa `nome_lowercase → valor` |
| `jsGlobals` | `page.evaluate` → percorre paths do tipo `window.wp`, `window.React` etc. (lista extraída dinamicamente de `technologies.json`) |
| `scriptSrc` | `page.evaluate` → `querySelectorAll('script[src]')` |
| `finalUrl` | `page.url()` após possíveis redirects |

> Timeout de navegação: **30 segundos** (`waitUntil: 'networkidle2'`).  
> O browser é sempre fechado no bloco `finally`, mesmo em erro.

---

### 5. Detecção de tecnologias — `detectTechnologies()` (`matcher.js`)

Itera sobre todos os fingerprints de `technologies.json` (formato Wappalyzer).

**Para cada tecnologia**, testa 6 grupos de canais nessa ordem:

```
headers     → chave:valor com lookup case-insensitive
meta        → chave:valor (name/property de meta tags)
cookies     → chave:valor case-insensitive
jsGlobals   → presença/valor de variável global (case-sensitive)
html        → regex contra HTML completo
scriptSrc   → regex contra lista de src de scripts (joined por \n)
```

**Formato dos padrões:**

```
"regex\;version:\1\;confidence:75"
```

- A parte antes do primeiro `\;` é a regex.
- `version:\1` → usa grupo de captura para extrair a versão.
- `confidence:N` → confiança parcial (padrão 100).
- Presença de chave em `jsGlobals` sem regex conta como match com confiança 100.

**Melhor match:** para cada tecnologia, mantém apenas o resultado com maior confiança; em empate, prioriza quem trouxe versão.

**Tecnologias implicadas:** após o loop principal, percorre o campo `implies` de cada detecção e adiciona as tecnologias ausentes com `confidence: 100` e `implied: true`.

> Exemplo: `WordPress` implica `PHP` e `MySQL`.

**Resultado:** array ordenado por confiança decrescente.

---

### 6. Agrupamento e serialização — `analyzeUrl()` (`server.js`)

- Mapeia IDs numéricos de categoria para nomes legíveis via `categories.json`.
- Constrói o objeto `grouped`: `{ "CMS": [...], "Programming languages": [...] }`.
- Serializa cada tecnologia para o formato de resposta pública (remove campos internos como `icon`, `implies`).
- Salva no cache e retorna.

---

## Estrutura da resposta

```json
{
  "url": "https://exemplo.com.br",
  "finalUrl": "https://exemplo.com.br/",
  "analyzedAt": "2026-10-16T14:00:00.000Z",
  "count": 4,
  "technologies": [
    {
      "name": "WordPress",
      "categories": ["CMS", "Blogs"],
      "confidence": 100,
      "version": "6.5",
      "website": "https://wordpress.org",
      "implied": false
    },
    {
      "name": "PHP",
      "categories": ["Programming languages"],
      "confidence": 100,
      "version": null,
      "website": "https://php.net",
      "implied": true
    }
  ],
  "grouped": {
    "CMS": ["..."],
    "Programming languages": ["..."]
  },
  "cached": false
}
```

| Campo | Descrição |
|-------|-----------|
| `url` | URL normalizada enviada na requisição |
| `finalUrl` | URL após redirects (capturada pelo Puppeteer) |
| `analyzedAt` | Timestamp ISO 8601 da análise |
| `count` | Total de tecnologias detectadas (incluindo implicadas) |
| `technologies` | Lista ordenada por confiança decrescente |
| `grouped` | Mesmos objetos indexados por nome de categoria |
| `cached` | `true` se o resultado veio do cache em memória |

---

## Erros

| Código | Situação |
|--------|----------|
| `400` | `url` ausente ou não-string |
| `429` | Rate limit excedido (só `/api/v1/stack`) |
| `500` | Falha interna na rota `/api/analyze` |
| `502` | Falha ao carregar/analisar o site na rota `/api/v1/stack` |

---

## Arquivos envolvidos

```
server/
├── server.js      — Express, rotas, cache, orquestração do fluxo
├── analyze.js     — Puppeteer: coleta HTML, headers, meta, cookies, JS globals
├── matcher.js     — Motor de fingerprint (formato Wappalyzer)
└── cache.js       — TtlCache: Map em memória com TTL configurável
data/
├── technologies.json  — Fingerprints (Wappalyzer ruleset)
└── categories.json    — Mapa ID numérico → nome de categoria
```
