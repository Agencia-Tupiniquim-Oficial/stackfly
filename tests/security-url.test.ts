import { describe, expect, it } from 'vitest';
import { isStackflyError } from '@/lib/errors';
import { defaultAddressPolicy, isPublicAddress } from '@/lib/security/ip';
import { resolveAllowedAddresses, type Resolver } from '@/lib/security/resolve';
import { parseTargetUrl } from '@/lib/security/url';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    if (isStackflyError(err)) return err.code;
    throw err;
  }
  return undefined;
}

describe('parseTargetUrl', () => {
  it('aceita domínio sem esquema e mantém a normalização histórica em `display`', () => {
    const t = parseTargetUrl('  exemplo.com.br ');
    expect(t.display).toBe('https://exemplo.com.br');
    expect(t.url.href).toBe('https://exemplo.com.br/');
    expect(t.port).toBe(443);
  });

  it('URLs equivalentes geram a mesma chave de cache', () => {
    const keys = ['exemplo.com', 'https://EXEMPLO.com', 'https://exemplo.com/', 'https://exemplo.com:443/#topo'].map(
      (u) => parseTargetUrl(u).cacheKey,
    );
    expect(new Set(keys).size).toBe(1);
    expect(parseTargetUrl('http://exemplo.com').cacheKey).not.toBe(keys[0]);
  });

  it.each([
    [undefined, 'MISSING_URL'],
    ['', 'MISSING_URL'],
    ['   ', 'MISSING_URL'],
    [['a', 'b'], 'MISSING_URL'],
    ['https://', 'INVALID_URL'],
    ['https://exa mple.com', 'INVALID_URL'],
    ['https://user:pass@exemplo.com', 'INVALID_URL'],
    [`https://exemplo.com/${'a'.repeat(3000)}`, 'INVALID_URL'],
  ])('%j → %s', (input, code) => {
    expect(codeOf(() => parseTargetUrl(input))).toBe(code);
  });

  it.each([
    'ftp://exemplo.com',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,<h1>oi</h1>',
    'ws://exemplo.com',
    'gopher://exemplo.com',
  ])('protocolo não permitido: %s', (input) => {
    expect(codeOf(() => parseTargetUrl(input))).toBe('UNSUPPORTED_PROTOCOL');
  });

  it.each([
    'localhost',
    'http://localhost:3000',
    'http://app.localhost',
    'http://127.0.0.1',
    'http://127.1',
    'http://2130706433', // 127.0.0.1 em decimal
    'http://0x7f000001',
    'http://0x7f.0.0.1',
    'http://0177.0.0.1', // octal
    'http://0.0.0.0',
    'http://10.0.0.5',
    'http://192.168.1.1',
    'http://172.16.0.1',
    'http://169.254.169.254/latest/meta-data/',
    'http://100.64.0.1',
    'http://[::1]',
    'http://[::]',
    'http://[::ffff:127.0.0.1]',
    'http://[::ffff:7f00:1]',
    'http://[::ffff:169.254.169.254]',
    'http://[64:ff9b::a9fe:a9fe]', // NAT64 → 169.254.169.254
    'http://[fe80::1]',
    'http://[fd00::1]',
    'http://metadata.google.internal',
    'http://intranet',
    'http://router.lan',
    'https://exemplo.com:22',
    'https://exemplo.com:6379',
  ])('destino bloqueado: %s', (input) => {
    expect(codeOf(() => parseTargetUrl(input))).toBe('BLOCKED_TARGET');
  });

  it.each(['http://exemplo.com:8080', 'https://exemplo.com:8443', 'https://8.8.8.8', 'http://[2606:4700::1111]'])(
    'aceita %s',
    (input) => {
      expect(() => parseTargetUrl(input)).not.toThrow();
    },
  );
});

describe('isPublicAddress', () => {
  it.each(['8.8.8.8', '1.1.1.1', '200.147.67.142', '2606:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8'])(
    'público: %s',
    (ip) => expect(isPublicAddress(ip)).toBe(true),
  );

  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.31.255.255',
    '192.168.0.1',
    '169.254.169.254',
    '100.100.100.200',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
    '::1',
    '::',
    '::ffff:10.0.0.1',
    '::127.0.0.1',
    '64:ff9b::7f00:1',
    'fe80::1',
    'fe80::1%eth0',
    'fc00::1',
    'ff02::1',
    '2001:db8::1',
    '2002:7f00:1::1', // 6to4
    '2001:0:4136:e378::1', // Teredo
    'not-an-ip',
  ])('não público: %s', (ip) => expect(isPublicAddress(ip)).toBe(false));
});

describe('resolveAllowedAddresses', () => {
  const fake =
    (map: Record<string, string[]>): Resolver =>
    async (host) => {
      const ips = map[host];
      if (!ips) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
      return ips.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
    };

  it('aceita domínio que resolve só para IPs públicos', async () => {
    const r = fake({ 'exemplo.com': ['93.184.215.14', '2606:2800:21f:cb07:6820:80da:af6b:8b2c'] });
    await expect(resolveAllowedAddresses('exemplo.com', 443, defaultAddressPolicy, r)).resolves.toHaveLength(2);
  });

  it('bloqueia domínio que resolve para IP privado (ex.: nip.io, rebinding)', async () => {
    const r = fake({ '127.0.0.1.nip.io': ['127.0.0.1'], 'meta.attacker.com': ['169.254.169.254'] });
    await expect(resolveAllowedAddresses('127.0.0.1.nip.io', 80, defaultAddressPolicy, r)).rejects.toMatchObject({
      code: 'BLOCKED_TARGET',
    });
    await expect(resolveAllowedAddresses('meta.attacker.com', 80, defaultAddressPolicy, r)).rejects.toMatchObject({
      code: 'BLOCKED_TARGET',
    });
  });

  it('bloqueia resposta mista (um IP público e um privado)', async () => {
    const r = fake({ 'misto.com': ['8.8.8.8', '10.0.0.1'] });
    await expect(resolveAllowedAddresses('misto.com', 443, defaultAddressPolicy, r)).rejects.toMatchObject({
      code: 'BLOCKED_TARGET',
    });
  });

  it('domínio inexistente → DNS_RESOLUTION_FAILED', async () => {
    await expect(resolveAllowedAddresses('nao-existe.com', 443, defaultAddressPolicy, fake({}))).rejects.toMatchObject({
      code: 'DNS_RESOLUTION_FAILED',
    });
  });
});
