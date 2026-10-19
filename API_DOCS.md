# API pública Stackfly — v1

Endpoint aberto pra qualquer aplicação consultar a stack de tecnologia de um
site. Sem cadastro, sem chave de API.

## Endpoint

### `GET /api/v1/stack?url=<site>`

**Exemplo:**
```bash
curl "https://stackfly.suaempresa.com.br/api/v1/stack?url=exemplo.com.br"
```

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
    "CMS": [ "...mesmos objetos, agrupados por categoria..." ]
  },
  "cached": false
}
```

`cached: true` indica que o resultado veio do cache (ver TTL abaixo) em vez
de rodar uma nova varredura.

### Erros

| Status | Motivo |
|---|---|
| 400 | `url` ausente ou inválida |
| 429 | Limite de requisições excedido |
| 502 | Falha ao carregar/analisar o site alvo |

## Limites

- **Rate limit:** 10 requisições/minuto por IP (configurável via
  `RATE_LIMIT_MAX` e `RATE_LIMIT_WINDOW_MS`). É a única proteção contra
  abuso já que a API é totalmente aberta — vale reavaliar esse número
  conforme o volume de uso real depois do lançamento.
- **Cache:** resultados ficam em cache por 1h por URL (configurável via
  `CACHE_TTL_MS`), pra evitar repetir a varredura com Puppeteer pra quem
  consulta o mesmo site várias vezes seguidas.
- **CORS:** liberado pra qualquer origem — a API foi pensada pra ser
  chamada tanto do navegador quanto de servidores externos.
