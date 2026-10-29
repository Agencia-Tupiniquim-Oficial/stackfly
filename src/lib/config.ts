import 'server-only';

function intFromEnv(name: string, fallback: number, { min = 1 }: { min?: number } = {}): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min) {
    console.warn(`[stackfly] ${name}="${raw}" inválido; usando ${fallback}.`);
    return fallback;
  }
  return Math.floor(value);
}

// Lido uma vez por instância. Todos os valores têm padrão — nenhuma variável é
// obrigatória para rodar localmente.
export const config = {
  cacheTtlMs: intFromEnv('CACHE_TTL_MS', 60 * 60 * 1000), // 1h
  rateLimitWindowMs: intFromEnv('RATE_LIMIT_WINDOW_MS', 60 * 1000), // 1min
  // API pública e aberta: limite conservador por IP, já que qualquer um pode chamar.
  rateLimitMax: intFromEnv('RATE_LIMIT_MAX', 10),
  navigationTimeoutMs: intFromEnv('ANALYSIS_NAVIGATION_TIMEOUT_MS', 25_000),
  // Depois do DOMContentLoaded, espera a rede "acalmar" por no máximo esse tempo.
  settleTimeoutMs: intFromEnv('ANALYSIS_SETTLE_TIMEOUT_MS', 5_000, { min: 0 }),
  // Prazo total de uma análise (fila + navegador + coleta). Precisa caber no
  // maxDuration da rota (60s).
  totalTimeoutMs: intFromEnv('ANALYSIS_TOTAL_TIMEOUT_MS', 45_000),
  // Total de bytes baixados pela página analisada (todas as requisições).
  maxDownloadBytes: intFromEnv('ANALYSIS_MAX_DOWNLOAD_BYTES', 30 * 1024 * 1024),
  trustProxyHeaders: process.env.TRUST_PROXY_HEADERS === 'true',
};
