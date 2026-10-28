import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export const alias = {
  '@': path.resolve(root, 'src'),
  // `server-only` é resolvido pelo Next; nos testes vira um módulo vazio.
  'server-only': path.resolve(root, 'tests/helpers/empty.ts'),
};
