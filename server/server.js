'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { fetchPageData } = require('./analyze');
const { detectTechnologies } = require('./matcher');
const { TtlCache } = require('./cache');

const app = express();
const PORT = process.env.PORT || 3000;

const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 60 * 60 * 1000); // 1h
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000); // 1min
// API pública e aberta: limite mais conservador por IP, já que qualquer um pode chamar.
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 10); // 10 req/min por IP

const technologies = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'technologies.json'), 'utf8')
);
const categories = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'categories.json'), 'utf8')
);

const resultCache = new TtlCache(CACHE_TTL_MS);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function normalizeUrl(input) {
  let url = String(input).trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

// Lógica central de análise, compartilhada entre a UI web e a API pública.
// Usa cache por URL normalizada pra evitar rodar o Puppeteer de novo em
// pouco tempo pro mesmo site.
async function analyzeUrl(rawUrl) {
  const targetUrl = normalizeUrl(rawUrl);

  const cached = resultCache.get(targetUrl);
  if (cached) return { ...cached, cached: true };

  const pageData = await fetchPageData(targetUrl, technologies);
  const detections = detectTechnologies(technologies, pageData);

  const grouped = {};
  for (const det of detections) {
    const catIds = det.categories.length ? det.categories : [0];
    for (const catId of catIds) {
      const catName = categories[String(catId)]?.name || 'Outros';
      if (!grouped[catName]) grouped[catName] = [];
      grouped[catName].push(det);
    }
  }

  const result = {
    url: targetUrl,
    finalUrl: pageData.finalUrl,
    analyzedAt: new Date().toISOString(),
    count: detections.length,
    technologies: detections.map((d) => ({
      name: d.name,
      categories: (d.categories.length ? d.categories : [0]).map(
        (id) => categories[String(id)]?.name || 'Outros'
      ),
      confidence: d.confidence,
      version: d.version || null,
      website: d.website || null,
      implied: !!d.implied,
    })),
    grouped,
    cached: false,
  };

  resultCache.set(targetUrl, result);
  return result;
}

// --- Rota usada pela interface web (mesma origem) -------------------------
app.post('/api/analyze', async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Informe uma URL válida.' });
  }
  try {
    const result = await analyzeUrl(url);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Falha ao analisar o site: ${err.message}` });
  }
});

// --- API pública v1 --------------------------------------------------------
// Aberta pra qualquer um consumir — sem chave, sem cadastro. O rate limit
// por IP é a única proteção contra abuso.

const apiV1 = express.Router();

apiV1.use(cors({ origin: true })); // reflete qualquer origem, acesso público

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de requisições excedido. Tente novamente em instantes.' },
});

apiV1.use(limiter);

apiV1.get('/stack', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Informe ?url= com o site a analisar.' });
  }
  try {
    const result = await analyzeUrl(url);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: `Falha ao analisar o site: ${err.message}` });
  }
});

app.use('/api/v1', apiV1);

app.listen(PORT, () => {
  console.log(`Stackfly rodando em http://localhost:${PORT}`);
  console.log(`${Object.keys(technologies).length} fingerprints carregados`);
  console.log(`API pública disponível em /api/v1/stack (sem chave, rate limit por IP)`);
});
