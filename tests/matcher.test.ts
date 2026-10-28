import { describe, expect, it } from 'vitest';
import { collectJsPaths, detectTechnologies, parsePattern } from '@/lib/fingerprints/matcher';
import { buildStackResult } from '@/lib/fingerprints/result';
import { categories, fixtureNames, loadExpected, loadPageFixture, technologies } from './helpers/dataset';

describe('dataset', () => {
  it('mantém todas as fingerprints e categorias', () => {
    expect(Object.keys(technologies).length).toBe(7613);
    expect(Object.keys(categories).length).toBe(109);
    expect(technologies.WordPress.implies).toEqual(['PHP', 'MySQL']);
  });

  it('extrai os caminhos de variáveis JS do dataset', () => {
    const paths = collectJsPaths(technologies);
    expect(paths).toContain('wp.ajax');
    expect(paths).toContain('React.version');
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('regressão contra o matcher original (server/matcher.js)', () => {
  it.each(fixtureNames)('%s produz exatamente as mesmas detecções', (name) => {
    const detections = detectTechnologies(technologies, loadPageFixture(name));
    // JSON round-trip: o snapshot foi serializado (undefined some).
    expect(JSON.parse(JSON.stringify(detections))).toEqual(loadExpected(name));
  });

  it('resultado é estável entre execuções (padrões pré-compilados)', () => {
    const page = loadPageFixture('wordpress');
    expect(detectTechnologies(technologies, page)).toEqual(detectTechnologies(technologies, page));
  });
});

describe('detecções', () => {
  it('WordPress: versão pelo meta generator e inferência de MySQL', () => {
    const det = detectTechnologies(technologies, loadPageFixture('wordpress'));
    const byName = Object.fromEntries(det.map((d) => [d.name, d]));
    expect(byName.WordPress.version).toBe('6.5.2');
    expect(byName.MySQL.implied).toBe(true);
    // PHP foi detectado diretamente (header) — não pode virar "inferido" nem duplicar.
    expect(byName.PHP.implied).toBeUndefined();
    expect(byName.PHP.version).toBe('8.2.10');
    expect(det.filter((d) => d.name === 'PHP')).toHaveLength(1);
  });

  it('WooCommerce implica WordPress, que entra uma vez só', () => {
    const det = detectTechnologies(technologies, loadPageFixture('woocommerce'));
    expect(det.filter((d) => d.name === 'WordPress')).toHaveLength(1);
  });

  it('app renderizado no cliente: detecta pelos globais JS', () => {
    const names = detectTechnologies(technologies, loadPageFixture('nextjs')).map((d) => d.name);
    expect(names).toEqual(expect.arrayContaining(['Next.js', 'React', 'Webpack']));
  });

  it('página sem tecnologia reconhecível não inventa resultado', () => {
    expect(detectTechnologies(technologies, loadPageFixture('empty'))).toEqual([]);
  });
});

describe('parsePattern', () => {
  it('lê versão e confiança', () => {
    const p = parsePattern(String.raw`^WordPress(?: ([\d.]+))?\;version:\1\;confidence:50`);
    expect(p.confidence).toBe(50);
    expect(p.version).toBe(String.raw`\1`);
    expect(p.regex?.test('wordpress 6.0')).toBe(true);
  });

  it('ignora regex incompatível com JS sem derrubar o matcher', () => {
    expect(parsePattern('(?<=a').regex).toBeNull();
  });
});

describe('buildStackResult', () => {
  it('serializa no formato público e agrupa os mesmos objetos por categoria', () => {
    const det = detectTechnologies(technologies, loadPageFixture('wordpress'));
    const result = buildStackResult({ url: 'https://exemplo.com', finalUrl: 'https://exemplo.com/' }, det, categories);

    expect(result.count).toBe(det.length);
    expect(result.cached).toBe(false);
    const wp = result.technologies.find((t) => t.name === 'WordPress')!;
    expect(wp).toEqual({
      name: 'WordPress',
      categories: ['CMS', 'Blogs'],
      confidence: 100,
      version: '6.5.2',
      website: 'https://wordpress.org',
      implied: false,
    });
    expect(result.grouped.CMS).toContainEqual(wp);
    expect(result.grouped['Programming languages'].map((t) => t.name)).toContain('PHP');
    for (const list of Object.values(result.grouped)) {
      for (const t of list) expect(Object.keys(t).sort()).toEqual(Object.keys(wp).sort());
    }
  });

  it('categoria desconhecida vira "Outros"', () => {
    const result = buildStackResult(
      { url: 'u', finalUrl: 'u' },
      [{ name: 'X', confidence: 100, version: undefined, categories: [99999], website: undefined, icon: undefined, implies: [] }],
      categories,
    );
    expect(result.technologies[0]).toMatchObject({ categories: ['Outros'], version: null, website: null });
  });
});
