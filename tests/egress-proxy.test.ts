import http from 'node:http';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startEgressProxy, type EgressProxy } from '@/lib/security/egress-proxy';
import type { Resolver } from '@/lib/security/resolve';

// "Serviço interno" que nunca deveria ser alcançado pelo navegador.
let internal: http.Server;
let internalPort: number;
let internalHits = 0;

beforeAll(async () => {
  internal = http.createServer((req, res) => {
    internalHits++;
    res.end(req.url === '/big' ? Buffer.alloc(64 * 1024, 'x') : 'segredo');
  });
  await new Promise<void>((r) => internal.listen(0, '127.0.0.1', () => r()));
  internalPort = (internal.address() as net.AddressInfo).port;
});

afterAll(() => new Promise<void>((r) => internal.close(() => r())));

function proxyGet(proxy: EgressProxy, url: string): Promise<{ status: number; body: string }> {
  const { port } = new URL(proxy.url);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: Number(port), method: 'GET', path: url }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

function proxyConnect(proxy: EgressProxy, authority: string): Promise<string> {
  const { port } = new URL(proxy.url);
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(port), '127.0.0.1', () => {
      socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
    });
    socket.once('data', (d) => {
      resolve(d.toString().split('\r\n')[0]);
      socket.destroy();
    });
    socket.on('error', reject);
  });
}

const denyAll = () => false;

// Recusas em HTTP simples derrubam a conexão (sem resposta), para o Chromium
// não tratar a resposta do proxy como se fosse a página do site.
const refused = { code: 'ECONNRESET' };

describe('proxy de saída', () => {
  it('recusa loopback via HTTP e via CONNECT, sem tocar no serviço interno', async () => {
    const proxy = await startEgressProxy({ policy: denyAll, maxBytes: 1e6 });
    try {
      const before = internalHits;
      await expect(proxyGet(proxy, `http://127.0.0.1:${internalPort}/`)).rejects.toMatchObject(refused);
      await expect(proxyGet(proxy, `http://localhost:${internalPort}/`)).rejects.toMatchObject(refused);
      expect(await proxyConnect(proxy, `127.0.0.1:${internalPort}`)).toContain('403');
      expect(await proxyConnect(proxy, `[::1]:${internalPort}`)).toContain('403');
      expect(internalHits).toBe(before);
      expect(proxy.blockedHosts.has('127.0.0.1')).toBe(true);
    } finally {
      await proxy.close();
    }
  });

  it('DNS rebinding: valida o IP que o proxy resolveu, não o nome', async () => {
    // O nome "parece" público mas resolve para loopback na hora da conexão.
    const rebinding: Resolver = async () => [{ address: '127.0.0.1', family: 4 }];
    const proxy = await startEgressProxy({ policy: (ip) => ip !== '127.0.0.1', resolver: rebinding, maxBytes: 1e6 });
    try {
      const before = internalHits;
      await expect(proxyGet(proxy, `http://rebind.attacker.com:${internalPort}/`)).rejects.toMatchObject(refused);
      expect(await proxyConnect(proxy, `rebind.attacker.com:${internalPort}`)).toContain('403');
      expect(internalHits).toBe(before);
    } finally {
      await proxy.close();
    }
  });

  it('repassa HTTP e abre túnel CONNECT quando a política permite', async () => {
    const allowInternal = (ip: string, port: number) => ip === '127.0.0.1' && port === internalPort;
    const resolver: Resolver = async () => [{ address: '127.0.0.1', family: 4 }];
    const proxy = await startEgressProxy({ policy: allowInternal, resolver, maxBytes: 1e6 });
    try {
      const res = await proxyGet(proxy, `http://site.test:${internalPort}/ok`);
      expect(res).toEqual({ status: 200, body: 'segredo' });
      expect(await proxyConnect(proxy, `site.test:${internalPort}`)).toContain('200');
      // Porta diferente da permitida continua bloqueada.
      await expect(proxyGet(proxy, `http://site.test:1/`)).rejects.toMatchObject(refused);
    } finally {
      await proxy.close();
    }
  });

  it('recusa requisições que não estão em absolute-form', async () => {
    const proxy = await startEgressProxy({ policy: () => true, maxBytes: 1e6 });
    try {
      expect((await proxyGet(proxy, '/admin')).status).toBe(400);
    } finally {
      await proxy.close();
    }
  });

  it('derruba as conexões quando o orçamento de bytes estoura', async () => {
    const resolver: Resolver = async () => [{ address: '127.0.0.1', family: 4 }];
    const proxy = await startEgressProxy({ policy: () => true, resolver, maxBytes: 1024 });
    try {
      await proxyGet(proxy, `http://site.test:${internalPort}/big`).catch(() => undefined);
      expect(proxy.budgetExceeded).toBe(true);
      await expect(proxyGet(proxy, `http://site.test:${internalPort}/ok`)).rejects.toMatchObject(refused);
    } finally {
      await proxy.close();
    }
  });
});
