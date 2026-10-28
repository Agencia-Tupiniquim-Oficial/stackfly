/**
 * Proxy HTTP local por onde passa TODO o tráfego do Chromium durante uma análise.
 *
 * Por que um proxy e não só `page.setRequestInterception`?
 *  - Interceptação vê a URL, mas quem resolve o DNS e conecta é o Chromium.
 *    Um domínio com TTL 0 pode responder IP público na checagem e
 *    169.254.169.254 na conexão (DNS rebinding).
 *  - Aqui o proxy resolve o nome, valida TODOS os IPs e conecta no IP já
 *    validado. O Chromium nunca resolve nomes por conta própria (com proxy
 *    HTTP configurado, quem resolve é o proxy).
 *  - Cobre tudo que sai pela pilha de rede do navegador: documento, redirects
 *    (cada salto é uma nova requisição), sub-recursos, iframes, fetch/XHR,
 *    workers, WebSockets (vão por CONNECT) e beacons.
 *
 * O que NÃO passa por aqui (e é tratado em browser.ts): QUIC/HTTP3 (desligado),
 * UDP do WebRTC (desligado via flag) e DNS prefetch (desligado).
 */
import http from 'node:http';
import net from 'node:net';
import type { Duplex } from 'node:stream';
import type { AddressPolicy } from './ip';
import { BlockedDestinationError, resolveAllowedAddresses, type Resolver } from './resolve';

const CONNECT_TIMEOUT_MS = 10_000;
const IDLE_SOCKET_TIMEOUT_MS = 30_000;

// Cabeçalhos hop-by-hop que não devem ser repassados ao destino.
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export interface EgressProxyOptions {
  policy: AddressPolicy;
  resolver?: Resolver;
  /** Total de bytes que o destino pode enviar somando todas as conexões. */
  maxBytes: number;
}

export interface EgressProxy {
  /** Para o `proxyServer` do Chromium, ex.: "http://127.0.0.1:53123". */
  readonly url: string;
  /** Hosts recusados pela política (para diferenciar "bloqueado" de "falhou"). */
  readonly blockedHosts: ReadonlySet<string>;
  readonly budgetExceeded: boolean;
  readonly bytesReceived: number;
  close(): Promise<void>;
}

function parseAuthority(authority: string): { host: string; port: number } | null {
  const m = authority.match(/^\[([^\]]+)\]:(\d+)$/) ?? authority.match(/^([^:]+):(\d+)$/);
  if (!m) return null;
  const port = Number(m[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host: m[1].toLowerCase(), port };
}

export async function startEgressProxy(options: EgressProxyOptions): Promise<EgressProxy> {
  const { policy, resolver, maxBytes } = options;
  const sockets = new Set<Duplex>();
  const blockedHosts = new Set<string>();
  let bytesReceived = 0;
  let budgetExceeded = false;

  const track = (socket: Duplex) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  };

  const destroyAll = () => {
    for (const s of sockets) s.destroy();
  };

  // Conta bytes vindos do destino; estourou o orçamento → derruba tudo.
  const countBytes = (chunk: Buffer) => {
    bytesReceived += chunk.length;
    if (bytesReceived > maxBytes && !budgetExceeded) {
      budgetExceeded = true;
      destroyAll();
    }
  };

  async function connectUpstream(host: string, port: number): Promise<net.Socket> {
    let addresses;
    try {
      addresses = await resolveAllowedAddresses(host, port, policy, resolver);
    } catch (err) {
      if (err instanceof BlockedDestinationError) blockedHosts.add(host);
      throw err;
    }
    // Conecta no IP validado — nunca no nome.
    const { address } = addresses[0];
    return new Promise((resolve, reject) => {
      const upstream = net.connect({ host: address, port });
      track(upstream);
      upstream.setTimeout(CONNECT_TIMEOUT_MS, () => upstream.destroy(new Error('connect timeout')));
      upstream.once('connect', () => {
        upstream.setTimeout(IDLE_SOCKET_TIMEOUT_MS, () => upstream.destroy());
        resolve(upstream);
      });
      upstream.once('error', reject);
    });
  }

  const server = http.createServer();
  server.on('connection', (socket) => track(socket));
  server.on('clientError', (_err, socket) => socket.destroy());

  // HTTPS e WebSockets: túnel CONNECT host:porta. O TLS continua ponta a ponta
  // (o Chromium valida o certificado do nome original).
  server.on('connect', async (req: http.IncomingMessage, client: Duplex, head: Buffer) => {
    client.on('error', () => client.destroy());
    const target = parseAuthority(req.url ?? '');
    if (!target || budgetExceeded) {
      client.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    let upstream: net.Socket;
    try {
      upstream = await connectUpstream(target.host, target.port);
    } catch (err) {
      const status = err instanceof BlockedDestinationError ? '403 Forbidden' : '502 Bad Gateway';
      client.end(`HTTP/1.1 ${status}\r\n\r\n`);
      return;
    }
    if (client.destroyed) {
      upstream.destroy();
      return;
    }
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head.length) upstream.write(head);
    upstream.on('data', countBytes);
    upstream.pipe(client);
    client.pipe(upstream);
    upstream.on('error', () => client.destroy());
    upstream.on('close', () => client.destroy());
    client.on('close', () => upstream.destroy());
  });

  // HTTP simples: o Chromium manda a requisição em "absolute-form"
  // (GET http://host/caminho). Repassamos para o IP validado.
  server.on('request', async (req: http.IncomingMessage, res: http.ServerResponse) => {
    let target: URL;
    try {
      target = new URL(req.url ?? '');
    } catch {
      res.writeHead(400).end();
      return;
    }
    // Atenção: para HTTP simples, qualquer resposta que o proxy mandar é
    // tratada pelo Chromium como se fosse a página do site (um 403 daqui
    // viraria uma "análise bem-sucedida" de uma página vazia). Por isso, em
    // caso de recusa/falha, a conexão é derrubada — o navegador vê erro de
    // rede, como com o CONNECT recusado.
    if (target.protocol !== 'http:' || budgetExceeded) {
      req.socket.destroy();
      return;
    }
    const port = target.port ? Number(target.port) : 80;
    const host = target.hostname.replace(/^\[|\]$/g, '').toLowerCase();

    let upstreamSocket: net.Socket;
    try {
      upstreamSocket = await connectUpstream(host, port);
    } catch {
      req.socket.destroy();
      return;
    }

    const headers: http.OutgoingHttpHeaders = {};
    for (const [name, value] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP.has(name) && value !== undefined) headers[name] = value;
    }
    headers.host = target.host;

    const upstreamReq = http.request({
      createConnection: () => upstreamSocket,
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers,
      setHost: false,
    });
    upstreamReq.on('response', (upstreamRes) => {
      const resHeaders: http.OutgoingHttpHeaders = {};
      for (const [name, value] of Object.entries(upstreamRes.headers)) {
        if (!HOP_BY_HOP.has(name) && value !== undefined) resHeaders[name] = value;
      }
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.statusMessage, resHeaders);
      upstreamRes.on('data', countBytes);
      upstreamRes.pipe(res);
      upstreamRes.on('error', () => res.destroy());
    });
    upstreamReq.on('error', () => req.socket.destroy());
    res.on('close', () => upstreamReq.destroy());
    req.pipe(upstreamReq);
  });

  // ws:// em texto puro chegaria como Upgrade; o Chromium usa CONNECT para
  // WebSockets via proxy, então qualquer Upgrade aqui é recusado.
  server.on('upgrade', (_req, socket: Duplex) => socket.destroy());

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as net.AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    blockedHosts,
    get budgetExceeded() {
      return budgetExceeded;
    },
    get bytesReceived() {
      return bytesReceived;
    },
    close: () =>
      new Promise<void>((resolve) => {
        destroyAll();
        server.close(() => resolve());
      }),
  };
}
