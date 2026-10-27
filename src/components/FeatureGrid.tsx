const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function FeatureGrid() {
  return (
    <div className="feature-grid">
      <div className="feature-card">
        <div className="feature-icon">
          <svg {...iconProps}>
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <div className="feature-title">Fingerprints Wappalyzer</div>
        <div className="feature-desc">Base de dados open-source com centenas de tecnologias reconhecidas por padrão.</div>
      </div>
      <div className="feature-card">
        <div className="feature-icon">
          <svg {...iconProps}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <div className="feature-title">6 canais de detecção</div>
        <div className="feature-desc">Headers HTTP, HTML, meta tags, cookies, JS globals e URLs de scripts.</div>
      </div>
      <div className="feature-card">
        <div className="feature-icon">
          <svg {...iconProps}>
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
        </div>
        <div className="feature-title">API pública</div>
        <div className="feature-desc">
          Acesse via <code style={{ color: 'var(--accent)', fontSize: 12 }}>GET /api/v1/stack</code> sem cadastro ou
          chave de API.
        </div>
      </div>
    </div>
  );
}
