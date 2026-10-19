# Stackfly

Ferramenta web + API pública, estilo Wappalyzer, pra identificar as
tecnologias usadas por um site: CMS, frameworks JS, e-commerce, analytics,
CDN, servidor etc. Nasceu pra apoiar as atividades de diagnóstico de site da
agência, e agora também expõe os dados como API aberta.

## Como funciona

1. Você informa uma URL na interface (ou chama a API).
2. O backend (Node.js + Puppeteer) carrega a página num Chrome headless,
   captura os headers HTTP, o HTML renderizado, cookies, `src` de scripts e
   testa a presença de variáveis JS conhecidas (`window.wp`, `window.React`
   etc.).
3. Esses dados são testados contra o dataset de fingerprints em
   `data/technologies.json` — **7.613 tecnologias**, vindas do fork
   open-source mantido pela comunidade (`enthec/webappanalyzer`), já que o
   repositório original da Wappalyzer fechou o código em 2023.
4. O resultado aparece agrupado por categoria, com nível de confiança e
   versão detectada (quando disponível).

## Instalação

Requer Node.js 18+.

```bash
npm install
```

O `npm install` baixa o Puppeteer, que já vem com uma versão do Chromium
embutida (não precisa instalar Chrome separadamente).

## Rodando

```bash
npm start
```

Acesse `http://localhost:3000`.

## API pública

Além da interface web, dá pra consumir a análise programaticamente via
`GET /api/v1/stack?url=...` — **aberta, sem chave de API, sem cadastro**.
Veja [`API_DOCS.md`](./API_DOCS.md) para o guia completo (exemplo de
resposta, rate limit, cache).

A única proteção contra abuso é rate limit por IP (10 req/min por padrão).
Configurações de rate limit e cache ficam em variáveis de ambiente — veja
`.env.example`.

## Estrutura

```
server/
  server.js   → rotas Express (UI + API pública v1) + agrupamento por categoria
  analyze.js   → abre a página no Puppeteer e coleta os dados
  matcher.js    → motor de matching dos fingerprints
  cache.js      → cache em memória com TTL pros resultados de análise
data/
  technologies.json → dataset de fingerprints (7.613 tecnologias)
  categories.json     → nomes das categorias
public/
  index.html       → frontend (form + resultado)
```

## Atualizando o dataset de fingerprints

O dataset pode ficar desatualizado com o tempo. Pra atualizar, baixe de novo
o fork mantido pela comunidade e re-gere o `technologies.json`:

```bash
git clone --depth 1 https://github.com/enthec/webappanalyzer.git /tmp/wappalyzer-src
python3 - <<'PYEOF'
import json, glob
merged = {}
for f in sorted(glob.glob('/tmp/wappalyzer-src/src/technologies/*.json')):
    merged.update(json.load(open(f)))
json.dump(merged, open('data/technologies.json', 'w'), ensure_ascii=False)
PYEOF
```

## Limitações conhecidas

- Sites que dependem fortemente de anti-bot/CAPTCHA podem bloquear o
  Puppeteer.
- A detecção via variável JS só pega o que existe em `window` no momento em
  que a página termina de carregar (`networkidle2`) — SPAs muito lentas
  podem precisar de um timeout maior em `analyze.js`.
- O dataset é uma "foto" do ruleset da comunidade; a Wappalyzer oficial
  (paga) tem mais fingerprints e atualizações mais frequentes.
- Como a API é totalmente aberta, sem chave, o rate limit por IP é a única
  linha de defesa contra abuso — vale monitorar o uso depois do lançamento
  e reavaliar o limite (ou reconsiderar autenticação) se aparecer tráfego
  anômalo.

## Licença do dataset

O `data/technologies.json` deriva do repositório `enthec/webappanalyzer`,
licenciado sob GPL-3.0. Mantenha a atribuição se for redistribuir.
