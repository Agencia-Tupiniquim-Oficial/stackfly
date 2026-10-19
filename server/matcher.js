'use strict';

/**
 * Motor de matching de fingerprints, no formato usado pelo ruleset
 * open-source da Wappalyzer (technologies.json).
 *
 * Cada padrão pode vir como string simples ou como string com metadados
 * separados por ";", por exemplo:
 *   "^WordPress(?: ([\\d.]+))?\\;version:\\1"
 *   "someRegex\\;confidence:50"
 */

// Faz o parse de um padrão único no formato "regex\\;chave:valor\\;chave:valor"
function parsePattern(pattern) {
  const parts = String(pattern).split('\\;');
  const regexStr = parts.shift();
  const meta = { confidence: 100 };

  for (const part of parts) {
    const [key, value] = part.split(':');
    if (key === 'version') meta.version = value;
    else if (key === 'confidence') meta.confidence = parseInt(value, 10) || 100;
  }

  let regex = null;
  if (regexStr) {
    try {
      // Wappalyzer usa regex case-insensitive por padrão
      regex = new RegExp(regexStr, 'i');
    } catch (e) {
      regex = null; // alguns padrões usam sintaxe PCRE incompatível com JS; ignora
    }
  }

  return { regexStr, regex, ...meta };
}

// Resolve "\1", "\2" etc. dentro da string de versão usando os grupos capturados
function resolveVersion(versionTemplate, match) {
  if (!versionTemplate || !match) return undefined;
  const resolved = versionTemplate.replace(/\\(\d)/g, (_, idx) => match[idx] || '');
  return resolved.trim() || undefined;
}

// Testa um valor (string) contra um padrão já parseado
function testPattern(value, parsed) {
  if (!parsed.regex || typeof value !== 'string') return null;
  const match = value.match(parsed.regex);
  if (!match) return null;
  return {
    confidence: parsed.confidence,
    version: resolveVersion(parsed.version, match),
  };
}

// Normaliza um campo do fingerprint (string | array | objeto) em uma lista de
// { key, patterns } prontos pra testar
function normalizeField(field) {
  if (!field) return [];
  if (typeof field === 'string') {
    return [{ key: null, patterns: [parsePattern(field)] }];
  }
  if (Array.isArray(field)) {
    return [{ key: null, patterns: field.map(parsePattern) }];
  }
  if (typeof field === 'object') {
    return Object.entries(field).map(([key, val]) => ({
      key,
      patterns: (Array.isArray(val) ? val : [val]).map(parsePattern),
    }));
  }
  return [];
}

/**
 * Roda todas as tecnologias do dataset contra os dados coletados da página.
 *
 * @param {object} technologies - dataset merged (nome -> fingerprint)
 * @param {object} page - dados coletados: { headers, html, scriptSrc, meta, cookies, js, dom }
 * @returns {Array} lista de detecções { name, confidence, version, categories, website }
 */
// Decide se `candidate` deve substituir `current` como melhor match:
// confiança maior sempre vence; em empate, prioriza quem trouxe versão.
function isBetterMatch(candidate, current) {
  if (!current) return true;
  if (candidate.confidence !== current.confidence) return candidate.confidence > current.confidence;
  return !current.version && !!candidate.version;
}

function detectTechnologies(technologies, page) {
  const results = new Map();

  for (const [name, tech] of Object.entries(technologies)) {
    let best = null;

    const checkGroups = [
      { data: page.headersLower, groups: normalizeField(tech.headers), byKey: true, lowerKey: true },
      { data: page.meta, groups: normalizeField(tech.meta), byKey: true, lowerKey: true },
      { data: page.cookies, groups: normalizeField(tech.cookies), byKey: true, lowerKey: true },
      { data: page.jsGlobals, groups: normalizeField(tech.js), byKey: true, lowerKey: false },
      { data: page.html, groups: normalizeField(tech.html), byKey: false },
      { data: page.scriptSrcJoined, groups: normalizeField(tech.scriptSrc || tech.script), byKey: false },
    ];

    for (const group of checkGroups) {
      for (const { key, patterns } of group.groups) {
        for (const parsed of patterns) {
          if (group.byKey) {
            if (!key) continue;
            const lookupKey = group.lowerKey ? key.toLowerCase() : key;
            const value = group.data ? group.data[lookupKey] : undefined;
            if (value === undefined) continue;
            // presença de chave (js globals) sem regex útil ainda conta como match
            const result = parsed.regexStr
              ? testPattern(String(value), parsed)
              : { confidence: parsed.confidence, version: undefined };
            if (result && isBetterMatch(result, best)) best = result;
          } else {
            if (!group.data) continue;
            const result = testPattern(group.data, parsed);
            if (result && isBetterMatch(result, best)) best = result;
          }
        }
      }
    }

    if (best) {
      results.set(name, {
        name,
        confidence: best.confidence,
        version: best.version,
        categories: tech.cats || [],
        website: tech.website,
        icon: tech.icon,
        implies: Array.isArray(tech.implies) ? tech.implies : (tech.implies ? [tech.implies] : []),
      });
    }
  }

  // Resolve tecnologias "implicadas" (ex: WordPress implica PHP + MySQL)
  const implied = new Set();
  for (const detection of results.values()) {
    for (const impliedName of detection.implies) {
      const cleanName = impliedName.split('\\;')[0];
      if (!results.has(cleanName)) implied.add(cleanName);
    }
  }
  for (const impliedName of implied) {
    const tech = technologies[impliedName];
    if (tech) {
      results.set(impliedName, {
        name: impliedName,
        confidence: 100,
        version: undefined,
        categories: tech.cats || [],
        website: tech.website,
        icon: tech.icon,
        implied: true,
        implies: [],
      });
    }
  }

  return Array.from(results.values()).sort((a, b) => b.confidence - a.confidence);
}

module.exports = { detectTechnologies, parsePattern };
