import { handleStackRequest } from '@/lib/api/default-handler';
import { corsPreflight } from '@/lib/api/stack-handler';

// Puppeteer/Chromium precisam do runtime Node.js (não Edge).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Cabe em todos os planos da Vercel. O prazo interno da análise
// (ANALYSIS_TOTAL_TIMEOUT_MS, 45s) é menor, para sobrar tempo de responder.
export const maxDuration = 60;

// API pública v1 — aberta, sem chave nem cadastro. O rate limit por IP é a
// proteção contra abuso.
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url');
  return handleStackRequest(request, url);
}

export function OPTIONS() {
  return corsPreflight();
}
