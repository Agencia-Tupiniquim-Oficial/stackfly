import { BlockList, isIP } from 'node:net';

// Faixas que nunca devem ser acessadas pelo analisador: loopback, redes
// privadas, link-local (inclui o endpoint de metadados 169.254.169.254),
// CGNAT, multicast, documentação, reservadas etc.
const blockedV4 = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedV4.addSubnet(net, prefix, 'ipv4');
}

// Para IPv6 só aceitamos unicast global (2000::/3), menos as faixas especiais
// dentro dele. Endereços com IPv4 embutido são tratados à parte.
const globalUnicastV6 = new BlockList();
globalUnicastV6.addSubnet('2000::', 3, 'ipv6');

const blockedV6 = new BlockList();
for (const [net, prefix] of [
  ['2001::', 23], // IETF protocol assignments (Teredo, ORCHID, benchmarking…)
  ['2001:db8::', 32], // documentação
  ['2002::', 16], // 6to4 (embute IPv4 arbitrário)
  ['3fff::', 20], // documentação
] as const) {
  blockedV6.addSubnet(net, prefix, 'ipv6');
}

/** Expande um IPv6 (com "::" e/ou IPv4 no final) para 8 grupos de 16 bits. */
export function expandIPv6(address: string): number[] | null {
  let addr = address.toLowerCase();
  if (addr.includes('%')) return null; // zone id — só faz sentido em link-local

  const v4Match = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Match) {
    const octets = v4Match[1].split('.').map(Number);
    if (octets.some((o) => o > 255)) return null;
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    addr = addr.slice(0, -v4Match[1].length) + `${hi}:${lo}`;
  }

  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  const parsed = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return parsed.some(Number.isNaN) ? null : parsed;
}

function embeddedV4(groups: number[]): string {
  const [a, b] = [groups[6], groups[7]];
  return `${a >> 8}.${a & 0xff}.${b >> 8}.${b & 0xff}`;
}

/**
 * true se o endereço é roteável publicamente na internet.
 * Qualquer coisa que não dê para classificar com certeza é tratada como bloqueada.
 */
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !blockedV4.check(ip, 'ipv4');
  if (family !== 6) return false;

  const groups = expandIPv6(ip);
  if (!groups) return false;

  const first80Zero = groups.slice(0, 5).every((g) => g === 0);
  // ::ffff:a.b.c.d (IPv4-mapped) e ::a.b.c.d (IPv4-compatible, obsoleto)
  if (first80Zero && (groups[5] === 0xffff || groups[5] === 0)) {
    if (groups[5] === 0) return false; // inclui :: e ::1
    return isPublicAddress(embeddedV4(groups));
  }
  // NAT64 (64:ff9b::/96): o destino real é o IPv4 embutido
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0)) {
    return isPublicAddress(embeddedV4(groups));
  }

  const canonical = groups.map((g) => g.toString(16)).join(':');
  return globalUnicastV6.check(canonical, 'ipv6') && !blockedV6.check(canonical, 'ipv6');
}

// Portas aceitas para o site analisado e para os recursos que ele carrega.
// Evita usar o analisador como scanner de portas de terceiros.
export const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

/** Política de rede aplicada a toda conexão do navegador. Injetável nos testes. */
export type AddressPolicy = (ip: string, port: number) => boolean;

export const defaultAddressPolicy: AddressPolicy = (ip, port) =>
  ALLOWED_PORTS.has(port) && isPublicAddress(ip);
