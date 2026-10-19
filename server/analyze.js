'use strict';

// Análise baseada em fetch nativo (Node 18+) — 100% compatível com Vercel (sem Puppeteer/Chromium)
function collectJsPaths(technologies) {
  return [];
}

async function fetchPageData(url, technologies) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    const finalUrl = res.url;
    const html = await res.text();

    const headersLower = {};
    res.headers.forEach((val, key) => {
      headersLower[key.toLowerCase()] = val;
    });

    // Extrai cookies do header Set-Cookie
    const cookieMap = {};
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      // Simples parser para cookies do header
      const parts = setCookie.split(/,(?=\s*[a-zA-Z0-9_\-]+=)/);
      for (const part of parts) {
        const firstPair = part.split(';')[0];
        const eqIdx = firstPair.indexOf('=');
        if (eqIdx > 0) {
          const name = firstPair.slice(0, eqIdx).trim().toLowerCase();
          const val = firstPair.slice(eqIdx + 1).trim();
          cookieMap[name] = val;
        }
      }
    }

    // Extrai meta tags via regex simples do HTML
    const metaTags = {};
    const metaRegex = /<meta\s+([^>]+)>/gi;
    let match;
    while ((match = metaRegex.exec(html)) !== null) {
      const attrStr = match[1];
      const nameMatch = attrStr.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i);
      const contentMatch = attrStr.match(/content\s*=\s*["']([^"']*)["']/i);
      if (nameMatch && contentMatch) {
        metaTags[nameMatch[1].toLowerCase()] = contentMatch[1];
      }
    }

    // Extrai script src via regex
    const scriptSrcs = [];
    const scriptRegex = /<script[^>]+src\s*=\s*["']([^"']+)["']/gi;
    while ((match = scriptRegex.exec(html)) !== null) {
      scriptSrcs.push(match[1]);
    }

    return {
      html,
      headersLower,
      meta: metaTags,
      cookies: cookieMap,
      jsGlobals: {},
      scriptSrc: scriptSrcs,
      scriptSrcJoined: scriptSrcs.join('\n'),
      finalUrl,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`Falha ao carregar URL (${err.message})`);
  }
}

module.exports = { fetchPageData, collectJsPaths };
