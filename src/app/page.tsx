import { StackAnalyzer } from '@/components/StackAnalyzer';

export default function Home() {
  return (
    <>
      <div className="scan-grid" />
      <div className="wrap">
        <header>
          <div className="logo">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--accent)' }}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h1>
            Stack <span className="green">Fly</span>
          </h1>
          <p className="sub">
            Cole uma URL e a ferramenta varre headers, HTML, cookies e variáveis JS para identificar CMS, frameworks,
            analytics, CDN e outras tecnologias.
          </p>
        </header>

        <StackAnalyzer />
      </div>
    </>
  );
}
