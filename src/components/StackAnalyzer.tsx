'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { ApiErrorBody, StackResult } from '@/types/stack';
import { FeatureGrid } from './FeatureGrid';
import { ResultView } from './ResultView';

type Status = { kind: 'idle' | 'loading' } | { kind: 'error'; message: string };

export function StackAnalyzer() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [result, setResult] = useState<StackResult | null>(null);
  const [started, setStarted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const loading = status.kind === 'loading';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = inputRef.current?.value.trim() ?? '';
    if (!url || loading) return;

    setStarted(true);
    setResult(null);
    setStatus({ kind: 'loading' });

    try {
      const res = await fetch(`/api/v1/stack?url=${encodeURIComponent(url)}`);
      // Respostas de erro da própria plataforma (ex.: timeout da função) podem não ser JSON.
      const data = (await res.json().catch(() => null)) as StackResult | ApiErrorBody | null;

      if (!res.ok || !data || 'error' in data) {
        const message = data && 'error' in data ? data.error : 'Não foi possível analisar esse site.';
        setStatus({ kind: 'error', message });
        return;
      }

      setStatus({ kind: 'idle' });
      setResult(data);
    } catch (err) {
      console.error('Stackfly fetch error:', err);
      setStatus({ kind: 'error', message: 'Erro de conexão com o servidor de análise.' });
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} aria-busy={loading}>
        <span className="input-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          name="url"
          placeholder="exemplo.com.br"
          autoComplete="off"
          aria-label="URL do site"
        />
        <button type="submit" disabled={loading}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Analisar
        </button>
      </form>

      <div className={status.kind === 'error' ? 'status error' : 'status'} role="status" aria-live="polite">
        {status.kind === 'loading' && 'Varrendo fingerprints...'}
        {status.kind === 'error' && status.message}
      </div>

      <div className="results">{result && <ResultView data={result} />}</div>

      {!started && <FeatureGrid />}
    </>
  );
}
