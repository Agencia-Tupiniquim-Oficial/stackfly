import type { Analyzer } from '@/lib/analyzer/analyze';
import { StackflyError, isStackflyError } from '@/lib/errors';
import { getClientId } from '@/lib/security/client-ip';
import type { RateLimiter, RateLimitResult } from '@/lib/security/rate-limit';
import { parseTargetUrl } from '@/lib/security/url';
import type { ApiErrorBody } from '@/types/stack';

export interface StackHandlerDeps {
  analyzer: () => Analyzer;
  rateLimiter: () => RateLimiter;
  trustProxyHeaders?: boolean;
}

// API pública: qualquer origem pode chamar (sem credenciais).
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After',
};

// Mesmos cabeçalhos do express-rate-limit com `standardHeaders: true`.
function rateLimitHeaders(rl: RateLimitResult): Record<string, string> {
  return {
    'RateLimit-Limit': String(rl.limit),
    'RateLimit-Remaining': String(rl.remaining),
    'RateLimit-Reset': String(Math.ceil(rl.resetMs / 1000)),
  };
}

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store', ...headers },
  });
}

function errorResponse(err: StackflyError, headers: Record<string, string> = {}) {
  const body: ApiErrorBody = { error: err.message, code: err.code };
  return json(body, err.status, headers);
}

/**
 * Lógica comum de GET /api/v1/stack e POST /api/analyze:
 * rate limit → validação da URL → análise → JSON.
 */
export function createStackHandler(deps: StackHandlerDeps) {
  return async function handle(request: Request, rawUrl: unknown): Promise<Response> {
    const clientId = getClientId(request.headers, { trustProxyHeaders: deps.trustProxyHeaders });

    let rl: RateLimitResult;
    try {
      rl = await deps.rateLimiter().check(clientId);
    } catch (err) {
      console.error('[stackfly] rate limit indisponível:', err);
      return errorResponse(new StackflyError('INTERNAL_ERROR', 'Erro interno. Tente novamente.'));
    }
    const rlHeaders = rateLimitHeaders(rl);
    if (!rl.allowed) {
      return errorResponse(
        new StackflyError('RATE_LIMITED', 'Limite de requisições excedido. Tente novamente em instantes.'),
        { ...rlHeaders, 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) },
      );
    }

    try {
      const target = parseTargetUrl(rawUrl);
      const result = await deps.analyzer()(target);
      return json(result, 200, rlHeaders);
    } catch (err) {
      if (isStackflyError(err)) {
        if (err.status >= 500) console.error(`[stackfly] ${err.code}:`, err.cause ?? err);
        return errorResponse(err, rlHeaders);
      }
      console.error('[stackfly] erro inesperado:', err);
      return errorResponse(new StackflyError('INTERNAL_ERROR', 'Erro interno ao analisar o site.'), rlHeaders);
    }
  };
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' } });
}
