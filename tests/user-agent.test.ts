import { describe, expect, it } from 'vitest';
import { buildUserAgent } from '@/lib/analyzer/collect';

describe('buildUserAgent', () => {
  it('usa a versão real do navegador no formato do Chrome (NNN.0.0.0)', () => {
    const ua = buildUserAgent('HeadlessChrome/153.0.8010.36');
    expect(ua.userAgent).toContain('Chrome/153.0.0.0 Safari/537.36');
    expect(ua.userAgent).not.toMatch(/headless/i);
    expect(ua.userAgentMetadata.brands).toContainEqual({ brand: 'Google Chrome', version: '153' });
  });

  it('versão ilegível cai num padrão em vez de gerar um UA quebrado', () => {
    expect(buildUserAgent('???').userAgent).toMatch(/Chrome\/\d+\.0\.0\.0 /);
  });
});
