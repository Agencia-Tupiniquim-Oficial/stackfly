'use strict';

const puppeteer = require('puppeteer');

// Lista de "caminhos" de variáveis globais de JS que vale a pena checar.
// É construída dinamicamente a partir do dataset de tecnologias (ver server.js),
// então não precisamos manter essa lista manualmente.
function collectJsPaths(technologies) {
  const paths = new Set();
  for (const tech of Object.values(technologies)) {
    if (tech.js && typeof tech.js === 'object') {
      for (const key of Object.keys(tech.js)) paths.add(key);
    }
  }
  return Array.from(paths);
}

async function fetchPageData(url, technologies) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    );

    let mainResponseHeaders = {};
    page.on('response', (response) => {
      // Guarda os headers apenas da resposta principal (documento raiz)
      if (response.url() === url || response.request().resourceType() === 'document') {
        if (Object.keys(mainResponseHeaders).length === 0) {
          mainResponseHeaders = response.headers();
        }
      }
    });

    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    if (response) {
      mainResponseHeaders = { ...response.headers(), ...mainResponseHeaders };
    }

    const html = await page.content();

    const scriptSrcs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[src]')).map((s) => s.src)
    );

    const metaTags = await page.evaluate(() => {
      const result = {};
      document.querySelectorAll('meta[name], meta[property]').forEach((m) => {
        const key = (m.getAttribute('name') || m.getAttribute('property') || '').toLowerCase();
        if (key) result[key] = m.getAttribute('content') || '';
      });
      return result;
    });

    const cookies = await page.cookies();
    const cookieMap = {};
    cookies.forEach((c) => {
      cookieMap[c.name.toLowerCase()] = c.value;
    });

    // Checa a presença de variáveis globais conhecidas (window.wp, window.React etc.)
    const jsPaths = collectJsPaths(technologies);
    const jsGlobals = await page.evaluate((paths) => {
      const found = {};
      for (const path of paths) {
        try {
          const value = path.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), window);
          if (value !== undefined) found[path] = String(value).slice(0, 200);
        } catch (e) {
          // ignora paths que geram erro de acesso
        }
      }
      return found;
    }, jsPaths);

    const headersLower = {};
    for (const [k, v] of Object.entries(mainResponseHeaders)) headersLower[k.toLowerCase()] = v;

    return {
      html,
      headersLower,
      meta: metaTags,
      cookies: cookieMap,
      jsGlobals,
      scriptSrc: scriptSrcs,
      scriptSrcJoined: scriptSrcs.join('\n'),
      finalUrl: page.url(),
    };
  } finally {
    await browser.close();
  }
}

module.exports = { fetchPageData, collectJsPaths };
