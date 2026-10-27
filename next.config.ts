import type { NextConfig } from 'next';

// Arquivos lidos do disco em runtime que precisam ir junto no bundle da função.
// O rastreamento automático não detecta nenhum deles: o dataset é lido via
// fs, e o @sparticuz/chromium descompacta bin/*.br (Chromium, libs, fontes)
// para /tmp na primeira execução.
const analyzerFiles = [
  './data/technologies.json',
  './data/categories.json',
  './node_modules/@sparticuz/chromium/bin/**',
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Não empacotar: o @sparticuz/chromium lê os binários (bin/*.br) relativos
  // ao próprio pacote em node_modules.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/v1/stack': analyzerFiles,
    '/api/analyze': analyzerFiles,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
