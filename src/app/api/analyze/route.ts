import { handleStackRequest } from '@/lib/api/default-handler';
import { corsPreflight } from '@/lib/api/stack-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Rota legada (POST { url }) usada pela interface antiga. Mantida por
// compatibilidade; agora passa pelo mesmo rate limit e pelas mesmas
// validações da API pública (antes não tinha limite nenhum).
export async function POST(request: Request) {
  let url: unknown;
  try {
    url = ((await request.json()) as { url?: unknown } | null)?.url;
  } catch {
    url = undefined;
  }
  return handleStackRequest(request, url);
}

export function OPTIONS() {
  return corsPreflight();
}
