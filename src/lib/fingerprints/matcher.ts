/**
 * Motor de matching de fingerprints, no formato usado pelo ruleset
 * open-source da Wappalyzer (technologies.json).
 *
 * Cada padrão pode vir como string simples ou como string com metadados
 * separados por ";", por exemplo:
 *   "^WordPress(?: ([\\d.]+))?\\;version:\\1"
 *   "someRegex\\;confidence:50"
 *
 * Portado de server/matcher.js sem mudar a semântica. A única diferença é que
 * os padrões são compilados uma vez por dataset (antes eram recompilados a
 * cada requisição) — o teste de regressão em tests/matcher.test.ts compara a
 * saída com a do matcher original.
 */
import type { Detection, Fingerprint, PageData, PatternField, TechnologyDataset } from './types';

interface ParsedPattern {
  regexStr: string;
  regex: RegExp | null;
  confidence: number;
  version?: string;
}

interface PatternGroup {
  key: string | null;
  patterns: ParsedPattern[];
}

// Faz o parse de um padrão único no formato "regex\\;chave:valor\\;chave:valor"
export function parsePattern(pattern: string): ParsedPattern {
  const parts = String(pattern).split('\\;');
  const regexStr = parts.shift() ?? '';
  const meta: { confidence: number; version?: string } = { confidence: 100 };

  for (const part of parts) {
    const [key, value] = part.split(':');
    if (key === 'version') meta.version = value;
    else if (key === 'confidence') meta.confidence = parseInt(value, 10) || 100;
  }

  let regex: RegExp | null = null;
  if (regexStr) {
    try {
      // Wappalyzer usa regex case-insensitive por padrão
      regex = new RegExp(regexStr, 'i');
    } catch {
      regex = null; // alguns padrões usam sintaxe PCRE incompatível com JS; ignora
    }
  }

  return { regexStr, regex, ...meta };
}

// Resolve "\1", "\2" etc. dentro da string de versão usando os grupos capturados
function resolveVersion(versionTemplate: string | undefined, match: RegExpMatchArray): string | undefined {
  if (!versionTemplate || !match) return undefined;
  const resolved = versionTemplate.replace(/\\(\d)/g, (_, idx: string) => match[Number(idx)] || '');
  return resolved.trim() || undefined;
}

// Testa um valor (string) contra um padrão já parseado
function testPattern(value: unknown, parsed: ParsedPattern) {
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
function normalizeField(field: PatternField | undefined): PatternGroup[] {
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

type Channel = 'headersLower' | 'meta' | 'cookies' | 'jsGlobals' | 'html' | 'scriptSrcJoined';

interface CompiledCheck {
  channel: Channel;
  groups: PatternGroup[];
  byKey: boolean;
  lowerKey: boolean;
}

interface CompiledTechnology {
  name: string;
  tech: Fingerprint;
  checks: CompiledCheck[];
}

function compileTechnology(name: string, tech: Fingerprint): CompiledTechnology {
  return {
    name,
    tech,
    checks: [
      { channel: 'headersLower', groups: normalizeField(tech.headers), byKey: true, lowerKey: true },
      { channel: 'meta', groups: normalizeField(tech.meta), byKey: true, lowerKey: true },
      { channel: 'cookies', groups: normalizeField(tech.cookies), byKey: true, lowerKey: true },
      { channel: 'jsGlobals', groups: normalizeField(tech.js), byKey: true, lowerKey: false },
      { channel: 'html', groups: normalizeField(tech.html), byKey: false, lowerKey: false },
      { channel: 'scriptSrcJoined', groups: normalizeField(tech.scriptSrc || tech.script), byKey: false, lowerKey: false },
    ],
  };
}

const compiledByDataset = new WeakMap<TechnologyDataset, CompiledTechnology[]>();

function getCompiled(technologies: TechnologyDataset): CompiledTechnology[] {
  let compiled = compiledByDataset.get(technologies);
  if (!compiled) {
    compiled = Object.entries(technologies).map(([name, tech]) => compileTechnology(name, tech));
    compiledByDataset.set(technologies, compiled);
  }
  return compiled;
}

/** Lista de "caminhos" de variáveis globais de JS que vale a pena checar. */
export function collectJsPaths(technologies: TechnologyDataset): string[] {
  const paths = new Set<string>();
  for (const tech of Object.values(technologies)) {
    if (tech.js && typeof tech.js === 'object') {
      for (const key of Object.keys(tech.js)) paths.add(key);
    }
  }
  return Array.from(paths);
}

type MatchResult = { confidence: number; version: string | undefined };

// Decide se `candidate` deve substituir `current` como melhor match:
// confiança maior sempre vence; em empate, prioriza quem trouxe versão.
function isBetterMatch(candidate: MatchResult, current: MatchResult | null): boolean {
  if (!current) return true;
  if (candidate.confidence !== current.confidence) return candidate.confidence > current.confidence;
  return !current.version && !!candidate.version;
}

function toImpliesList(implies: Fingerprint['implies']): string[] {
  if (Array.isArray(implies)) return implies;
  return implies ? [implies] : [];
}

/**
 * Roda todas as tecnologias do dataset contra os dados coletados da página.
 * Retorna as detecções ordenadas por confiança (decrescente).
 */
export function detectTechnologies(technologies: TechnologyDataset, page: Omit<PageData, 'finalUrl'>): Detection[] {
  const results = new Map<string, Detection>();

  for (const { name, tech, checks } of getCompiled(technologies)) {
    let best: MatchResult | null = null;

    for (const check of checks) {
      const data = page[check.channel];
      for (const { key, patterns } of check.groups) {
        for (const parsed of patterns) {
          if (check.byKey) {
            if (!key) continue;
            const lookupKey = check.lowerKey ? key.toLowerCase() : key;
            const value = data ? (data as Record<string, string>)[lookupKey] : undefined;
            if (value === undefined) continue;
            // presença de chave (js globals) sem regex útil ainda conta como match
            const result = parsed.regexStr
              ? testPattern(String(value), parsed)
              : { confidence: parsed.confidence, version: undefined };
            if (result && isBetterMatch(result, best)) best = result;
          } else {
            if (!data) continue;
            const result = testPattern(data, parsed);
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
        implies: toImpliesList(tech.implies),
      });
    }
  }

  // Resolve tecnologias "implicadas" (ex: WordPress implica PHP + MySQL)
  const implied = new Set<string>();
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
