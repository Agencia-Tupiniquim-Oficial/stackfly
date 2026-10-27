import { defineConfig } from 'vitest/config';
import { alias } from './vitest.shared.mts';

// Testes com Chromium de verdade (puppeteer local). Mais lentos; rodam à parte.
export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    include: ['tests/browser/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
