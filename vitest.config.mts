import { defineConfig } from 'vitest/config';
import { alias } from './vitest.shared.mts';

export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/browser/**', 'node_modules/**'],
  },
});
