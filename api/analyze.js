'use strict';

const path = require('path');
const fs = require('fs');
const chromium = require('@sparticuz/chromium');
const puppeteerCore = require('puppeteer-core');
const { fetchPageData } = require('../server/analyze');
const { detectTechnologies } = require('../server/matcher');

const technologies = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'technologies.json'), 'utf8')
);
const categories = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'categories.json'), 'utf8')
);

function normalizeUrl(input) {
  let u = String(input).trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Informe uma URL válida.' });
  }

  const targetUrl = normalizeUrl(url);

  try {
    // Configurações essenciais do @sparticuz/chromium para Vercel Serverless
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    const executablePath = await chromium.executablePath();

    const pageData = await fetchPageData(targetUrl, technologies, {
      executablePath,
      puppeteerModule: puppeteerCore,
      launchArgs: chromium.args,
      headless: chromium.headless,
    });

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

    return res.status(200).json({
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
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: `Falha ao analisar o site: ${err.message}` });
  }
};
