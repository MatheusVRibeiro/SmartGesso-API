import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Validação de URL de logo contra SSRF (Server-Side Request Forgery).
 *
 * Permite apenas http/https (data: é tratado à parte pelo caller) e
 * bloqueia IPs privados/loopback/link-local/reservados — tanto em IPs
 * literais quanto após resolução DNS (todos os registros A/AAAA).
 *
 * Falha fechada: URL inválida, scheme não permitido, DNS falho ou
 * qualquer IP bloqueado → retorna false (o caller simplesmente não
 * carrega a logo; o PDF continua sendo gerado sem ela).
 */
export async function isSafeLogoUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname;
  const ip = isIP(hostname);

  if (ip === 4) {
    return !isPrivateIPv4(hostname);
  }
  if (ip === 6) {
    return !isPrivateIPv6(hostname);
  }

  // Hostname: resolve e exige que TODOS os endereços sejam públicos.
  try {
    const records = await lookup(hostname, { all: true });
    return records.every((record) =>
      record.family === 4
        ? !isPrivateIPv4(record.address)
        : !isPrivateIPv6(record.address),
    );
  } catch {
    return false;
  }
}

/** Bloqueia 0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, multicast/reservado. */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** Bloqueia ::/128, ::1, fc00::/7 (unique local), fe80::/10 (link-local), multicast. */
export function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb') ||
    lower.startsWith('ff')
  );
}
