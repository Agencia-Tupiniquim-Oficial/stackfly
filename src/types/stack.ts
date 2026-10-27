// Contrato público da API (/api/v1/stack). Mantido igual ao da versão Express.

export interface TechnologyResult {
  name: string;
  categories: string[];
  confidence: number;
  version: string | null;
  website: string | null;
  implied: boolean;
}

export interface StackResult {
  /** URL informada, normalizada (com https:// quando faltava o esquema). */
  url: string;
  /** URL final após redirecionamentos. */
  finalUrl: string;
  analyzedAt: string;
  count: number;
  technologies: TechnologyResult[];
  grouped: Record<string, TechnologyResult[]>;
  cached: boolean;
}

export type ErrorCode =
  | 'MISSING_URL'
  | 'INVALID_URL'
  | 'UNSUPPORTED_PROTOCOL'
  | 'BLOCKED_TARGET'
  | 'DNS_RESOLUTION_FAILED'
  | 'NAVIGATION_FAILED'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'SERVER_BUSY'
  | 'BROWSER_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: string;
  code: ErrorCode;
}
