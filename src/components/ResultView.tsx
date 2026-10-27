import type { StackResult } from '@/types/stack';

// Ordem de exibição das categorias principais; as demais vêm depois, em ordem alfabética.
// (Restaurado: foi removido por engano no commit 0c326b5 e quebrava a renderização.)
const CATEGORY_ORDER = [
  'CMS',
  'Ecommerce',
  'JavaScript frameworks',
  'JavaScript libraries',
  'Web servers',
  'Analytics',
  'CDN',
  'Programming languages',
];

function compareCategories(a: string, b: string) {
  const ai = CATEGORY_ORDER.indexOf(a);
  const bi = CATEGORY_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

export function ResultView({ data }: { data: StackResult }) {
  const plural = data.count !== 1 ? 's' : '';
  const categoryNames = Object.keys(data.grouped).sort(compareCategories);

  return (
    <>
      <div className="result-meta">
        <span>{data.finalUrl}</span>
        <span className="badge">
          {data.count} tecnologia{plural} detectada{plural}
        </span>
      </div>

      {data.count === 0 ? (
        <div className="status">Nenhuma tecnologia reconhecida no fingerprint atual.</div>
      ) : (
        categoryNames.map((catName) => (
          <div className="category" key={catName}>
            <div className="category-name">{catName}</div>
            <div className="tech-list">
              {[...data.grouped[catName]]
                .sort((a, b) => b.confidence - a.confidence)
                .map((t, i) => (
                  <div className="tech-row" key={`${t.name}-${i}`}>
                    <div className="tech-name-wrap">
                      <span className="tech-name">{t.name}</span>
                      {t.version && <span className="tech-version">v{t.version}</span>}
                      {t.implied && <span className="implied-tag">(inferido)</span>}
                    </div>
                    <span className="tech-confidence">{t.confidence}%</span>
                  </div>
                ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
