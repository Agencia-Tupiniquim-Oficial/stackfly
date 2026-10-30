import { describe, expect, it } from 'vitest';
import { withDisabledFeatures } from '@/lib/analyzer/browser';

describe('withDisabledFeatures', () => {
  it('junta com a lista que o navegador já traz, numa flag só', () => {
    const args = withDisabledFeatures([
      '--no-sandbox',
      '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process',
      '--enable-features=SharedArrayBuffer',
    ]);
    const flags = args.filter((a) => a.startsWith('--disable-features='));
    expect(flags).toHaveLength(1);
    const features = flags[0].slice('--disable-features='.length).split(',');
    // as do @sparticuz/chromium continuam (essenciais em processo único)...
    expect(features).toEqual(expect.arrayContaining(['AudioServiceOutOfProcess', 'IsolateOrigins', 'site-per-process']));
    // ...e as nossas entram junto
    expect(features).toEqual(expect.arrayContaining(['NetworkPrediction', 'PrivateNetworkAccessPermissionPrompt']));
    expect(args).toContain('--enable-features=SharedArrayBuffer');
  });

  it('sem lista prévia, cria a flag; sem duplicar features repetidas', () => {
    const flag = withDisabledFeatures(['--x'], ['A', 'A']).find((a) => a.startsWith('--disable-features='));
    expect(flag).toBe('--disable-features=A');
  });
});
