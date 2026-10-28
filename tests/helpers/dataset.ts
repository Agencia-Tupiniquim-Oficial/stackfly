import fs from 'node:fs';
import path from 'node:path';
import type { CategoryDataset, PageData, TechnologyDataset } from '@/lib/fingerprints/types';

const root = path.resolve(__dirname, '..', '..');

export const technologies: TechnologyDataset = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'technologies.json'), 'utf8'),
);
export const categories: CategoryDataset = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'categories.json'), 'utf8'),
);

export const fixtureNames = fs
  .readdirSync(path.join(root, 'tests', 'fixtures', 'pages'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

export function loadPageFixture(name: string): PageData {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'fixtures', 'pages', `${name}.json`), 'utf8'));
  return { ...raw, scriptSrcJoined: raw.scriptSrc.join('\n'), finalUrl: 'https://exemplo.com/' };
}

/** Saída do matcher ORIGINAL (server/matcher.js) gerada antes da migração. */
export function loadExpected(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(root, 'tests', 'fixtures', 'expected', `${name}.json`), 'utf8'));
}
