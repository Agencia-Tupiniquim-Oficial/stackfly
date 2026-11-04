# API pública Stackfly — v1

Endpoint aberto pra qualquer aplicação consultar a stack de tecnologia de um
site. Sem cadastro. Chave de API opcional para cotas maiores (veja [Autenticação](#autenticação)).

## Endpoint

### `GET /api/v1/stack?url=<site>`

**Exemplo:**
```bash
curl "https://stackfly.suaempresa.com.br/api/v1/stack?url=exemplo.com.br"
```

O esquema é opcional (`exemplo.com.br` vira `https://exemplo.com.br`). Só
`http://` e `https://` são aceitos.

**Resposta (200):**
```json
{
  "url": "https://exemplo.com.br",
  "finalUrl": "https://exemplo.com.br/",
  "analyzedAt": "2026-09-10T20:40:00.000Z",
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
    "CMS": [ "...mesmos objetos de technologies, agrupados por categoria..." ]
  },
  "cached": false
}
```

| Campo | Descrição |
|-------|-----------|
| `url` | URL informada, normalizada (com `https://` se faltava o esquema) |
| `finalUrl` | URL após redirecionamentos |
| `analyzedAt` | Momento da análise (ISO 8601). Num resultado do cache, é o da análise original |
| `count` | Total de tecnologias (inclui as inferidas) |
| `technologies` | Ordenadas por confiança decrescente |
| `grouped` | Os mesmos objetos de `technologies`, indexados pelo nome da categoria |
| `cached` | `true` se veio do cache |

`implied: true` indica uma tecnologia inferida a partir de outra (ex.:
WordPress → PHP e MySQL), não detectada diretamente.

### Cabeçalhos de resposta

Todas as respostas (200 e erros) incluem:

| Cabeçalho | Exemplo | Descrição |
|---|---|---|
| `RateLimit-Limit` | `10` | Cota total da janela atual |
| `RateLimit-Remaining` | `7` | Requisições restantes na janela |
| `RateLimit-Reset` | `42` | Segundos até a janela reiniciar |

Quando o limite é atingido (429), a resposta acrescenta:

| Cabeçalho | Exemplo | Descrição |
|---|---|---|
| `Retry-After` | `42` | Segundos para aguardar antes de tentar novamente |

Use `Retry-After` para implementar backoff no chamador — nunca tente
novamente sem aguardar esse intervalo.

### Erros

Todos os erros vêm em JSON com uma mensagem e um código estável:

```json
{ "error": "O endereço informado aponta para um destino não permitido.", "code": "BLOCKED_TARGET" }
```

| Status | `code` | Motivo |
|---|---|---|
| 400 | `MISSING_URL` | `url` ausente ou vazia |
| 400 | `INVALID_URL` | URL malformada, longa demais ou com usuário/senha |
| 400 | `UNSUPPORTED_PROTOCOL` | Esquema diferente de `http`/`https` |
| 401 | `UNAUTHORIZED` | API key enviada mas inválida |
| 403 | `BLOCKED_TARGET` | Destino não público (localhost, rede privada, metadados de nuvem, porta não permitida) — inclusive se o site redirecionar para um destino assim |
| 429 | `RATE_LIMITED` | Limite de requisições excedido (veja `Retry-After`) |
| 500 | `INTERNAL_ERROR` | Erro interno |
| 502 | `DNS_RESOLUTION_FAILED` | Domínio não resolve |
| 502 | `NAVIGATION_FAILED` | Site inacessível, conexão recusada, limite de dados excedido |
| 503 | `SERVER_BUSY` | Muitas análises simultâneas — tente de novo em instantes |
| 503 | `BROWSER_UNAVAILABLE` | Falha ao iniciar o navegador de análise |
| 504 | `TIMEOUT` | O site demorou demais para responder |

Uma falha nunca devolve um resultado "vazio" com status 200.

> Portas aceitas: 80, 443, 8080 e 8443.

## Autenticação

Por padrão a API é aberta e limita por IP (10 req/min). Aplicações que
precisam de cota maior — como backends rodando em Edge Functions com IPs
compartilhados — podem usar uma **API key** para receber uma cota separada
(padrão 120 req/min), independente do limite público.

### Como obter uma chave

Fale com o time Stackfly. Uma chave é uma string aleatória de 32 bytes hex
(gerada com `openssl rand -hex 32`). Ela é configurada pelo operador da
instância via variável de ambiente `STACKFLY_API_KEYS`.

### Como enviar a chave

Duas formas equivalentes, escolha uma:

```bash
# Opção 1 — header dedicado
curl "https://stackfly.suaempresa.com.br/api/v1/stack?url=exemplo.com" \
  -H "X-Api-Key: SUA_CHAVE"

# Opção 2 — Bearer token
curl "https://stackfly.suaempresa.com.br/api/v1/stack?url=exemplo.com" \
  -H "Authorization: Bearer SUA_CHAVE"
```

```ts
// TypeScript / fetch
const res = await fetch(
  `https://stackfly.suaempresa.com.br/api/v1/stack?url=${encodeURIComponent(url)}`,
  { headers: { 'X-Api-Key': process.env.STACKFLY_API_KEY! } },
);
```

### Comportamento

| Situação | Rate limit aplicado | ID da cota |
|---|---|---|
| Sem header de chave | 10 req/min por IP | IP do chamador |
| Chave válida | 120 req/min (configurável) | A própria chave |
| Chave inválida | — | retorna `401 UNAUTHORIZED` |
| Feature desabilitada na instância | Ignora o header, usa limite por IP | IP do chamador |

Cotas de chave e de IP são **completamente independentes** — uma não consome
a outra.

## Limites

- **Rate limit:** duas faixas de cota, janela fixa de 1 minuto:
  - **Sem autenticação:** 10 req/min por IP (configurável via `RATE_LIMIT_MAX`).
  - **Com API key válida:** 120 req/min por chave (configurável via `RATE_LIMIT_MAX_WITH_KEY`).
  - Todas as respostas trazem `RateLimit-Limit`, `RateLimit-Remaining` e
    `RateLimit-Reset`; o 429 traz também `Retry-After` (segundos). Requisições
    inválidas também contam.
- **Cache:** resultados ficam em cache por 1h por URL (configurável via
  `CACHE_TTL_MS`). URLs equivalentes (`exemplo.com`, `https://EXEMPLO.com/`)
  compartilham a mesma entrada. Falhas não são cacheadas.
- **Tempo:** cada análise tem um prazo de ~45s. Sites que não carregam nesse
  tempo retornam `504`.
- **CORS:** liberado para qualquer origem. Os cabeçalhos `X-Api-Key` e
  `Authorization` estão incluídos em `Access-Control-Allow-Headers`, então a
  autenticação por chave funciona diretamente de chamadas no navegador
  (fetch/XHR cross-origin).

## Rota legada

`POST /api/analyze` com corpo `{ "url": "..." }` continua funcionando (era a
rota usada pela interface antiga) e devolve o mesmo JSON. Ela passa pelo mesmo
rate limit, pelas mesmas validações e aceita os mesmos headers de autenticação
(`X-Api-Key` / `Authorization: Bearer`). Prefira `GET /api/v1/stack`.

## Boas práticas para chamadores

### Tratar 429 explicitamente

Nunca ignore o status 429 — a resposta é JSON com `code: "RATE_LIMITED"` e o
cabeçalho `Retry-After` indica exatamente quantos segundos esperar:

```ts
async function analyzeStack(url: string): Promise<StackResult> {
  const res = await fetch(
    `https://stackfly.suaempresa.com.br/api/v1/stack?url=${encodeURIComponent(url)}`,
    { headers: { 'X-Api-Key': process.env.STACKFLY_API_KEY! } },
  );

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? 60);
    throw new Error(`Rate limit atingido. Tente novamente em ${retryAfter}s.`);
  }
  if (res.status === 401) {
    throw new Error('API key inválida.');
  }
  if (!res.ok) {
    const body = await res.json();
    throw new Error(`Erro ${res.status}: ${body.code}`);
  }

  return res.json();
}
```

### Cache no lado do chamador

O Stackfly já faz cache de resultados por 1h, mas adicionar cache local evita
requisições desnecessárias — útil em ambientes com IPs compartilhados ou cota
limitada:

```ts
const cache = new Map<string, { result: StackResult; expiresAt: number }>();

async function analyzeStackCached(url: string): Promise<StackResult> {
  const hit = cache.get(url);
  if (hit && Date.now() < hit.expiresAt) return hit.result;

  const result = await analyzeStack(url);
  cache.set(url, { result, expiresAt: Date.now() + 60 * 60 * 1000 }); // 1h
  return result;
}
```

> Em produção, prefira Redis/KV a um `Map` em memória — ele some a cada restart.

### Controlar a taxa de saída

Se sua aplicação dispara muitas análises em paralelo, limite a taxa de envio
para evitar atingir o teto antes do necessário:

```ts
// Enfileira as chamadas; libera no máximo `rate` por `windowMs`
class TokenBucket {
  private tokens: number;
  private lastRefill = Date.now();

  constructor(
    private rate: number,    // ex.: 100 (margem abaixo de 120)
    private windowMs: number // ex.: 60_000
  ) {
    this.tokens = rate;
  }

  async consume(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.windowMs) {
      this.tokens = this.rate;
      this.lastRefill = now;
    }
    if (this.tokens > 0) { this.tokens--; return; }
    await new Promise<void>((r) => setTimeout(r, this.windowMs - elapsed));
    this.tokens = this.rate - 1;
    this.lastRefill = Date.now();
  }
}

const bucket = new TokenBucket(100, 60_000);

async function analyzeStackThrottled(url: string): Promise<StackResult> {
  await bucket.consume();
  return analyzeStackCached(url);
}
```
