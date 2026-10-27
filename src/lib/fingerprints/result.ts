import type { StackResult, TechnologyResult } from '@/types/stack';
import type { CategoryDataset, Detection } from './types';

const FALLBACK_CATEGORY = 'Outros';

function categoryNames(det: Detection, categories: CategoryDataset): string[] {
  return (det.categories.length ? det.categories : [0]).map(
    (id) => categories[String(id)]?.name || FALLBACK_CATEGORY,
  );
}

function toPublic(det: Detection, categories: CategoryDataset): TechnologyResult {
  return {
    name: det.name,
    categories: categoryNames(det, categories),
    confidence: det.confidence,
    version: det.version || null,
    website: det.website || null,
    implied: !!det.implied,
  };
}

/**
 * Monta a resposta pública. `grouped` usa os mesmos objetos de `technologies`
 * (como o API_DOCS sempre documentou) — a versão Express vazava ali os objetos
 * internos do matcher (IDs de categoria, `icon`, `implies`).
 */
export function buildStackResult(
  input: { url: string; finalUrl: string },
  detections: Detection[],
  categories: CategoryDataset,
): StackResult {
  const technologies = detections.map((d) => toPublic(d, categories));

  const grouped: Record<string, TechnologyResult[]> = {};
  for (const tech of technologies) {
    for (const catName of tech.categories) {
      (grouped[catName] ??= []).push(tech);
    }
  }

  return {
    url: input.url,
    finalUrl: input.finalUrl,
    analyzedAt: new Date().toISOString(),
    count: technologies.length,
    technologies,
    grouped,
    cached: false,
  };
}
