// Formato do dataset open-source (enthec/webappanalyzer, derivado do Wappalyzer).
// Só tipamos os campos que o matcher usa; o resto do JSON é preservado como está.

export type PatternField = string | string[] | Record<string, string | string[]>;

export interface Fingerprint {
  cats?: number[];
  website?: string;
  icon?: string;
  implies?: string | string[];
  headers?: PatternField;
  meta?: PatternField;
  cookies?: PatternField;
  js?: PatternField;
  html?: PatternField;
  scriptSrc?: PatternField;
  script?: PatternField;
  [field: string]: unknown;
}

export type TechnologyDataset = Record<string, Fingerprint>;
export type CategoryDataset = Record<string, { name: string; priority?: number; groups?: number[] }>;

/** Dados coletados de uma página, prontos para o matcher. */
export interface PageData {
  html: string;
  headersLower: Record<string, string>;
  meta: Record<string, string>;
  cookies: Record<string, string>;
  jsGlobals: Record<string, string>;
  scriptSrc: string[];
  scriptSrcJoined: string;
  finalUrl: string;
}

export interface Detection {
  name: string;
  confidence: number;
  version: string | undefined;
  categories: number[];
  website: string | undefined;
  icon: string | undefined;
  implies: string[];
  implied?: true;
}
