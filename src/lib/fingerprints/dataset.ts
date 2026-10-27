import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { CategoryDataset, TechnologyDataset } from './types';

// O dataset (~2,6 MB) fica em /data e é lido do disco uma única vez por
// instância. Não usamos `import x from '*.json'` porque o TypeScript tentaria
// inferir tipos para 7.600+ objetos. Na Vercel, o next.config.ts inclui
// data/** no bundle da função via outputFileTracingIncludes.
const DATA_DIR = path.join(process.cwd(), 'data');

let cached: { technologies: TechnologyDataset; categories: CategoryDataset } | null = null;

export function loadDataset() {
  if (!cached) {
    cached = {
      technologies: JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'technologies.json'), 'utf8')),
      categories: JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'categories.json'), 'utf8')),
    };
  }
  return cached;
}
