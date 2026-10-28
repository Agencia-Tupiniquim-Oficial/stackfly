import type { ErrorCode } from '@/types/stack';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  MISSING_URL: 400,
  INVALID_URL: 400,
  UNSUPPORTED_PROTOCOL: 400,
  BLOCKED_TARGET: 403,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  DNS_RESOLUTION_FAILED: 502,
  NAVIGATION_FAILED: 502,
  SERVER_BUSY: 503,
  BROWSER_UNAVAILABLE: 503,
  TIMEOUT: 504,
};

/**
 * Erro "esperado" do Stackfly. A `message` é segura para devolver ao cliente;
 * detalhes internos ficam em `cause` e só vão para o log.
 */
export class StackflyError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StackflyError';
    this.code = code;
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

export function isStackflyError(err: unknown): err is StackflyError {
  return err instanceof StackflyError;
}
